import {
  Column,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("system_settings")
export class SystemSetting {
  @PrimaryColumn({ length: 64 }) key: string;
  @Column({ type: "jsonb", default: {} }) value: Record<string, unknown>;
  @Column({ name: "updated_by", type: "uuid", nullable: true }) updatedBy:
    string | null;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}

@Entity("attachments")
export class Attachment {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "original_name", length: 255 }) originalName: string;
  @Column({ name: "object_key", unique: true }) objectKey: string;
  @Column() bucket: string;
  @Column() endpoint: string;
  @Column() port: number;
  @Column({ name: "use_ssl" }) useSSL: boolean;
  @Column({ name: "mime_type" }) mimeType: string;
  @Column({ type: "integer" }) size: number;
  @Column({ name: "created_by", type: "uuid", nullable: true }) createdBy:
    string | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
