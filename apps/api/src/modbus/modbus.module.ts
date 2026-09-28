import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardPreference } from "./entities/dashboard.entity";
import { ModbusTag } from "./entities/modbus-tag.entity";
import { Telemetry } from "./entities/telemetry.entity";
import { Machine } from "./entities/machine.entity";
import { ModbusGatewayConfig } from "./entities/modbus-gateway.entity";
import { ModbusService } from "./modbus.service";
import { ModbusController } from "./modbus.controller";
import { AuthModule } from "../auth/auth";
import { MachineAccess } from "../access/entities/machine-access.entity";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DashboardPreference,
      ModbusTag,
      Telemetry,
      Machine,
      ModbusGatewayConfig,
      MachineAccess,
    ]),
    AuthModule,
  ],
  controllers: [ModbusController],
  providers: [ModbusService],
})
export class ModbusModule {}
