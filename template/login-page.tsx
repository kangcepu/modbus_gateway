"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Wrench } from "lucide-react";
import { request, useSession } from "@/lib/session";
import { BrandImage, useBranding } from "@/lib/branding";
import { Modal } from "@/app/components/modal";

export default function LoginPage() {
  const { branding } = useBranding();
  const { login, user, loading } = useSession();
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [bootstrapError, setBootstrapError] = useState("");
  const [notice, setNotice] = useState("");
  const check = () => {
    setBootstrapError("");
    request("auth/bootstrap")
      .then((data) => setReady(data.ready))
      .catch(() =>
        setBootstrapError(
          "Server belum dapat dihubungi. Periksa koneksi lalu coba lagi.",
        ),
      );
  };
  useEffect(check, []);
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#7d5a91] via-[#c98a9b] to-[#f0a97e] px-4 py-10">
      <h1 className="mb-8 text-center text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-4xl">
        WELCOME {branding.appName}
      </h1>
      <div className="w-full max-w-sm rounded-3xl border border-white/25 bg-white/15 p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white shadow-md">
            <BrandImage
              src={branding.logoUrl || branding.iconUrl}
              name={branding.appName}
            />
          </span>
          <span>
            <span className="block text-xl font-bold text-white">
              {branding.appName}
            </span>
            <span className="block text-xs text-white/80">
              {branding.appSubtitle}
            </span>
          </span>
        </div>
        {bootstrapError ? (
          <div role="alert" className="space-y-4 text-sm text-white">
            <p>{bootstrapError}</p>
            <button
              className="rounded-full bg-rose-600 px-5 py-2 font-semibold"
              onClick={check}
            >
              Coba lagi
            </button>
          </div>
        ) : ready === null || loading ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-white"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat…
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setPending(true);
              try {
                if (!ready) {
                  await request("auth/bootstrap", {
                    method: "POST",
                    body: JSON.stringify({
                      name: data.get("name"),
                      username: data.get("username"),
                      password: data.get("password"),
                      role: "admin",
                    }),
                  });
                  setReady(true);
                  setNotice("Administrator berhasil dibuat. Silakan login.");
                } else
                  await login(
                    String(data.get("username")),
                    String(data.get("password")),
                  );
              } catch (err) {
                setError(err instanceof Error ? err.message : "Login gagal.");
                setShowPassword(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {!ready && (
              <p className="text-sm text-white/90">
                Buat akun administrator pertama untuk menyiapkan sistem.
              </p>
            )}
            {!ready && (
              <label className="login-label">
                Nama lengkap
                <input
                  name="name"
                  className="login-input"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="login-label">
              Username
              <input
                name="username"
                className="login-input"
                required
                minLength={3}
                maxLength={50}
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className="login-label">
              Password
              <span className="relative block">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="login-input pr-11"
                  required
                  minLength={6}
                  autoComplete={ready ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </span>
            </label>
            {notice && (
              <p role="status" className="text-sm text-white">
                {notice}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <button
                disabled={pending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-rose-600 px-7 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending
                  ? "Memproses…"
                  : ready
                    ? "Login"
                    : "Buat administrator"}
              </button>
            </div>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-white/80">
        Copyright © {new Date().getFullYear()}, {branding.appName}
        <br />
        All rights reserved.
      </p>
      <Modal
        open={Boolean(error)}
        title="Login Gagal"
        onClose={() => setError("")}
      >
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-6 py-8 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-slate-950">
            Login Gagal
          </h2>
          <p role="alert" className="text-lg font-semibold text-slate-950">
            {error}
          </p>
          <button className="btn" onClick={() => setError("")}>
            Coba kembali
          </button>
        </div>
      </Modal>
    </main>
  );
}
