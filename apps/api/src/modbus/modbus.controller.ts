import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  DashboardDto,
  DeviceDto,
  GatewayDto,
  HistoryDto,
  MachineDto,
  RawCaptureDto,
  ScanUnitIdsDto,
  TagDto,
  TestConnectionDto,
  UpdateDeviceDto,
  UpdateTagDto,
} from "./dto";
import { ModbusService } from "./modbus.service";
import { AdminGuard, SessionGuard } from "../auth/auth";
@Controller("api")
@UseGuards(SessionGuard)
export class ModbusController {
  constructor(private service: ModbusService) {}
  @Get("gateways") gateways(@Request() r: any) {
    return this.service.listGatewaysForUser(r.user);
  }
  @Post("gateways") @UseGuards(AdminGuard) createGateway(
    @Body() b: GatewayDto,
  ) {
    return this.service.createGateway(b);
  }
  @Patch("gateways/:id") @UseGuards(AdminGuard) updateGateway(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateDeviceDto,
  ) {
    return this.service.updateGateway(id, b);
  }
  @Delete("gateways/:id") @UseGuards(AdminGuard) @HttpCode(204) removeGateway(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.removeGateway(id);
  }
  @Post("gateways/:id/machines") @UseGuards(AdminGuard) createMachine(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: MachineDto,
  ) {
    return this.service.createMachine(id, b);
  }
  @Patch("machines/:id") @UseGuards(AdminGuard) updateMachine(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateDeviceDto,
  ) {
    return this.service.updateMachine(id, b);
  }
  @Delete("machines/:id") @UseGuards(AdminGuard) @HttpCode(204) removeMachine(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.removeMachine(id);
  }
  @Post("machines/:id/tags") @UseGuards(AdminGuard) createMachineTag(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: TagDto,
  ) {
    return this.service.createMachineTag(id, b);
  }
  @Get("devices") devices(@Request() r: any) {
    return this.service.listDevices(r.user);
  }
  @Post("devices") @UseGuards(AdminGuard) createDevice(@Body() b: DeviceDto) {
    return this.service.createDevice(b);
  }
  @Patch("devices/:id") @UseGuards(AdminGuard) updateDevice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateDeviceDto,
  ) {
    return this.service.updateDevice(id, b);
  }
  @Delete("devices/:id") @UseGuards(AdminGuard) @HttpCode(204) removeDevice(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.removeMachine(id);
  }
  @Post("devices/:id/tags") @UseGuards(AdminGuard) createTag(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: TagDto,
  ) {
    return this.service.createMachineTag(id, b);
  }
  @Post("devices/:id/test-connection") @UseGuards(AdminGuard) test(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: TestConnectionDto,
  ) {
    return this.service.testConnection(id, b);
  }
  @Post("devices/:id/scan-unit-ids") @UseGuards(AdminGuard) scan(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: ScanUnitIdsDto,
  ) {
    return this.service.scanUnitIds(id, b);
  }
  @Post("devices/:id/raw-capture") @UseGuards(AdminGuard) rawCapture(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: RawCaptureDto,
  ) {
    return this.service.rawCapture(id, b);
  }
  @Patch("tags/:id") @UseGuards(AdminGuard) updateTag(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateTagDto,
  ) {
    return this.service.updateTag(id, b);
  }
  @Delete("tags/:id") @UseGuards(AdminGuard) @HttpCode(204) removeTag(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.removeTag(id);
  }
  @Get("telemetry/latest") latest(@Request() r: any) {
    return this.service.latestForUser(r.user);
  }
  @Get("telemetry/history") history(@Request() r: any, @Query() q: HistoryDto) {
    return this.service.history(r.user, q);
  }
  @Get("telemetry") telemetry(@Request() r: any) {
    return this.service.recentTelemetry(r.user);
  }
  @Get("dashboard/preferences") dashboard(@Request() r: any) {
    return this.service.dashboard(r.user);
  }
  @Patch("dashboard/preferences") saveDashboard(
    @Request() r: any,
    @Body() b: DashboardDto,
  ) {
    return this.service.saveDashboard(r.user, b);
  }
}
