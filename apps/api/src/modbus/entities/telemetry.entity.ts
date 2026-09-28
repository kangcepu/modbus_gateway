import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ModbusTag } from './modbus-tag.entity';
@Entity('telemetry')
export class Telemetry {
  @PrimaryGeneratedColumn('increment') id: number;
  @Column({ name: 'tag_id' }) tagId: string;
  @ManyToOne(() => ModbusTag, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tag_id' }) tag: ModbusTag;
  @Column('numeric') value: number;
  @CreateDateColumn({ name: 'recorded_at' }) recordedAt: Date;
}
