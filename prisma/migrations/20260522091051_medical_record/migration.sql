-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'HOSPITAL_STAFF', 'VERIFIED_DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('LIFE_THREATENING', 'UNCONSCIOUS', 'CRITICAL_SURGERY');

-- CreateEnum
CREATE TYPE "EbgStatus" AS ENUM ('INITIATED', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportRequesterType" AS ENUM ('PATIENT', 'HOSPITAL');

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "nikHash" TEXT NOT NULL,
    "ibuKandungHash" TEXT NOT NULL,
    "walletPubkey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "hospitalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "walletAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_staff" (
    "id" TEXT NOT NULL,
    "staffCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'HOSPITAL_STAFF',
    "hospitalId" TEXT NOT NULL,
    "nikHash" TEXT,
    "strNumber" TEXT,
    "sipNumber" TEXT,
    "specialization" TEXT,
    "isVerifiedDoctor" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_history" (
    "id" TEXT NOT NULL,
    "exportCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "requesterType" "ExportRequesterType" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "fileSizeMb" DOUBLE PRECISION NOT NULL,
    "costSgt" DOUBLE PRECISION NOT NULL,
    "blockchainTx" TEXT,
    "ipfsRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_access_logs" (
    "id" TEXT NOT NULL,
    "ebgCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "emergencyType" "EmergencyType" NOT NULL,
    "justification" TEXT NOT NULL,
    "justificationHash" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionUsed" BOOLEAN NOT NULL DEFAULT false,
    "sessionUsedAt" TIMESTAMP(3),
    "status" "EbgStatus" NOT NULL DEFAULT 'INITIATED',
    "recordsAccessed" TEXT[],
    "blockchainTxInitiated" TEXT,
    "blockchainTxCompleted" TEXT,
    "witnessedBy" TEXT,
    "location" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_config_history" (
    "id" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "oldValueSgt" DOUBLE PRECISION NOT NULL,
    "newValueSgt" DOUBLE PRECISION NOT NULL,
    "changedById" TEXT NOT NULL,
    "blockchainTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_config_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_patientCode_key" ON "patients"("patientCode");

-- CreateIndex
CREATE UNIQUE INDEX "patients_nikHash_key" ON "patients"("nikHash");

-- CreateIndex
CREATE UNIQUE INDEX "patients_walletPubkey_key" ON "patients"("walletPubkey");

-- CreateIndex
CREATE INDEX "patients_nikHash_idx" ON "patients"("nikHash");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_hospitalCode_key" ON "hospitals"("hospitalCode");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_walletAddress_key" ON "hospitals"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_staff_staffCode_key" ON "hospital_staff"("staffCode");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_staff_email_key" ON "hospital_staff"("email");

-- CreateIndex
CREATE INDEX "hospital_staff_email_idx" ON "hospital_staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "export_history_exportCode_key" ON "export_history"("exportCode");

-- CreateIndex
CREATE INDEX "export_history_patientId_idx" ON "export_history"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_access_logs_ebgCode_key" ON "emergency_access_logs"("ebgCode");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_access_logs_sessionId_key" ON "emergency_access_logs"("sessionId");

-- CreateIndex
CREATE INDEX "emergency_access_logs_patientId_idx" ON "emergency_access_logs"("patientId");

-- CreateIndex
CREATE INDEX "emergency_access_logs_doctorId_idx" ON "emergency_access_logs"("doctorId");

-- CreateIndex
CREATE INDEX "emergency_access_logs_sessionId_idx" ON "emergency_access_logs"("sessionId");

-- AddForeignKey
ALTER TABLE "hospital_staff" ADD CONSTRAINT "hospital_staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_access_logs" ADD CONSTRAINT "emergency_access_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_access_logs" ADD CONSTRAINT "emergency_access_logs_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "hospital_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
