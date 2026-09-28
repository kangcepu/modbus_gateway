export type Tag = {
  id: string;
  name: string;
  address: number;
  functionCode: number;
  dataType: string;
  scale?: number;
  unit?: string;
  enabled?: boolean;
};
export type Device = {
  id: string;
  name: string;
  gatewayId?: string;
  gatewayName?: string;
  host: string;
  port: number;
  unitId: number;
  pollIntervalMs?: number;
  enabled: boolean;
  gatewayEnabled?: boolean;
  machineEnabled?: boolean;
  tags: Tag[];
  health?: {
    state: string;
    lastAttempt?: string;
    lastSuccess?: string;
    error?: string;
    tagErrors: Record<string, string>;
  };
};
export type Reading = {
  tagId: string;
  value: number | string;
  recordedAt: string;
};
export type Widget = {
  id: string;
  tagId: string;
  type: "value" | "gauge" | "trend";
  title: string;
  min: number;
  max: number;
  wide: boolean;
};
export type DashboardConfig = {
  refreshSeconds: number;
  columns: number;
  widgets: Widget[];
  saved?: boolean;
};
export function status(device: Device, now = Date.now()) {
  if (!device.enabled)
    return { label: "Nonaktif", color: "bg-slate-100 text-slate-600" };
  if (!device.tags.some((t) => t.enabled !== false))
    return {
      label: "Belum ada register aktif",
      color: "bg-slate-100 text-slate-600",
    };
  if (!device.health?.lastAttempt)
    return { label: "Menunggu polling", color: "bg-slate-100 text-slate-600" };
  if (
    now - new Date(device.health.lastAttempt).getTime() >
    Math.max(30000, (device.pollIntervalMs || 1000) * 3)
  )
    return { label: "Data lama", color: "bg-amber-50 text-amber-700" };
  if (device.health.state === "online")
    return { label: "Online", color: "bg-emerald-50 text-emerald-700" };
  if (device.health.state === "partial")
    return { label: "Sebagian gagal", color: "bg-amber-50 text-amber-700" };
  return { label: "Offline", color: "bg-rose-50 text-rose-700" };
}
export function isStale(reading: Reading | undefined, device: Device) {
  return (
    !reading ||
    !device.enabled ||
    Date.now() - new Date(reading.recordedAt).getTime() >
      Math.max(30000, (device.pollIntervalMs || 1000) * 3)
  );
}
export const formatValue = (value: number | string) =>
  Number(value).toLocaleString("id-ID", { maximumFractionDigits: 4 });
