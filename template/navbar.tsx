"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, Clock, UserCog } from "lucide-react";
import { cn, initials, useSession } from "@/lib/session";

export function AppHeader({
  onToggleSidebar,
  collapsed,
  title,
}: {
  onToggleSidebar: () => void;
  collapsed: boolean;
  title: string;
}) {
  const { user, logout } = useSession();
  const [now, setNow] = useState<Date | null>(null);
  const [panel, setPanel] = useState<"profile" | "notifications" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPanel(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    document.addEventListener("click", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white pr-4">
      <button
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Buka menu" : "Tutup menu"}
        aria-expanded={!collapsed}
        className="relative grid h-16 w-10 shrink-0 place-items-center rounded-r-[2rem] border-y border-r border-white/10 bg-gradient-to-b from-[#09111f] to-[#070d18] text-white shadow-[0_10px_20px_rgba(5,11,23,0.18)] transition-colors hover:from-[#111d31] hover:to-[#0d1728]"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            collapsed && "rotate-180",
          )}
        />
      </button>
      <div className="min-w-0 flex-1 py-2">
        <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">
          {title}
        </p>
        <p className="truncate text-xs leading-tight text-slate-400">
          {title === "Dashboard"
            ? "Dashboard"
            : [
                  "Setting",
                  "UserManagement",
                  "Role Management",
                  "Permission Management",
                ].includes(title)
              ? `Dashboard → MasterData → ${title}`
              : `Dashboard → ${title}`}
        </p>
      </div>
      <div ref={ref} className="flex items-center gap-4">
        <div className="hidden min-w-[152px] items-center justify-center gap-2 border-r border-slate-200 pr-4 sm:flex">
          <Clock className="h-4 w-4 text-slate-400" />
          <div className="min-w-[104px] text-center leading-tight">
            <p className="text-sm font-semibold tabular-nums text-slate-800">
              {now?.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }) || "--:--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {now?.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }) || "-- --- ----"}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Notifikasi"
            aria-expanded={panel === "notifications"}
            onClick={() =>
              setPanel(panel === "notifications" ? null : "notifications")
            }
          >
            <Bell className="h-5 w-5" />
          </button>
          {panel === "notifications" && (
            <div className="absolute -right-14 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg sm:right-0">
              <p className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                Notifikasi
              </p>
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Lihat nilai register dan waktu pembacaan terakhir di Monitoring
                Mesin.
              </p>
              <Link
                className="block border-t border-slate-100 px-3 py-3 text-center text-xs font-medium text-brand-600 hover:bg-slate-50"
                href="/?tab=monitoring"
                onClick={() => setPanel(null)}
              >
                Buka Monitoring Mesin
              </Link>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            className="flex min-w-0 items-center gap-2"
            aria-label="Menu profil"
            aria-expanded={panel === "profile"}
            onClick={() => setPanel(panel === "profile" ? null : "profile")}
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold tracking-tight text-brand-700 ring-1 ring-brand-200"
            >
              {initials(user?.name || "?")}
            </span>
            <span className="hidden max-w-[220px] truncate text-sm font-medium text-slate-800 sm:block">
              {user?.name}
            </span>
          </button>
          {panel === "profile" && (
            <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-800">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {user?.username}
                </p>
              </div>
              <Link
                href="/profile"
                onClick={() => setPanel(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserCog className="h-4 w-4 text-slate-400" />
                Profil
              </Link>
              <button
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    await logout();
                  } catch {
                    setError("Logout gagal. Silakan coba lagi.");
                  } finally {
                    setPending(false);
                  }
                }}
                className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                {pending ? "Memproses…" : "Logout"}
              </button>
              {error && (
                <p role="alert" className="px-3 py-2 text-xs text-rose-600">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
