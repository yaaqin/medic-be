# Medical Records on Blockchain (Sui Network)

## 📋 Project Overview

A decentralized medical records system where:
- **Data lives on Sui blockchain** (immutable source of truth)
- **Patient privacy protected** via end-to-end encryption (NIK + Nama Ibu Kandung based ZK)
- **Multi-hospital network** - seamless data sharing across healthcare providers
- **Token-based monetization** - SGT token for data export/recording fees
- **Transparent audit trail** - all access logged on blockchain
- **Emergency Break Glass** - authorized doctors can access records in life-threatening emergencies

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                  React Native / Next.js Frontend             │
│              (Patient App + Hospital Dashboard)              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │   NestJS Backend API      │
        │  ├─ Auth & Patient Mgmt   │
        │  ├─ Record Operations     │
        │  ├─ Export/PDF Service    │
        │  ├─ Payment Processing    │
        │  ├─ Fee Management        │
        │  └─ Emergency Break Glass │  ← NEW
        └────────────┬──────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
   ┌────▼───────┐          ┌────────▼──────┐
   │  Sui       │          │   IPFS/Pinata │
   │ Blockchain │          │ (Encrypted    │
   │            │          │  Data Storage)│
   │ ├─ Records │          └───────────────┘
   │ ├─ Access  │
   │ │  Logs    │
   │ ├─ Fees    │
   │ ├─ Payments│
   │ └─ Break   │  ← NEW
   │   Glass    │
   │   Logs     │
   └────────────┘
```

---

## 🔐 Identity & Authentication

### Patient Identity (No Wallet Management)

**Primary Identifiers:**
- **NIK** (Indonesian National ID) - 16 digits
- **Nama Ibu Kandung** (Mother's name)
- **Optional:** Fingerprint biometric (future enhancement)

**Flow:**
```
Patient Input (NIK + Ibu Kandung)
    ↓
Backend Hashing (Non-reversible)
    ├─ NIK Hash → 0x7a3f8b2c...
    ├─ Ibu Kandung Hash → 0x5c2e1f...
    └─ Combined Seed (for wallet generation)
    ↓
Deterministic Wallet Generation
    ├─ Public Key: 0x5c2e1f9a8b7d...
    ├─ Secret Key: Generated from seed (server-held, never shared)
    └─ Wallet Address: Derived from keypair
    ↓
Patient Data Stored Locally (encrypted)
    └─ Device SecureStore: NIK, Ibu Kandung, Wallet PubKey
```

**Key Points:**
- ✅ No user wallet management (no lost seed phrases)
- ✅ Deterministic (same NIK + Ibu Kandung = same wallet always)
- ✅ Private key never exposed to user
- ✅ Backend controls key derivation securely

---

## 📝 Patient Registration Flow

### Step 1: User Registration (React Native App)

```
User Input:
├─ NIK: "3201234567890123"
├─ Nama Ibu Kandung: "Siti Nurhaliza"
├─ Nama: "Budi Santoso"
├─ No HP: "08123456789"
└─ Email: "budi@example.com"
```

### Step 2: Backend Processing

```
POST /api/patient/register
{
  "nik": "3201234567890123",
  "namaIbuKandung": "Siti Nurhaliza",
  "nama": "Budi Santoso",
  "noHp": "08123456789",
  "email": "budi@example.com"
}

Backend Actions:
├─ Hash NIK → nikHash = sha256(nik)
├─ Hash Ibu Kandung → ibuKandungHash = sha256(namaIbuKandung)
├─ Generate deterministic wallet
│  └─ combined_seed = hash(NIK + ibuKandung + BACKEND_SALT)
├─ Generate keypair from seed
├─ Store patient data locally (encrypted)
└─ Return: patientId + walletPubkey
```

### Step 3: Blockchain Registration

```
Patient data registered on Sui blockchain:
{
  patient_id: "PAT-0001",
  nik_hash: "0x7a3f8b2c...",
  ibu_kandung_hash: "0x5c2e1f...",
  wallet_pubkey: "0x5c2e1f9a...",
  patient_name: "Budi Santoso",
  created_at: 1715424600
}

Event Emitted:
PatientRegistered(
  patient_id: "PAT-0001",
  nik_hash: "0x7a3f8b2c...",
  wallet: "0x5c2e1f9a...",
  timestamp: 1715424600
)
```

### Step 4: Response to User

```json
{
  "success": true,
  "patientId": "PAT-0001",
  "message": "Patient registered successfully",
  "data": {
    "nik": "3201234567890123",
    "nama": "Budi Santoso",
    "walletPubkey": "0x5c2e1f9a..."
  }
}
```

---

## 🔑 Patient Login & Access Flow

### Step 1: User Login

```
POST /api/patient/login
{
  "nik": "3201234567890123",
  "namaIbuKandung": "Siti Nurhaliza"
}
```

### Step 2: Backend Verification

```
Backend Actions:
├─ Hash NIK & Ibu Kandung
├─ Query blockchain for patient by hashes
├─ Verify patient exists & credentials match
├─ Generate JWT token
└─ Return token + patientId
```

### Step 3: Response

```json
{
  "success": true,
  "patientId": "PAT-0001",
  "token": "eyJhbGc...",
  "message": "Login successful"
}
```

### Step 4: Access Patient Records

```
GET /api/patient/records
Headers: Authorization: Bearer <token>

