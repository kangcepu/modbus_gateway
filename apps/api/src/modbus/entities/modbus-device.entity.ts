import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ModbusTag } from './modbus-tag.entity';
@Entity('modbus_devices')
export class ModbusDevice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) name: string;
  @Column() host: string;
  @Column({ default: 502 }) port: number;
  @Column({ name: 'unit_id', default: 1 }) unitId: number;
  @Column({ name: 'poll_interval_ms', default: 1000 }) pollIntervalMs: number;
  @Column({ default: true }) enabled: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @OneToMany(() => ModbusTag, tag => tag.device, { cascade: true }) tags: ModbusTag[];
}
