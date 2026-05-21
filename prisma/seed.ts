import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Sample Hospital ───────────────────────────────
  const rsudB = await prisma.hospital.upsert({
    where: { hospitalCode: 'RSUD-B' },
    update: {},
    create: {
      hospitalCode: 'RSUD-B',
      name: 'RSUD B Kota Lampung',
      address: 'Jl. Raya Bandar Lampung No. 1',
      walletAddress: '0xRSUDB_WALLET_ADDRESS_PLACEHOLDER',
      isActive: true,
    },
  });
  console.log(`✅ Hospital: ${rsudB.hospitalCode}`);

  const puskesmasC = await prisma.hospital.upsert({
    where: { hospitalCode: 'PUSKESMAS-C' },
    update: {},
    create: {
      hospitalCode: 'PUSKESMAS-C',
      name: 'Puskesmas C Kecamatan Tengah',
      address: 'Jl. Puskesmas No. 5',
      walletAddress: '0xPUSKESMASC_WALLET_ADDRESS_PLACEHOLDER',
      isActive: true,
    },
  });
  console.log(`✅ Hospital: ${puskesmasC.hospitalCode}`);

  // ─── Verified Doctor ───────────────────────────────
  const passwordHash = await bcrypt.hash('Doctor@123', 12);
  const doctor = await prisma.hospitalStaff.upsert({
    where: { email: 'dr.andi@rsud-b.id' },
    update: {},
    create: {
      staffCode: 'DOC-0001',
      name: 'Dr. Andi Santoso',
      email: 'dr.andi@rsud-b.id',
      passwordHash,
      role: Role.VERIFIED_DOCTOR,
      hospitalId: rsudB.id,
      strNumber: '503/001/STR/2023',
      sipNumber: 'SIP/001/DINKES/2024',
      specialization: 'Emergency Medicine',
      isVerifiedDoctor: true,
      verifiedAt: new Date(),
    },
  });
  console.log(`✅ Doctor: ${doctor.staffCode} (${doctor.email})`);

  // ─── Regular Hospital Staff ────────────────────────
  const staffPasswordHash = await bcrypt.hash('Staff@123', 12);
  const staff = await prisma.hospitalStaff.upsert({
    where: { email: 'staff.rina@puskesmas-c.id' },
    update: {},
    create: {
      staffCode: 'STF-0001',
      name: 'Rina Wati',
      email: 'staff.rina@puskesmas-c.id',
      passwordHash: staffPasswordHash,
      role: Role.HOSPITAL_STAFF,
      hospitalId: puskesmasC.id,
      isVerifiedDoctor: false,
    },
  });
  console.log(`✅ Staff: ${staff.staffCode} (${staff.email})`);

  console.log('\n✅ Seed selesai!');
  console.log('\nCredentials untuk testing:');
  console.log('  Doctor  → dr.andi@rsud-b.id  / Doctor@123');
  console.log('  Staff   → staff.rina@puskesmas-c.id / Staff@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
