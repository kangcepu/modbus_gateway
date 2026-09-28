# MasterData dan konfigurasi sistem

## Navigasi

Menu administrator **MasterData** berisi:

- **UserManagement** → `/?tab=pengguna`
- **Role Management** → `/?tab=role`
- **Permission Management** → `/?tab=permission`
- **Setting** → `/settings`

URL lama tetap tersedia. Operator tidak dapat mengubah setting atau mengakses
API administrasi setting.

## Identitas aplikasi

Nama aplikasi, deskripsi singkat, logo login, icon sidebar, dan favicon disimpan
di kategori `application`. Perubahan diterapkan setelah tombol **Simpan identitas**
ditekan. URL HTTP/HTTPS dapat digunakan tanpa MinIO. Logo dapat diunggah setelah
konfigurasi MinIO aktif dan disimpan. Format: PNG, JPG, WebP, ICO; maksimal 2 MB.
URL kosong memakai tampilan bawaan. Icon sidebar memakai logo jika icon kosong.

Gambar yang diunggah belum menjadi publik sampai URL-nya dipilih dalam setting
dan disimpan. Endpoint publik hanya membaca tiga gambar branding yang saat itu
dipilih. Attachment biasa tetap memerlukan sesi administrator.

## MinIO

Isi endpoint (hostname/IP tanpa scheme/port), port, bucket, region, access key,
secret key, dan opsi TLS. Bucket harus sudah dibuat. **Tes koneksi** memeriksa
akses bucket menggunakan nilai form; tes tidak menyimpan konfigurasi. Upload
logo menggunakan konfigurasi yang sudah disimpan dan memerlukan izin tulis.
Implementasi memakai [MinIO JavaScript SDK](https://docs.min.io/aistor/developers/sdk/javascript/api/).

Secret key disimpan memakai AES-256-GCM. API hanya mengembalikan indikator
`hasSecretKey`, bukan secret key atau ciphertext. Field secret yang dikosongkan
saat menyimpan mempertahankan secret sebelumnya.

`SETTINGS_ENCRYPTION_KEY` di `.env` harus berupa 64 karakter hex acak. Kunci lokal
sudah dibuat tanpa mengganti konfigurasi database. Untuk deployment baru:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Simpan hasil sebagai `SETTINGS_ENCRYPTION_KEY`. Backup kunci bersama database;
jangan mengganti kunci tanpa mengenkripsi ulang secret yang sudah tersimpan.

Mengganti endpoint tidak memindahkan attachment lama. Metadata menyimpan endpoint
dan bucket asal, dan menolak membaca file melalui endpoint berbeda. Memindahkan
storage memerlukan migrasi file tersendiri. Menonaktifkan MinIO menghentikan
upload baru; gambar/file yang sudah ada masih dapat dibaca selama koneksi valid.

## Database dan pengembangan berikutnya

Migration `1720000004000-SystemSettings.ts` membuat:

- `system_settings`: key kategori, value JSONB, updated_by, updated_at.
- `attachments`: metadata file, object key, lokasi bucket, pemilik, dan waktu upload.

Kategori awal: `application` dan `storage.minio`. Kategori baru dapat ditambahkan
melalui DTO tervalidasi, service, dan kartu/form setting tanpa mengubah struktur
tabel. Jangan mengekspos seluruh JSONB melalui endpoint publik; branding memakai
proyeksi field eksplisit. Kredensial baru harus dienkripsi dan dihapus dari respons.

`SettingsModule` mengekspor `SettingsService` untuk integrasi attachment berikutnya:

- `GET /api/settings/branding` — branding publik.
- `GET /api/settings` — setting administrator, secret disamarkan.
- `PATCH /api/settings/application` — simpan branding.
- `PATCH /api/settings/minio` — simpan storage.
- `POST /api/settings/minio/test` — tes akses bucket.
- `POST /api/settings/branding/upload` — multipart field `file`, maks 2 MB.
- `POST /api/settings/attachments` — multipart field `file`, maks 20 MB.
- `GET /api/settings/attachments/:id` — download administrator.
- `GET /api/settings/assets/:id` — hanya gambar branding aktif.

Upload yang belum diterapkan tetap tercatat sebagai attachment. Kebijakan retensi
atau pembersihan attachment belum digunakan agar tidak menghapus file pengguna.

## Verifikasi

```sh
npm run migration:run
NEXT_DIST_DIR=.next-verify npm run build
node --test apps/api/test/settings.test.cjs apps/api/test/profile-password.test.cjs
```

Migration telah dijalankan pada database lokal. Tes SDK memakai server fixture
protokol S3 lokal (bucket check, upload, download), tanpa kredensial eksternal.
Pengujian browser memakai API simulasi untuk navigasi, save/reload branding,
favicon, upload, penyimpanan secret, error koneksi, dan pembatasan operator.
Screenshot tersedia di `artifacts/masterdata/`.

MinIO eksternal belum diaktifkan karena endpoint dan kredensial pengguna belum
tersedia. Konfigurasi awal tetap nonaktif; masukkan nilai sebenarnya lewat Setting.
