# luma-backend-projek

Backend REST API untuk Luma CRM — TypeScript, Express 5, Sequelize, PostgreSQL.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express 5
- **ORM**: Sequelize 6
- **Database**: PostgreSQL
- **Migration**: Umzug 3
- **Auth**: JWT (access token 15m + refresh token 7d)
- **Upload**: Multer (memoryStorage) → disk
- **Logger**: Winston + Morgan
- **Password**: bcrypt
- **Enkripsi**: AES-256-GCM (credential payment gateway)

## Mulai Cepat

```bash
npm install
cp .env.example .env     # lalu sesuaikan isinya

npm run migrate          # siapkan struktur tabel
npm run dev              # jalan di http://localhost:4000
```

## Struktur Folder

```
luma-backend-projek/
├── migrations/                         # File migration (dijalankan berurutan)
├── src/
│   ├── index.ts                        # Entry point + static file /files
│   ├── databases/
│   │   ├── index.ts                    # Koneksi, auto-load model, registrasi asosiasi
│   │   ├── migrator.ts                 # Konfigurasi Umzug
│   │   └── migrate.ts                  # CLI migration (up/down/status)
│   ├── clients/
│   │   └── midtrans.ts                 # HTTP client verifikasi credential Midtrans
│   ├── config/
│   │   ├── logger.ts                   # Winston logger
│   │   └── multer.ts                   # Konfigurasi upload (max 10MB)
│   ├── middlewares/
│   │   ├── authenticate.ts             # Verifikasi JWT Bearer token
│   │   └── http-logger.ts              # Morgan stream ke Winston
│   ├── router/
│   │   └── indext.ts                   # Agregasi semua route service
│   ├── utils/
│   │   ├── api-response.ts             # sendSuccess, sendCreated, sendPaginated, dll
│   │   ├── app-error.ts                # Custom error class + handler Sequelize
│   │   ├── bcrypt.ts                   # hashPassword, comparePassword
│   │   ├── encryption.ts               # encrypt, decrypt, safeDecrypt (AES-256-GCM)
│   │   ├── generate-username.ts        # Auto generate username dari full name
│   │   ├── jwt.ts                      # signToken, verifyToken, generateTokenPair
│   │   └── query-filter.ts             # Parser filter/sort dari query string
│   └── services/
│       ├── users/                      # Register, login, profil, karyawan
│       ├── documents/                  # Upload file (tableName: files)
│       ├── flex-params/                # Master data: kategori, menu, role, metode bayar
│       ├── company/                    # Perusahaan + company_code (kode nomor dokumen)
│       ├── role-menu-permissions/      # Akses menu per role
│       ├── payment-methods/            # Metode bayar aktif per owner (Tunai/QRIS/VA)
│       ├── payment-gateway/            # Credential Midtrans (terenkripsi, Owner only)
│       ├── products/                   # Produk + foto + relasi promo
│       ├── promos/                     # Promo + produk yang dikenai promo
│       └── naming-series/              # Generator nomor dokumen / SKU
├── logs/                               # Output log (dibuat otomatis)
├── files/                              # File upload (dibuat otomatis)
├── .env / .env.example
├── package.json
└── tsconfig.json
```

Tiap service mengikuti pola berlapis yang sama:

```
model.ts       → definisi tabel + asosiasi (static associate)
repository.ts  → query ke database
service.ts     → business logic & validasi
controller.ts  → handler HTTP, kelola transaksi
route.ts       → definisi endpoint
types.ts       → tipe input
```

## Environment Variables

Salin `.env.example` ke `.env` lalu sesuaikan.

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=luma
DB_USER=postgres
DB_PASSWORD=your_password

# Upload
PATH_FILE_UPLOAD=files

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=4000
BASE_URL=http://localhost:4000
NODE_ENV=development

