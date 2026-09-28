const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const ModbusRTU = require("modbus-serial");
const { validate } = require("class-validator");
const { plainToInstance } = require("class-transformer");
const ds = require("../dist/database/data-source").default;
const { ModbusService } = require("../dist/modbus/modbus.service");
const { ModbusTag } = require("../dist/modbus/entities/modbus-tag.entity");
const { Machine } = require("../dist/modbus/entities/machine.entity");
const {
  ModbusGatewayConfig,
} = require("../dist/modbus/entities/modbus-gateway.entity");
const { Telemetry } = require("../dist/modbus/entities/telemetry.entity");
const {
  DashboardPreference,
} = require("../dist/modbus/entities/dashboard.entity");
const { DashboardDto, UpdateDeviceDto } = require("../dist/modbus/dto");
test("dashboard input validates nested widgets, unique IDs and refresh bounds", async () => {
  const id = randomUUID(),
    widget = {
      id,
      tagId: randomUUID(),
      type: "invalid",
      title: "",
      min: 0,
      max: 100,
      wide: false,
    };
  const dto = plainToInstance(DashboardDto, {
    refreshSeconds: 0,
    columns: 8,
    widgets: [widget, widget],
  });
  assert.ok((await validate(dto)).length >= 3);
  const patch = plainToInstance(UpdateDeviceDto, { name: "Only name" });
  assert.equal(patch.enabled, undefined);
  assert.equal(patch.unitId, undefined);
  assert.deepEqual(await validate(patch), []);
});
test("canonical machines, multi-unit Modbus polling, history, access scope, and per-user dashboard persist in PostgreSQL", async () => {
  const reservation = require("node:net").createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const freePort = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const requests = [];
  const server = new ModbusRTU.ServerTCP(
    {
      getHoldingRegister: (address, unit, callback) => {
        requests.push({ address, unit });
        if (address === 99) return callback({ modbusErrorCode: 2 });
        if (address === 1) return callback(null, 0xfffe);
        if (address === 10) return callback(null, 0x422a);
        if (address === 11) return callback(null, 0);
        callback(null, unit * 10);
      },
      getInputRegister: () => 77,
      getCoil: () => true,
      getDiscreteInput: () => false,
    },
    { host: "127.0.0.1", port: freePort, unitID: 255 },
  );
  server.on("socketError", () => {});
  await Promise.race([
    once(server, "initialized"),
    once(server, "serverError").then(([e]) => {
      throw e;
    }),
  ]);
  const port = server._server.address().port;
  await ds.initialize();
  const runner = ds.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  const admin = { id: randomUUID(), role: "admin" },
    operator = { id: randomUUID(), role: "operator" };
  const service = new ModbusService(
    runner.manager.getRepository(ModbusTag),
    runner.manager.getRepository(Telemetry),
    runner.manager.getRepository(Machine),
    runner.manager.getRepository(ModbusGatewayConfig),
    runner.manager.getRepository(DashboardPreference),
  );
  try {
    for (const u of [admin, operator])
      await runner.query(
        "INSERT INTO app_users(id,name,username,password_hash,role) VALUES($1,$2,$3,$4,$5)",
        [
          u.id,
          "Dashboard test",
          `test-${u.id}`,
          "not-a-login-password",
          u.role,
        ],
      );
    const gateway = await service.createGateway({
      name: "Simulator",
      host: "127.0.0.1",
      port,
      pollIntervalMs: 1000,
      enabled: true,
    });
    const one = await service.createMachine(gateway.id, {
      name: "Machine A",
      unitId: 1,
      enabled: true,
    });
    const two = await service.createDevice({
      name: "Machine B",
      host: "127.0.0.1",
      port,
      unitId: 2,
      pollIntervalMs: 1000,
      enabled: true,
    });
    assert.equal(two.gatewayId, gateway.id);
    assert.equal(
      await runner.manager
        .getRepository(Machine)
        .countBy({ gatewayId: gateway.id }),
      2,
    );
    const specs = [
      ["value", 0, 3, "uint16", 1],
      ["signed", 1, 3, "int16", 2],
      ["float", 10, 3, "float32", 1],
      ["input", 0, 4, "uint16", 1],
      ["coil", 0, 1, "coil", 1],
      ["discrete", 0, 2, "coil", 1],
      ["bad", 99, 3, "uint16", 1],
    ];
    const tags = [];
    for (const [name, address, functionCode, dataType, scale] of specs)
      tags.push(
        await service.createMachineTag(one.id, {
          name,
          address,
          functionCode,
          dataType,
          scale,
          enabled: true,
        }),
      );
    const other = await service.createMachineTag(two.id, {
      name: "other",
      address: 0,
      functionCode: 3,
      dataType: "uint16",
      scale: 1,
      enabled: true,
    });
    const machines = await runner.manager
      .getRepository(Machine)
      .find({ where: { gatewayId: gateway.id }, relations: { tags: true } });
    await service.pollGateway(gateway, machines);
    const readings = await service.latestForUser(admin);
    const values = new Map(readings.map((r) => [r.tagId, Number(r.value)]));
    assert.equal(values.get(tags[0].id), 10);
    assert.equal(values.get(tags[1].id), -4);
    assert.equal(values.get(tags[2].id), 42.5);
    assert.equal(values.get(tags[3].id), 77);
    assert.equal(values.get(tags[4].id), 1);
    assert.equal(values.get(tags[5].id), 0);
    assert.equal(values.get(other.id), 20);
    assert.equal(values.has(tags[6].id), false);
    assert.equal(service.health.get(one.id).state, "partial");
    assert.equal(service.health.get(two.id).state, "online");
    assert.ok(
      requests.some((r) => r.unit === 1) && requests.some((r) => r.unit === 2),
    );
    assert.equal((await service.listDevices(operator)).length, 0);
    await assert.rejects(
      service.history(operator, { tagId: tags[0].id, minutes: 60 }),
      (e) => e.getStatus() === 404,
    );
    await runner.query(
      "INSERT INTO machine_access(user_id,machine_id,access) VALUES($1,$2,$3)",
      [operator.id, one.id, "view"],
    );
    assert.deepEqual(
      (await service.listDevices(operator)).map((d) => d.id),
      [one.id],
    );
    assert.ok(
      (await service.latestForUser(operator)).every(
        (r) => r.tag.machineId === one.id,
      ),
    );
    assert.ok(
      (await service.recentTelemetry(operator)).every(
        (r) => r.tag.machineId === one.id,
      ),
    );
    const history = await service.history(operator, {
      tagId: tags[0].id,
      minutes: 60,
    });
    assert.equal(history.length, 1);
    assert.equal(Number(history[0].value), 10);
    const config = {
      refreshSeconds: 2,
      columns: 2,
      widgets: [
        {
          id: randomUUID(),
          tagId: tags[0].id,
          title: "Temperature",
          type: "gauge",
          min: 0,
          max: 100,
          wide: true,
        },
      ],
    };
    await service.saveDashboard(operator, config);
    assert.equal(
      (await service.dashboard(operator)).widgets[0].title,
      "Temperature",
    );
    assert.equal((await service.dashboard(admin)).saved, false);
    await assert.rejects(
      service.saveDashboard(operator, {
        ...config,
        widgets: [{ ...config.widgets[0], tagId: other.id }],
      }),
      (e) => e.getStatus() === 400,
    );
    await assert.rejects(
      service.saveDashboard(operator, {
        ...config,
        widgets: [{ ...config.widgets[0], max: 0 }],
      }),
      (e) => e.getStatus() === 400,
    );
    await runner.query("DELETE FROM machine_access WHERE user_id=$1", [
      operator.id,
    ]);
    assert.deepEqual((await service.dashboard(operator)).widgets, []);
    const result = await service.testConnection(two.id, {
      functionCode: 3,
      address: 0,
      timeoutMs: 500,
    });
    assert.equal(result.modbusResponded, true);
    assert.deepEqual(result.values, [20]);
    const scan = await service.scanUnitIds(two.id, {
      from: 1,
      to: 2,
      functionCode: 3,
      address: 0,
      timeoutMs: 100,
    });
    assert.deepEqual(scan.found, [1, 2]);
    await service.updateDevice(two.id, { enabled: false });
    assert.equal(
      (await service.listDevices(admin)).find((d) => d.id === two.id).enabled,
      false,
    );
    await service.updateTag(tags[0].id, { name: "renamed" });
    assert.equal(
      (
        await runner.manager
          .getRepository(ModbusTag)
          .findOneBy({ id: tags[0].id })
      ).functionCode,
      3,
    );
    await assert.rejects(
      service.createMachineTag(one.id, {
        name: "badtype",
        address: 0,
        functionCode: 1,
        dataType: "float32",
        scale: 1,
        enabled: true,
      }),
      (e) => e.getStatus() === 400,
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
    await ds.destroy();
    for (const socket of server.socks.keys()) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("scheduler groups the same TCP endpoint and limits concurrent gateways", async () => {
  const groups = Array.from({ length: 6 }, (_, i) => ({
    id: `g${i}`,
    host: `host${i}`,
    port: 502,
    pollIntervalMs: 1000,
    enabled: true,
    machines: [{ id: `m${i}`, enabled: true, tags: [{ enabled: true }] }],
  }));
  groups.push({
    ...groups[0],
    id: "duplicate",
    machines: [{ id: "extra-unit", enabled: true, tags: [{ enabled: true }] }],
  });
  const service = new ModbusService(
    {},
    {},
    {},
    { find: async () => groups },
    {},
  );
  const seen = [];
  let release;
  const pending = new Promise((resolve) => (release = resolve));
  service.pollGateway = async (g, m) => {
    seen.push({ host: g.host, machines: m });
    await pending;
  };
  await service.poll();
  assert.equal(seen.length, 4);
  assert.equal(seen[0].machines.length, 2);
  assert.equal(service.jobs.size, 4);
  release();
  await Promise.all([...service.jobs]);
  assert.equal(service.locks.size, 0);
  await service.poll();
  await Promise.all([...service.jobs]);
  assert.ok(seen.some((g) => g.host === "host5"));
});

test("a connected but silent Modbus gateway times out and reports offline", async () => {
  const sockets = [];
  const server = require("node:net").createServer((socket) =>
    sockets.push(socket),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const service = new ModbusService({}, {}, {}, {}, {});
  const machine = {
    id: "silent",
    unitId: 1,
    tags: [
      {
        id: "tag",
        address: 0,
        functionCode: 3,
        dataType: "uint16",
        scale: 1,
        enabled: true,
      },
    ],
  };
  try {
    const start = Date.now();
    await service.pollGateway(
      { host: "127.0.0.1", port: server.address().port },
      [machine],
    );
    assert.ok(Date.now() - start < 4000);
    assert.equal(service.health.get(machine.id).state, "offline");
    assert.ok(service.health.get(machine.id).tagErrors.tag);
  } finally {
    sockets.forEach((socket) => socket.destroy());
    await new Promise((resolve) => server.close(resolve));
  }
});
