# Dashboard interaktif dan Modbus

## Mengatur dashboard

1. Tambahkan koneksi dan register di **Gateway & Register**. Mesin pada host/port
   yang sama memakai gateway bersama dan dibedakan oleh Unit ID.
2. Buka **Dashboard → Atur dashboard**. Tambahkan widget, pilih register mesin,
   jenis **Nilai terkini**, **Gauge**, atau **Tren historis**, lalu beri judul.
3. Gauge memiliki rentang minimum/maksimum untuk tampilan. Angka aktual tetap
   ditampilkan jika berada di luar rentang; batas ini bukan alarm atau kontrol mesin.
4. Atur lebar penuh, susunan dengan drag atau tombol panah, dan 1–3 kolom desktop.
   Ponsel memakai satu kolom. Maksimal 24 widget per akun.
5. Pilih refresh 1, 2, 5, 10, atau 30 detik dan tekan **Simpan dashboard**.
   Konfigurasi disimpan di PostgreSQL untuk pengguna yang sedang login.

Akun baru mendapat hingga enam widget nilai awal dari register yang tersedia.
Daftar mesin dan pilihan register diperbarui otomatis; widget baru dapat ditambahkan
saat alat baru tersedia. Menyimpan layout kosong tetap mempertahankan pilihan itu.
Filter mesin dan pencarian hanya mengubah tampilan, bukan konfigurasi tersimpan.
**Jeda tampilan** menghentikan refresh browser; polling backend tetap berjalan.

Tren dapat dilihat untuk 15 menit, 1 jam, atau 24 jam. API mengagregasikan rata-rata
menjadi maksimal 181 titik, bukan mengirim seluruh telemetry. Arahkan pointer atau
pilih slider untuk melihat waktu dan nilai suatu titik. Widget tren diperbarui
paling cepat setiap 10 detik saat dashboard melakukan refresh.

## Detail dan diagnostik

Klik nama mesin atau **Lihat detail** untuk melihat nilai, satuan, FC, alamat,
tipe data, skala, timestamp, dan error pembacaan. Administrator dapat memakai
**Tes koneksi** dan **Pindai Unit ID**. Pemindaian maksimal 32 Unit ID per permintaan,
menggunakan FC/alamat yang dipilih. Tidak ada respons pada suatu alamat tidak
menjamin bahwa Unit ID tersebut tidak ada.

Status mesin berasal dari hasil polling: menunggu, online, sebagian gagal,
offline, nonaktif, atau data lama. Data dianggap lama setelah tiga kali interval
polling atau 30 detik (mana yang lebih besar). Nilai lama tidak diganti angka nol.
Status runtime kembali menunggu setelah backend restart, hingga polling berikutnya.

Implementasi menggunakan pembacaan [modbus-serial](https://github.com/yaacov/node-modbus-serial).
Alamat register berbasis nol; FC1/FC2 memakai tipe `coil`, FC3/FC4 tipe numerik.
Decode 32-bit saat ini memakai urutan word big-endian. Alat dengan word order lain
memerlukan dukungan konversi tambahan. Dashboard tidak menulis coil/register mesin.

## Model data dan kompatibilitas

- Sumber konfigurasi polling kini `modbus_gateways → machines → modbus_tags`.
- Endpoint `devices` tetap tersedia sebagai adapter ke model tersebut agar form
  yang ada tetap kompatibel. Tidak lagi menulis/poll tabel `modbus_devices`.
- Host, port, interval polling berlaku bersama untuk mesin pada satu gateway.
  Penambahan mesin ke gateway yang ada menggunakan interval gateway tersebut.
- Migration `1720000005000-CustomDashboard` menyambungkan data legacy yang belum
  termigrasi, membuat `dashboard_preferences`, dan menambah indeks riwayat telemetry.
  Data pada tabel legacy tetap tersedia. Rollback migration tidak membalikkan
  penyesuaian data; jangan mengaktifkan versi polling legacy setelah perubahan baru.
- Polling mengelompokkan koneksi pada host/port sama, maksimal empat gateway aktif
  bersamaan, dan memberi timeout koneksi/pembacaan. Register gagal dicatat terpisah.
- Diagnostik memakai kunci koneksi yang sama; permintaan saat gateway sibuk
  mengembalikan pesan untuk mencoba lagi.

## Hak akses dan API

Administrator dan role dengan `machines.view_all` dapat melihat semua mesin.
Pengguna lain hanya menerima mesin yang diberikan melalui `machine_access`.
Administrator dapat memilih **MasterData → UserManagement → Akses mesin** untuk
memberikan atau mencabut akses. Role group dapat dipilih pada form tambah/ubah pengguna.
Batas akses yang sama berlaku untuk daftar perangkat, telemetry terbaru, riwayat,
dan widget. Referensi widget yang kehilangan akses disaring saat layout dimuat.
Konfigurasi mesin dan diagnostik hanya tersedia untuk administrator.

- `GET/PATCH /api/dashboard/preferences`: layout milik pengguna login.
- `GET /api/devices`: mesin yang diizinkan, gateway, register, dan status runtime.
- `GET /api/telemetry/latest`: pembacaan terakhir yang diizinkan.
- `GET /api/telemetry/history?tagId=UUID&minutes=15|60|1440`: riwayat teragregasi.
- `POST /api/devices/:id/test-connection`: uji TCP dan pembacaan Modbus.
- `POST /api/devices/:id/scan-unit-ids`: pemindaian terbatas.

Dashboard memakai refresh HTTP terautentikasi. Broadcaster Socket.IO lama tidak
lagi didaftarkan karena sebelumnya menyebarkan telemetry tanpa pemeriksaan akses.

## Pengujian

```sh
NEXT_DIST_DIR=.next-verify npm run build
node --test apps/api/test/*.test.cjs
npm run migration:run
```

Tes dashboard membutuhkan PostgreSQL lokal dan migration yang sudah diterapkan.
Tes membuat data dalam transaksi yang selalu di-rollback dan menjalankan simulator
Modbus TCP pada port lokal sementara. Tidak menghubungi atau mengubah alat fisik.
Mencakup multi-Unit ID, FC1–FC4, signed/float/scaling, kegagalan satu register,
riwayat, layout per pengguna, penolakan akses, diagnostik, dan jadwal polling.
Browser diuji memakai data simulasi; screenshot ada di `artifacts/dashboard/`.
