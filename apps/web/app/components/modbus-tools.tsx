"use client";
import { useState } from "react";
import { Loader2, PlugZap, Search } from "lucide-react";
import { request } from "@/lib/session";
import type { Device } from "@/lib/monitoring";
export function ModbusTools({ device }: { device: Device }) {
  const [unitId, setUnitId] = useState(device.unitId),
    [fc, setFc] = useState(device.tags[0]?.functionCode || 3),
    [address, setAddress] = useState(device.tags[0]?.address || 0),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(10),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const run = async (scan: boolean) => {
    setBusy(scan ? "scan" : "test");
    setMessage("");
    setError(false);
    try {
      const result = await request(
        `devices/${device.id}/${scan ? "scan-unit-ids" : "test-connection"}`,
        {
          method: "POST",
          body: JSON.stringify(
            scan
              ? { from, to, functionCode: fc, address, timeoutMs: 200 }
              : { unitId, functionCode: fc, address, timeoutMs: 1000 },
          ),
        },
      );
      setMessage(result.message);
      setError(scan ? false : !result.modbusResponded);
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Pengujian gagal.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="mt-5 border-t border-slate-200 pt-5">
      <h3 className="mb-2 font-semibold">Diagnostik Modbus</h3>
      <p className="mb-4 text-xs text-slate-500">
        Uji FC dan alamat register sesuai manual alat. Pemindaian membaca
        maksimal 32 Unit ID dan berbagi koneksi dengan polling.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
      >
        <fieldset disabled={!!busy} className="grid gap-3 sm:grid-cols-3">
          <label className="field">
            Unit ID
            <input
              className="input"
              type="number"
              min={0}
              max={247}
              required
              value={unitId}
              onChange={(e) => setUnitId(+e.target.value)}
            />
          </label>
          <label className="field">
            Function code
            <select
              className="input"
              value={fc}
              onChange={(e) => setFc(+e.target.value)}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  FC{n}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Alamat register
            <input
              className="input"
              type="number"
              min={0}
              max={65535}
              required
              value={address}
              onChange={(e) => setAddress(+e.target.value)}
            />
          </label>
        </fieldset>
        <button className="btn-secondary mt-3" disabled={!!busy}>
          {busy === "test" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PlugZap size={16} />
          )}
          Tes koneksi
        </button>
      </form>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(true);
        }}
      >
        <fieldset disabled={!!busy} className="flex flex-wrap items-end gap-3">
          <label className="field w-28">
            Unit ID awal
            <input
              className="input"
              type="number"
              min={0}
              max={247}
              value={from}
              required
              onChange={(e) => setFrom(+e.target.value)}
            />
          </label>
          <label className="field w-28">
            Unit ID akhir
            <input
              className="input"
              type="number"
              min={from}
              max={Math.min(247, from + 31)}
              required
              value={to}
              onChange={(e) => setTo(+e.target.value)}
            />
          </label>
          <button className="btn-secondary" disabled={!!busy}>
            {busy === "scan" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Pindai Unit ID
          </button>
        </fieldset>
      </form>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-4 rounded-lg p-3 text-sm ${error ? "bg-rose-50 text-rose-700" : "bg-brand-50 text-brand-700"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
