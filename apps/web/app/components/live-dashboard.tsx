"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { request, useSession } from "@/lib/session";
import {
  DashboardConfig,
  Device,
  Reading,
  Widget,
  formatValue,
  isStale,
  status,
} from "@/lib/monitoring";
import { AppShell } from "./shell";
import { Modal } from "./modal";
import { ModbusTools } from "./modbus-tools";
import { TrendChart } from "./trend-chart";
const empty: DashboardConfig = {
  refreshSeconds: 5,
  columns: 3,
  widgets: [],
  saved: false,
};
export function LiveDashboard({
  monitoring = false,
}: {
  monitoring?: boolean;
}) {
  const { user } = useSession();
  const [devices, setDevices] = useState<Device[]>([]),
    [readings, setReadings] = useState<Reading[]>([]),
    [config, setConfig] = useState<DashboardConfig>(empty),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [updated, setUpdated] = useState(0),
    [paused, setPaused] = useState(false),
    [customize, setCustomize] = useState(false),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState(""),
    [minutes, setMinutes] = useState(60),
    [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState<Widget | null>(null),
    [widgetError, setWidgetError] = useState("");
  const saved = useRef<DashboardConfig>(empty),
    alive = useRef(true),
    fetching = useRef(false),
    preferencesLoaded = useRef(false);
  const load = useCallback(async (initial = false) => {
    if (fetching.current) return;
    fetching.current = true;
    setBusy(true);
    try {
      const [d, r, c] = await Promise.all([
        request("devices"),
        request("telemetry/latest"),
        initial || !preferencesLoaded.current
          ? request("dashboard/preferences")
          : Promise.resolve(null),
      ]);
      if (!alive.current) return;
      setDevices(d);
      setReadings(r);
      setUpdated(Date.now());
      setError("");
      if (c) {
        preferencesLoaded.current = true;
        const next: DashboardConfig = c.saved
          ? c
          : {
              ...c,
              widgets: d
                .flatMap((device: Device) =>
                  device.tags
                    .filter((t) => t.enabled !== false)
                    .map((tag) => ({
                      id: crypto.randomUUID(),
                      tagId: tag.id,
                      type: "value",
                      title: "",
                      min: 0,
                      max: 100,
                      wide: false,
                    })),
                )
                .slice(0, 6),
            };
        setConfig(next);
        saved.current = next;
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Pembaruan gagal.");
    } finally {
      fetching.current = false;
      if (alive.current) {
        setBusy(false);
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    if (user) void load(true);
    return () => {
      alive.current = false;
    };
  }, [user, load]);
  useEffect(() => {
    if (!user || loading || paused) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const next = async () => {
      if (document.visibilityState === "visible") await load();
      if (active) timer = setTimeout(next, config.refreshSeconds * 1000);
    };
    timer = setTimeout(next, config.refreshSeconds * 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user, loading, paused, config.refreshSeconds, load]);
  const entries = devices.flatMap((device) =>
      device.tags.map((tag) => ({ device, tag })),
    ),
    byTag = new Map(entries.map((e) => [e.tag.id, e])),
    latest = new Map(readings.map((r) => [r.tagId, r]));
  const visible = devices.filter(
    (d) =>
      (!filter || d.id === filter) &&
      `${d.name} ${d.host} ${d.gatewayName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const ids = new Set(visible.map((d) => d.id));
  const detail = devices.find((d) => d.id === selected);
  const change = (next: DashboardConfig) => {
    setConfig(next);
    setDirty(true);
    setMessage("");
  };
  const move = (id: string, delta: number) => {
    const widgets = [...config.widgets],
      index = widgets.findIndex((w) => w.id === id),
      target = index + delta;
    if (index < 0 || target < 0 || target >= widgets.length) return;
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    change({ ...config, widgets });
  };
  const add = () => {
    const entry = entries.find((e) => !filter || e.device.id === filter);
    if (!entry) return;
    setWidgetError("");
    setEditor({
      id: crypto.randomUUID(),
      tagId: entry.tag.id,
      type: "value",
      title: "",
      min: 0,
      max: 100,
      wide: false,
    });
  };
  const save = async () => {
    if (!preferencesLoaded.current) {
      setError("Muat ulang konfigurasi dashboard sebelum menyimpan.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { saved: ignored, ...body } = config;
      const result = await request("dashboard/preferences", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setConfig(result);
      saved.current = result;
      setDirty(false);
      setMessage("Dashboard tersimpan untuk akun Anda.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan dashboard.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppShell
      title={monitoring ? "Monitoring Mesin" : "Dashboard"}
      activeHref={monitoring ? "/?tab=monitoring" : "/"}
    >
      <div className="page-heading">
        <div>
          <h1>{monitoring ? "Monitoring Mesin" : "Dashboard"}</h1>
          <p>
            {monitoring
              ? "Pilih mesin untuk melihat register dan diagnostik Modbus."
              : "Pantau mesin pilihan Anda melalui widget nilai, gauge, dan tren."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => void load(!updated)}
          >
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            Muat ulang
          </button>
          {!monitoring && (
            <button
              className={customize ? "btn" : "btn-secondary"}
              onClick={() => setCustomize(!customize)}
            >
              <Settings2 size={16} />
              {customize ? "Selesai mengatur" : "Atur dashboard"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error} {updated > 0 && "Data terakhir tetap ditampilkan."}
        </p>
      )}
      {message && (
        <p role="status" className="notice text-emerald-700">
          {message}
        </p>
      )}
      {loading ? (
        <div className="card empty" role="status">
          Memuat dashboard…
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Mesin terdaftar", devices.length],
              [
                "Mesin online",
                devices.filter((d) => status(d).label === "Online").length,
              ],
              ["Register terdaftar", entries.length],
            ].map(([label, value]) => (
              <div key={label} className="card p-5">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
            <label className="field min-w-0 flex-1">
              Mesin
              <select
                aria-label="Mesin"
                className="input min-w-[150px]"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Semua mesin</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · Unit {d.unitId}
                  </option>
                ))}
              </select>
            </label>
            <label className="field min-w-0 flex-1">
              Cari mesin / gateway
              <input
                className="input"
                placeholder="Nama atau alamat IP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="field">
              Riwayat
              <select
                className="input"
                value={minutes}
                onChange={(e) => setMinutes(+e.target.value)}
              >
                <option value={15}>15 menit</option>
                <option value={60}>1 jam</option>
                <option value={1440}>24 jam</option>
              </select>
            </label>
            <button
              className="btn-secondary"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
              {paused ? "Lanjutkan" : "Jeda tampilan"}
            </button>
            <p className="w-full text-xs text-slate-400">
              {paused
                ? "Pembaruan tampilan dijeda."
                : `Pembaruan setiap ${config.refreshSeconds} detik.`}{" "}
              {updated
                ? `Terakhir ${new Date(updated).toLocaleTimeString("id-ID")}`
                : "Belum ada pembaruan."}
            </p>
          </div>
          {!monitoring && (
            <>
              {(customize || dirty) && (
                <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                  {customize && (
                    <>
                      <label className="field">
                        Kolom desktop
                        <select
                          className="input"
                          value={config.columns}
                          disabled={saving}
                          onChange={(e) =>
                            change({ ...config, columns: +e.target.value })
                          }
                        >
                          {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              {n} kolom
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Refresh tampilan
                        <select
                          className="input"
                          value={config.refreshSeconds}
                          disabled={saving}
                          onChange={(e) =>
                            change({
                              ...config,
                              refreshSeconds: +e.target.value,
                            })
                          }
                        >
                          {[1, 2, 5, 10, 30].map((n) => (
                            <option key={n} value={n}>
                              {n} detik
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn-secondary"
                        disabled={
                          !entries.length ||
                          config.widgets.length >= 24 ||
                          saving
                        }
                        onClick={add}
                      >
                        <Plus size={16} />
                        Tambah widget
                      </button>
                    </>
                  )}
                  <button
                    className="btn"
                    disabled={saving}
                    onClick={() => void save()}
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Simpan dashboard
                  </button>
                  {dirty && (
                    <>
                      <button
                        className="btn-secondary"
                        disabled={saving}
                        onClick={() => {
                          setConfig(saved.current);
                          setDirty(false);
                        }}
                      >
                        Batalkan perubahan
                      </button>
                      <span className="self-center text-xs text-brand-700">
                        Belum disimpan
                      </span>
                    </>
                  )}
                  <p className="w-full text-xs text-slate-500">
                    Geser widget atau gunakan panah untuk mengurutkan. Maksimal
                    24 widget.
                  </p>
                </div>
              )}
              {!config.widgets.length ? (
                <div className="card mb-5 p-8 text-center">
                  <Radio className="mx-auto mb-3 text-slate-400" />
                  <h2 className="font-semibold">
                    {entries.length
                      ? "Susun dashboard Anda"
                      : "Siapkan mesin pertama"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {entries.length
                      ? "Tambahkan widget dari register mesin yang ingin dipantau."
                      : "Mesin dan register baru akan muncul otomatis setelah ditambahkan."}
                  </p>
                  {entries.length ? (
                    <button
                      className="btn mt-4"
                      onClick={() => {
                        setCustomize(true);
                        add();
                      }}
                    >
                      <Plus size={16} />
                      Tambah widget
                    </button>
                  ) : (
                    user?.role === "admin" && (
                      <Link className="btn mt-4" href="/?tab=mesin">
                        Tambah mesin & register
                      </Link>
                    )
                  )}
                </div>
              ) : (
                <div
                  className={`mb-6 grid gap-4 ${config.columns === 1 ? "grid-cols-1" : config.columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}
                >
                  {config.widgets
                    .filter(
                      (w) =>
                        (!filter && !search) ||
                        ids.has(byTag.get(w.tagId)?.device.id || ""),
                    )
                    .map((widget, index) => {
                      const entry = byTag.get(widget.tagId),
                        reading = latest.get(widget.tagId),
                        stale = entry ? isStale(reading, entry.device) : true;
                      const value = reading ? Number(reading.value) : null,
                        pct =
                          value === null
                            ? 0
                            : Math.max(
                                0,
                                Math.min(
                                  100,
                                  ((value - widget.min) /
                                    (widget.max - widget.min)) *
                                    100,
                                ),
                              );
                      const tagFailed =
                        !!entry?.device.health?.tagErrors?.[widget.tagId];
                      return (
                        <article
                          key={widget.id}
                          className={`card min-w-0 p-5 ${widget.wide ? "sm:col-span-full" : ""}`}
                          onDragOver={(e) => {
                            if (customize) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!customize || saving) return;
                            const id = e.dataTransfer.getData("text/plain");
                            const from = config.widgets.findIndex(
                                (w) => w.id === id,
                              ),
                              to = config.widgets.findIndex(
                                (w) => w.id === widget.id,
                              );
                            if (from < 0 || to < 0) return;
                            const widgets = [...config.widgets];
                            const [moving] = widgets.splice(from, 1);
                            widgets.splice(to, 0, moving);
                            change({ ...config, widgets });
                          }}
                        >
                          {customize && (
                            <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2">
                              <span
                                draggable={!saving}
                                onDragStart={(e) =>
                                  e.dataTransfer.setData(
                                    "text/plain",
                                    widget.id,
                                  )
                                }
                                className="cursor-grab rounded p-1 text-slate-400"
                                title="Geser widget"
                              >
                                <GripVertical size={16} />
                              </span>
                              <button
                                className="icon-btn"
                                disabled={
                                  saving || config.widgets[0]?.id === widget.id
                                }
                                aria-label={`Naikkan ${widget.title || entry?.tag.name || "widget"}`}
                                onClick={() => move(widget.id, -1)}
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                className="icon-btn"
                                disabled={
                                  saving ||
                                  config.widgets[config.widgets.length - 1]
                                    ?.id === widget.id
                                }
                                aria-label={`Turunkan ${widget.title || entry?.tag.name || "widget"}`}
                                onClick={() => move(widget.id, 1)}
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                className="icon-btn"
                                disabled={saving}
                                aria-label={`Ubah widget ${widget.title || entry?.tag.name || ""}`}
                                onClick={() => {
                                  setWidgetError("");
                                  setEditor(widget);
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                className="icon-btn ml-auto text-rose-600"
                                disabled={saving}
                                aria-label={`Hapus widget ${widget.title || entry?.tag.name || ""}`}
                                onClick={() =>
                                  change({
                                    ...config,
                                    widgets: config.widgets.filter(
                                      (w) => w.id !== widget.id,
                                    ),
                                  })
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                          <h2 className="truncate font-semibold">
                            {widget.title ||
                              entry?.tag.name ||
                              "Register tidak tersedia"}
                          </h2>
                          {entry ? (
                            <>
                              <button
                                className="mt-1 text-left text-xs text-brand-600 hover:underline"
                                onClick={() => setSelected(entry.device.id)}
                              >
                                {entry.device.name} · Unit {entry.device.unitId}
                              </button>
                              <p
                                className={`mt-4 text-3xl font-semibold tabular-nums ${tagFailed ? "text-rose-600" : stale ? "text-slate-400" : "text-slate-900"}`}
                              >
                                {value === null ? "—" : formatValue(value)}{" "}
                                <span className="text-sm font-normal text-slate-500">
                                  {entry.tag.unit}
                                </span>
                              </p>
                              {widget.type === "gauge" && (
                                <div className="mt-4">
                                  <div
                                    role="meter"
                                    aria-label={widget.title || entry.tag.name}
                                    aria-valuemin={widget.min}
                                    aria-valuemax={widget.max}
                                    aria-valuenow={
                                      value === null
                                        ? undefined
                                        : Math.max(
                                            widget.min,
                                            Math.min(widget.max, value),
                                          )
                                    }
                                    aria-valuetext={
                                      value === null
                                        ? "Belum ada data"
                                        : String(value)
                                    }
                                    className="h-3 overflow-hidden rounded-full bg-slate-100"
                                  >
                                    <div
                                      className="h-full rounded-full bg-brand-500 transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="mt-2 flex justify-between text-xs text-slate-400">
                                    <span>{widget.min}</span>
                                    <span>{widget.max}</span>
                                  </div>
                                  {value !== null &&
                                    (value < widget.min ||
                                      value > widget.max) && (
                                      <p className="mt-1 text-xs text-amber-700">
                                        Nilai di luar rentang tampilan.
                                      </p>
                                    )}
                                </div>
                              )}
                              {widget.type === "trend" && (
                                <TrendChart
                                  tagId={widget.tagId}
                                  minutes={minutes}
                                  tick={Math.floor(updated / 10000)}
                                  unit={entry.tag.unit}
                                />
                              )}
                              <p className="mt-3 text-xs text-slate-400">
                                {tagFailed
                                  ? "Pembacaan gagal · "
                                  : stale
                                    ? "Data lama / menunggu · "
                                    : ""}
                                {reading
                                  ? new Date(reading.recordedAt).toLocaleString(
                                      "id-ID",
                                    )
                                  : "Belum ada pembacaan"}
                              </p>
                            </>
                          ) : (
                            <p className="mt-4 text-sm text-slate-500">
                              Register telah dihapus atau akses berubah. Hapus
                              atau pilih register lain melalui Atur dashboard.
                            </p>
                          )}
                        </article>
                      );
                    })}
                </div>
              )}
            </>
          )}
          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Mesin & koneksi Modbus</h2>
              {user?.role === "admin" && (
                <Link
                  className="text-sm font-medium text-brand-600 hover:underline"
                  href="/?tab=mesin"
                >
                  Kelola mesin & register
                </Link>
              )}
            </div>
            {!visible.length ? (
              <div className="empty">
                {devices.length
                  ? "Tidak ada mesin yang cocok dengan filter."
                  : "Belum ada mesin yang dapat Anda akses."}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mesin</th>
                      <th>Gateway</th>
                      <th>Unit ID</th>
                      <th>Status pembacaan</th>
                      <th>Register</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((d) => {
                      const health = status(d);
                      return (
                        <tr key={d.id}>
                          <td>
                            <button
                              className="font-medium text-brand-600 hover:underline"
                              onClick={() => setSelected(d.id)}
                            >
                              {d.name}
                            </button>
                          </td>
                          <td className="whitespace-nowrap">
                            {d.host}:{d.port}
                          </td>
                          <td>{d.unitId}</td>
                          <td>
                            <span className={`badge ${health.color}`}>
                              {health.label}
                            </span>
                          </td>
                          <td>{d.tags.length}</td>
                          <td>
                            <button
                              className="btn-secondary whitespace-nowrap"
                              onClick={() => setSelected(d.id)}
                            >
                              Lihat detail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <Modal
        open={!!detail}
        title={detail?.name || "Detail mesin"}
        onClose={() => setSelected(null)}
      >
        {detail && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className={`badge ${status(detail).color}`}>
                {status(detail).label}
              </span>
              <p className="text-xs text-slate-500">
                {detail.host}:{detail.port} · Unit ID {detail.unitId} · Polling{" "}
                {detail.pollIntervalMs} ms
              </p>
            </div>
            {detail.health?.error && (
              <p className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {detail.health.error}
              </p>
            )}
            <div className="space-y-2">
              {detail.tags.length ? (
                detail.tags.map((tag) => {
                  const r = latest.get(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">
                          {tag.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          FC{tag.functionCode} · Alamat {tag.address} ·{" "}
                          {tag.dataType} · Skala {tag.scale ?? 1}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {r
                            ? new Date(r.recordedAt).toLocaleString("id-ID")
                            : "Belum ada data"}
                          {tag.enabled === false ? " · Nonaktif" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">
                        {r ? formatValue(r.value) : "—"}{" "}
                        <small>{tag.unit}</small>
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="empty">Belum ada register.</p>
              )}
            </div>
            {user?.role === "admin" && (
              <ModbusTools key={detail.id} device={detail} />
            )}
          </>
        )}
      </Modal>
      <Modal
        open={!!editor}
        title={
          config.widgets.some((w) => w.id === editor?.id)
            ? "Ubah widget"
            : "Tambah widget"
        }
        onClose={() => setEditor(null)}
      >
        {editor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editor.type === "gauge" && editor.max <= editor.min) {
                setWidgetError("Maksimum harus lebih besar dari minimum.");
                return;
              }
              if (!byTag.has(editor.tagId)) {
                setWidgetError("Pilih register yang tersedia.");
                return;
              }
              const exists = config.widgets.some((w) => w.id === editor.id);
              if (!exists && config.widgets.length >= 24) {
                setWidgetError("Maksimal 24 widget.");
                return;
              }
              change({
                ...config,
                widgets: exists
                  ? config.widgets.map((w) => (w.id === editor.id ? editor : w))
                  : [...config.widgets, editor],
              });
              setEditor(null);
              setCustomize(true);
            }}
            className="space-y-4"
          >
            <label className="field">
              Register mesin
              <select
                className="input"
                required
                value={editor.tagId}
                onChange={(e) =>
                  setEditor({ ...editor, tagId: e.target.value })
                }
              >
                {devices.map((d) => (
                  <optgroup key={d.id} label={`${d.name} · Unit ${d.unitId}`}>
                    {d.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · FC{t.functionCode} / {t.address}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">
              Judul widget
              <input
                className="input"
                maxLength={80}
                placeholder="Kosongkan untuk menggunakan nama register"
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
              />
            </label>
            <label className="field">
              Jenis widget
              <select
                className="input"
                value={editor.type}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    type: e.target.value as Widget["type"],
                  })
                }
              >
                <option value="value">Nilai terkini</option>
                <option value="gauge">Gauge / rentang nilai</option>
                <option value="trend">Tren historis</option>
              </select>
            </label>
            {editor.type === "gauge" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  Minimum
                  <input
                    className="input"
                    type="number"
                    step="any"
                    required
                    value={editor.min}
                    onChange={(e) =>
                      setEditor({ ...editor, min: +e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Maksimum
                  <input
                    className="input"
                    type="number"
                    step="any"
                    required
                    value={editor.max}
                    onChange={(e) =>
                      setEditor({ ...editor, max: +e.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={editor.wide}
                onChange={(e) =>
                  setEditor({ ...editor, wide: e.target.checked })
                }
              />
              Lebar penuh
            </label>
            {widgetError && (
              <p role="alert" className="text-sm text-rose-600">
                {widgetError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditor(null)}
              >
                Batal
              </button>
              <button className="btn">
                <Check size={16} />
                Terapkan widget
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