Backend Actions:
├─ Verify JWT token
├─ Regenerate deterministic wallet from stored credentials
├─ Query Sui blockchain for all records with patient's nik_hash
├─ Return record list (metadata only):
│  ├─ record_id
│  ├─ hospital_id
│  ├─ ipfs_ref (encrypted data location)
│  ├─ data_hash (for verification)
│  └─ created_at
```

---

## 🏥 Hospital Record Creation Flow

### Step 1: Hospital Creates Record

```
Hospital App Input:
├─ Patient NIK
├─ Patient Ibu Kandung
└─ Medical Data:
   ├─ Diagnosis
   ├─ Treatment
   ├─ Doctor Name
   └─ Notes

POST /api/hospital/create-record
{
  "nik": "3201234567890123",
  "ibuKandung": "Siti Nurhaliza",
  "medicalData": {...},
  "hospitalWalletAddress": "0x..."
}
```

### Step 2: Fee Calculation & Deduction

```
Current Fees:
├─ Record Creation Fee: 1 SGT (adjustable by admin)
├─ Calculated on demand
└─ Deducted from hospital wallet via blockchain

Fee Structure (Configurable):
├─ 1 SGT per record (default)
├─ Can be 0 SGT (promotional free period)
└─ Admin can adjust anytime
```

### Step 3: Data Encryption

```
Backend Actions:
├─ Regenerate patient wallet (deterministic)
├─ Encrypt medical data with patient's public key
├─ Hash encrypted data for verification
└─ Upload encrypted data to IPFS
   └─ Return: ipfsHash = "QmABCD1234..."
```

### Step 4: Blockchain Write

```
Sui Smart Contract Call:
├─ Create medical record on blockchain
├─ Link to patient by nik_hash
├─ Store IPFS reference
├─ Store data hash (for verification)
└─ Emit RecordCreated event

Data on Blockchain:
{
  record_id: "REC-2024-0001",
  patient_nik_hash: "0x7a3f8b2c...",
  hospital_id: "PUSKESMAS-C",
  data_hash: "0x3f4a2b...",
  ipfs_ref: "QmABCD1234...",
  created_at: 1714556400
}
```

### Step 5: Process Payment

```
Blockchain Transaction:
├─ Deduct recording fee from hospital wallet
├─ Transfer to payment pool
├─ Log payment on blockchain
└─ Emit PaymentProcessed event

Hospital sees transaction:
├─ Fee deducted: 1 SGT
├─ Blockchain TX: 0x5f8e9d...
└─ Status: Completed
```

### Step 6: Response

```json
{
  "success": true,
  "record_id": "REC-2024-0001",
  "blockchain_tx": "0x5f8e9d...",
  "ipfs_ref": "QmABCD1234...",
  "fee_charged_sgt": 1,
  "message": "Record created successfully"
}
```

---

## 🔄 Multi-Hospital Data Sharing

### Scenario: Patient visits multiple hospitals

```
Timeline:
├─ 2024-05-01: Puskesmas C (create record)
├─ 2024-05-05: Praktik A (create record)
└─ 2024-05-10: RSUD B (access both records)
```

### Step 1: RSUD B Queries Blockchain

```
POST /api/blockchain/patient/records
{
  "nik_hash": "0x7a3f8b2c...",
  "ibu_kandung_hash": "0x5c2e1f...",
  "zk_proof": "0x..."
}

Blockchain Returns:
[
  {
    "record_id": "REC-2024-0001",
    "hospital_id": "PUSKESMAS-C",
    "ipfs_ref": "QmABCD1234...",
    "data_hash": "0x3f4a2b...",
    "created_at": 1714556400
  },
  {
    "record_id": "REC-2024-0002",
    "hospital_id": "PRAKTIK-A",
    "ipfs_ref": "QmEFGH5678...",
    "data_hash": "0x5c2e1f...",
    "created_at": 1714945800
  }
]
```

### Step 2: RSUD B Fetches Encrypted Data from IPFS

```
For each record:
├─ Fetch from IPFS: ipfs://QmABCD1234...
├─ Get: encrypted_medical_data
└─ Store locally (temporary)
```

### Step 3: RSUD B Decrypts Data

```
Backend Actions:
├─ Regenerate patient wallet (deterministic)
├─ Decrypt each record using patient's secret key
├─ Display to RSUD B doctor
└─ Log access to blockchain
```

### Step 4: Access Log on Blockchain

```
POST /api/blockchain/log-access
{
  "patient_nik_hash": "0x7a3f8b2c...",
  "accessing_hospital": "RSUD-B",
  "accessed_records": ["REC-2024-0001", "REC-2024-0002"],
  "purpose": "Patient consultation"
}

