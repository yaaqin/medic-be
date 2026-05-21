import { Injectable } from '@nestjs/common';
import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private backendSalt = process.env.BACKEND_SALT;

  // Hash value
  hashValue(value: string): string {
    return crypto
      .createHash('sha256')
      .update(value)
      .digest('hex');
  }

  // Generate deterministic wallet dari NIK + Ibu Kandung
  generatePatientWallet(nik: string, namaIbuKandung: string) {
    const combined = nik + namaIbuKandung + this.backendSalt;
    const seed = crypto
      .createHash('sha256')
      .update(combined)
      .digest();

    const keypair = nacl.sign.keyPair.fromSeed(seed);

    return {
      publicKey: util.encodeBase64(keypair.publicKey),
      secretKey: util.encodeBase64(keypair.secretKey),
      seed: util.encodeBase64(seed),
    };
  }

  // Encrypt data dengan public key
  encrypt(plaintext: string, publicKeyBase64: string): string {
    const publicKey = util.decodeBase64(publicKeyBase64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ephemeralKeypair = nacl.box.keyPair();

    const encrypted = nacl.box(
      util.decodeUTF8(plaintext),
      nonce,
      publicKey,
      ephemeralKeypair.secretKey,
    );

    return util.encodeBase64(
      ephemeralKeypair.publicKey + nonce + encrypted,
    );
  }

  // Decrypt data (server-side)
  decrypt(encryptedDataBase64: string, secretKeyBase64: string): string {
    const encryptedData = util.decodeBase64(encryptedDataBase64);
    const ephemeralPublicKey = encryptedData.slice(0, nacl.box.publicKeyLength);
    const nonce = encryptedData.slice(
      nacl.box.publicKeyLength,
      nacl.box.publicKeyLength + nacl.box.nonceLength,
    );
    const ciphertext = encryptedData.slice(
      nacl.box.publicKeyLength + nacl.box.nonceLength,
    );

    const secretKey = util.decodeBase64(secretKeyBase64);
    const plaintext = nacl.box.open(
      ciphertext,
      nonce,
      ephemeralPublicKey,
      secretKey,
    );

    if (!plaintext) {
      throw new Error('Decryption failed');
    }

    return util.encodeUTF8(plaintext);
  }

  // Generate ZK proof (simplified)
  generateZKProof(nik: string, namaIbuKandung: string, recordHash?: string): string {
    const nikHash = this.hashValue(nik);
    const ibuKandungHash = this.hashValue(namaIbuKandung);

    const proofData = {
      nikHash,
      ibuKandungHash,
      recordHash,
      timestamp: Math.floor(Date.now() / 1000),
    };

    return crypto
      .createHmac('sha256', this.backendSalt)
      .update(JSON.stringify(proofData))
      .digest('hex');
  }

  // Verify ZK proof
  verifyZKProof(
    proof: string,
    nik: string,
    namaIbuKandung: string,
    recordHash?: string,
  ): boolean {
    const expectedProof = this.generateZKProof(nik, namaIbuKandung, recordHash);
    return proof === expectedProof;
  }
}