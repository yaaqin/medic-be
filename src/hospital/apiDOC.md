# API Documentation — Hospital Module

Base URL: `http://localhost:3000`  
Auth: semua endpoint ini butuh JWT Admin di header `Authorization: Bearer <token>`

---

## Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/admin/hospitals` | Daftarkan hospital baru |
| GET | `/api/admin/hospitals` | List semua hospital |
| GET | `/api/admin/hospitals/:id` | Detail hospital + staff |
| PATCH | `/api/admin/hospitals/:id/toggle` | Aktifkan / nonaktifkan hospital |
| POST | `/api/admin/hospitals/invite` | Generate invite code |
| GET | `/api/admin/hospitals/:id/invites` | List invite code milik hospital |
| POST | `/api/auth/staff/register` | Staff/Dokter register pakai invite code |

---

## POST `/api/admin/hospitals`

Daftarkan hospital baru. Admin bisa pilih generate wallet baru atau import existing.

**Headers**
```
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

**Body — generate wallet baru**
```json
{
  "hospitalCode": "RSUD-BEKASI",
  "name": "RSUD Kota Bekasi",
  "address": "Jl. Pramuka No.55, Bekasi",
  "phone": "02188888888",
  "email": "admin@rsudbekasi.go.id",
  "walletMode": "generate"
}
```

**Body — import wallet existing**
```json
{
  "hospitalCode": "PUSKESMAS-CILINCING",
  "name": "Puskesmas Cilincing",
  "walletMode": "import",
  "walletPrivateKey": "suiprivkey1q..."
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid-hospital",
    "hospitalCode": "RSUD-BEKASI",
    "name": "RSUD Kota Bekasi",
    "walletAddress": "0x1a2b3c..."
  },
  "message": "Hospital berhasil didaftarkan"
}
```

**cURL**
```bash
curl -X POST http://localhost:3000/api/admin/hospitals \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "hospitalCode": "RSUD-BEKASI",
    "name": "RSUD Kota Bekasi",
    "address": "Jl. Pramuka No.55, Bekasi",
    "walletMode": "generate"
  }'
```

---

## GET `/api/admin/hospitals`

List semua hospital dengan pagination.

**Query Params**

| Param | Default | Deskripsi |
|-------|---------|-----------|
| `page` | `1` | Halaman |
| `limit` | `20` | Jumlah per halaman |

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-hospital",
      "hospitalCode": "RSUD-BEKASI",
      "name": "RSUD Kota Bekasi",
      "walletAddress": "0x1a2b3c...",
      "isActive": true,
      "createdAt": "2026-05-23T10:00:00.000Z",
      "_count": { "staff": 5 }
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**cURL**
```bash
curl http://localhost:3000/api/admin/hospitals?page=1&limit=20 \
  -H "Authorization: Bearer <admin_jwt>"
```

---

## GET `/api/admin/hospitals/:id`

Detail satu hospital beserta daftar staff-nya.

**cURL**
```bash
curl http://localhost:3000/api/admin/hospitals/uuid-hospital \
  -H "Authorization: Bearer <admin_jwt>"
```

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid-hospital",
    "hospitalCode": "RSUD-BEKASI",
    "name": "RSUD Kota Bekasi",
    "walletAddress": "0x1a2b3c...",
    "isActive": true,
    "staff": [
      {
        "id": "uuid-staff",
        "staffCode": "DOC-0001",
        "name": "Dr. Andi",
        "role": "VERIFIED_DOCTOR",
        "isVerifiedDoctor": true,
        "specialization": "Emergency Medicine"
      }
    ],
    "_count": { "staff": 1, "inviteCodes": 3 }
  }
}
```

---

## PATCH `/api/admin/hospitals/:id/toggle`

Aktifkan atau nonaktifkan hospital. Hospital yang nonaktif tidak bisa login dan tidak bisa buat record.

**Body**
```json
{ "isActive": false }
```

**cURL**
```bash
# Nonaktifkan
curl -X PATCH http://localhost:3000/api/admin/hospitals/uuid-hospital/toggle \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": false }'

# Aktifkan kembali
curl -X PATCH http://localhost:3000/api/admin/hospitals/uuid-hospital/toggle \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "isActive": true }'
```

**Response**
```json
{
  "success": true,
  "message": "Hospital dinonaktifkan"
}
```

---

## POST `/api/admin/hospitals/invite`

Generate invite code untuk hospital. Code ini dibagikan ke staff/dokter yang akan join.

**Body**
```json
{
  "hospitalId": "uuid-hospital",
  "role": "HOSPITAL_STAFF",
  "expiresInDays": 7
}
```

| Field | Tipe | Default | Keterangan |
|-------|------|---------|------------|
| `hospitalId` | string | — | UUID hospital |
| `role` | `HOSPITAL_STAFF` \| `VERIFIED_DOCTOR` | `HOSPITAL_STAFF` | Role yang langsung diberikan saat register |
| `expiresInDays` | number | `7` | Masa berlaku code (1–30 hari) |

