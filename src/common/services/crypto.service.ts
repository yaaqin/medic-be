import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as crypto from 'crypto';

export interface DeterministicWallet {
  publicKey: string;   // hex
  secretKey: string;   // hex — NEVER expose to client
  address: string;     // 0x + first 20 bytes of pubkey (Sui-style)
}

export interface EncryptedData {
  ciphertext: string;  // base64
  nonce: string;       // base64
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly salt: string;

  constructor(private readonly config: ConfigService) {
    this.salt = this.config.get<string>('app.walletDerivationSalt') ?? '';
    if (!this.salt) {
      this.logger.warn('⚠️  WALLET_DERIVATION_SALT not set — using empty string (dev only)');
    }
  }

  // ─────────────────────────────────────────────────
  // HASHING
  // ─────────────────────────────────────────────────

  /**
   * SHA-256 hash — dipakai untuk NIK & namaIbuKandung
   * Returns hex string
   */
  hashSha256(input: string): string {
    return crypto.createHash('sha256').update(input.trim().toLowerCase()).digest('hex');
  }

  /**
   * HMAC-SHA256 — dipakai untuk justification hash (EBG)
   * Returns hex string
   */
  hmacSha256(input: string, key: string): string {
    return crypto.createHmac('sha256', key).update(input).digest('hex');
  }

  // ─────────────────────────────────────────────────
  // DETERMINISTIC WALLET
  // ─────────────────────────────────────────────────

  /**
   * Generate wallet deterministik dari NIK + namaIbuKandung.
   * Input yang sama → output yang sama selalu.
   * ⚠️  secretKey harus disimpan di backend, TIDAK boleh expose ke client.
   */
  generateDeterministicWallet(nik: string, namaIbuKandung: string): DeterministicWallet {
    // Seed: HMAC-SHA256(NIK + namaIbuKandung, salt)
    // Normalize input sebelum hash
    const combined = `${nik.trim()}:${namaIbuKandung.trim().toLowerCase()}`;
    const seedHex = crypto
      .createHmac('sha256', this.salt)
      .update(combined)
      .digest('hex');

    // Convert 32-byte seed to Uint8Array untuk NaCl
    const seed = Buffer.from(seedHex.slice(0, 64), 'hex'); // 32 bytes
    const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));

    const publicKeyHex = Buffer.from(keypair.publicKey).toString('hex');
    const secretKeyHex = Buffer.from(keypair.secretKey).toString('hex');

    // Sui address: 0x + hex pubkey (simplified — production pakai proper Sui address derivation)
    const address = '0x' + publicKeyHex.slice(0, 40);

    return {
      publicKey: publicKeyHex,
      secretKey: secretKeyHex,
      address,
    };
  }

  // ─────────────────────────────────────────────────
  // ENCRYPTION / DECRYPTION
  // ─────────────────────────────────────────────────

  /**
   * Enkripsi data dengan public key pasien.
   * Menggunakan NaCl secretbox (symmetric) dengan key dari wallet.
   */
  encryptData(data: string | object, secretKey: string): EncryptedData {
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const plaintextBytes = naclUtil.decodeUTF8(plaintext);

    // Derive symmetric key dari secret key (ambil 32 bytes pertama)
    const keyBytes = new Uint8Array(Buffer.from(secretKey.slice(0, 64), 'hex'));
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

    const cipherBytes = nacl.secretbox(plaintextBytes, nonce, keyBytes);

    return {
      ciphertext: Buffer.from(cipherBytes).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  /**
   * Dekripsi data dengan secret key pasien.
   */
  decryptData(encrypted: EncryptedData, secretKey: string): string {
    const keyBytes = new Uint8Array(Buffer.from(secretKey.slice(0, 64), 'hex'));
    const cipherBytes = new Uint8Array(Buffer.from(encrypted.ciphertext, 'base64'));
    const nonce = new Uint8Array(Buffer.from(encrypted.nonce, 'base64'));

    const plainBytes = nacl.secretbox.open(cipherBytes, nonce, keyBytes);
    if (!plainBytes) {
      throw new Error('Decryption failed — invalid key or corrupted data');
    }

    return naclUtil.encodeUTF8(plainBytes);
  }

  // ─────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────

  /**
   * Generate random hex string (untuk IDs, tokens, etc.)
   */
  generateRandomHex(bytes = 16): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Verify bahwa NIK + namaIbuKandung menghasilkan wallet pubkey yang sama.
   * Dipakai untuk login verification.
   */
  verifyIdentity(nik: string, namaIbuKandung: string, expectedPubkey: string): boolean {
    const wallet = this.generateDeterministicWallet(nik, namaIbuKandung);
    return wallet.publicKey === expectedPubkey;
  }
}
