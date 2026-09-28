import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Client } from "minio";
import {
  Agent as HttpAgent,
  request as httpRequest,
  RequestOptions,
  IncomingMessage,
} from "http";
import { Agent as HttpsAgent, request as httpsRequest } from "https";
import { randomUUID } from "crypto";
import { isIP } from "net";
import { Attachment, SystemSetting } from "./entities";
import { ApplicationSettingsDto, MinioSettingsDto } from "./dto";
import { decryptSecret, encryptSecret } from "./secret";

export const DEFAULT_APPLICATION: ApplicationSettingsDto = {
  appName: "MONTARA",
  appSubtitle: "Modbus Monitoring System",
  logoUrl: "",
  iconUrl: "",
  faviconUrl: "",
};
const DEFAULT_STORAGE = {
  enabled: false,
  endPoint: "",
  port: 9000,
  useSSL: false,
  bucket: "attachments",
  region: "us-east-1",
  accessKey: "",
  secretKeyEncrypted: "",
};
type StorageConfig = typeof DEFAULT_STORAGE;
export type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private settings: Repository<SystemSetting>,
    @InjectRepository(Attachment) private attachments: Repository<Attachment>,
  ) {}
  async application(): Promise<ApplicationSettingsDto> {
    const row = await this.settings.findOneBy({ key: "application" });
    const value = { ...DEFAULT_APPLICATION, ...row?.value };
    // Explicit public projection: future private settings must never leak here.
    return {
      appName: value.appName,
      appSubtitle: value.appSubtitle,
      logoUrl: value.logoUrl,
      iconUrl: value.iconUrl,
      faviconUrl: value.faviconUrl,
    };
  }
  async saveApplication(input: ApplicationSettingsDto, userId: string) {
    for (const url of [input.logoUrl, input.iconUrl, input.faviconUrl]) {
      if (url.startsWith("/api/settings/assets/")) {
        const asset = await this.attachments.findOneBy({
          id: url.split("/").pop()!,
        });
        if (!asset || !asset.mimeType.startsWith("image/"))
          throw new BadRequestException("File branding tidak ditemukan.");
      } else if (url) {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          throw new BadRequestException("URL gambar tidak valid.");
        }
        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password
        )
          throw new BadRequestException(
            "Gunakan URL gambar HTTP/HTTPS tanpa kredensial.",
          );
      }
    }
    await this.settings.save({
      key: "application",
      value: { ...input, appName: input.appName.trim() },
      updatedBy: userId,
    });
    return this.application();
  }
  private async storage(): Promise<StorageConfig> {
    const row = await this.settings.findOneBy({ key: "storage.minio" });
    return { ...DEFAULT_STORAGE, ...row?.value };
  }
  async publicStorage() {
    const { secretKeyEncrypted, ...config } = await this.storage();
    return { ...config, hasSecretKey: Boolean(secretKeyEncrypted) };
  }
  private async candidate(input: MinioSettingsDto): Promise<StorageConfig> {
    const current = await this.storage();
    const { secretKey, ...values } = input;
    const config = {
      ...values,
      secretKeyEncrypted: secretKey
        ? encryptSecret(secretKey)
        : current.secretKeyEncrypted,
    };
    if (
      config.enabled &&
      (!config.endPoint || !config.accessKey || !config.secretKeyEncrypted)
    )
      throw new BadRequestException(
        "Endpoint, access key, dan secret key wajib diisi untuk mengaktifkan MinIO.",
      );
    if (
      config.endPoint &&
      !isIP(config.endPoint) &&
      !config.endPoint
        .split(".")
        .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
    )
      throw new BadRequestException(
        "Endpoint harus berupa hostname atau IP yang valid, tanpa scheme dan port.",
      );
    if (
      config.bucket.includes("..") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(config.bucket)
    )
      throw new BadRequestException("Nama bucket tidak valid.");
    return config;
  }
  async saveStorage(input: MinioSettingsDto, userId: string) {
    const config = await this.candidate(input);
    await this.settings.save({
      key: "storage.minio",
      value: { ...config },
      updatedBy: userId,
    });
    return this.publicStorage();
  }
  private client(config: StorageConfig) {
    if (!config.endPoint || !config.accessKey || !config.secretKeyEncrypted)
      throw new BadRequestException("Konfigurasi MinIO belum lengkap.");
    const agent = config.useSSL
      ? new HttpsAgent({ timeout: 10000 })
      : new HttpAgent({ timeout: 10000 });
    const transport = {
      request: ((
        options: RequestOptions,
        callback?: (response: IncomingMessage) => void,
      ) => {
        const req = (config.useSSL ? httpsRequest : httpRequest)(
          options,
          callback,
        );
        const timer = setTimeout(
          () => req.destroy(new Error("MinIO request timeout")),
          15000,
        );
        req.once("close", () => clearTimeout(timer));
        return req;
      }) as typeof httpRequest,
    };
    return new Client({
      transport,
      retryOptions: { maximumRetryCount: 0 },
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: decryptSecret(config.secretKeyEncrypted),
      region: config.region || "us-east-1",
      transportAgent: agent,
    });
  }
  async testStorage(input: MinioSettingsDto) {
    const config = await this.candidate(input);
    const client = this.client(config);
    try {
      if (!(await client.bucketExists(config.bucket)))
        throw new BadRequestException(
          "Server dapat dihubungi, tetapi bucket tidak ditemukan. Buat bucket tersebut di MinIO terlebih dahulu.",
        );
      return {
        success: true,
        message:
          "Koneksi dan akses bucket berhasil. Uji upload memastikan izin tulis.",
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException(
        "MinIO tidak dapat diakses. Periksa endpoint, TLS, kredensial, dan izin bucket.",
      );
    }
  }
  async upload(
    file: UploadedFile | undefined,
    userId: string,
    branding = false,
  ) {
    if (!file?.size)
      throw new BadRequestException("Pilih file yang akan diunggah.");
    let mime = "application/octet-stream";
    if (
      file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mime = "image/png";
    else if (
      file.buffer[0] === 255 &&
      file.buffer[1] === 216 &&
      file.buffer[2] === 255
    )
      mime = "image/jpeg";
    else if (
      file.buffer.toString("ascii", 0, 4) === "RIFF" &&
      file.buffer.toString("ascii", 8, 12) === "WEBP"
    )
      mime = "image/webp";
    else if (file.buffer.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])))
      mime = "image/x-icon";
    if (branding && (!mime.startsWith("image/") || file.size > 2 * 1024 * 1024))
      throw new BadRequestException(
        "Logo/icon harus PNG, JPG, WebP, atau ICO dengan ukuran maksimal 2 MB.",
      );
    const config = await this.storage();
    if (!config.enabled)
      throw new BadRequestException(
        "Aktifkan dan simpan konfigurasi MinIO terlebih dahulu.",
      );
    const client = this.client(config);
    const objectKey = `${branding ? "branding" : "attachments"}/${randomUUID()}`;
    try {
      await client.putObject(config.bucket, objectKey, file.buffer, file.size, {
        "Content-Type": mime,
      });
    } catch {
      throw new ServiceUnavailableException(
        "Upload gagal. Periksa koneksi dan izin tulis bucket MinIO.",
      );
    }
    let result: Attachment;
    try {
      result = await this.attachments.save(
        this.attachments.create({
          originalName: file.originalname.slice(0, 255),
          objectKey,
          bucket: config.bucket,
          endpoint: config.endPoint,
          port: config.port,
          useSSL: config.useSSL,
          mimeType: mime,
          size: file.size,
          createdBy: userId,
        }),
      );
    } catch (error) {
      await client
        .removeObject(config.bucket, objectKey)
        .catch(() => undefined);
      throw error;
    }
    return {
      id: result.id,
      name: result.originalName,
      size: result.size,
      url: branding
        ? `/api/settings/assets/${result.id}`
        : `/api/settings/attachments/${result.id}`,
    };
  }
  async download(id: string, publicAsset = false) {
    if (publicAsset) {
      const branding = await this.application();
      if (
        ![branding.logoUrl, branding.iconUrl, branding.faviconUrl].includes(
          `/api/settings/assets/${id}`,
        )
      )
        throw new NotFoundException();
    }
    const attachment = await this.attachments.findOneBy({ id });
    if (!attachment) throw new NotFoundException();
    const config = await this.storage();
    if (
      config.endPoint !== attachment.endpoint ||
      config.port !== attachment.port ||
      config.useSSL !== attachment.useSSL
    )
      throw new ConflictException(
        "File tersimpan pada endpoint MinIO sebelumnya. Pulihkan konfigurasi atau migrasikan file.",
      );
    try {
      return {
        file: attachment,
        stream: await this.client(config).getObject(
          attachment.bucket,
          attachment.objectKey,
        ),
      };
    } catch {
      throw new ServiceUnavailableException(
        "File tidak dapat dibaca dari MinIO.",
      );
    }
  }
}
