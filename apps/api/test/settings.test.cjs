const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { createServer } = require("node:http");
const { validate } = require("class-validator");
const { SettingsService } = require("../dist/settings/settings.service");
const { SettingsController } = require("../dist/settings/settings.module");
const {
  ApplicationSettingsDto,
  MinioSettingsDto,
} = require("../dist/settings/dto");
const { encryptSecret, decryptSecret } = require("../dist/settings/secret");
const { SessionGuard, AdminGuard } = require("../dist/auth/auth");
process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
function fixture() {
  const rows = new Map();
  const files = new Map();
  const settings = {
    findOneBy: async ({ key }) => rows.get(key),
    save: async (row) => {
      rows.set(row.key, row);
      return row;
    },
  };
  const attachments = {
    findOneBy: async ({ id }) => files.get(id),
    create: (row) => row,
    save: async (row) => {
      const result = { ...row, id: "11111111-1111-4111-8111-111111111111" };
      files.set(result.id, result);
      return result;
    },
  };
  return { service: new SettingsService(settings, attachments), rows, files };
}
const minio = {
  enabled: true,
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  bucket: "attachments",
  region: "us-east-1",
  accessKey: "test-access",
  secretKey: "test-secret",
};
test("secret encryption uses authenticated encryption and detects tampering", () => {
  const ciphertext = encryptSecret("example-secret");
  assert.notEqual(ciphertext, encryptSecret("example-secret"));
  assert.equal(decryptSecret(ciphertext), "example-secret");
  const parts = ciphertext.split(":");
  parts[2] = (parts[2][0] === "0" ? "1" : "0") + parts[2].slice(1);
  assert.throws(() => decryptSecret(parts.join(":")));
});
test("storage never returns secret and blank secret preserves stored value", async () => {
  const { service, rows } = fixture();
  const saved = await service.saveStorage(minio, "user");
  assert.equal(saved.hasSecretKey, true);
  assert.equal("secretKey" in saved, false);
  assert.equal("secretKeyEncrypted" in saved, false);
  const encrypted = rows.get("storage.minio").value.secretKeyEncrypted;
  assert.equal(JSON.stringify(saved).includes("test-secret"), false);
  await service.saveStorage({ ...minio, secretKey: "", port: 9001 }, "user");
  assert.equal(rows.get("storage.minio").value.secretKeyEncrypted, encrypted);
  await service.saveStorage({ ...minio, secretKey: "replacement" }, "user");
  assert.equal(
    decryptSecret(rows.get("storage.minio").value.secretKeyEncrypted),
    "replacement",
  );
});
test("public branding explicitly excludes private and future fields", async () => {
  const { service, rows } = fixture();
  rows.set("application", {
    value: {
      appName: "Factory",
      secretKey: "hidden",
      privateSetting: "hidden",
    },
  });
  assert.deepEqual(
    Object.keys(await service.application()).sort(),
    ["appName", "appSubtitle", "faviconUrl", "iconUrl", "logoUrl"].sort(),
  );
});
test("invalid config and active storage without credentials are rejected", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.saveStorage({ ...minio, secretKey: "" }, "user"),
    (e) => e.getStatus() === 400,
  );
  const invalid = Object.assign(new MinioSettingsDto(), {
    ...minio,
    port: 70000,
    bucket: "Invalid Bucket",
  });
  assert.ok((await validate(invalid)).length >= 2);
  const app = Object.assign(new ApplicationSettingsDto(), {
    appName: " ",
    appSubtitle: "",
    logoUrl: "javascript:alert(1)",
    iconUrl: "",
    faviconUrl: "",
  });
  assert.ok((await validate(app)).length >= 2);
});
test("settings and attachments are admin only; branding is public", () => {
  for (const name of [
    "all",
    "application",
    "minio",
    "test",
    "uploadBrand",
    "upload",
    "attachment",
  ]) {
    const guards = Reflect.getMetadata(
      "__guards__",
      SettingsController.prototype[name],
    );
    assert.ok(guards.includes(SessionGuard));
    assert.ok(guards.includes(AdminGuard));
  }
  assert.equal(
    Reflect.getMetadata("__guards__", SettingsController.prototype.branding),
    undefined,
  );
});
test("private attachments are never exposed through public branding endpoint", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.download("11111111-1111-4111-8111-111111111111", true),
    (e) => e.getStatus() === 404,
  );
  await assert.rejects(
    service.upload(
      {
        originalname: "evil.svg",
        size: 20,
        buffer: Buffer.from("<svg><script/></svg>"),
      },
      "user",
      true,
    ),
    (e) => e.getStatus() === 400,
  );
});
test("MinIO SDK exercises bucket check, upload and download against a local S3 protocol fixture", async () => {
  const objects = new Map();
  const server = createServer((req, res) => {
    if (req.method === "HEAD") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method === "PUT") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        objects.set(req.url, Buffer.concat(chunks));
        res.writeHead(200, { etag: '"test-etag"' });
        res.end();
      });
      return;
    }
    if (req.method === "GET") {
      const body = objects.get(req.url);
      res.writeHead(body ? 200 : 404);
      res.end(body);
      return;
    }
    res.writeHead(204);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { service } = fixture();
    const config = {
      ...minio,
      endPoint: "127.0.0.1",
      port: server.address().port,
    };
    await service.saveStorage(config, "user");
    assert.equal(
      (await service.testStorage({ ...config, secretKey: "" })).success,
      true,
    );
    const buffer = Buffer.from("89504e470d0a1a0a00000000", "hex");
    const result = await service.upload(
      { originalname: "logo.png", size: buffer.length, buffer },
      "user",
      true,
    );
    await service.saveApplication(
      {
        appName: "Factory",
        appSubtitle: "Monitoring",
        logoUrl: result.url,
        iconUrl: "",
        faviconUrl: "",
      },
      "user",
    );
    const download = await service.download(result.id, true);
    const chunks = [];
    for await (const chunk of download.stream) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), buffer);
    await service.saveStorage({ ...config, port: 9001, secretKey: "" }, "user");
    await assert.rejects(
      service.download(result.id, true),
      (e) => e.getStatus() === 409,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