# Enkripsi credential payment gateway (hex 64 karakter)
# generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# Midtrans
# sandbox    : https://api.sandbox.midtrans.com
# production : https://api.midtrans.com
MIDTRANS_BASE_URL=https://api.sandbox.midtrans.com
```

Catatan penting:

- **`BASE_URL`** dipakai membentuk `file_url` saat upload. Di production ganti dengan domain server.
- **`ENCRYPTION_KEY`** wajib diisi — tanpa ini endpoint payment-gateway error. Kalau kunci ini hilang/berganti, credential yang sudah tersimpan tidak bisa didekripsi lagi. Pakai kunci berbeda untuk production.
- **`MIDTRANS_BASE_URL`** menentukan environment Midtrans. Ganti ke URL production saat go-live, dan credential-nya ikut diganti (server key sandbox ditolak di production).

## Database & Migration

Struktur tabel dikelola lewat **migration**, bukan sync otomatis.

```bash
npm run migrate          # jalankan migration yang belum jalan
npm run migrate:down     # batalkan 1 migration terakhir
npm run migrate:status   # lihat mana yang sudah & belum jalan
```

Riwayat migration disimpan di tabel `migrations_meta`, jadi file yang sama tidak pernah jalan dua kali.

### Auto-sync di development

Saat `NODE_ENV=development`, server menjalankan `sequelize.sync({ alter: true })` otomatis — ubah model, restart, tabel ikut berubah. Praktis untuk coding lokal.

Di luar development, auto-sync **dimatikan**. Alasannya:

- `alter` bisa menghapus kolom yang hilang dari model → data hilang permanen
- kalau `alter` gagal, server ikut mati (API down, bukan cuma skema gagal)
- tidak ada jejak perubahan dan tidak bisa di-rollback

Paksa on/off lewat `DB_SYNC_ALTER=true|false` (menimpa `NODE_ENV`). Jangan `true` di production.

### Membuat migration baru

Buat file di `migrations/` dengan awalan timestamp agar urut:

```ts
// migrations/20261020120000-add-kolom-baru.ts
import type { Migration } from '../src/databases/migrator';

export const up: Migration = async ({ context }) => {
  await context.queryInterface.addColumn('products', 'kolom_baru', {
    type: DataTypes.STRING,
    allowNull: true,
  });
};

export const down: Migration = async ({ context }) => {
  await context.queryInterface.removeColumn('products', 'kolom_baru');
};
```

Perubahan model di lokal ditangani auto-sync, **tapi tidak sampai ke production** kalau migration-nya tidak ditulis.

### Asosiasi antar model

Relasi dideklarasikan lewat `static associate()` di model masing-masing, dipanggil loader setelah semua model termuat (menghindari circular import):

```ts
class Promo extends Model {
  static associate(models: Record<string, any>): void {
    Promo.hasMany(models['Product'], {
      foreignKey: 'promo_id',
      as: 'products',
      constraints: false,   // FK dikelola lewat migration, bukan sync
    });
  }
}
```

## Menjalankan Aplikasi

```bash
npm run dev       # development, auto-reload
npm run build     # compile ke dist/
npm start         # jalankan hasil build
```

## Konvensi API

### Format response

Sukses:

```json
{ "status": "success", "message": "...", "data": { } }
```

Dengan pagination:

```json
{
  "status": "success",
  "message": "...",
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 25, "total_pages": 3 }
}
```

Gagal:

```json
{
  "status": "fail",
  "message": "Validasi gagal",
  "errors": [{ "field": "name", "message": "Nama wajib diisi" }]
}
```

### Pagination, filter, sort

```bash
?page=1&limit=10                  # default page=1, limit=10, max 100
?sort=created_at&order=desc       # order: asc | desc
?search=kopi                      # tersedia di products & promos
```

Filter berupa **JSON array**:

```bash
curl --get http://localhost:4000/api/products \
  -H "Authorization: Bearer TOKEN" \
  --data-urlencode 'filter=[{"key":"active","operator":"equal","value":true}]'