Blockchain Logs:
{
  access_id: "ACC-001",
  patient_nik_hash: "0x7a3f8b2c...",
  accessing_hospital: "RSUD-B",
  accessed_records: ["REC-2024-0001", "REC-2024-0002"],
  purpose: "Patient consultation",
  timestamp: 1715427600,
  tx_hash: "0x9e0f1a2b..."
}
```

**Key Points:**
- ✅ No inter-hospital HTTP requests (direct blockchain query)
- ✅ All access immutable & logged
- ✅ Patient can audit who accessed their data
- ✅ IPFS decentralized storage

---

## 🚨 Emergency Break Glass

### Overview

Emergency Break Glass (EBG) adalah mekanisme akses darurat yang memungkinkan **dokter terverifikasi** membuka rekam medis pasien tanpa consent normal — khusus kondisi darurat medis yang mengancam jiwa. Seluruh akses EBG **wajib dilengkapi justifikasi** dan **dicatat permanen di blockchain** sebagai audit trail yang tidak bisa dihapus.

```
┌──────────────────────────────────────────────────────────┐
│              EMERGENCY BREAK GLASS PRINCIPLES            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ Hanya dokter terverifikasi (role: VERIFIED_DOCTOR)   │
│  ✅ Justifikasi wajib diisi sebelum akses dibuka         │
│  ✅ Akses single-session (expire setelah sesi selesai)   │
│  ✅ Seluruh event dicatat immutable di blockchain        │
│  ✅ Tidak ada mekanisme untuk menghapus log              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

### Doctor Credential Requirements

Dokter harus memiliki role `VERIFIED_DOCTOR` untuk menggunakan EBG. Role ini diberikan oleh admin sistem dan disimpan di database backend + on-chain registry.

```
Doctor Verification Data:
├─ doctor_id: "DOC-0001"
├─ nik_doctor: "3201987654321001"
├─ str_number: "503/XXX/STR/2023"    (Surat Tanda Registrasi)
├─ sip_number: "SIP/001/DINKES/2024" (Surat Izin Praktik)
├─ hospital_id: "RSUD-B"
├─ specialization: "Emergency Medicine"
├─ role: "VERIFIED_DOCTOR"
└─ verified_at: 1715424600
```

Admin endpoints untuk manage doctor credentials:
```
POST   /api/admin/doctors/verify        - Grant VERIFIED_DOCTOR role
DELETE /api/admin/doctors/:doctorId/revoke - Revoke role
GET    /api/admin/doctors               - List verified doctors
```

---

### Emergency Break Glass Flow

#### Step 1: Dokter Submit Emergency Access Request

Dokter mengisi form darurat — **justifikasi wajib diisi** sebelum request dikirim.

```
POST /api/emergency/break-glass
Headers: Authorization: Bearer <doctor_jwt>

{
  "patient_nik": "3201234567890123",
  "patient_name_hint": "Budi Santoso",    // optional, for verification
  "emergency_type": "LIFE_THREATENING",   // LIFE_THREATENING | UNCONSCIOUS | CRITICAL_SURGERY
  "justification": "Pasien tidak sadarkan diri, masuk IGD dengan kondisi kritis. Perlu riwayat alergi dan penyakit kronis sebelum tindakan operasi darurat.",
  "location": "IGD RSUD B",
  "witnessed_by": "Dr. Rina Susanti"      // optional, kolega yang menyaksikan
}
```

**Validation rules:**
```
├─ doctor_id must have role: VERIFIED_DOCTOR
├─ justification minimum 50 characters
├─ emergency_type must be valid enum
├─ patient NIK must exist in system
└─ rate limit: max 3 EBG requests per doctor per 24 hours
```

---

#### Step 2: Backend Validation & Token Generation

```
Backend Actions:
├─ Verify JWT → extract doctor_id
├─ Check doctor role = VERIFIED_DOCTOR
├─ Validate justification length & content
├─ Lookup patient by NIK → get nik_hash
├─ Generate single-use EBG session token:
│  ├─ ebg_token = JWT with short TTL (15 minutes)
│  ├─ Payload: { doctor_id, patient_nik_hash, session_id, exp }
│  └─ session_id = UUID (one-time use, invalidated after first use)
└─ Write pending EBG event to blockchain (BEFORE data access)
```

**EBG Session Token structure:**
```json
{
  "type": "EMERGENCY_BREAK_GLASS",
  "session_id": "EBG-SESSION-uuid-v4",
  "doctor_id": "DOC-0001",
  "patient_nik_hash": "0x7a3f8b2c...",
  "issued_at": 1715427600,
  "expires_at": 1715428500,   // +15 minutes
  "single_use": true
}
```

---

#### Step 3: Blockchain Pre-Access Log (INITIATED)

Sebelum data dibuka, event `EmergencyAccessInitiated` langsung ditulis ke blockchain. Ini memastikan bahkan jika akses gagal di tengah jalan, ada jejak bahwa akses pernah dicoba.

```
Blockchain Event: EmergencyAccessInitiated
{
  ebg_id: "EBG-2024-0001",
  doctor_id: "DOC-0001",
  doctor_str: "503/XXX/STR/2023",
  hospital_id: "RSUD-B",
  patient_nik_hash: "0x7a3f8b2c...",
  emergency_type: "LIFE_THREATENING",
  justification_hash: sha256(justification),  // hash, bukan plaintext
  session_id: "EBG-SESSION-uuid-v4",
  status: "INITIATED",
  timestamp: 1715427600,
  tx_hash: "0xABC123..."
}
```

> **Catatan:** `justification` disimpan sebagai hash di blockchain (privacy), tapi plaintext disimpan di backend database untuk keperluan audit internal/legal.

---

#### Step 4: Data Access (Single Session)

