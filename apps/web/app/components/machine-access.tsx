"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { request } from "@/lib/session";
import type { Device } from "@/lib/monitoring";
export function MachineAccess({
  user,
  devices,
}: {
  user: { id: string; name: string; role: string };
  devices: Device[];
}) {
  const [granted, setGranted] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await request(`access/users/${user.id}/machines`);
      setGranted(rows.map((row: { machineId: string }) => row.machineId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat akses mesin.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [user.id]);
  const toggle = async (id: string, on: boolean) => {
    setPending(id);
    setError("");
    setMessage("");
    try {
      await request(`access/users/${user.id}/machines/${id}`, {
        method: on ? "POST" : "DELETE",
        ...(on ? { body: JSON.stringify({ access: "view" }) } : {}),
      });
      setGranted((current) =>
        on ? [...current, id] : current.filter((value) => value !== id),
      );
      setMessage("Akses mesin berhasil diperbarui.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui akses.");
    } finally {
      setPending("");
    }
  };
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Pilih mesin yang boleh dipantau {user.name}. Setiap perubahan langsung
        disimpan. Administrator dan role dengan permission machines.view_all
        tetap dapat melihat seluruh mesin.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-rose-600">
          {error}
          <button
            className="ml-2 underline"
            disabled={!!pending}
            onClick={() => void load()}
          >
            Muat ulang akses
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="mb-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status" className="empty">
          Memuat akses…
        </p>
      ) : !devices.length ? (
        <p className="empty">Belum ada mesin terdaftar.</p>
      ) : (
        <fieldset disabled={!!pending || !!error} className="space-y-2">
          {devices.map((device) => (
            <label
              key={device.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
            >
              <input
                type="checkbox"
                checked={granted.includes(device.id)}
                onChange={(e) => void toggle(device.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{device.name}</span>
                <span className="text-xs text-slate-400">
                  {device.host}:{device.port} · Unit {device.unitId}
                </span>
              </span>
              {pending === device.id && (
                <Loader2 size={16} className="animate-spin" />
              )}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
