import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AppUser } from '../../auth/entities/app-user.entity';
import { Permission } from './permission.entity';

@Entity('role_groups')
export class RoleGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true, length: 50 }) code: string;
  @Column({ unique: true, length: 100 }) name: string;
  @Column({ nullable: true, length: 255 }) description?: string;
  @Column({ name: 'is_system', default: false }) isSystem: boolean;
  @ManyToMany(() => Permission, permission => permission.roles)
  @JoinTable({ name: 'role_group_permissions', joinColumn: { name: 'role_group_id' }, inverseJoinColumn: { name: 'permission_id' } })
  permissions: Permission[];
  @OneToMany(() => AppUser, user => user.roleGroup) users: AppUser[];
}
