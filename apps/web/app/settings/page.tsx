"use client";
import { useEffect, useRef, useState } from "react";
import {
  Database,
  ImagePlus,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "../components/shell";
import { request, useSession } from "@/lib/session";
import { Branding, BrandImage, useBranding } from "@/lib/branding";

type MinioConfig = {
  enabled: boolean;
  endPoint: string;
  port: number;
  useSSL: boolean;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  hasSecretKey: boolean;
};
type AssetField = "logoUrl" | "iconUrl" | "faviconUrl";
export default function SettingsPage() {
  const { user } = useSession();
  const { branding, update } = useBranding();
  const [application, setApplication] = useState<Branding | null>(null);
  const [minio, setMinio] = useState<MinioConfig | null>(null);
  const [section, setSection] = useState<"application" | "storage">(
    "application",
  );
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState<Partial<Record<AssetField, string>>>(
    {},
  );
  const previewUrls = useRef<string[]>([]);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("settings");
      setApplication(data.application);
      setMinio({ ...data.minio, secretKey: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat setting.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.role === "admin") void load();
  }, [user?.id]);
  useEffect(
    () => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal.");
    } finally {
      setBusy("");
    }
  };
  const upload = (field: AssetField, file: File | undefined) => {
    if (!file || !application) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2 MB.");
      return;
    }
    void run(field, async () => {
      const form = new FormData();
      form.append("file", file);
      const result = await request("settings/branding/upload", {
        method: "POST",
        body: form,
      });
      setApplication((current) =>
        current ? { ...current, [field]: result.url } : current,
      );
      const preview = URL.createObjectURL(file);
      previewUrls.current.push(preview);
      setPreviews((current) => ({ ...current, [field]: preview }));
      setMessage(
        "Gambar berhasil diunggah. Klik Simpan identitas untuk menerapkannya.",
      );
    });
  };
  const setStorage = <K extends keyof MinioConfig>(
    key: K,
    value: MinioConfig[K],
  ) =>
    setMinio((current) => (current ? { ...current, [key]: value } : current));
  return (
    <AppShell title="Setting" activeHref="/settings">
      <div className="page-heading">
        <div>
          <h1>Setting</h1>
          <p>Kelola identitas aplikasi dan penyimpanan media.</p>
        </div>
        <span className="badge gap-1.5">
          <ShieldCheck size={14} />
          Administrator
        </span>
      </div>
      {user?.role !== "admin" ? (
        <div className="card empty">
          Setting hanya dapat diakses administrator.
        </div>
      ) : (
        <>
          <nav
            aria-label="Kategori setting"
            className="mb-6 flex gap-2 border-b border-slate-200 pb-3"
          >
            <button
              type="button"
              aria-current={section === "application" ? "page" : undefined}
              className={section === "application" ? "btn" : "btn-secondary"}
              onClick={() => {
                setSection("application");
                setError("");
                setMessage("");
              }}
            >
              <Settings size={16} />
              Identitas aplikasi
            </button>
            <button
              type="button"
              aria-current={section === "storage" ? "page" : undefined}
              className={section === "storage" ? "btn" : "btn-secondary"}
              onClick={() => {
                setSection("storage");
                setError("");
                setMessage("");
              }}
            >
              <Database size={16} />
              Penyimpanan
            </button>
          </nav>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              {error}
              {!application && (
                <button className="ml-3 underline" onClick={() => void load()}>
                  Coba lagi
                </button>
              )}
            </div>
          )}
          {message && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              {message}
            </div>
          )}
          {loading ? (
            <div className="card empty">Memuat konfigurasi…</div>
          ) : (
            application &&
            minio &&
            (section === "application" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("application", async () => {
                    const saved = await request("settings/application", {
                      method: "PATCH",
                      body: JSON.stringify(application),
                    });
                    update(saved);
                    setApplication(saved);
                    setMessage(
                      "Identitas aplikasi berhasil disimpan dan diterapkan.",
                    );
                  });
                }}
                className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"
              >
                <div className="space-y-5">
                  <section className="card p-5">
                    <h2 className="border-b border-slate-200 pb-3 text-base font-semibold">
                      Nama aplikasi / sistem
                    </h2>
                    <fieldset
                      disabled={Boolean(busy)}
                      className="mt-4 grid gap-4"
                    >
                      <label className="field">
                        Nama aplikasi
                        <input
                          className="input"
                          value={application.appName}
                          maxLength={80}
                          required
                          onChange={(e) =>
                            setApplication({
                              ...application,
                              appName: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Deskripsi singkat
                        <input
                          className="input"
                          value={application.appSubtitle}
                          maxLength={160}
                          onChange={(e) =>
                            setApplication({
                              ...application,
                              appSubtitle: e.target.value,
                            })
                          }
                        />
                      </label>
                    </fieldset>
                  </section>
                  <section className="card p-5">
                    <h2 className="text-base font-semibold">
                      Logo, icon & favicon
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Gunakan URL gambar atau unggah ke MinIO. PNG, JPG, WebP,
                      ICO; maksimal 2 MB per file.
                    </p>
                    <fieldset
                      disabled={Boolean(busy)}
                      className="mt-5 space-y-5"
                    >
                      {(
                        [
                          {
                            key: "logoUrl",
                            label: "Logo aplikasi",
                            hint: "Ditampilkan pada halaman login.",
                          },
                          {
                            key: "iconUrl",
                            label: "Icon aplikasi",
                            hint: "Ditampilkan pada sidebar. Menggunakan logo jika kosong.",
                          },
                          {
                            key: "faviconUrl",
                            label: "Favicon",
                            hint: "Icon pada tab browser; disarankan gambar persegi.",
                          },
                        ] as { key: AssetField; label: string; hint: string }[]
                      ).map(({ key, label, hint }) => (
                        <div
                          key={key}
                          className="border-t border-slate-100 pt-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1 text-slate-400">
                              <BrandImage
                                src={previews[key] || application[key]}
                                name={label}
                              />
                            </span>
                            <label className="field min-w-0 flex-1">
                              {label}
                              <input
                                className="input"
                                placeholder="https://… atau unggah gambar"
                                maxLength={2048}
                                value={application[key]}
                                onChange={(e) => {
                                  setApplication({
                                    ...application,
                                    [key]: e.target.value,
                                  });
                                  setPreviews((current) => ({
                                    ...current,
                                    [key]: undefined,
                                  }));
                                }}
                              />
                              <span className="block text-xs font-normal text-slate-400">
                                {hint}
                              </span>
                            </label>
                          </div>
                          <label className="btn-secondary relative mt-3 cursor-pointer">
                            <ImagePlus size={15} />
                            {busy === key
                              ? "Mengunggah…"
                              : `Unggah ${label.toLowerCase()}`}
                            <input
                              type="file"
                              className="absolute inset-0 w-full cursor-pointer opacity-0"
                              aria-label={`Unggah ${label.toLowerCase()}`}
                              accept="image/png,image/jpeg,image/webp,image/x-icon,.ico"
                              onChange={(e) => {
                                upload(key, e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </fieldset>
                  </section>
                  <div className="flex justify-end">
                    <button className="btn" disabled={Boolean(busy)}>
                      {busy === "application" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Simpan identitas
                    </button>
                  </div>
                </div>
                <aside className="card p-5">
                  <h2 className="text-sm font-semibold">Pratinjau sidebar</h2>
                  <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#0a0f1c] p-4 text-white">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900">
                      <BrandImage
                        src={
                          previews.iconUrl ||
                          application.iconUrl ||
                          previews.logoUrl ||
                          application.logoUrl
                        }
                        name={application.appName}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-bold">
                        {application.appName || branding.appName}
                      </p>
                      <p className="mt-1 break-words text-[11px] text-slate-400">
                        {application.appSubtitle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-slate-500">
                    Perubahan diterapkan setelah disimpan. Kosongkan URL untuk
                    menggunakan tampilan bawaan.
                  </p>
                </aside>
              </form>
            ) : (
              <form
                className="card max-w-4xl p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("minio", async () => {
                    const saved = await request("settings/minio", {
                      method: "PATCH",
                      body: JSON.stringify(minio),
                    });
                    setMinio({ ...saved, secretKey: "" });
                    setMessage("Konfigurasi MinIO berhasil disimpan.");
                  });
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      MinIO Object Storage
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Penyimpanan logo dan attachment aplikasi.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={minio.enabled}
                      disabled={Boolean(busy)}
                      onChange={(e) => setStorage("enabled", e.target.checked)}
                    />
                    Aktifkan MinIO
                  </label>
                </div>
                <fieldset
                  disabled={Boolean(busy)}
                  className="mt-5 grid gap-4 sm:grid-cols-2"
                >
                  <label className="field">
                    Endpoint
                    <input
                      className="input"
                      placeholder="minio.example.com atau 192.168.1.20"
                      value={minio.endPoint}
                      required={minio.enabled}
                      onChange={(e) => setStorage("endPoint", e.target.value)}
                    />
                    <span className="block text-xs font-normal text-slate-400">
                      Hostname / IP tanpa http:// dan tanpa nomor port.
                    </span>
                  </label>
                  <label className="field">
                    Port
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={65535}
                      required
                      value={minio.port}
                      onChange={(e) =>
                        setStorage("port", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="field">
                    Bucket
                    <input
                      className="input"
                      value={minio.bucket}
                      required
                      minLength={3}
                      maxLength={63}
                      pattern="[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]"
                      onChange={(e) => setStorage("bucket", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Region
                    <input
                      className="input"
                      placeholder="us-east-1"
                      value={minio.region}
                      onChange={(e) => setStorage("region", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Access key
                    <input
                      className="input"
                      autoComplete="off"
                      value={minio.accessKey}
                      required={minio.enabled}
                      onChange={(e) => setStorage("accessKey", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Secret key
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        minio.hasSecretKey
                          ? "Tersimpan — kosongkan untuk mempertahankan"
                          : "Masukkan secret key"
                      }
                      value={minio.secretKey}
                      required={minio.enabled && !minio.hasSecretKey}
                      onChange={(e) => setStorage("secretKey", e.target.value)}
                    />
                    <span className="block text-xs font-normal text-slate-400">
                      {minio.hasSecretKey
                        ? "Secret key tersimpan. Isi hanya untuk menggantinya."
                        : "Secret key disimpan terenkripsi."}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={minio.useSSL}
                      onChange={(e) => setStorage("useSSL", e.target.checked)}
                    />
                    Gunakan HTTPS / TLS
                  </label>
                </fieldset>
                <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                  Bucket harus sudah tersedia dan akun MinIO memiliki izin
                  baca/tulis. Mengubah endpoint tidak memindahkan file lama.
                  Simpan konfigurasi sebelum mengunggah logo.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("test", async () => {
                        const result = await request("settings/minio/test", {
                          method: "POST",
                          body: JSON.stringify(minio),
                        });
                        setMessage(result.message);
                      })
                    }
                  >
                    {busy === "test" && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    Tes koneksi
                  </button>
                  <button className="btn" disabled={Boolean(busy)}>
                    {busy === "minio" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Simpan MinIO
                  </button>
                </div>
              </form>
            ))
          )}
        </>
      )}
    </AppShell>
  );
}
