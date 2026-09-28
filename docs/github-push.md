# Push ke GitHub

Repositori ini memakai branch utama `main` dan remote berikut:

```text
https://github.com/kangcepu/modbus_gateway.git
```

## Identitas contributor

Atur identitas hanya untuk repositori ini, dengan nama dan email yang terdaftar
atau terverifikasi di akun GitHub Anda. Jika email pribadi disembunyikan di
GitHub, gunakan alamat *noreply* yang ditampilkan di GitHub: **Settings →
Emails**.

```bash
git config user.name "kangcepu"
git config user.email "EMAIL_GITHUB_ANDA"
```

Verifikasi sebelum commit:

```bash
git config --get user.name
git config --get user.email
```

## Commit dan push pertama

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/kangcepu/modbus_gateway.git
git push -u origin main
```

Saat Git meminta kredensial HTTPS, masukkan username GitHub dan **personal
access token** (PAT), bukan password GitHub. Buat PAT dengan izin `repo` di
GitHub Settings → Developer settings → Personal access tokens.

Jika repository di GitHub sudah berisi README atau commit lain, tarik dan
gabungkan riwayatnya terlebih dahulu:

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

## Pemeriksaan keamanan

Jangan commit `.env`, private key, dump database, atau file dependency/build.
Pola-pola tersebut sudah dicakup oleh `.gitignore`; `.env.example` sengaja tetap
disertakan sebagai template tanpa rahasia.
