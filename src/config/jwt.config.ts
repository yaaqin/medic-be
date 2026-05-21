import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'fallback-secret',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  hospitalSecret: process.env.JWT_HOSPITAL_SECRET ?? 'fallback-hospital-secret',
  hospitalExpiresIn: process.env.JWT_HOSPITAL_EXPIRES_IN ?? '8h',
  ebgSecret: process.env.JWT_EBG_SECRET ?? 'fallback-ebg-secret',
  ebgExpiresIn: process.env.JWT_EBG_EXPIRES_IN ?? '15m',
}));
