# MedRec Backend — Setup Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (untuk DB di VPS)
- npm atau yarn

---

## 1. Clone & Install

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env
# Edit .env sesuai konfigurasi kamu
```

---

## 2. Start DB Services (Docker di VPS)

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Verify running
docker-compose ps
```

Port yang terekspos (localhost only, tidak public):
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

---

## 3. Database Migration

```bash
# Generate Prisma client
npm run db:generate

# Jalankan migration
npm run db:migrate

# Seed data awal (hospital + sample doctor)
npm run db:seed
```

---

## 4. Jalankan Backend

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Backend berjalan di: `http://localhost:3000`

---

## 5. API Endpoints (Modul 1: Auth + Patient)

### Patient

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/patient/register` | — | Register pasien baru |
| POST | `/api/patient/login` | — | Login pasien |
| GET | `/api/patient/:id` | JWT Patient | Get info pasien |
| GET | `/api/patient/:id/wallet` | JWT Patient | Get wallet info |
| GET | `/api/patient/:id/records` | JWT Patient | Get semua records |
| GET | `/api/patient/:id/emergency/logs` | JWT Patient | Lihat EBG history |

### Hospital Staff

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/hospital/login` | — | Login staff/dokter |

---

## 6. Test Quick

```bash
# Register pasien
curl -X POST http://localhost:3000/api/patient/register \
  -H "Content-Type: application/json" \
  -d '{
    "nik": "3201234567890123",
    "namaIbuKandung": "Siti Nurhaliza",
    "nama": "Budi Santoso",
    "noHp": "081234567890",
    "email": "budi@example.com"
  }'

# Login pasien
curl -X POST http://localhost:3000/api/patient/login \
  -H "Content-Type: application/json" \
  -d '{
    "nik": "3201234567890123",
    "namaIbuKandung": "Siti Nurhaliza"
  }'

# Login dokter (dari seed)
curl -X POST http://localhost:3000/api/hospital/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dr.andi@rsud-b.id",
    "password": "Doctor@123"
  }'
```

---

## Modul Selanjutnya

- [ ] **Modul 2**: Records (hospital create record, multi-hospital query)
- [ ] **Modul 3**: Export PDF + fee calculation
- [ ] **Modul 4**: Payment processing (SGT token)
- [ ] **Modul 5**: Emergency Break Glass

---

## Catatan Penting

### WALLET_DERIVATION_SALT
**JANGAN PERNAH GANTI** setelah production. Salt ini menentukan semua wallet pasien. Jika diganti, semua wallet lama tidak bisa di-regenerate.

### JWT Secrets
Gunakan random string panjang (min 32 chars) untuk semua JWT secrets di production.

### Database
Ganti password PostgreSQL di `docker-compose.yml` dan `.env` sebelum deploy ke production.
