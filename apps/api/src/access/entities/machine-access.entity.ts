import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { AppUser } from '../../auth/entities/app-user.entity';
import { Machine } from '../../modbus/entities/machine.entity';
@Entity('machine_access') @Unique(['userId', 'machineId'])
export class MachineAccess { @PrimaryGeneratedColumn('uuid') id: string; @Column({ name: 'user_id' }) userId: string; @Column({ name: 'machine_id' }) machineId: string; @Column({ default: 'view' }) access: string; @ManyToOne(() => AppUser, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: AppUser; @ManyToOne(() => Machine, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'machine_id' }) machine: Machine; @CreateDateColumn({ name: 'created_at' }) createdAt: Date; }
