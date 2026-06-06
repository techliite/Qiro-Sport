import { Injectable } from '@nestjs/common'
import { prisma } from '@qiro/db'

@Injectable()
export class GameConfigService {
  async get(gameType: string, key: string, fallback: string): Promise<string> {
    const config = await prisma.gameConfig.findUnique({
      where: { gameType_key: { gameType, key } },
    })
    return config?.value ?? fallback
  }

  async getNumber(gameType: string, key: string, fallback: number): Promise<number> {
    const val = await this.get(gameType, key, String(fallback))
    return Number(val)
  }

  async getBoolean(gameType: string, key: string, fallback = false): Promise<boolean> {
    const val = await this.get(gameType, key, String(fallback))
    return val === 'true'
  }

  async set(gameType: string, key: string, value: string) {
    return prisma.gameConfig.upsert({
      where: { gameType_key: { gameType, key } },
      update: { value },
      create: { gameType, key, value },
    })
  }
}
