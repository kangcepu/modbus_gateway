import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemSettings1720000004000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "system_settings" (
      "key" varchar(64) PRIMARY KEY, "value" jsonb NOT NULL DEFAULT '{}',
      "updated_by" uuid REFERENCES "app_users"("id") ON DELETE SET NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`INSERT INTO "system_settings" ("key", "value") VALUES
      ('application', '{"appName":"MONTARA","appSubtitle":"Modbus Monitoring System","logoUrl":"","iconUrl":"","faviconUrl":""}'),
      ('storage.minio', '{"enabled":false,"endPoint":"","port":9000,"useSSL":false,"bucket":"attachments","region":"us-east-1","accessKey":"","secretKeyEncrypted":""}')`);
    await q.query(`CREATE TABLE "attachments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "original_name" varchar(255) NOT NULL,
      "object_key" varchar NOT NULL UNIQUE, "bucket" varchar NOT NULL,
      "endpoint" varchar NOT NULL, "port" integer NOT NULL, "use_ssl" boolean NOT NULL,
      "mime_type" varchar NOT NULL, "size" integer NOT NULL,
      "created_by" uuid REFERENCES "app_users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "attachments"');
    await q.query('DROP TABLE "system_settings"');
  }
}
