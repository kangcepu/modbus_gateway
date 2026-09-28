import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessControl1720000002000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "permissions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "code" varchar(100) NOT NULL UNIQUE, "name" varchar(100) NOT NULL, "category" varchar(50) NOT NULL)`);
    await q.query(`CREATE TABLE "role_groups" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "code" varchar(50) NOT NULL UNIQUE, "name" varchar(100) NOT NULL UNIQUE, "description" varchar(255), "is_system" boolean NOT NULL DEFAULT false)`);
    await q.query(`CREATE TABLE "role_group_permissions" ("role_group_id" uuid NOT NULL REFERENCES "role_groups"("id") ON DELETE CASCADE, "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE, PRIMARY KEY ("role_group_id", "permission_id"))`);
    await q.query(`ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "role_group_id" uuid REFERENCES "role_groups"("id") ON DELETE SET NULL`);
    await q.query(`INSERT INTO "permissions" ("code", "name", "category") VALUES
      ('dashboard.view','Melihat dashboard','Monitoring'),('telemetry.view','Melihat telemetry','Monitoring'),
      ('devices.manage','Mengelola mesin dan register','Konfigurasi'),('users.manage','Mengelola pengguna','Akses'),('roles.manage','Mengelola role group dan permission','Akses')
      ON CONFLICT ("code") DO NOTHING`);
    await q.query(`INSERT INTO "role_groups" ("code", "name", "description", "is_system") VALUES
      ('superadmin','Super Administrator','Akses penuh termasuk role dan permission.',true),
      ('admin','Administrator','Mengelola mesin, register, dan pengguna.',true),
      ('operator','Operator','Memantau dashboard dan telemetry.',true)
      ON CONFLICT ("code") DO NOTHING`);
    await q.query(`INSERT INTO "role_group_permissions" ("role_group_id", "permission_id")
      SELECT r.id, p.id FROM "role_groups" r CROSS JOIN "permissions" p WHERE r.code='superadmin' ON CONFLICT DO NOTHING`);
    await q.query(`INSERT INTO "role_group_permissions" ("role_group_id", "permission_id")
      SELECT r.id, p.id FROM "role_groups" r JOIN "permissions" p ON p.code IN ('dashboard.view','telemetry.view','devices.manage','users.manage') WHERE r.code='admin' ON CONFLICT DO NOTHING`);
    await q.query(`INSERT INTO "role_group_permissions" ("role_group_id", "permission_id")
      SELECT r.id, p.id FROM "role_groups" r JOIN "permissions" p ON p.code IN ('dashboard.view','telemetry.view') WHERE r.code='operator' ON CONFLICT DO NOTHING`);
    await q.query(`INSERT INTO "app_users" ("username", "password_hash", "name", "role", "role_group_id")
      SELECT 'superadmin', '$2b$12$JG6qSpX1J.xD1KZO.kmw5OOi5fCOhHENd272EZ6spq7FYadNwKJW.', 'Super Administrator', 'admin', r.id FROM "role_groups" r WHERE r.code='superadmin' ON CONFLICT ("username") DO NOTHING`);
    await q.query(`UPDATE "app_users" u SET "role_group_id" = r.id FROM "role_groups" r WHERE u."role_group_id" IS NULL AND r.code = CASE WHEN u.role='admin' THEN 'admin' ELSE 'operator' END`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "app_users" DROP COLUMN IF EXISTS "role_group_id"`); await q.query('DROP TABLE "role_group_permissions"'); await q.query('DROP TABLE "role_groups"'); await q.query('DROP TABLE "permissions"'); }
}