```
GET /api/emergency/break-glass/records
Headers:
  Authorization: Bearer <doctor_jwt>
  X-EBG-Session: <ebg_token>

Backend Actions:
├─ Validate doctor_jwt (must be VERIFIED_DOCTOR)
├─ Validate ebg_token:
│  ├─ Not expired (< 15 minutes)
│  ├─ session_id not already used (check Redis/DB)
│  └─ session_id matches blockchain INITIATED event
├─ Mark session_id as USED (atomic operation)  ← prevents replay
├─ Regenerate patient wallet (deterministic)
├─ Query blockchain for all patient records
├─ Fetch encrypted data from IPFS
├─ Decrypt each record
└─ Return decrypted medical data
```

**Response:**
```json
{
  "success": true,
  "ebg_id": "EBG-2024-0001",
  "warning": "EMERGENCY ACCESS - All activity logged permanently on blockchain",
  "session_expires_at": "2024-05-11T10:35:00Z",
  "records": [
    {
      "record_id": "REC-2024-0001",
      "hospital_id": "PUSKESMAS-C",
      "created_at": "2024-05-01",
      "diagnosis": "...",
      "treatment": "...",
      "allergies": "...",
      "chronic_conditions": "..."
    }
  ]
}
```

---

#### Step 5: Blockchain Post-Access Log (COMPLETED)

Setelah data berhasil diakses, update event di blockchain menjadi `COMPLETED`.

```
Blockchain Event: EmergencyAccessCompleted
{
  ebg_id: "EBG-2024-0001",
  status: "COMPLETED",
  records_accessed: ["REC-2024-0001", "REC-2024-0002"],
  accessed_at: 1715427650,
  session_duration_seconds: 50,
  tx_hash: "0xDEF456..."
}
```

---

#### Step 6: Session Expiry & Invalidation

```
Session lifecycle:
├─ Token issued (TTL 15 minutes)
├─ First use → session_id marked USED in Redis
├─ Any subsequent request with same session_id → 403 FORBIDDEN
├─ After 15 minutes → token expired, no new access possible
└─ Session closed → EBG_SESSION_CLOSED event on blockchain

What "single-session" means:
├─ Dokter dapat melihat data selama sesi aktif (≤ 15 menit)
├─ Data tidak di-cache / tidak tersimpan di device
├─ Setelah sesi selesai, harus request EBG baru (dengan justifikasi baru)
└─ Tidak ada "remember this session"
```

---

### Complete EBG User Journey

```
1. Pasien masuk IGD tidak sadarkan diri
   ↓
2. Dokter IGD (role: VERIFIED_DOCTOR) buka app
   ↓
3. Dokter isi form darurat:
   ├─ NIK pasien (dari KTP/gelang identitas)
   ├─ Emergency type: LIFE_THREATENING
   └─ Justifikasi: "Pasien tidak sadar, butuh riwayat alergi..."
   ↓
4. Backend validasi:
   ├─ Role check: VERIFIED_DOCTOR ✅
   └─ Justifikasi ≥ 50 chars ✅
   ↓
5. Blockchain mencatat: EmergencyAccessInitiated
   (tidak bisa dihapus, permanen)
   ↓
6. EBG session token diterbitkan (TTL: 15 menit)
   ↓
7. Dokter akses rekam medis lengkap
   ├─ Riwayat alergi → obat A dikontraindikasikan
   ├─ Penyakit kronis → diabetes, hipertensi
   └─ Obat rutin → metformin 500mg
   ↓
8. Dokter selesai → sesi di-invalidate
   ↓
9. Blockchain mencatat: EmergencyAccessCompleted
   ↓
10. ✅ Pasien ditangani dengan info lengkap
    ✅ Audit trail permanen di blockchain
    ✅ Tidak ada akses residual setelah sesi
```

---

### Blockchain Data Structure (Smart Contract)

Tambahan struct di Sui Move smart contract:

```move
// Emergency Break Glass Registry
struct EmergencyAccessRegistry has key {
    id: UID,
    access_logs: Table<String, EmergencyAccessLog>,
    total_emergency_accesses: u64,
}

struct EmergencyAccessLog has store {
    ebg_id: String,
    doctor_id: String,
    doctor_str_number: String,
    hospital_id: String,
    patient_nik_hash: String,
    emergency_type: String,
    justification_hash: String,    // sha256 of justification text
    session_id: String,
    status: String,                // INITIATED | COMPLETED | EXPIRED | FAILED
    records_accessed: vector<String>,
    initiated_at: u64,
    completed_at: u64,
    session_duration_seconds: u64,
}

// Events
struct EmergencyAccessInitiated has copy, drop {
    ebg_id: String,
    doctor_id: String,
    patient_nik_hash: String,
    emergency_type: String,
    justification_hash: String,
    timestamp: u64,
}

struct EmergencyAccessCompleted has copy, drop {
    ebg_id: String,
    records_accessed: vector<String>,
    session_duration_seconds: u64,
    timestamp: u64,
}
```

---

### API Endpoints (Break Glass)

```
POST   /api/emergency/break-glass              - Request EBG access + justifikasi
GET    /api/emergency/break-glass/records      - Fetch records (requires EBG session token)
POST   /api/emergency/break-glass/close        - Explicitly close session early
GET    /api/admin/emergency/logs               - Admin: list all EBG events
GET    /api/admin/emergency/logs/:ebgId        - Admin: detail satu EBG event
GET    /api/patient/:patientId/emergency/logs  - Patient: lihat siapa yg EBG ke data mereka
```

