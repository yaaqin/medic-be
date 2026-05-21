// src/modules/patient/patient.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { SuiClientService } from '../blockchain/services/sui-client.service';
import { SuiTransactionService } from '../blockchain/services/sui-transaction.service';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PatientService {
  // In-memory storage (untuk testing, later replace dengan database)
  private patients: Map<string, any> = new Map();

  constructor(
    private cryptoService: CryptoService,
    private suiClientService: SuiClientService,
    private suiTransactionService: SuiTransactionService,
    private configService: ConfigService,
  ) {}

  /**
   * Register patient
   */
  async registerPatient(
    nik: string,
    namaIbuKandung: string,
    nama: string,
    noHp: string,
    email: string,
  ) {
    // Hash identifiers
    const nikHash = this.cryptoService.hashValue(nik);
    const ibuKandungHash = this.cryptoService.hashValue(namaIbuKandung);

    // Check if already exists
    if (this.patients.has(nikHash)) {
      throw new ConflictException('Patient already registered');
    }

    // Generate deterministic wallet
    const wallet = this.cryptoService.generatePatientWallet(
      nik,
      namaIbuKandung,
    );

    // Generate patient ID
    const patientId = `PAT-${Date.now()}`;

    // Store patient data locally
    const patientData = {
      patientId,
      nikHash,
      ibuKandungHash,
      walletPubkey: wallet.publicKey,
      walletSecretKey: wallet.secretKey, // Keep secure! (should be in vault)
      nama,
      noHp,
      email,
      createdAt: new Date(),
      blockchainStatus: 'pending',
    };

    // Register ke blockchain
    try {
      const tx = new SuiTransactionService(
        this.suiClientService,
        this.configService,
      );

      // Call blockchain to register patient
      // (In real implementation, would call Sui smart contract)
      console.log('Registering patient on blockchain:', patientId);

      patientData.blockchainStatus = 'completed';
    } catch (error) {
      console.error('Blockchain registration failed:', error);
      patientData.blockchainStatus = 'failed';
      throw error;
    }

    // Store patient
    this.patients.set(nikHash, patientData);

    return {
      success: true,
      patientId,
      message: 'Patient registered successfully',
      data: {
        nik: nik,
        nama,
        walletPubkey: wallet.publicKey,
      },
    };
  }

  /**
   * Verify patient & generate session token
   */
  async verifyPatient(nikHash: string, ibuKandungHash: string) {
    // Find patient by hashes
    const patient = this.findPatientByHash(nikHash, ibuKandungHash);

    if (!patient) {
      throw new NotFoundException('Patient not found or invalid credentials');
    }

    // Generate JWT token
    const token = this.generateToken(patient.patientId);

    return {
      success: true,
      patientId: patient.patientId,
      token,
      message: 'Login successful',
    };
  }

  /**
   * Get patient info
   */
  getPatientInfo(patientId: string) {
    // Find by patient ID
    const patient = Array.from(this.patients.values()).find(
      (p) => p.patientId === patientId,
    );

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return {
      patientId: patient.patientId,
      nama: patient.nama,
      email: patient.email,
      noHp: patient.noHp,
      walletPubkey: patient.walletPubkey,
      createdAt: patient.createdAt,
    };
  }

  /**
   * Get patient wallet
   */
  getPatientWallet(patientId: string) {
    const patient = Array.from(this.patients.values()).find(
      (p) => p.patientId === patientId,
    );

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return {
      patientId,
      walletPubkey: patient.walletPubkey,
      walletSecretKey: patient.walletSecretKey, // DANGEROUS - only for server!
    };
  }

  /**
   * Helper: Find patient by hash
   */
  private findPatientByHash(nikHash: string, ibuKandungHash: string) {
    for (const patient of this.patients.values()) {
      if (
        patient.nikHash === nikHash &&
        patient.ibuKandungHash === ibuKandungHash
      ) {
        return patient;
      }
    }
    return null;
  }

  /**
   * Generate JWT token (placeholder)
   */
  private generateToken(patientId: string): string {
    // TODO: Implement proper JWT generation
    // For now, return a simple token
    return `token_${patientId}_${Date.now()}`;
  }
}