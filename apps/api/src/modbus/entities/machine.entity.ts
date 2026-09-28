import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ModbusGatewayConfig } from './modbus-gateway.entity';
import { ModbusTag } from './modbus-tag.entity';

@Entity('machines')
export class Machine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'gateway_id' }) gatewayId: string;
  @ManyToOne(() => ModbusGatewayConfig, gateway => gateway.machines, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'gateway_id' }) gateway: ModbusGatewayConfig;
  @Column({ length: 100 }) name: string;
  @Column({ name: 'unit_id', default: 1 }) unitId: number;
  @Column({ nullable: true, length: 100 }) location?: string;
  @Column({ default: true }) enabled: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @OneToMany(() => ModbusTag, tag => tag.machine) tags: ModbusTag[];
}
