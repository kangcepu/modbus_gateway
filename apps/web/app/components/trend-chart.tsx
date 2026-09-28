"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/session";
import { formatValue } from "@/lib/monitoring";
type Point = {
  recordedAt: string;
  value: number;
  minimum?: number;
  maximum?: number;
};
export function TrendChart({
  tagId,
  minutes,
  tick,
  unit,
}: {
  tagId: string;
  minutes: number;
  tick: number;
  unit?: string;
}) {
  const [points, setPoints] = useState<Point[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    request(`telemetry/history?tagId=${tagId}&minutes=${minutes}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (active) {
          setPoints(data);
          setError("");
          setIndex(null);
        }
      })
      .catch(() => {
        if (active) setError("Tren gagal diperbarui.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [tagId, minutes, tick]);
  const min = Math.min(...points.map((p) => Number(p.value))),
    max = Math.max(...points.map((p) => Number(p.value))),
    span = max - min || 1;
  const start = points.length ? new Date(points[0].recordedAt).getTime() : 0,
    end = points.length
      ? new Date(points[points.length - 1].recordedAt).getTime()
      : 1;
  const x = (p: Point) =>
    10 +
    ((new Date(p.recordedAt).getTime() - start) / Math.max(1, end - start)) *
      280;
  const y = (p: Point) => 75 - ((Number(p.value) - min) / span) * 60;
  const selected =
    index === null
      ? points[points.length - 1]
      : points[Math.min(index, points.length - 1)];
  return (
    <div className="mt-3">
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
      {!points.length ? (
        <div className="grid h-28 place-items-center rounded-lg bg-slate-50 text-xs text-slate-500">
          {loading ? "Memuat tren…" : "Belum ada riwayat pada rentang ini."}
        </div>
      ) : (
        <>
          <svg
            preserveAspectRatio="none"
            viewBox="0 0 300 90"
            role="img"
            aria-label={`Tren register: minimum ${formatValue(min)}, maksimum ${formatValue(max)}`}
            className="h-28 w-full text-brand-600"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const time =
                start + ((e.clientX - box.left) / box.width) * (end - start);
              let best = 0;
              points.forEach((point, i) => {
                if (
                  Math.abs(new Date(point.recordedAt).getTime() - time) <
                  Math.abs(new Date(points[best].recordedAt).getTime() - time)
                )
                  best = i;
              });
              setIndex(best);
            }}
            onMouseLeave={() => setIndex(null)}
          >
            <path
              d="M10 15H290 M10 45H290 M10 75H290"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <polyline
              vectorEffect="non-scaling-stroke"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              points={points.map((p) => `${x(p)},${y(p)}`).join(" ")}
            />
            {selected && (
              <circle
                cx={x(selected)}
                cy={y(selected)}
                r="3"
                fill="currentColor"
              />
            )}
          </svg>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{new Date(start).toLocaleTimeString("id-ID")}</span>
            <span>{new Date(end).toLocaleTimeString("id-ID")}</span>
          </div>
          <label className="mt-2 block text-xs text-slate-500">
            <span className="sr-only">Pilih titik riwayat</span>
            <input
              aria-label="Pilih titik riwayat"
              type="range"
              className="w-full accent-blue-600"
              min={0}
              max={Math.max(0, points.length - 1)}
              value={index ?? points.length - 1}
              onChange={(e) => setIndex(+e.target.value)}
            />
            {selected && (
              <span>
                {new Date(selected.recordedAt).toLocaleString("id-ID")} ·{" "}
                {formatValue(selected.value)} {unit}
              </span>
            )}
          </label>
          <p className="mt-1 text-[10px] text-slate-400">
            Rata-rata per interval · Min {formatValue(min)} / Maks{" "}
            {formatValue(max)}
          </p>
        </>
      )}
    </div>
  );
}