---

### Security Considerations

```
┌──────────────────────────────────────────────────────────┐
│              EBG SECURITY LAYERS                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Gate 1: Role-based access control                        │
│  └─ Only VERIFIED_DOCTOR can trigger EBG                 │
│  └─ Role stored both in DB and on-chain registry         │
│                                                          │
│ Gate 2: Justification enforcement                        │
│  └─ Minimum 50 characters (tidak bisa diisi asal)        │
│  └─ Disimpan di backend (untuk kebutuhan legal)          │
│  └─ Hash-nya on-chain (untuk verifikasi integritas)      │
│                                                          │
│ Gate 3: Single-use session token                         │
│  └─ UUID session_id dipakai sekali, lalu invalid         │
│  └─ Atomic mark-as-used (no race condition)              │
│  └─ TTL 15 menit (tidak bisa extend)                     │
│                                                          │
│ Gate 4: Pre-access blockchain logging                    │
│  └─ Log ditulis SEBELUM data dibuka                      │
│  └─ Tidak bisa akses data tanpa log terbuat duluan       │
│                                                          │
│ Gate 5: Rate limiting                                    │
│  └─ Max 3 EBG requests per doctor per 24 jam             │
│  └─ Cegah abuse / fishing data                           │
│                                                          │
│ Gate 6: No data persistence                              │
│  └─ Data tidak di-cache setelah sesi selesai             │
│  └─ In-memory only selama sesi aktif                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

### EBG vs Normal Access Comparison

| Aspect | Normal Access | Emergency Break Glass |
|---|---|---|
| Trigger | Patient consent / hospital login | Dokter verified + justifikasi |
| Authorization | JWT + patient credentials | JWT + EBG session token |
| Session duration | Per-request | Single session (max 15 min) |
| Pre-logging | After access | Before access (immutable) |
| Justification | Not required | Wajib (min 50 chars) |
| Rate limit | Standard API limit | 3x per doctor per 24 jam |
| Blockchain log | Access log | EBG-specific log (separate registry) |
| Patient visibility | Normal audit trail | Marked as EMERGENCY ACCESS |

---

## 📥 Data Export & Download Flow

### Step 1: User/Hospital Requests Export

```
POST /api/export-pdf
{
  "nik": "3201234567890123",
  "ibu_kandung": "Siti Nurhaliza",
  "requester_type": "user", // or "hospital"
  "requester_id": "PAT-0001",
  "wallet_address": "0x5c2e1f9a..."
}
```

### Step 2: Fetch Records from Blockchain

```
Backend Actions:
├─ Query blockchain for all patient records
├─ Get IPFS references for each
└─ Fetch encrypted data from IPFS
```

### Step 3: Decrypt Records

```
Backend Actions:
├─ Regenerate patient wallet
├─ Decrypt each record
└─ Collect into single document
```

### Step 4: Generate PDF

```
PDF Contents:
├─ Header: "Rekam Medis Pasien"
├─ Patient Info
└─ For each record:
   ├─ Hospital Name
   ├─ Date
   ├─ Diagnosis
   ├─ Treatment
   ├─ Doctor Notes
   └─ Page Break
```

### Step 5: Calculate Fee

```
Current Pricing:
├─ File Size ≤ 2 MB → 1 SGT
├─ File Size > 2 MB → (Size in MB) × 1 SGT
│  Example: 2.8 MB → 2.8 SGT

Calculation:
├─ Generate PDF
├─ Measure file size
├─ Calculate fee
└─ Display to user: "Cost: 2.8 SGT"
```

### Step 6: Payment Processing

```
Blockchain Transaction:
├─ Check wallet balance
├─ Verify sufficient SGT
├─ Deduct fee from wallet
├─ Transfer to payment pool
├─ Log transaction on blockchain
└─ Emit ExportInitiated event

Payment Record:
{
  export_id: "EXP-0001",
  user_nik_hash: "0x7a3f8b2c...",
  requester_type: "user",
  requester_id: "PAT-0001",
  file_size_mb: 2.8,
  cost_sgt: 2.8,
  blockchain_tx: "0x5f8e9d...",
  ipfs_ref: "QmPDF123456...",
  timestamp: 1715427600
}
```

### Step 7: Return PDF to User

```
Response Headers:
├─ Content-Type: application/pdf
├─ Content-Disposition: attachment; filename="rekam_medis_EXP-0001.pdf"
├─ X-Cost-SGT: 2.8
└─ X-Blockchain-TX: 0x5f8e9d...

Response Body:
└─ PDF binary data

