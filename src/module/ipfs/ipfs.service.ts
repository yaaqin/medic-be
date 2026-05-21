// src/modules/ipfs/ipfs.service.ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import * as FormData from 'form-data';

@Injectable()
export class IpfsService {
  private pinataKey: string;
  private pinataSecret: string;

  constructor(private configService: ConfigService) {
    this.pinataKey = this.configService.get('PINATA_API_KEY');
    this.pinataSecret = this.configService.get('PINATA_API_SECRET');
  }

  // Add file to IPFS via Pinata
  async add(data: string | Buffer): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', Buffer.isBuffer(data) ? data : Buffer.from(data));

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            pinata_api_key: this.pinataKey,
            pinata_secret_api_key: this.pinataSecret,
          },
        },
      );

      return response.data.IpfsHash;
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  // Get file from IPFS
  async get(hash: string): Promise<Buffer> {
    try {
      const gatewayUrl = this.configService.get('IPFS_GATEWAY_URL');
      const response = await axios.get(`${gatewayUrl}/ipfs/${hash}`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }
}