**cURL**
```bash
# Invite untuk dokter terverifikasi
curl -X POST http://localhost:3000/api/admin/hospitals/invite \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "hospitalId": "uuid-hospital",
    "role": "VERIFIED_DOCTOR",
    "expiresInDays": 3
  }'
```

**Response**
```json
{
  "success": true,
  "data": {
    "code": "RSUD1A2B",
    "hospitalCode": "RSUD-BEKASI",
    "hospitalName": "RSUD Kota Bekasi",
    "role": "VERIFIED_DOCTOR",
    "expiresAt": "2026-05-30T10:00:00.000Z"
  },
  "message": "Invite code dibuat — bagikan ke staff/dokter yang akan bergabung"
}
```

---

## GET `/api/admin/hospitals/:id/invites`

List semua invite code milik satu hospital — termasuk yang sudah dipakai dan expired.

**cURL**
```bash
curl http://localhost:3000/api/admin/hospitals/uuid-hospital/invites \
  -H "Authorization: Bearer <admin_jwt>"
```

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-invite",
      "code": "RSUD1A2B",
      "role": "VERIFIED_DOCTOR",
      "usedById": null,
      "usedAt": null,
      "expiresAt": "2026-05-30T10:00:00.000Z",
      "createdAt": "2026-05-23T10:00:00.000Z"
    }
  ]
}
```

---

## POST `/api/auth/staff/register`

Staff atau dokter mendaftar menggunakan invite code dari hospital.  
**Tidak butuh JWT** — endpoint publik, tapi butuh invite code yang valid.

**Body — Staff biasa**
```json
{
  "inviteCode": "RSUD1A2B",
  "name": "Budi Hartono",
  "email": "budi@rsudbekasi.go.id",
  "password": "password123"
}
```

**Body — Dokter (invite role = VERIFIED_DOCTOR)**
```json
{
  "inviteCode": "RSUD1A2B",
  "name": "Dr. Andi Susanto",
  "email": "andi@rsudbekasi.go.id",
  "password": "password123",
  "nik": "3201234567890001",
  "strNumber": "503/XXX/STR/2023",
  "sipNumber": "SIP/001/DINKES/2024",
  "specialization": "Emergency Medicine"
}
```

**cURL**
```bash
curl -X POST http://localhost:3000/api/auth/staff/register \
  -H "Content-Type: application/json" \
  -d '{
    "inviteCode": "RSUD1A2B",
    "name": "Dr. Andi Susanto",
    "email": "andi@rsudbekasi.go.id",
    "password": "password123",
    "nik": "3201234567890001",
    "strNumber": "503/XXX/STR/2023",
    "sipNumber": "SIP/001/DINKES/2024",
    "specialization": "Emergency Medicine"
  }'
```

**Response**
```json
{
  "success": true,
  "staffCode": "DOC-0001",
  "name": "Dr. Andi Susanto",
  "role": "VERIFIED_DOCTOR",
  "hospitalCode": "RSUD-BEKASI",
  "hospitalName": "RSUD Kota Bekasi",
  "isVerifiedDoctor": true,
  "message": "Registrasi berhasil"
}
```

---

## Error Responses

| Status | Kode | Penyebab |
|--------|------|----------|
| 401 | `Unauthorized` | JWT tidak ada / invalid |
| 403 | `Forbidden` | Role bukan ADMIN |
| 404 | `Not Found` | Hospital / invite code tidak ditemukan |
| 409 | `Conflict` | `hospitalCode` atau wallet address sudah terdaftar |
| 400 | `Bad Request` | Invite code expired / sudah dipakai / hospital nonaktif |

**Contoh error response**
```json
{
  "statusCode": 409,
  "message": "Hospital code \"RSUD-BEKASI\" sudah terdaftar",
  "error": "Conflict"
}
```

---

## Flow Lengkap — Onboarding Hospital Baru

```bash
# 1. Admin daftarkan hospital
curl -X POST http://localhost:3000/api/admin/hospitals \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "hospitalCode": "RSUD-BEKASI", "name": "RSUD Kota Bekasi", "walletMode": "generate" }'

# 2. Admin generate invite code untuk dokter
curl -X POST http://localhost:3000/api/admin/hospitals/invite \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "hospitalId": "<id_dari_step_1>", "role": "VERIFIED_DOCTOR", "expiresInDays": 3 }'

# 3. Bagikan code "RSUD1A2B" ke dokter via WhatsApp/email

# 4. Dokter register sendiri
curl -X POST http://localhost:3000/api/auth/staff/register \
  -H "Content-Type: application/json" \
  -d '{
    "inviteCode": "RSUD1A2B",
    "name": "Dr. Andi",
    "email": "andi@rsud.go.id",
    "password": "secret123",
    "strNumber": "503/XXX/STR/2023",
    "sipNumber": "SIP/001/DINKES/2024",
    "specialization": "Emergency Medicine"
  }'

# 5. Dokter login
curl -X POST http://localhost:3000/api/hospital/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "andi@rsud.go.id", "password": "secret123" }'
```

---

*Last updated: 2026-05-23 | Module version: 1.0.0*