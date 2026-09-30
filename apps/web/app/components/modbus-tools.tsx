"use client";
import { useState } from "react";
import { Loader2, PlugZap, Radio, Search } from "lucide-react";
import { request } from "@/lib/session";
import type { Device } from "@/lib/monitoring";
type CaptureEvent = {
  at: string;
  direction: "rx" | "tx";
  hex: string;
  length: number;
};
export function ModbusTools({ device }: { device: Device }) {
  const [unitId, setUnitId] = useState(device.unitId),
    [fc, setFc] = useState(device.tags[0]?.functionCode || 3),
    [address, setAddress] = useState(device.tags[0]?.address || 0),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(10),
    [durationMs, setDurationMs] = useState(3000),
    [probeHex, setProbeHex] = useState(""),
    [captureEvents, setCaptureEvents] = useState<CaptureEvent[] | null>(null),
    [captureMessage, setCaptureMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const capture = async () => {
    setBusy("capture");
    setCaptureMessage("");
    setCaptureEvents(null);
    try {
      const result = await request(`devices/${device.id}/raw-capture`, {
        method: "POST",
        body: JSON.stringify({
          durationMs,
          probeHex: probeHex.replace(/\s+/g, "") || undefined,
        }),
      });
      setCaptureEvents(result.events);
      setCaptureMessage(result.message);
    } catch (e) {
      setCaptureEvents([]);
      setCaptureMessage(
        e instanceof Error ? e.message : "Perekaman gagal.",
      );
    } finally {
      setBusy("");
    }
  };
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
      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="mb-2 font-semibold">Rekam data mentah</h3>
        <p className="mb-4 text-xs text-slate-500">
          Buka koneksi TCP polos ke gateway dan catat semua byte yang lewat
          apa adanya, tanpa asumsi protokol Modbus. Berguna kalau perangkat
          diduga memakai protokol proprietary, bukan Modbus RTU/TCP.
        </p>
        <fieldset
          disabled={!!busy}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="field w-32">
            Durasi (ms)
            <input
              className="input"
              type="number"
              min={200}
              max={15000}
              step={100}
              value={durationMs}
              onChange={(e) => setDurationMs(+e.target.value)}
            />
          </label>
          <label className="field min-w-0 flex-1">
            Probe hex (opsional)
            <input
              className="input"
              placeholder="mis. 08 03 00 00 00 02 C4 0B"
              value={probeHex}
              onChange={(e) => setProbeHex(e.target.value)}
            />
          </label>
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() => void capture()}
          >
            {busy === "capture" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Radio size={16} />
            )}
            Rekam
          </button>
        </fieldset>
        {captureMessage && (
          <p className="mt-3 text-xs text-slate-500">{captureMessage}</p>
        )}
        {captureEvents && captureEvents.length > 0 && (
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 font-mono text-xs">
            {captureEvents.map((ev, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="text-slate-400">
                  {new Date(ev.at).toLocaleTimeString("id-ID")}
                </span>
                <span
                  className={
                    ev.direction === "rx"
                      ? "font-semibold text-emerald-700"
                      : "font-semibold text-brand-700"
                  }
                >
                  {ev.direction === "rx" ? "RX" : "TX"}
                </span>
                <span className="break-all">{ev.hex}</span>
                <span className="text-slate-400">({ev.length}B)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
