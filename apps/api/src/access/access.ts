import { Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Module } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { AdminGuard, AuthModule, SessionGuard } from '../auth/auth';
import { Permission } from './entities/permission.entity';
import { RoleGroup } from './entities/role-group.entity';
import { MachineAccess } from './entities/machine-access.entity';
import { Machine } from '../modbus/entities/machine.entity';

class RoleGroupInput {
  @IsString() @MaxLength(50) code: string;
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) permissionIds: string[] = [];
}
class PermissionInput { @IsString() @MaxLength(100) code: string; @IsString() @MaxLength(100) name: string; @IsString() @MaxLength(50) category: string; }
@Injectable()
export class AccessService {
  constructor(@InjectRepository(RoleGroup) private roles: Repository<RoleGroup>, @InjectRepository(Permission) private permissions: Repository<Permission>, @InjectRepository(MachineAccess) private machineAccess: Repository<MachineAccess>) {}
  listMachineAccess(userId: string) { return this.machineAccess.find({ where: { userId }, relations: { machine: { gateway: true } } }); }
  async grantMachineAccess(userId: string, machineId: string, access = 'view') { const found = await this.machineAccess.findOneBy({ userId, machineId }); return this.machineAccess.save(found ? Object.assign(found, { access }) : this.machineAccess.create({ userId, machineId, access })); }
  async revokeMachineAccess(userId: string, machineId: string) { await this.machineAccess.delete({ userId, machineId }); }
  listPermissions() { return this.permissions.find({ order: { category: 'ASC', name: 'ASC' } }); }
  async createPermission(input: PermissionInput) { if (await this.permissions.findOneBy({ code: input.code })) throw new ConflictException('Kode permission sudah digunakan.'); return this.permissions.save(this.permissions.create(input)); }
  async updatePermission(id: string, input: Partial<PermissionInput>) { const permission = await this.permissions.findOneByOrFail({ id }); if (input.code && input.code !== permission.code && await this.permissions.findOneBy({ code: input.code })) throw new ConflictException('Kode permission sudah digunakan.'); Object.assign(permission, input); return this.permissions.save(permission); }
  async removePermission(id: string) { const permission = await this.permissions.findOne({ where: { id }, relations: { roles: true } }); if (!permission) throw new NotFoundException('Permission tidak ditemukan.'); if (permission.roles.length) throw new ConflictException('Lepaskan permission ini dari seluruh role group terlebih dahulu.'); await this.permissions.delete(id); }
  listRoles() { return this.roles.find({ relations: { permissions: true }, order: { name: 'ASC' } }); }
  async create(input: RoleGroupInput) { if (await this.roles.findOneBy({ code: input.code })) throw new ConflictException('Kode role group sudah digunakan.'); return this.save(this.roles.create(), input); }
  async update(id: string, input: Partial<RoleGroupInput>) { const role = await this.roles.findOne({ where: { id }, relations: { permissions: true } }); if (!role) throw new NotFoundException('Role group tidak ditemukan.'); if (role.isSystem && input.code && input.code !== role.code) throw new ConflictException('Kode role bawaan tidak dapat diubah.'); return this.save(role, input); }
  async remove(id: string) { const role = await this.roles.findOne({ where: { id }, relations: { users: true } }); if (!role) throw new NotFoundException('Role group tidak ditemukan.'); if (role.isSystem) throw new ConflictException('Role group bawaan tidak dapat dihapus.'); if (role.users.length) throw new ConflictException('Pindahkan pengguna dari role group ini terlebih dahulu.'); await this.roles.delete(id); }
  private async save(role: RoleGroup, input: Partial<RoleGroupInput>) { Object.assign(role, { code: input.code ?? role.code, name: input.name ?? role.name, description: input.description ?? role.description }); if (input.permissionIds) role.permissions = input.permissionIds.length ? await this.permissions.findBy({ id: In(input.permissionIds) }) : []; return this.roles.save(role); }
}
@Controller('api/access') @UseGuards(SessionGuard, AdminGuard)
export class AccessController { constructor(private access: AccessService) {} @Get('permissions') permissions() { return this.access.listPermissions(); } @Post('permissions') createPermission(@Body() input: PermissionInput) { return this.access.createPermission(input); } @Patch('permissions/:id') updatePermission(@Param('id') id: string, @Body() input: Partial<PermissionInput>) { return this.access.updatePermission(id, input); } @Delete('permissions/:id') removePermission(@Param('id') id: string) { return this.access.removePermission(id); } @Get('role-groups') roles() { return this.access.listRoles(); } @Post('role-groups') create(@Body() input: RoleGroupInput) { return this.access.create(input); } @Patch('role-groups/:id') update(@Param('id') id: string, @Body() input: Partial<RoleGroupInput>) { return this.access.update(id, input); } @Delete('role-groups/:id') remove(@Param('id') id: string) { return this.access.remove(id); } @Get('users/:userId/machines') machineAccess(@Param('userId') userId: string) { return this.access.listMachineAccess(userId); } @Post('users/:userId/machines/:machineId') grantMachine(@Param('userId') userId: string, @Param('machineId') machineId: string, @Body() body: { access?: string }) { return this.access.grantMachineAccess(userId, machineId, body.access); } @Delete('users/:userId/machines/:machineId') revokeMachine(@Param('userId') userId: string, @Param('machineId') machineId: string) { return this.access.revokeMachineAccess(userId, machineId); } }
@Module({ imports: [TypeOrmModule.forFeature([RoleGroup, Permission, MachineAccess, Machine]), AuthModule], controllers: [AccessController], providers: [AccessService], exports: [TypeOrmModule, AccessService] }) export class AccessModule {}
