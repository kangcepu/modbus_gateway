import { MigrationInterface, QueryRunner } from 'typeorm';
export class InitialSchema1720000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await q.query(`CREATE TABLE "modbus_devices" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(100) NOT NULL, "host" varchar(255) NOT NULL, "port" integer NOT NULL DEFAULT 502, "unit_id" integer NOT NULL DEFAULT 1, "poll_interval_ms" integer NOT NULL DEFAULT 1000, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await q.query(`CREATE TABLE "modbus_tags" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "device_id" uuid NOT NULL REFERENCES "modbus_devices"("id") ON DELETE CASCADE, "name" varchar(100) NOT NULL, "address" integer NOT NULL, "function_code" integer NOT NULL DEFAULT 3, "data_type" varchar(20) NOT NULL DEFAULT 'uint16', "scale" numeric(14,6) NOT NULL DEFAULT 1, "unit" varchar(30), "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("device_id", "name"))`);
    await q.query(`CREATE TABLE "telemetry" ("id" bigserial PRIMARY KEY, "tag_id" uuid NOT NULL REFERENCES "modbus_tags"("id") ON DELETE CASCADE, "value" numeric(20,6) NOT NULL, "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX "IDX_telemetry_tag_recorded" ON "telemetry" ("tag_id", "recorded_at" DESC)`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE "telemetry"'); await q.query('DROP TABLE "modbus_tags"'); await q.query('DROP TABLE "modbus_devices"'); }
}
