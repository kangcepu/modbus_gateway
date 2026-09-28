import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Module,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Delete, Get, Param, Patch, Post, Request } from "@nestjs/common";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import { AppUser } from "./entities/app-user.entity";
import { UserSession } from "./entities/user-session.entity";
class Credentials {
  @IsString() @MinLength(3) @MaxLength(50) username: string;
  @IsString() @MinLength(6) password: string;
}
class PasswordInput {
  @IsString() @MinLength(1) currentPassword: string;
  @IsString() @MinLength(6) @MaxLength(128) newPassword: string;
}
class UserInput extends Credentials {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsIn(["admin", "operator"]) role = "operator";
  @IsOptional() @IsUUID() roleGroupId?: string;
}
export class UpdateUserInput {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(50) username?: string;
  @IsOptional() @IsString() @MinLength(6) @MaxLength(128) password?: string;
  @IsOptional() @IsIn(["admin", "operator"]) role?: string;
  @IsOptional() @IsUUID() roleGroupId?: string;
}
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AppUser) private users: Repository<AppUser>,
    @InjectRepository(UserSession) private sessions: Repository<UserSession>,
  ) {}
  async publicUser(u: AppUser) {
    const { passwordHash, sessions, ...safe } = u;
    return safe;
  }
  async bootstrap(input: UserInput) {
    if (await this.users.count())
      throw new ConflictException("Akun awal sudah dibuat.");
    return this.create(input, true);
  }
  async create(input: UserInput, first = false) {
    const exists = await this.users.findOneBy({ username: input.username });
    if (exists) throw new ConflictException("Username sudah digunakan.");
    const user = await this.users.save(
      this.users.create({
        ...input,
        role: first ? "admin" : input.role,
        passwordHash: await bcrypt.hash(input.password, 12),
      }),
    );
    return this.publicUser(user);
  }
  async login(input: Credentials) {
    const u = await this.users.findOne({
      where: { username: input.username },
      relations: { roleGroup: { permissions: true } },
    });
    if (!u || !(await bcrypt.compare(input.password, u.passwordHash)))
      throw new UnauthorizedException("Username atau password salah.");
    const session = await this.sessions.save(
      this.sessions.create({
        userId: u.id,
        token: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 86400000),
      }),
    );
    return { token: session.token, user: await this.publicUser(u) };
  }
  async byToken(token?: string) {
    if (!token) throw new UnauthorizedException();
    const s = await this.sessions.findOne({
      where: { token },
      relations: { user: { roleGroup: { permissions: true } } },
    });
    if (!s || s.expiresAt < new Date())
      throw new UnauthorizedException("Sesi tidak valid.");
    return s.user;
  }
  async list() {
    return Promise.all(
      (
        await this.users.find({
          relations: { roleGroup: true },
          order: { createdAt: "DESC" },
        })
      ).map((u) => this.publicUser(u)),
    );
  }
  async update(id: string, input: UpdateUserInput) {
    const u = await this.users.findOneByOrFail({ id });
    if (
      input.username &&
      input.username !== u.username &&
      (await this.users.findOneBy({ username: input.username }))
    )
      throw new ConflictException("Username sudah digunakan.");
    for (const key of ["name", "username", "role", "roleGroupId"] as const) {
      if (input[key] !== undefined) Object.assign(u, { [key]: input[key] });
    }
    if (input.password) u.passwordHash = await bcrypt.hash(input.password, 12);
    return this.publicUser(await this.users.save(u));
  }
  async remove(id: string, actor: AppUser) {
    if (id === actor.id)
      throw new ForbiddenException("Tidak dapat menghapus akun sendiri.");
    await this.users.delete(id);
  }
  async changePassword(user: AppUser, input: PasswordInput) {
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash)))
      throw new ForbiddenException("Password saat ini salah.");
    user.passwordHash = await bcrypt.hash(input.newPassword, 12);
    await this.users.save(user);
    return { success: true };
  }
  async logout(token: string) {
    await this.sessions.delete({ token });
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = await this.auth.byToken(
      req.headers.authorization?.replace("Bearer ", ""),
    );
    return true;
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const user = ctx.switchToHttp().getRequest().user as AppUser | undefined;
    if (user?.role !== "admin")
      throw new ForbiddenException(
        "Hanya administrator yang dapat mengubah pengguna.",
      );
    return true;
  }
}
@Controller("api/auth")
export class AuthController {
  constructor(private auth: AuthService) {}
  @Get("bootstrap") async bootstrapState() {
    return { ready: (await this.auth["users"].count()) > 0 };
  }
  @Post("bootstrap") bootstrap(@Body() b: UserInput) {
    return this.auth.bootstrap(b);
  }
  @Post("login") login(@Body() b: Credentials) {
    return this.auth.login(b);
  }
  @UseGuards(SessionGuard) @Get("me") me(@Request() r: any) {
    return this.auth.publicUser(r.user);
  }
  @UseGuards(SessionGuard) @Patch("password") password(
    @Request() r: any,
    @Body() b: PasswordInput,
  ) {
    return this.auth.changePassword(r.user, b);
  }
  @UseGuards(SessionGuard) @Post("logout") logout(@Request() r: any) {
    return this.auth.logout(r.headers.authorization.replace("Bearer ", ""));
  }
}
@Controller("api/users")
@UseGuards(SessionGuard, AdminGuard)
export class UsersController {
  constructor(private auth: AuthService) {}
  @Get() list() {
    return this.auth.list();
  }
  @Post() create(@Body() b: UserInput) {
    return this.auth.create(b);
  }
  @Patch(":id") update(@Param("id") id: string, @Body() b: UpdateUserInput) {
    return this.auth.update(id, b);
  }
  @Delete(":id") remove(@Param("id") id: string, @Request() r: any) {
    return this.auth.remove(id, r.user);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([AppUser, UserSession])],
  controllers: [AuthController, UsersController],
  providers: [AuthService, SessionGuard, AdminGuard],
  exports: [AuthService, SessionGuard, AdminGuard],
})
export class AuthModule {}
