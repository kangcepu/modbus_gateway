# Montara UI Templates

Folder ini adalah sumber komponen yang **langsung dipakai** aplikasi Next.js:

- `login-page.tsx` → `/login`, termasuk pembuatan administrator pertama dan dialog error.
- `sidebar.tsx` → navigasi desktop, collapse, dan drawer ponsel.
- `navbar.tsx` → judul halaman, breadcrumb, jam, notifikasi, dan menu profil.
- `profile-page.tsx` → `/profile`, informasi akun dan ganti password.

Alias `@template/*` dan content Tailwind dikonfigurasi di `apps/web`.
Komponen terhubung ke sesi melalui `apps/web/lib/session.tsx` dan layout bersama
`apps/web/app/components/shell.tsx`. Styling bersama ada di
`apps/web/app/globals.css`; stylesheet lama tidak lagi diimpor.

Desain mengikuti template asal: sidebar `#0a0f1c`, navbar putih setinggi 64px,
tombol collapse gelap, kartu putih dengan border slate, serta login gradient
ungu–pink–oranye dan kartu glass. Seluruh halaman menggunakan Google Inter
melalui `next/font/google`, termasuk judul dan jam.

Data akun mengikuti API Montara: nama, username, role, dan role group.
API belum menyediakan unggah avatar, email, divisi, atau company, sehingga
profil menggunakan inisial nama dan hanya menampilkan field yang tersedia.
Ganti password memakai `PATCH /api/auth/password` dengan verifikasi password lama.

## Monitoring

Dashboard dan monitoring memakai model gateway–mesin yang sama, dengan refresh
HTTP terautentikasi. Dashboard mendukung widget nilai/gauge/tren, layout per akun,
filter, dan diagnostik Modbus. Lihat [panduan dashboard](../docs/dashboard.md).

## Build saat dev server sedang berjalan

Gunakan output terpisah agar build tidak menimpa cache dev server:

```sh
NEXT_DIST_DIR=.next-verify npm run build -w @iot/web
```

## MasterData dan branding

Sidebar memuat grup MasterData untuk UserManagement, Role Management, Permission Management, dan Setting. Nama aplikasi, subtitle, logo/icon, dan favicon dibaca dari setting publik melalui BrandingProvider. Panduan MinIO dan penambahan kategori konfigurasi ada di [docs/settings.md](../docs/settings.md).
