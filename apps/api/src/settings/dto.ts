import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
export class ApplicationSettingsDto {
  @IsString() @MinLength(1) @MaxLength(80) @Matches(/\S/) appName: string;
  @IsString() @MaxLength(160) appSubtitle: string;
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/[^\s]+|\/api\/settings\/assets\/[0-9a-f-]+)?$/i)
  logoUrl: string;
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/[^\s]+|\/api\/settings\/assets\/[0-9a-f-]+)?$/i)
  iconUrl: string;
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/[^\s]+|\/api\/settings\/assets\/[0-9a-f-]+)?$/i)
  faviconUrl: string;
}
export class MinioSettingsDto {
  @IsBoolean() enabled: boolean;
  @IsString() @MaxLength(253) @Matches(/^[a-z\d.:-]*$/i) endPoint: string;
  @IsInt() @Min(1) @Max(65535) port: number;
  @IsBoolean() useSSL: boolean;
  @IsString() @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/) bucket: string;
  @IsString() @MaxLength(100) region: string;
  @IsString() @MaxLength(128) accessKey: string;
  @IsOptional() @IsString() @MaxLength(256) secretKey?: string;
}
