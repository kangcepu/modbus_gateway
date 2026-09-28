"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/app/components/shell";
import { initials, request, useSession } from "@/lib/session";

export default function ProfilePage() {
  const { user } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const error =
    next && next.length < 6
      ? "Minimal 6 karakter."
      : confirm && next !== confirm
        ? "Konfirmasi tidak cocok."
        : "";
  return (
    <AppShell title="Profil Saya" activeHref="/profile">
      <div className="page-heading">
        <div>
          <h1>Profil Saya</h1>
          <p>Informasi akun dan keamanan password Anda.</p>
        </div>
      </div>
      {user && (
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="card h-fit p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-100 ring-1 ring-slate-200">
                <span className="text-xl font-semibold text-brand-700">
                  {initials(user.name)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">
                  {user.name}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{user.username}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-slate-200 pt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Hak Akses
              </p>
              <span className="badge">{user.roleGroup?.name || user.role}</span>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {user.roleGroup?.description ||
                  "Hak akses akun dikelola oleh administrator."}
              </p>
            </div>
          </aside>
          <div className="space-y-4">
            <section className="card p-5">
              <h2 className="border-b border-slate-200 pb-3 text-base font-semibold text-slate-900">
                Informasi Akun
              </h2>
              <div className="grid gap-x-5 gap-y-4 pt-4 sm:grid-cols-2">
                {[
                  ["Nama Lengkap", user.name],
                  ["Username", user.username],
                  ["Role", user.role],
                  ["Role Group", user.roleGroup?.name || "Belum ditetapkan"],
                ].map(([label, value]) => (
                  <label key={label} className="field">
                    {label}
                    <input
                      value={value}
                      readOnly
                      className="input bg-slate-50 text-slate-700"
                    />
                  </label>
                ))}
              </div>
            </section>
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Ganti Password
                </h2>
              </div>
              <form
                className="mt-4 space-y-4 border-t border-slate-200 pt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (error || pending) return;
                  setPending(true);
                  setMessage("");
                  try {
                    await request("auth/password", {
                      method: "PATCH",
                      body: JSON.stringify({
                        currentPassword: current,
                        newPassword: next,
                      }),
                    });
                    setFailed(false);
                    setMessage(
                      "Password diperbarui. Gunakan password baru saat login berikutnya.",
                    );
                    setCurrent("");
                    setNext("");
                    setConfirm("");
                  } catch (err) {
                    setFailed(true);
                    setMessage(
                      err instanceof Error
                        ? err.message
                        : "Gagal mengganti password.",
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <label className="field">
                  Password Saat Ini
                  <input
                    type="password"
                    className="input"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    Password Baru
                    <input
                      type="password"
                      className="input"
                      autoComplete="new-password"
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      minLength={6}
                      required
                    />
                    <span className="block text-xs font-normal text-slate-400">
                      Minimal 6 karakter.
                    </span>
                  </label>
                  <label className="field">
                    Konfirmasi Password Baru
                    <input
                      type="password"
                      className="input"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "password-error" : undefined}
                      required
                    />
                    {error && (
                      <span
                        id="password-error"
                        className="text-xs text-rose-600"
                      >
                        {error}
                      </span>
                    )}
                  </label>
                </div>
                {message && (
                  <p
                    role={failed ? "alert" : "status"}
                    className={
                      failed
                        ? "text-sm text-rose-600"
                        : "text-sm text-emerald-700"
                    }
                  >
                    {message}
                  </p>
                )}
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button
                    className="btn"
                    disabled={
                      !current || next.length < 6 || next !== confirm || pending
                    }
                  >
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan Password
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