```

Operator: `equal`, `notEqual`, `like`, `in`, `gt`, `gte`, `lt`, `lte`.

### Multi-tenant

`owner_id` **tidak pernah dikirim client** — selalu diturunkan dari token:

- requester ber-role `Owner` → `owner_id` = `user_id` dirinya sendiri
- requester lain (staff/HRD) → `owner_id` = `header_id` miliknya

Semua listing otomatis tersaring per owner. Mengakses data milik owner lain dibalas **404**, bukan 403, supaya id orang lain tidak bisa ditebak.

### Auth

```
Authorization: Bearer <access_token>
```

Access token berlaku 15 menit. Kalau expired, pakai refresh token untuk mendapat access token baru.

## Endpoint

### Users — `/api/users`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/register` | - | Registrasi user baru |
| POST | `/login` | - | Login, return access + refresh token |
| POST | `/refresh-token` | - | Perbarui access token |
| GET | `/profile` | Bearer | Profil user yang login |
| PUT | `/profile` | Bearer | Update profil, opsional foto |
| POST | `/` | Bearer | Tambah karyawan |
| GET | `/:id` | Bearer | Detail karyawan |
| DELETE | `/:id` | Bearer | Hapus karyawan |

### Documents — `/api/documents`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/upload` | Bearer | Upload 1 file |
| POST | `/bulk-upload` | Bearer | Upload banyak file |
| POST | `/bulk-upsert` | Bearer | Ada id → update, tidak ada → create |
| PUT | `/bulk-update` | Bearer | Update banyak dokumen |
| GET | `/:id` | Bearer | Detail dokumen |
| PUT | `/:id` | Bearer | Update dokumen |
| DELETE | `/:id` | Bearer | Hapus dokumen (soft delete) |

File hasil upload dapat diakses di `{BASE_URL}/files/<nama-file>`.

### Flex Params — `/api/flex-params`

Master data serbaguna, dibedakan lewat `type_param`: `CATEGORY_OWNER`, `MENU_APP_LUMA`, `ROLE_OWNER`, `PAYMENT_METHODS`.

| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Bearer | Buat flex param, opsional foto |
| POST | `/bulk` | Bearer | Buat banyak sekaligus |
| GET | `/` | - | List semua |
| GET | `/type/:type_param` | - | List by type |
| GET | `/header/:header_id` | - | List by header id |
| GET | `/:id` | Bearer | Detail |
| PUT | `/:id` | Bearer | Update, opsional ganti foto |
| DELETE | `/:id` | Bearer | Hapus + hapus foto |

### Company — `/api/companies`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Bearer | Buat company, `company_code` digenerate otomatis |
| GET | `/` | - | List company |
| GET | `/:id` | Bearer | Detail |
| PUT | `/:id` | Bearer | Update (hanya owner pemilik) |
| DELETE | `/:id` | Bearer | Hapus (soft delete) |

`company_code` = 4 karakter acak (A–Z/0–9, tanpa I/O/0/1) dan dijamin unik. Dipakai sebagai bagian nomor dokumen.

### Role Menu Permissions — `/api/role-menu-permissions`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Bearer | Buat role + akses menunya |
| GET | `/` | Bearer | List role beserta menunya |
| GET | `/detail?role_name=` | Bearer | Detail akses satu role |
| PUT | `/:flex_param_role_id` | Bearer | Sync menu — menu di luar daftar dihapus |
| DELETE | `/:flex_param_role_id` | Bearer | Hapus role + semua akses menunya |

### Payment Methods — `/api/payment-methods`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Bearer | Aktifkan metode bayar untuk owner |
| GET | `/` | Bearer | List metode bayar |
| GET | `/:id` | Bearer | Detail |
| PUT | `/:id` | Bearer | Toggle aktif/non-aktif (`{ "active": true }`) |
| DELETE | `/:id` | Bearer | Hapus (soft delete) |

Aturannya:

- **Tunai** bebas diaktifkan/dimatikan, tidak butuh payment gateway
- **Selain Tunai** (QRIS, Virtual Account) hanya bisa diaktifkan kalau Midtrans sudah terhubung **dan** aktif. `payment_gateway_id` terisi otomatis saat pertama kali diaktifkan
- Menonaktifkan selalu boleh, tanpa syarat
- 1 owner hanya boleh punya 1 baris per jenis metode

