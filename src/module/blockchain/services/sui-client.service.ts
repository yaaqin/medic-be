import { Injectable } from '@nestjs/common';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuiClientService {
  private client: SuiClient;
  private adminKeypair: Ed25519Keypair;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    const network = this.configService.get('SUI_NETWORK') || 'testnet';
    const rpcUrl = getFullnodeUrl(network);

    this.client = new SuiClient({ url: rpcUrl });

    // Initialize admin keypair
    const adminPrivateKey = this.configService.get('SUI_ADMIN_PRIVATE_KEY');
    this.adminKeypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(adminPrivateKey.replace('0x', ''), 'hex'),
    );
  }

  getClient(): SuiClient {
    return this.client;
  }

  getAdminKeypair(): Ed25519Keypair {
    return this.adminKeypair;
  }

  async getBalance(address: string, coinType: string = '0x2::sui::SUI') {
    const coins = await this.client.getCoins({
      owner: address,
      coinType,
    });

    return coins.data.reduce((total, coin) => {
      return total + BigInt(coin.balance);
    }, BigInt(0));
  }

  async getObject(objectId: string) {
    return this.client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
      },
    });
  }
}