User Experience:
├─ Browser downloads PDF
├─ Wallet automatically charged 2.8 SGT
├─ Transaction recorded on blockchain
└─ Can verify on blockchain explorer
```

---

## 💰 Payment & Fee Management System

### Fee Structure (Configurable)

```
┌────────────────────────────────────────────────┐
│            CURRENT FEES (DEFAULT)              │
├────────────────────────────────────────────────┤
│ Data Export (Download PDF)                     │
│   ≤ 2 MB         → 1 SGT                       │
│   > 2 MB         → File Size × 1 SGT           │
│                                                 │
│ Record Creation (Hospital creates record)      │
│   Per record     → 1 SGT                       │
│                                                 │
│ Cross-Hospital Access (query other hospital)   │
│   Per access     → 0 SGT (free, promotes sharing)
│                                                 │
│ Emergency Break Glass                          │
│   Per EBG access → 0 SGT (free, life safety)   │
│                                                 │
│ Admin can change fees anytime                  │
│ All changes logged on blockchain (immutable)   │
└────────────────────────────────────────────────┘
```

### Admin Fee Management

```
API Endpoints (Admin Only):

PATCH /api/admin/fees/export-base
{
  "new_fee_sgt": 0.5  // 50% discount promo
}

PATCH /api/admin/fees/export-multiplier
{
  "new_multiplier": 0.7  // 0.7x for large files
}

PATCH /api/admin/fees/recording
{
  "new_fee_sgt": 0  // Free during launch
}

GET /api/admin/fees/current
└─ Returns current fee configuration

GET /api/admin/fees/history
└─ Returns all fee changes (audit trail)
```

---

## 🔒 Security & Privacy

### Data Encryption

```
┌─────────────────────────────────────────────────────┐
│              DATA SECURITY LAYERS                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Layer 1: Patient Private Key                        │
│  └─ Derived from NIK + Ibu Kandung                  │
│  └─ Never exposed to frontend                       │
│  └─ Held securely on backend                        │
│                                                     │
│ Layer 2: Encryption Algorithm                       │
│  └─ NaCl (tweetnacl.js) - industry standard         │
│  └─ Symmetric encryption of medical data            │
│  └─ Each record encrypted separately                │
│                                                     │
│ Layer 3: Storage Encryption                        │
│  └─ IPFS stores encrypted blobs (not decrypted)    │
│  └─ Only person with private key can decrypt       │
│  └─ Hospital stores encrypted data locally         │
│                                                     │
│ Layer 4: Transport Encryption                      │
│  └─ All API calls over HTTPS/TLS                   │
│  └─ JWT tokens for authentication                  │
│  └─ No PII in URLs or headers                      │
│                                                     │
│ Layer 5: Blockchain Immutability                   │
│  └─ Only hashes & metadata on blockchain           │
│  └─ Cannot be modified once written                │
│  └─ Provides audit trail                           │
│                                                     │
│ Layer 6: Emergency Access Controls                 │  ← NEW
│  └─ Role-based EBG authorization                   │
│  └─ Single-use session tokens                      │
│  └─ Pre-access blockchain logging                  │
│  └─ Rate limiting per doctor                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🗄️ Data Storage Architecture

### Three-Layer Storage

```
┌──────────────────────────────────────────────────┐
│ Layer 1: Blockchain (Sui)                        │
│ ├─ Patient index by nik_hash                     │
│ ├─ Record metadata (id, hospital, timestamp)     │
│ ├─ IPFS references                               │
│ ├─ Data hashes (for verification)                │
│ ├─ Access logs (who accessed what, when)         │
│ ├─ Payment history (immutable)                   │
│ ├─ Fee configuration (with history)              │
│ └─ Emergency Break Glass logs (immutable)        │  ← NEW
│                                                  │
│ Layer 2: IPFS (Encrypted Data)                  │
│ ├─ Encrypted medical data                        │
│ ├─ Encrypted PDFs                                │
│ ├─ Content-addressed (hash-based retrieval)      │
│ └─ Redundant & decentralized                     │
│                                                  │
│ Layer 3: Backend Database (Optional)             │
│ ├─ Patient metadata (name, email, phone)         │
│ ├─ Hospital info (name, api_endpoint)            │
│ ├─ Session management                            │
│ ├─ EBG session tracking (Redis: session_id used) │  ← NEW
│ ├─ EBG justification plaintext (legal audit)     │  ← NEW
│ └─ Caching layer for performance                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🎯 Complete User Journey Examples

### Example 1: Patient Registers & Views Records
*(unchanged — see above)*

### Example 2: Hospital Creates Record
*(unchanged — see above)*

### Example 3: RSUD B Accesses Patient Records
*(unchanged — see above)*

### Example 4: Patient Exports Medical Records as PDF
*(unchanged — see above)*

### Example 5: Emergency Break Glass Access (NEW)

```
1. Pasien X masuk IGD tidak sadarkan diri
   ↓
2. Dr. Andi (VERIFIED_DOCTOR, RSUD B) buka Hospital App
   ↓
3. Dr. Andi pilih menu: "Akses Darurat / Break Glass"
   Input:
   ├─ NIK Pasien: dari KTP atau gelang
   ├─ Emergency type: LIFE_THREATENING
   └─ Justifikasi: "Pasien koma, masuk IGD post-kecelakaan.
      Perlu riwayat alergi dan penyakit kronis sebelum
      tindakan operasi. Tidak ada keluarga yang bisa
      dihubungi saat ini."
   ↓
4. Backend validasi:
   ├─ Role Dr. Andi = VERIFIED_DOCTOR ✅
   ├─ STR & SIP aktif ✅
   └─ Justifikasi 150 chars ✅
   ↓
5. Blockchain menulis: EmergencyAccessInitiated
   (permanen, tidak bisa dihapus)
   ↓
