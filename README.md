# Modbus Realtime Monitoring

Dashboard monitoring industrial berbasis **NestJS**, **NextJS**, PostgreSQL, dan polling HTTP terautentikasi. Konfigurasi koneksi Modbus tidak memakai environment variable: perangkat dan register/tag dibuat, diubah, atau dihapus melalui dashboard lalu disimpan di database. `DATABASE_URL` diperlukan pada `.env`; `SETTINGS_ENCRYPTION_KEY` digunakan untuk mengenkripsi kredensial MinIO.

## Menjalankan lokal

1. Salin konfigurasi database:

   ```bash
   cp .env.example .env
   ```

2. Siapkan PostgreSQL. Cara cepat menggunakan Docker:

   ```bash
   docker compose up -d
   ```

3. Buat skema database dan nyalakan aplikasi:

   ```bash
   npm run migration:run
   npm run dev
   ```

Dashboard tersedia pada `http://localhost:3004`; API pada `http://localhost:3003`.

## Fitur

- Perangkat Modbus TCP dinamis: host, port, unit ID, status aktif, dan interval polling.
- Tag/register dinamis per perangkat: FC1, FC2, FC3, FC4; tipe `uint16`, `int16`, `uint32`, `int32`, `float32`, `coil`; skala dan satuan.
- Telemetry disimpan ke PostgreSQL dan ditampilkan melalui refresh HTTP terautentikasi.
- Migration TypeORM versioned di `apps/api/src/database/migrations`.

Untuk menambah perubahan skema, buat migration baru dengan:

```bash
npm run migration:generate -w @iot/api -- NamaPerubahan
npm run migration:run
```

Gunakan `npm run migration:revert` untuk mengembalikan satu migration terakhir.

## MasterData dan Setting

Menu MasterData mengelompokkan UserManagement, Role Management, Permission Management, dan Setting. Setting mendukung identitas aplikasi, logo/icon/favicon, serta MinIO untuk attachment. Lihat [panduan konfigurasi](docs/settings.md).

## Dashboard interaktif

Dashboard dapat dikustom per pengguna dengan widget nilai, gauge, dan tren historis. Mesin baru muncul otomatis; tersedia filter, detail register, dan diagnostik Modbus. Lihat [panduan dashboard](docs/dashboard.md).
