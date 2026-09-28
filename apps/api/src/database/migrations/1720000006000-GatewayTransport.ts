import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lets a gateway speak either native Modbus TCP (MBAP) or raw RTU frames tunneled over TCP, for transparent serial-to-Ethernet converters. */
export class GatewayTransport1720000006000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "modbus_gateways" ADD COLUMN "transport" varchar(10) NOT NULL DEFAULT 'tcp'`);
    await q.query(`ALTER TABLE "modbus_gateways" ADD CONSTRAINT "CHK_modbus_gateways_transport" CHECK ("transport" IN ('tcp', 'rtu'))`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "modbus_gateways" DROP CONSTRAINT "CHK_modbus_gateways_transport"`);
    await q.query(`ALTER TABLE "modbus_gateways" DROP COLUMN "transport"`);
  }
}
