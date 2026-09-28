"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@template/sidebar";
import { AppHeader } from "@template/navbar";
import { useSession } from "@/lib/session";
export function AppShell({
  title,
  activeHref,
  children,
}: {
  title: string;
  activeHref: string;
  children: React.ReactNode;
}) {
  const { user, loading, error, refresh } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setDesktop(media.matches);
      if (media.matches) setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!loading && !user && !error) router.replace("/login");
  }, [loading, user, error, router]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [open]);
  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center">
        <div
          role="status"
          className="space-y-4 text-center text-sm text-slate-500"
        >
          {error || "Memuat sesi…"}
          {error && (
            <div className="flex justify-center gap-3">
              <button className="btn" onClick={() => void refresh()}>
                Coba lagi
              </button>
              <a className="btn-secondary" href="/login">
                Ke login
              </a>
            </div>
          )}
        </div>
      </main>
    );
  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3"
      >
        Lewati ke konten
      </a>
      <AppSidebar
        activeHref={activeHref}
        open={open}
        collapsed={collapsed}
        onClose={() => setOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <AppHeader
          title={title}
          collapsed={desktop ? collapsed : !open}
          onToggleSidebar={() => {
            if (window.matchMedia("(min-width: 1024px)").matches)
              setCollapsed(!collapsed);
            else setOpen(!open);
          }}
        />
        <main
          id="main-content"
          className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
