import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ModbusDevice } from './modbus-device.entity';
import { Machine } from './machine.entity';
@Entity('modbus_tags') @Unique(['deviceId', 'name'])
export class ModbusTag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'device_id', nullable: true }) deviceId?: string;
  @ManyToOne(() => ModbusDevice, device => device.tags, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'device_id' }) device?: ModbusDevice;
  @Column({ name: 'machine_id', nullable: true }) machineId?: string;
  @ManyToOne(() => Machine, machine => machine.tags, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'machine_id' }) machine?: Machine;
  @Column({ length: 100 }) name: string;
  @Column() address: number;
  @Column({ name: 'function_code', default: 3 }) functionCode: number;
  @Column({ name: 'data_type', default: 'uint16' }) dataType: string;
  @Column('numeric', { default: 1 }) scale: number;
  @Column({ nullable: true, length: 30 }) unit?: string;
  @Column({ default: true }) enabled: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
