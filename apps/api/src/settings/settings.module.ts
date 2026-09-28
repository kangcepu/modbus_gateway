import {
  Body,
  Controller,
  Get,
  Header,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule, AdminGuard, SessionGuard } from "../auth/auth";
import { ApplicationSettingsDto, MinioSettingsDto } from "./dto";
import { Attachment, SystemSetting } from "./entities";
import { SettingsService, UploadedFile as MediaFile } from "./settings.service";

@Controller("api/settings")
export class SettingsController {
  constructor(private service: SettingsService) {}
  @Get("branding") branding() {
    return this.service.application();
  }
  @Header("X-Content-Type-Options", "nosniff") @Get("assets/:id") async asset(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const result = await this.service.download(id, true);
    return new StreamableFile(result.stream, {
      type: result.file.mimeType,
      length: result.file.size,
    });
  }
  @UseGuards(SessionGuard, AdminGuard) @Get() async all() {
    return {
      application: await this.service.application(),
      minio: await this.service.publicStorage(),
    };
  }
  @UseGuards(SessionGuard, AdminGuard) @Patch("application") application(
    @Body() body: ApplicationSettingsDto,
    @Request() req: any,
  ) {
    return this.service.saveApplication(body, req.user.id);
  }
  @UseGuards(SessionGuard, AdminGuard) @Patch("minio") minio(
    @Body() body: MinioSettingsDto,
    @Request() req: any,
  ) {
    return this.service.saveStorage(body, req.user.id);
  }
  @UseGuards(SessionGuard, AdminGuard) @Post("minio/test") test(
    @Body() body: MinioSettingsDto,
  ) {
    return this.service.testStorage(body);
  }
  @UseGuards(SessionGuard, AdminGuard)
  @Post("branding/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  uploadBrand(@UploadedFile() file: MediaFile, @Request() req: any) {
    return this.service.upload(file, req.user.id, true);
  }
  @UseGuards(SessionGuard, AdminGuard)
  @Post("attachments")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  upload(@UploadedFile() file: MediaFile, @Request() req: any) {
    return this.service.upload(file, req.user.id);
  }
  @UseGuards(SessionGuard, AdminGuard)
  @Header("X-Content-Type-Options", "nosniff")
  @Get("attachments/:id")
  async attachment(@Param("id", ParseUUIDPipe) id: string) {
    const result = await this.service.download(id);
    return new StreamableFile(result.stream, {
      type: result.file.mimeType,
      length: result.file.size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.file.originalName)}`,
    });
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting, Attachment]), AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
