import { DashboardPreference } from "../modbus/entities/dashboard.entity";
import { SystemSetting, Attachment } from "../settings/entities";
import { config } from "dotenv";
import { resolve } from "path";
import { DataSource, DataSourceOptions } from "typeorm";
config({ path: resolve(__dirname, "../../../../.env") });
import { ModbusDevice } from "../modbus/entities/modbus-device.entity";
import { ModbusTag } from "../modbus/entities/modbus-tag.entity";
import { Telemetry } from "../modbus/entities/telemetry.entity";
import { AppUser } from "../auth/entities/app-user.entity";
import { UserSession } from "../auth/entities/user-session.entity";
import { RoleGroup } from "../access/entities/role-group.entity";
import { Permission } from "../access/entities/permission.entity";
import { MachineAccess } from "../access/entities/machine-access.entity";
import { Machine } from "../modbus/entities/machine.entity";
import { ModbusGatewayConfig } from "../modbus/entities/modbus-gateway.entity";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL wajib diisi pada file .env");
export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [
    DashboardPreference,
    SystemSetting,
    Attachment,
    ModbusDevice,
    ModbusTag,
    Telemetry,
    AppUser,
    UserSession,
    RoleGroup,
    Permission,
    MachineAccess,
    Machine,
    ModbusGatewayConfig,
  ],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
};
export default new DataSource(dataSourceOptions);
