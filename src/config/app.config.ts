import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000'),
  walletDerivationSalt: process.env.WALLET_DERIVATION_SALT ?? '',
  ebgMaxRequestsPerDay: parseInt(process.env.EBG_MAX_REQUESTS_PER_DAY ?? '3'),
  pinataApiKey: process.env.PINATA_API_KEY ?? '',
  pinataSecretKey: process.env.PINATA_SECRET_API_KEY ?? '',
  pinataGateway: process.env.PINATA_GATEWAY ?? 'https://gateway.pinata.cloud/ipfs',
  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT ?? '6379'),
  redisPassword: process.env.REDIS_PASSWORD ?? '',
}));
