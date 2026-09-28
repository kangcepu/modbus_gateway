import { MigrationInterface, QueryRunner } from "typeorm";
export class CustomDashboard1720000005000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Reconcile records added through the old UI after the gateway/machine migration.
    await q.query(
      `INSERT INTO modbus_gateways (id,name,host,port,poll_interval_ms,enabled,created_at,updated_at) SELECT id,name,host,port,poll_interval_ms,true,created_at,updated_at FROM modbus_devices ON CONFLICT (id) DO NOTHING`,
    );
    await q.query(
      `INSERT INTO machines (id,gateway_id,name,unit_id,enabled,created_at,updated_at) SELECT id,id,name,unit_id,enabled,created_at,updated_at FROM modbus_devices ON CONFLICT (id) DO NOTHING`,
    );
    await q.query(
      `UPDATE modbus_gateways g SET host=d.host,port=d.port,poll_interval_ms=d.poll_interval_ms,updated_at=d.updated_at FROM modbus_devices d WHERE g.id=d.id AND d.updated_at>g.updated_at`,
    );
    await q.query(
      `UPDATE machines m SET name=d.name,unit_id=d.unit_id,enabled=d.enabled,updated_at=d.updated_at FROM modbus_devices d WHERE m.id=d.id AND d.updated_at>m.updated_at`,
    );
    await q.query(
      `UPDATE modbus_tags SET machine_id=device_id WHERE machine_id IS NULL AND device_id IN (SELECT id FROM machines)`,
    );
    await q.query(
      `CREATE TABLE dashboard_preferences (user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE, config jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_telemetry_tag_time ON telemetry(tag_id,recorded_at DESC)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE dashboard_preferences");
    await q.query("DROP INDEX IF EXISTS idx_telemetry_tag_time");
  }
}
