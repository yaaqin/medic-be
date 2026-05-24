import { registerAs } from '@nestjs/config';

export default registerAs('sui', () => ({
  network: process.env.SUI_NETWORK ?? 'testnet',
  rpcUrl: process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443',
  adminPrivateKey: process.env.SUI_ADMIN_PRIVATE_KEY ?? '',
  packageId: process.env.SUI_PACKAGE_ID ?? '',
  patientRegistryId: process.env.SUI_PATIENT_REGISTRY_ID ?? '',
  recordRegistryId: process.env.SUI_RECORD_REGISTRY_ID ?? '',
  feeConfigId: process.env.SUI_FEE_CONFIG_ID ?? '',
  treasuryId: process.env.SUI_TREASURY_ID ?? '',          
  ebgRegistryId: process.env.SUI_EBG_REGISTRY_ID ?? '',
  doctorRegistryId: process.env.SUI_DOCTOR_REGISTRY_ID ?? '', 
  doctorAdminCapId: process.env.SUI_DOCTOR_ADMIN_CAP_ID ?? '',
  recordAdminCapId: process.env.SUI_RECORD_ADMIN_CAP_ID ?? '',
  sgtCoinType: process.env.SGT_COIN_TYPE ?? '',
  sgtPackageId: process.env.SGT_PACKAGE_ID ?? '',
  sgtTreasuryCap: process.env.SGT_TREASURY_CAP_ID ?? '',
}));