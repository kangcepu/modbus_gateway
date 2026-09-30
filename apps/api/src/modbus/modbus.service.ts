import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import ModbusRTU from "modbus-serial";
import { Socket } from "net";
import { RtuTcpPort } from "./rtu-tcp-port";
import { ModbusTag } from "./entities/modbus-tag.entity";
import { Telemetry } from "./entities/telemetry.entity";
import { Machine } from "./entities/machine.entity";
import { ModbusGatewayConfig } from "./entities/modbus-gateway.entity";
import { MachineAccess } from "../access/entities/machine-access.entity";
import { DashboardPreference } from "./entities/dashboard.entity";
import {
  DashboardDto,
  DeviceDto,
  GatewayDto,
  HistoryDto,
  MachineDto,
  RawCaptureDto,
  ScanUnitIdsDto,
  TagDto,
  TestConnectionDto,
  UpdateDeviceDto,
  UpdateTagDto,
} from "./dto";

type Actor = {
  id: string;
  role: string;
  roleGroup?: { permissions?: { code: string }[] };
};
type Health = {
  state: "online" | "offline" | "partial" | "waiting";
  lastAttempt: string;
  lastSuccess?: string;
  error?: string;
  tagErrors: Record<string, string>;
};
@Injectable()
export class ModbusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModbusService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private stopped = false;
  private readonly lastPoll = new Map<string, number>();
  private readonly locks = new Set<string>();
  private readonly jobs = new Set<Promise<void>>();
  private readonly health = new Map<string, Health>();
  constructor(
    @InjectRepository(ModbusTag) private tags: Repository<ModbusTag>,
    @InjectRepository(Telemetry) private telemetry: Repository<Telemetry>,
    @InjectRepository(Machine) private machines: Repository<Machine>,
    @InjectRepository(ModbusGatewayConfig)
    private gateways: Repository<ModbusGatewayConfig>,
    @InjectRepository(DashboardPreference)
    private preferences: Repository<DashboardPreference>,
  ) {}
  private canViewAll(user: Actor) {
    return (
      user.role === "admin" ||
      user.roleGroup?.permissions?.some((p) => p.code === "machines.view_all")
    );
  }
  async listGatewaysForUser(user: Actor) {
    if (this.canViewAll(user))
      return this.gateways.find({
        relations: { machines: { tags: true } },
        order: { name: "ASC", machines: { name: "ASC" } },
      });
    return this.gateways
      .createQueryBuilder("gateway")
      .innerJoinAndSelect("gateway.machines", "machine")
      .innerJoin(
        MachineAccess,
        "access",
        "access.machine_id = machine.id AND access.user_id = :userId",
        { userId: user.id },
      )
      .leftJoinAndSelect("machine.tags", "tag")
      .orderBy("gateway.name", "ASC")
      .addOrderBy("machine.name", "ASC")
      .getMany();
  }
  async listDevices(user: Actor) {
    const gateways = await this.listGatewaysForUser(user);
    return gateways.flatMap((g) =>
      g.machines.map((m) => ({
        ...m,
        gatewayId: g.id,
        gatewayName: g.name,
        host: g.host,
        port: g.port,
        transport: g.transport,
        pollIntervalMs: g.pollIntervalMs,
        gatewayEnabled: g.enabled,
        machineEnabled: m.enabled,
        enabled: g.enabled && m.enabled,
        health: this.health.get(m.id) || { state: "waiting", tagErrors: {} },
      })),
    );
  }
  async createGateway(input: GatewayDto) {
    return this.gateways.save(this.gateways.create(input));
  }
  async updateGateway(id: string, input: UpdateDeviceDto) {
    const gateway = await this.gateways.findOneByOrFail({ id });
    const { name, host, port, transport, pollIntervalMs, enabled } = input;
    Object.assign(
      gateway,
      Object.fromEntries(
        Object.entries({
          name,
          host,
          port,
          transport,
          pollIntervalMs,
          enabled,
        }).filter(([, v]) => v !== undefined),
      ),
    );
    this.lastPoll.clear();
    this.health.clear();
    return this.gateways.save(gateway);
  }
  async removeGateway(id: string) {
    await this.gateways.delete(id);
  }
  async createMachine(gatewayId: string, input: MachineDto) {
    await this.gateways.findOneByOrFail({ id: gatewayId });
    if (await this.machines.existsBy({ gatewayId, unitId: input.unitId }))
      throw new ConflictException("Unit ID sudah digunakan pada gateway ini.");
    return this.machines.save(this.machines.create({ ...input, gatewayId }));
  }
  async updateMachine(id: string, input: UpdateDeviceDto) {
    const machine = await this.machines.findOneByOrFail({ id });
    if (
      input.unitId !== undefined &&
      input.unitId !== machine.unitId &&
      (await this.machines.existsBy({
        gatewayId: machine.gatewayId,
        unitId: input.unitId,
      }))
    )
      throw new ConflictException("Unit ID sudah digunakan pada gateway ini.");
    const { name, unitId, location, enabled } = input;
    Object.assign(
      machine,
      Object.fromEntries(
        Object.entries({ name, unitId, location, enabled }).filter(
          ([, v]) => v !== undefined,
        ),
      ),
    );
    this.lastPoll.delete(id);
    this.health.delete(id);
    return this.machines.save(machine);
  }
  async removeMachine(id: string) {
    await this.machines.delete(id);
    this.health.delete(id);
    this.lastPoll.delete(id);
  }
  // Compatibility adapter: the existing form now writes to canonical gateway/machine records.
  async createDevice(input: DeviceDto) {
    return this.machines.manager.transaction(async (manager) => {
      let gateway = await manager.findOneBy(ModbusGatewayConfig, {
        host: input.host,
        port: input.port,
      });
      if (!gateway)
        gateway = await manager.save(
          ModbusGatewayConfig,
          manager.create(ModbusGatewayConfig, {
            name: input.host,
            host: input.host,
            port: input.port,
            transport: input.transport,
            pollIntervalMs: input.pollIntervalMs,
            enabled: true,
          }),
        );
      if (
        await manager.existsBy(Machine, {
          gatewayId: gateway.id,
          unitId: input.unitId,
        })
      )
        throw new ConflictException(
          "Unit ID sudah digunakan pada gateway ini.",
        );
      return manager.save(
        Machine,
        manager.create(Machine, {
          gatewayId: gateway.id,
          name: input.name,
          unitId: input.unitId,
          enabled: input.enabled,
        }),
      );
    });
  }
  async updateDevice(id: string, input: UpdateDeviceDto) {
    const machine = await this.machines.findOneByOrFail({ id });
    await this.machines.manager.transaction(async (manager) => {
      if (
        input.unitId !== undefined &&
        input.unitId !== machine.unitId &&
        (await manager.existsBy(Machine, {
          gatewayId: machine.gatewayId,
          unitId: input.unitId,
        }))
      )
        throw new ConflictException(
          "Unit ID sudah digunakan pada gateway ini.",
        );
      const gatewayChanges = Object.fromEntries(
        Object.entries({
          host: input.host,
          port: input.port,
          transport: input.transport,
          pollIntervalMs: input.pollIntervalMs,
        }).filter(([, v]) => v !== undefined),
      );
      const machineChanges = Object.fromEntries(
        Object.entries({
          name: input.name,
          unitId: input.unitId,
          enabled: input.enabled,
          location: input.location,
        }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(gatewayChanges).length)
        await manager.update(
          ModbusGatewayConfig,
          machine.gatewayId,
          gatewayChanges,
        );
      if (Object.keys(machineChanges).length)
        await manager.update(Machine, id, machineChanges);
    });
    this.health.clear();
    this.lastPoll.clear();
    return this.machines.findOneByOrFail({ id });
  }
  private validateTag(
    input: Pick<ModbusTag, "address" | "functionCode" | "dataType">,
  ) {
    if ([1, 2].includes(input.functionCode) !== (input.dataType === "coil"))
      throw new BadRequestException(
        "FC1/FC2 memakai tipe coil; FC3/FC4 memakai tipe register numerik.",
      );
    if (
      input.address === 65535 &&
      ["uint32", "int32", "float32"].includes(input.dataType)
    )
      throw new BadRequestException(
        "Tipe 32-bit membutuhkan dua alamat register (maksimum alamat awal 65534).",
      );
  }
  async createMachineTag(machineId: string, input: TagDto) {
    await this.machines.findOneByOrFail({ id: machineId });
    this.validateTag(input);
    if (await this.tags.existsBy({ machineId, name: input.name }))
      throw new ConflictException(
        "Nama register sudah digunakan pada mesin ini.",
      );
    return this.tags.save(this.tags.create({ ...input, machineId }));
  }
  async updateTag(id: string, input: UpdateTagDto) {
    const tag = await this.tags.findOneByOrFail({ id });
    this.validateTag({ ...tag, ...input });
    if (
      input.name &&
      input.name !== tag.name &&
      (await this.tags.existsBy({ machineId: tag.machineId, name: input.name }))
    )
      throw new ConflictException(
        "Nama register sudah digunakan pada mesin ini.",
      );
    Object.assign(tag, input);
    return this.tags.save(tag);
  }
  async removeTag(id: string) {
    await this.tags.delete(id);
  }
  private telemetryQuery(user: Actor) {
    const query = this.telemetry
      .createQueryBuilder("t")
      .innerJoinAndSelect("t.tag", "tag")
      .innerJoinAndSelect("tag.machine", "machine");
    if (!this.canViewAll(user))
      query.innerJoin(
        MachineAccess,
        "access",
        "access.machine_id = machine.id AND access.user_id = :userId",
        { userId: user.id },
      );
    return query;
  }
  async latestForUser(user: Actor) {
    return this.telemetryQuery(user)
      .distinctOn(["t.tag_id"])
      .orderBy("t.tagId")
      .addOrderBy("t.recordedAt", "DESC")
      .getMany();
  }
  async recentTelemetry(user: Actor) {
    return this.telemetryQuery(user)
      .orderBy("t.recordedAt", "DESC")
      .take(100)
      .getMany();
  }
  async history(user: Actor, input: HistoryDto) {
    const devices = await this.listDevices(user);
    if (!devices.some((d) => d.tags.some((t) => t.id === input.tagId)))
      throw new NotFoundException(
        "Register tidak ditemukan atau tidak dapat diakses.",
      );
    const seconds = Math.max(1, Math.ceil((input.minutes * 60) / 180));
    return this.telemetry.query(
      `SELECT to_timestamp(floor(extract(epoch FROM recorded_at)/$2)*$2) AS "recordedAt", avg(value)::double precision AS value, min(value)::double precision AS minimum, max(value)::double precision AS maximum FROM telemetry WHERE tag_id=$1 AND recorded_at>=now()-($3 * interval '1 minute') GROUP BY 1 ORDER BY 1 LIMIT 181`,
      [input.tagId, seconds, input.minutes],
    );
  }
  async dashboard(user: Actor) {
    const saved = await this.preferences.findOneBy({ userId: user.id });
    const allowed = new Set(
      (await this.listDevices(user)).flatMap((d) => d.tags.map((t) => t.id)),
    );
    return saved
      ? {
          ...saved.config,
          widgets: saved.config.widgets.filter((w) => allowed.has(w.tagId)),
          saved: true,
        }
      : { refreshSeconds: 5, columns: 3, widgets: [], saved: false };
  }
  async saveDashboard(user: Actor, input: DashboardDto) {
    const allowed = new Set(
      (await this.listDevices(user)).flatMap((d) => d.tags.map((t) => t.id)),
    );
    for (const widget of input.widgets) {
      if (!allowed.has(widget.tagId))
        throw new BadRequestException(
          "Salah satu register tidak tersedia atau tidak dapat diakses. Muat ulang dashboard.",
        );
      if (widget.type === "gauge" && widget.max <= widget.min)
        throw new BadRequestException(
          "Batas maksimum gauge harus lebih besar dari minimum.",
        );
    }
    await this.preferences.save({ userId: user.id, config: input });
    return { ...input, saved: true };
  }
  private endpoint(device: { host: string; port: number }) {
    return `${device.host}:${device.port}`;
  }
  // "rtu" targets transparent serial-to-Ethernet converters (e.g. USR-TCP232-306 in
  // TCP Server mode): they relay raw bytes, so we tunnel actual RTU frames
  // (address+PDU+CRC16) via RtuTcpPort instead of wrapping requests in a Modbus
  // TCP MBAP header. modbus-serial's own connectTcpRTUBuffered still adds an MBAP
  // header on the wire (it only differs from connectTCP in response parsing), so
  // it does not work against a transparent converter.
  private connect(
    client: ModbusRTU,
    g: { host: string; port: number; transport: string },
  ) {
    if (g.transport !== "rtu") return client.connectTCP(g.host, { port: g.port });
    (client as unknown as { _port: RtuTcpPort })._port = new RtuTcpPort(
      g.host,
      {
        port: g.port,
        timeout: (client as unknown as { _timeout?: number })._timeout,
      },
    );
    return new Promise<void>((resolve, reject) => {
      client.open((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
  private async target(id: string) {
    return this.machines.findOneOrFail({
      where: { id },
      relations: { gateway: true },
    });
  }
  // Protocol-agnostic diagnostic: connects a plain TCP socket to the gateway
  // and records every raw byte exchanged, with no Modbus framing assumed.
  // Used to determine what a device actually speaks when it doesn't respond
  // to Modbus TCP/RTU at all (e.g. a proprietary "kiln bus" protocol).
  async rawCapture(id: string, input: RawCaptureDto) {
    const machine = await this.target(id);
    const g = machine.gateway;
    const key = this.endpoint(g);
    if (this.locks.has(key))
      throw new ConflictException(
        "Gateway sedang dipoll atau diuji. Coba kembali beberapa saat lagi.",
      );
    this.locks.add(key);
    const events: {
      at: string;
      direction: "rx" | "tx";
      hex: string;
      length: number;
    }[] = [];
    const socket = new Socket();
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.connect(g.port, g.host, () => {
          socket.removeListener("error", reject);
          resolve();
        });
      });
      socket.on("data", (data: Buffer) => {
        events.push({
          at: new Date().toISOString(),
          direction: "rx",
          hex: data.toString("hex"),
          length: data.length,
        });
      });
      this.logger.log(
        `Raw capture: terhubung ke ${key}, merekam ${input.durationMs}ms.`,
      );
      if (input.probeHex) {
        const probe = Buffer.from(input.probeHex, "hex");
        socket.write(probe);
        events.push({
          at: new Date().toISOString(),
          direction: "tx",
          hex: probe.toString("hex"),
          length: probe.length,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, input.durationMs));
      return {
        host: g.host,
        port: g.port,
        events,
        totalBytesReceived: events
          .filter((e) => e.direction === "rx")
          .reduce((sum, e) => sum + e.length, 0),
        message: events.some((e) => e.direction === "rx")
          ? `Menerima ${events.filter((e) => e.direction === "rx").length} paket data mentah.`
          : "Tidak ada data masuk selama perekaman. Perangkat tidak mengirim apa pun, baik unsolicited maupun sebagai balasan probe.",
      };
    } catch (e) {
      throw new BadRequestException(
        `Gateway TCP tidak dapat dihubungi: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    } finally {
      socket.destroy();
      this.locks.delete(key);
    }
  }
  async testConnection(id: string, input: TestConnectionDto) {
    const machine = await this.target(id);
    const g = machine.gateway;
    const key = this.endpoint(g);
    if (this.locks.has(key))
      throw new ConflictException(
        "Gateway sedang dipoll atau diuji. Coba kembali beberapa saat lagi.",
      );
    const client = new ModbusRTU();
    const unitId = input.unitId ?? machine.unitId;
    this.locks.add(key);
    client.setTimeout(input.timeoutMs);
    try {
      await this.connect(client, g);
      client.setID(unitId);
      try {
        const values = await this.readByFunction(
          client,
          input.functionCode,
          input.address,
        );
        return {
          tcpConnected: true,
          modbusResponded: true,
          unitId,
          values,
          message: `TCP terhubung; Unit ID ${unitId} merespons FC${input.functionCode} pada alamat ${input.address}.`,
        };
      } catch {
        return {
          tcpConnected: true,
          modbusResponded: false,
          unitId,
          message:
            "TCP terhubung, tetapi pembacaan Modbus gagal. Periksa Unit ID, function code, dan alamat register.",
        };
      }
    } catch {
      return {
        tcpConnected: false,
        modbusResponded: false,
        unitId,
        message: "Gateway TCP tidak dapat dihubungi.",
      };
    } finally {
      client.close(() => undefined);
      this.locks.delete(key);
    }
  }
  async scanUnitIds(id: string, input: ScanUnitIdsDto) {
    if (input.from > input.to || input.to - input.from > 31)
      throw new BadRequestException(
        "Pindai maksimal 32 Unit ID sekaligus dengan rentang yang benar.",
      );
    const machine = await this.target(id);
    const g = machine.gateway;
    const key = this.endpoint(g);
    if (this.locks.has(key))
      throw new ConflictException(
        "Gateway sedang dipoll atau diuji. Coba kembali.",
      );
    const client = new ModbusRTU();
    const found: number[] = [];
    this.locks.add(key);
    client.setTimeout(input.timeoutMs);
    try {
      await this.connect(client, g);
      for (let unitId = input.from; unitId <= input.to; unitId++) {
        try {
          client.setID(unitId);
          await this.readByFunction(client, input.functionCode, input.address);
          found.push(unitId);
        } catch {}
      }
      return {
        found,
        message: found.length
          ? `Unit ID merespons: ${found.join(", ")}.`
          : "Tidak ada respons pada register yang diuji. Hasil ini tidak memastikan bahwa mesin tidak ada.",
      };
    } catch {
      throw new BadRequestException("Gateway tidak dapat dihubungi.");
    } finally {
      client.close(() => undefined);
      this.locks.delete(key);
    }
  }
  onModuleInit() {
    this.timer = setInterval(() => void this.poll(), 500);
    void this.poll();
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.jobs]);
  }
  private async poll() {
    if (this.stopped || this.ticking) return;
    this.ticking = true;
    try {
      const gateways = await this.gateways.find({
        where: { enabled: true },
        relations: { machines: { tags: true } },
        order: { machines: { name: "ASC" } },
      });
      const groups = new Map<
        string,
        { gateway: ModbusGatewayConfig; due: Machine[]; oldest: number }
      >();
      for (const g of gateways) {
        const key = this.endpoint(g);
        const due = g.machines.filter(
          (m) =>
            m.enabled &&
            m.tags.some((t) => t.enabled) &&
            Date.now() - (this.lastPoll.get(m.id) || 0) >= g.pollIntervalMs,
        );
        if (!due.length) continue;
        const group = groups.get(key) || {
          gateway: g,
          due: [],
          oldest: Infinity,
        };
        group.due.push(...due);
        group.oldest = Math.min(
          group.oldest,
          ...due.map((m) => this.lastPoll.get(m.id) || 0),
        );
        groups.set(key, group);
      }
      for (const [key, { gateway: g, due }] of [...groups.entries()].sort(
        (a, b) => a[1].oldest - b[1].oldest,
      )) {
        if (this.stopped || this.jobs.size >= 4) break;
        if (this.locks.has(key)) continue;
        this.locks.add(key);
        due.forEach((m) => this.lastPoll.set(m.id, Date.now()));
        const job = this.pollGateway(g, due)
          .catch((e) =>
            this.logger.warn(e instanceof Error ? e.message : "Polling gagal"),
          )
          .finally(() => {
            this.locks.delete(key);
            this.jobs.delete(job);
          });
        this.jobs.add(job);
      }
    } catch (e) {
      this.logger.warn(
        e instanceof Error ? e.message : "Gagal memuat konfigurasi polling",
      );
    } finally {
      this.ticking = false;
    }
  }
  private async pollGateway(g: ModbusGatewayConfig, machines: Machine[]) {
    const client = new ModbusRTU();
    client.setTimeout(1000);
    try {
      await this.connect(client, g);
      for (const machine of machines) {
        if (this.stopped) break;
        client.setID(machine.unitId);
        let success = 0;
        const tagErrors: Record<string, string> = {};
        for (const tag of machine.tags.filter((t) => t.enabled)) {
          if (this.stopped) break;
          try {
            const value = this.decode(await this.read(client, tag), tag);
            if (!Number.isFinite(value))
              throw new Error("Nilai register bukan angka finite.");
            await this.telemetry.save(
              this.telemetry.create({ tagId: tag.id, value }),
            );
            success++;
          } catch (e) {
            tagErrors[tag.id] =
              e instanceof Error ? e.message : "Pembacaan gagal";
          }
        }
        const now = new Date().toISOString();
        this.health.set(machine.id, {
          state: Object.keys(tagErrors).length
            ? success
              ? "partial"
              : "offline"
            : "online",
          lastAttempt: now,
          lastSuccess: success ? now : this.health.get(machine.id)?.lastSuccess,
          error: Object.values(tagErrors)[0],
          tagErrors,
        });
      }
    } catch (e) {
      for (const m of machines)
        this.health.set(m.id, {
          state: "offline",
          lastAttempt: new Date().toISOString(),
          lastSuccess: this.health.get(m.id)?.lastSuccess,
          error: e instanceof Error ? e.message : "Gateway tidak merespons",
          tagErrors: {},
        });
    } finally {
      client.close(() => undefined);
    }
  }
  private async read(c: ModbusRTU, t: ModbusTag) {
    return this.readByFunction(
      c,
      t.functionCode,
      t.address,
      ["uint32", "int32", "float32"].includes(t.dataType) ? 2 : 1,
    );
  }
  private async readByFunction(
    c: ModbusRTU,
    fc: number,
    address: number,
    count = 1,
  ): Promise<number[]> {
    if (fc === 1) return (await c.readCoils(address, count)).data.map(Number);
    if (fc === 2)
      return (await c.readDiscreteInputs(address, count)).data.map(Number);
    if (fc === 4) return (await c.readInputRegisters(address, count)).data;
    return (await c.readHoldingRegisters(address, count)).data;
  }
  private decode(words: number[], tag: ModbusTag) {
    const b = Buffer.alloc(words.length * 2);
    words.forEach((w, i) => b.writeUInt16BE(w, i * 2));
    let value: number;
    if (tag.dataType === "int16") value = b.readInt16BE();
    else if (tag.dataType === "uint32") value = b.readUInt32BE();
    else if (tag.dataType === "int32") value = b.readInt32BE();
    else if (tag.dataType === "float32") value = b.readFloatBE();
    else value = words[0];
    return value * Number(tag.scale);
  }
}
