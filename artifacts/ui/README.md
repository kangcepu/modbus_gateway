# Verifikasi UI Montara

Screenshot di folder ini dibuat dari browser Chromium pada ukuran desktop
1440 × 1000 dan ponsel 390 × 844. Data akun, mesin, dan telemetry adalah fixture
pengujian melalui intercept API, bukan data mesin produksi.

Alur yang diperiksa:

- Login, tampil/sembunyikan password, dialog kredensial salah, dan logout.
- Navigasi dashboard, monitoring, konfigurasi Modbus, dan profil.
- Font Google Inter berhasil diterapkan.
- Form simpan gagal mempertahankan input; dialog ubah dan hapus dapat dibatalkan.
- Konfirmasi password yang berbeda mencegah submit; hasil sukses ditampilkan.
- Drawer ponsel dapat dibuka dan ditutup setelah navigasi.
- Halaman konfigurasi dan profil tidak menyebabkan overflow horizontal viewport.
- Tidak ada error JavaScript browser selama alur tersebut.

Build frontend/backend dan tes backend perubahan password juga dijalankan:

```sh
NEXT_DIST_DIR=.next-verify npm run build
node --test apps/api/test/profile-password.test.cjs
```

Tes backend memeriksa password lama yang salah, penyimpanan hash baru, dan
SessionGuard pada endpoint perubahan password. Koneksi Modbus fisik dan
perubahan data pada database produksi tidak dijalankan dalam pengujian UI.
