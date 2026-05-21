import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('app.redisHost') ?? 'localhost',
      port: this.config.get<number>('app.redisPort') ?? 6379,
      password: this.config.get<string>('app.redisPassword') || undefined,
      lazyConnect: true,
    });

    this.client.on('connect', () => this.logger.log('✅ Redis connected'));
    this.client.on('error', (e) => this.logger.error('Redis error', e));

    this.client.connect().catch((e) =>
      this.logger.warn(`Redis connection failed: ${e.message} — EBG session tracking disabled`),
    );
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  // ─── EBG Session helpers ───────────────────────────

  /** Mark session as USED — atomic, mencegah replay attack */
  async markEbgSessionUsed(sessionId: string): Promise<boolean> {
    // SET NX = only set if not exists → atomic check-and-set
    const result = await this.client.set(
      `ebg:session:used:${sessionId}`,
      '1',
      'EX',
      86400, // expire 24h (cleanup)
      'NX',  // only set if not exists
    );
    // result = 'OK' jika berhasil di-set (belum pernah dipakai)
    // result = null jika sudah ada (sudah dipakai)
    return result === 'OK';
  }

  async isEbgSessionUsed(sessionId: string): Promise<boolean> {
    return this.exists(`ebg:session:used:${sessionId}`);
  }

  /** Rate limiting untuk EBG per dokter per hari */
  async incrementEbgRequestCount(doctorId: string): Promise<number> {
    const key = `ebg:ratelimit:${doctorId}:${this.todayKey()}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      // Set expire ke akhir hari ini
      const secondsUntilMidnight = this.secondsUntilMidnight();
      await this.client.expire(key, secondsUntilMidnight);
    }
    return count;
  }

  async getEbgRequestCount(doctorId: string): Promise<number> {
    const key = `ebg:ratelimit:${doctorId}:${this.todayKey()}`;
    const val = await this.client.get(key);
    return val ? parseInt(val) : 0;
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private secondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }
}