### Payment Gateway — `/api/payment-gateway`

Credential Midtrans. **Hanya role `Owner`** — role lain dibalas 403.

| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Owner | Hubungkan Midtrans (409 kalau sudah terhubung) |
| GET | `/` | Owner | Status koneksi + credential |
| PUT | `/` | Owner | Update credential |
| DELETE | `/` | Owner | Putus koneksi |

Tanpa `:id` — 1 owner punya 1 credential per provider, resource-nya diturunkan dari token.

Perilaku:

- `merchant_id`, `client_key`, `server_key` disimpan **terenkripsi** (AES-256-GCM)
- Sebelum disimpan, `server_key` **diuji ke API Midtrans**. Ditolak → 400, tidak ada yang tersimpan
- `server_key` di response ter-mask (`••••xyZ`). Pakai `?reveal=true` untuk nilai utuh
- `GET` saat belum terhubung mengembalikan **200** dengan `is_connected: false` (bukan 404), supaya UI bisa menampilkan status

### Products — `/api/products`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Bearer | Buat produk (multipart, field foto: `photo`) |
| GET | `/` | Bearer | List + pagination/filter/sort/search |
| GET | `/:id` | Bearer | Detail |
| PUT | `/:id` | Bearer | Update (multipart) |
| DELETE | `/:id` | Bearer | Hapus (soft delete) |

- `sku` digenerate otomatis lewat naming-series
- Response list membawa `total_active` dan `total_inactive`
- `?search=` mencari di `name` dan `sku`, tidak peduli huruf besar/kecil

### Promos — `/api/promos`
| Method | URL | Auth | Keterangan |
|--------|-----|------|-----------|
| POST | `/` | Bearer | Buat promo + produk yang dikenai |
| GET | `/` | Bearer | List promo beserta produknya |
| GET | `/active` | Bearer | Promo yang sedang aktif & dalam periode |
| GET | `/:id` | Bearer | Detail |
| PUT | `/:id` | Bearer | Update + sync produk |
| PATCH | `/:id/toggle-active` | Bearer | Nonaktifkan / aktifkan kembali |
| DELETE | `/:id` | Bearer | Hapus (soft delete) |

Tipe diskon (`discount_type`), `discount_value` berbeda artinya:

| Tipe | Arti `discount_value` |
|---|---|
| `percentage` | nilai persen, mis. `20` |
| `fixed` | nominal potongan, mis. `15000` |
| `special_price` | harga tetap, mis. `85000` |

Status (`status`): `Aktif`, `Terjadwal`, `Nonaktif`, `Selesai`.

Aturan:

- `products` **wajib minimal 1** di create maupun update
- Update bersifat **sync penuh** — produk di luar daftar baru akan dilepas dari promo (`promo_id` & `promo_discount` dikosongkan), produknya sendiri tidak dihapus
- `promo_discount` boleh berbeda tiap produk; kalau tidak diisi → `null`
- `start_date` tidak boleh mundur ke belakang, `end_date` tidak boleh sebelum `start_date`
- Promo berstatus `Selesai` tidak bisa diupdate
- Status tidak berpindah sendiri seiring waktu — ditangani worker terpisah

## Naming Series

Generator nomor dokumen/SKU dengan format:

```
PREFIX/YEAR/COMPANY_CODE/0000001
```

Contoh: `PROD/2026/N2TW/0000001`

```ts
import { generateSerialNumber } from '../naming-series/service';

const sku = await generateSerialNumber('PRODUCT', owner_id, 'PROD', 2026, company_code, t);
// → PROD/2026/N2TW/0000001
```

- Counter terpisah per kombinasi `type_naming_series + owner_id + prefix + year + company_code`
- Tiap modul (`PRODUCT`, `INVOICE`) dan tiap owner punya urutan sendiri
- Ganti tahun → counter mulai dari `0000001` lagi
- Aman untuk request bersamaan (row-level lock)