6. EBG session token diterbitkan
   TTL: 15 menit
   ↓
7. Dr. Andi melihat rekam medis lengkap pasien:
   ├─ Alergi: Penisilin → hindari antibiotik golongan ini
   ├─ Riwayat: Diabetes Tipe 2, Hipertensi
   ├─ Obat rutin: Metformin, Amlodipine
   └─ Operasi sebelumnya: Appendektomi 2019
   ↓
8. Dr. Andi mengambil keputusan medis yang tepat
   ↓
9. Sesi berakhir (dokter tutup app / 15 menit habis)
   ↓
10. Blockchain menulis: EmergencyAccessCompleted
    ↓
11. ✅ Pasien ditangani dengan informasi lengkap
    ✅ Dr. Andi tidak bisa akses ulang tanpa EBG baru
    ✅ Audit trail permanen di blockchain
    ✅ Data tidak tersimpan di device setelah sesi
```

---

## 🛠️ Technology Stack

### Backend (NestJS)

```
Framework: NestJS 11.x
├─ TypeScript
├─ Modular architecture
├─ Dependency injection
└─ Built-in validation

Key Libraries:
├─ @mysten/sui.js (Sui blockchain)
├─ tweetnacl (encryption)
├─ @nestjs/jwt (authentication)
├─ @nestjs/passport (auth strategy)
├─ pdfkit (PDF generation)
├─ axios (HTTP client)
├─ uuid (unique identifiers)
└─ ioredis (session management for EBG single-use tokens)  ← NEW
```

### Frontend (Next.js / React Native)

```
Frontend: Next.js 14.x + React Native
├─ TypeScript
├─ Server-side rendering
└─ Mobile-first

Key Libraries:
├─ wagmi (blockchain interaction)
├─ ethers.js (Web3)
├─ pdfkit (PDF generation)
└─ expo-secure-store (credential storage)
```

### Blockchain

```
Network: Sui Mainnet/Testnet
├─ Smart contracts in Move language
├─ Package-based deployment
├─ On-chain storage for:
│  ├─ Patient records metadata
│  ├─ Access logs
│  ├─ Payment history
│  ├─ Fee configuration
│  └─ Emergency Break Glass registry  ← NEW
```

---

## 📊 API Endpoints Summary

### Patient Management

```
POST   /api/patient/register          - Register new patient
POST   /api/patient/login             - Login patient
GET    /api/patient/:patientId        - Get patient info
GET    /api/patient/:patientId/wallet - Get patient wallet
```

### Record Management

```
POST   /api/records/create            - Hospital creates record
GET    /api/records/:patientId        - Get patient records
GET    /api/records/:recordId         - Get single record details
```

### Data Export

```
POST   /api/export-pdf                - Export records as PDF
GET    /api/export/history/:userId    - Get export history
```

### Payment

```
GET    /api/payment/balance/:address  - Check wallet balance
POST   /api/payment/process           - Process payment
GET    /api/payment/history           - Get payment history
```

### Admin (Fee Management)

```
GET    /api/admin/fees/current        - Get current fees
PATCH  /api/admin/fees/export-base    - Update export base fee
PATCH  /api/admin/fees/export-mult    - Update export multiplier
PATCH  /api/admin/fees/recording      - Update recording fee
GET    /api/admin/fees/history        - Get fee change history
GET    /api/admin/revenue/stats       - Get revenue stats
POST   /api/admin/doctors/verify      - Grant VERIFIED_DOCTOR role        ← NEW
DELETE /api/admin/doctors/:id/revoke  - Revoke doctor role                ← NEW
GET    /api/admin/doctors             - List verified doctors              ← NEW
GET    /api/admin/emergency/logs      - List all EBG events               ← NEW
GET    /api/admin/emergency/logs/:id  - Detail single EBG event           ← NEW
```

### Emergency Break Glass (NEW)

```
POST   /api/emergency/break-glass              - Request EBG + submit justifikasi
GET    /api/emergency/break-glass/records      - Fetch records (requires EBG token)
POST   /api/emergency/break-glass/close        - Close session early
GET    /api/patient/:id/emergency/logs         - Patient audit: lihat EBG ke data mereka
```

### Blockchain

```
POST   /api/blockchain/patient/records         - Query patient records
POST   /api/blockchain/log-access             - Log data access
GET    /api/blockchain/export/history         - Get export logs
GET    /api/blockchain/emergency/logs         - Get EBG logs                ← NEW
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured (.env)
- [ ] Sui network selected (testnet/mainnet)
- [ ] Package ID obtained from Sui deployment
- [ ] Admin wallet created & funded
- [ ] IPFS/Pinata credentials set up
- [ ] Database (optional) initialized
- [ ] JWT secret generated
- [ ] Backend salt generated
- [ ] Redis configured (for EBG session tracking)  ← NEW

### Deployment

- [ ] Backend deployed (NestJS)
- [ ] Frontend deployed (Next.js)
- [ ] Mobile app published (React Native)
- [ ] SSL/TLS certificates installed
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Monitoring set up
- [ ] Logging configured

### Post-Deployment

