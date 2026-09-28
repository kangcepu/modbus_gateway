import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
export class GatewayDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @MinLength(1) @MaxLength(253) host: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port = 502;
  @IsOptional() @IsInt() @Min(250) @Max(3600000) pollIntervalMs = 1000;
  @IsOptional() @IsBoolean() enabled = true;
}
export class MachineDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsInt() @Min(0) @Max(247) unitId = 1;
  @IsOptional() @IsString() @MaxLength(100) location?: string;
  @IsOptional() @IsBoolean() enabled = true;
}
export class DeviceDto extends GatewayDto {
  @IsOptional() @IsInt() @Min(0) @Max(247) unitId = 1;
}
export class TagDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsInt() @Min(0) @Max(65535) address: number;
  @IsOptional() @IsInt() @IsIn([1, 2, 3, 4]) functionCode = 3;
  @IsOptional()
  @IsIn(["uint16", "int16", "uint32", "int32", "float32", "coil"])
  dataType = "uint16";
  @IsOptional() @IsNumber() scale = 1;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsBoolean() enabled = true;
}
// PATCH classes have no field defaults, so omitted fields remain unchanged.
export class UpdateDeviceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(253) host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsInt() @Min(0) @Max(247) unitId?: number;
  @IsOptional() @IsInt() @Min(250) @Max(3600000) pollIntervalMs?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(100) location?: string;
}
export class UpdateTagDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(65535) address?: number;
  @IsOptional() @IsInt() @IsIn([1, 2, 3, 4]) functionCode?: number;
  @IsOptional()
  @IsIn(["uint16", "int16", "uint32", "int32", "float32", "coil"])
  dataType?: string;
  @IsOptional() @IsNumber() scale?: number;
  @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
export class ScanUnitIdsDto {
  @IsOptional() @IsInt() @Min(0) @Max(247) from = 1;
  @IsOptional() @IsInt() @Min(0) @Max(247) to = 10;
  @IsOptional() @IsInt() @IsIn([1, 2, 3, 4]) functionCode = 3;
  @IsOptional() @IsInt() @Min(0) @Max(65535) address = 0;
  @IsOptional() @IsInt() @Min(100) @Max(2000) timeoutMs = 200;
}
export class TestConnectionDto {
  @IsOptional() @IsInt() @Min(0) @Max(247) unitId?: number;
  @IsOptional() @IsInt() @IsIn([1, 2, 3, 4]) functionCode = 3;
  @IsOptional() @IsInt() @Min(0) @Max(65535) address = 0;
  @IsOptional() @IsInt() @Min(100) @Max(5000) timeoutMs = 1000;
}
export class WidgetDto {
  @IsUUID() id: string;
  @IsUUID() tagId: string;
  @IsIn(["value", "gauge", "trend"]) type: string;
  @IsString() @MaxLength(80) title: string;
  @IsNumber() min: number;
  @IsNumber() max: number;
  @IsBoolean() wide: boolean;
}
export class DashboardDto {
  @IsInt() @IsIn([1, 2, 5, 10, 30]) refreshSeconds: number;
  @IsInt() @IsIn([1, 2, 3]) columns: number;
  @IsArray()
  @ArrayMaxSize(24)
  @ArrayUnique((widget: WidgetDto) => widget?.id)
  @ValidateNested({ each: true })
  @Type(() => WidgetDto)
  widgets: WidgetDto[];
}
export class HistoryDto {
  @IsUUID() tagId: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([15, 60, 1440]) minutes = 60;
}
