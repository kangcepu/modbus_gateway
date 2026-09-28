import { SettingsModule } from "./settings/settings.module";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { dataSourceOptions } from "./database/data-source";
import { ModbusModule } from "./modbus/modbus.module";
import { AuthModule } from "./auth/auth";
import { AccessModule } from "./access/access";

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    AccessModule,
    ModbusModule,
    SettingsModule,
  ],
})
export class AppModule {}