- [ ] Test registration flow
- [ ] Test record creation
- [ ] Test export & payment
- [ ] Verify blockchain transactions
- [ ] Check IPFS uploads
- [ ] Monitor error logs
- [ ] Set up alerts
- [ ] Create admin documentation
- [ ] Test Emergency Break Glass flow (end-to-end)  ← NEW
- [ ] Verify EBG blockchain logs are immutable       ← NEW
- [ ] Test EBG session single-use enforcement        ← NEW
- [ ] Test rate limiting (3x per 24h per doctor)     ← NEW

---

## 🔄 Development Phases

### Phase 1: MVP (Current)

```
✅ Patient registration (NIK + Ibu Kandung)
✅ Hospital record creation
✅ Multi-hospital data querying
✅ Basic export as PDF
✅ SGT token payment processing
✅ Admin fee management
```

### Phase 2: Enhancement

```
□ Emergency Break Glass (EBG)          ← IN PROGRESS
□ Fingerprint biometric (optional)
□ Mobile app UI/UX polish
□ Advanced search & filtering
□ Bulk export feature
□ API rate limiting & quotas
□ Advanced analytics dashboard
```

### Phase 3: Scale

```
□ Shard blockchain for performance
□ Caching layer optimization
□ Multi-region deployment
□ HL7 FHIR integration
□ Third-party app marketplace
□ Insurance integration
```

---

## 🙋 FAQ

### Q: What if patient loses access to their identity?

A: Since wallet is deterministic from NIK + Ibu Kandung, patient can recover by re-entering credentials. No seed phrase needed.

### Q: Can backend read patient medical data?

A: No. Data is encrypted with patient's public key. Backend has secret key but cannot decrypt without patient authorization (in production, with proper access controls).

### Q: What happens if hospital doesn't have SGT to create records?

A: During bootstrap, recording fees can be 0. Hospital needs to buy SGT on exchange or we provide initial allocation. Can also implement credit system.

### Q: Can data be deleted from blockchain?

A: No. Blockchain is immutable. Patient privacy is protected via encryption, not deletion. Only admin with proper authorization can mark records as "archived".

### Q: How do you handle emergency access?

A: Via Emergency Break Glass (EBG). Only VERIFIED_DOCTOR role can trigger it. Doctor must provide written justification (min 50 chars). Access is single-session (max 15 minutes), after which a new EBG request with new justification is required. All access is logged permanently on blockchain before data is even opened.

### Q: Can a doctor reuse an EBG session?

A: No. Each EBG session token is single-use. Once the records endpoint is called, the session_id is marked as USED in Redis and cannot be replayed. The doctor must submit a new EBG request with a new justification for any subsequent emergency access.

### Q: Who can see EBG logs?

A: Three parties: (1) Admin system can see full logs including justification plaintext, (2) Patient can see that an EBG event occurred (doctor ID, hospital, timestamp, emergency type — but not justification detail), (3) Anyone can verify the justification hash on blockchain for integrity check.

### Q: What about GDPR compliance?

A: System design supports GDPR via:
- Right to access: Patient can export all data
- Right to be forgotten: Can revoke hospital access (via revocation on blockchain)
- Data minimization: Only necessary data collected
- Transparency: Immutable audit trail including emergency access events

---

## 👨‍💻 Development Status

```
Backend (NestJS)
├─ ✅ Setup & project structure (completed)
├─ ✅ Crypto service (completed)
├─ ✅ Sui blockchain integration (completed)
├─ ✅ IPFS service (completed)
├─ ✅ Auth & patient registration (completed)
├─ □ Record creation (next)
├─ □ Export & PDF generation (next)
├─ □ Payment processing (next)
├─ □ Fee management (next)
└─ □ Emergency Break Glass module (next)  ← NEW

Frontend (Next.js / React Native)
├─ □ Project setup
├─ □ Registration screen
├─ □ Login screen
├─ □ Dashboard (record list)
├─ □ Export feature
└─ □ Emergency Break Glass UI (doctor)  ← NEW

Smart Contracts (Sui Move)
├─ ✅ Patient registry
├─ ✅ Record management
├─ ✅ Payment processing
├─ ✅ Fee management
├─ ✅ Access logging
└─ □ Emergency Break Glass registry     ← NEW
```

---

**Last Updated:** May 21, 2026
**Version:** 1.1.0
**Status:** Development Phase - MVP + Emergency Break Glass



🎯 3. Cara Menjual Konsep Ini di Portofolio Lu
Saat lu nanti bikin dokumentasi kode atau presentasi interview, lu bisa sebut trik ini sebagai "Zero-Knowledge Caching for Emergency States" atau "Ephemeral Decryption" (Dekripsi Sementara).

Lu tinggal bilang gini ke Hiring Manager:

"Untuk data medis darurat (Break-Glass), saya menerapkan arsitektur Stateless & Ephemeral Decryption. Backend NestJS hanya bertugas sebagai kurir transit di memori RAM (in-memory parsing) yang langsung mengalirkan data ke layar UGD via TLS stream. Kami sengaja mem-bypass DB Caching layer untuk memastikan zero-trace data sensitif di infrastruktur internal kami, sehingga tetap patuh pada regulasi HIPAA/GDPR."

Pernyataan itu otomatis bakal langsung mengeliminasi keraguan rekruter global tentang kemampuan arsitektur dan keamanan data lu. Clean, secure, and professional! 🚀