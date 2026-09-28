import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AppUser } from './app-user.entity';
@Entity('user_sessions') export class UserSession { @PrimaryGeneratedColumn('uuid') id: string; @Column({ unique: true }) token: string; @Column({ name: 'user_id' }) userId: string; @ManyToOne(() => AppUser, u => u.sessions, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: AppUser; @Column({ name: 'expires_at' }) expiresAt: Date; @CreateDateColumn({ name: 'created_at' }) createdAt: Date; }
