import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Machine } from './machine.entity';

@Entity('modbus_gateways')
export class ModbusGatewayConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) name: string;
  @Column() host: string;
  @Column({ default: 502 }) port: number;
  @Column({ default: 'tcp' }) transport: 'tcp' | 'rtu';
  @Column({ name: 'poll_interval_ms', default: 1000 }) pollIntervalMs: number;
  @Column({ default: true }) enabled: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @OneToMany(() => Machine, machine => machine.gateway) machines: Machine[];
}
