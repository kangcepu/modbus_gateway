import { MigrationInterface, QueryRunner } from 'typeorm';

/** Separates TCP gateways from the Modbus machines/Unit IDs behind them. */
export class GatewayMachineArchitecture1720000003000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "modbus_gateways" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar(100) NOT NULL, "host" varchar(255) NOT NULL, "port" integer NOT NULL DEFAULT 502, "poll_interval_ms" integer NOT NULL DEFAULT 1000, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await q.query(`CREATE TABLE "machines" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "gateway_id" uuid NOT NULL REFERENCES "modbus_gateways"("id") ON DELETE CASCADE, "name" varchar(100) NOT NULL, "unit_id" integer NOT NULL DEFAULT 1, "location" varchar(100), "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("gateway_id", "unit_id"))`);
    await q.query(`CREATE TABLE "machine_access" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE, "machine_id" uuid NOT NULL REFERENCES "machines"("id") ON DELETE CASCADE, "access" varchar(20) NOT NULL DEFAULT 'view', "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE("user_id", "machine_id"))`);
    await q.query(`ALTER TABLE "modbus_tags" ADD COLUMN "machine_id" uuid REFERENCES "machines"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "modbus_tags" ALTER COLUMN "device_id" DROP NOT NULL`);
    // Preserve existing installations: every legacy device becomes one gateway and one machine.
    await q.query(`INSERT INTO "modbus_gateways" ("id", "name", "host", "port", "poll_interval_ms", "enabled", "created_at", "updated_at") SELECT id, name, host, port, poll_interval_ms, enabled, created_at, updated_at FROM "modbus_devices"`);
    await q.query(`INSERT INTO "machines" ("id", "gateway_id", "name", "unit_id", "enabled", "created_at", "updated_at") SELECT id, id, name, unit_id, enabled, created_at, updated_at FROM "modbus_devices"`);
    await q.query(`UPDATE "modbus_tags" SET "machine_id" = "device_id" WHERE "machine_id" IS NULL`);
    await q.query(`CREATE INDEX "IDX_machines_gateway" ON "machines" ("gateway_id")`);
    await q.query(`CREATE INDEX "IDX_machine_access_user" ON "machine_access" ("user_id")`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('ALTER TABLE "modbus_tags" DROP COLUMN "machine_id"'); await q.query('DROP TABLE "machine_access"'); await q.query('DROP TABLE "machines"'); await q.query('DROP TABLE "modbus_gateways"'); }
}
