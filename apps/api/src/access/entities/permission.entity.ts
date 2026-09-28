import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RoleGroup } from './role-group.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true, length: 100 }) code: string;
  @Column({ length: 100 }) name: string;
  @Column({ length: 50 }) category: string;
  @ManyToMany(() => RoleGroup, role => role.permissions) roles: RoleGroup[];
}
