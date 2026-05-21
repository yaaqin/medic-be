import { registerAs } from '@nestjs/config';

export default registerAs('sui', () => ({
  network: process.env.SUI_NETWORK ?? 'testnet',
  rpcUrl: process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443',
  adminPrivateKey: process.env.SUI_ADMIN_PRIVATE_KEY ?? '',
  packageId: process.env.SUI_PACKAGE_ID ?? '',
  patientRegistryId: process.env.SUI_PATIENT_REGISTRY_ID ?? '',
  recordRegistryId: process.env.SUI_RECORD_REGISTRY_ID ?? '',
  feeConfigId: process.env.SUI_FEE_CONFIG_ID ?? '',
  paymentPoolId: process.env.SUI_PAYMENT_POOL_ID ?? '',
  ebgRegistryId: process.env.SUI_EBG_REGISTRY_ID ?? '',
  sgtTokenType: process.env.SGT_TOKEN_TYPE ?? '',
}));
