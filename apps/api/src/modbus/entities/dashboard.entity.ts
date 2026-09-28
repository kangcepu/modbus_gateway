import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
@Entity("dashboard_preferences")
export class DashboardPreference {
  @PrimaryColumn({ name: "user_id", type: "uuid" }) userId: string;
  @Column({ type: "jsonb" }) config: {
    refreshSeconds: number;
    columns: number;
    widgets: {
      id: string;
      tagId: string;
      type: string;
      title: string;
      min: number;
      max: number;
      wide: boolean;
    }[];
  };
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
