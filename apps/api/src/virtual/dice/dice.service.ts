import { Injectable, BadRequestException } from '@nestjs/common'
import {
  generateRoll,
  generateSeed,
  commitSeedHash,
  calculateDicePayout,
  payoutMultiplier,
} from '@qiro/game-engine'
import { prisma } from '@qiro/db'
import { TransactionType, GameType, DiceRollDto } from '@qiro/types'
import { WalletService } from '../../wallet/wallet.service'
import { randomUUID } from 'node:crypto'

const MIN_THRESHOLD = 2
const MAX_THRESHOLD = 98

@Injectable()
export class DiceService {
  constructor(private readonly walletService: WalletService) {}

  async roll(userId: string, dto: DiceRollDto) {
    if (dto.threshold < MIN_THRESHOLD || dto.threshold > MAX_THRESHOLD) {
      throw new BadRequestException(`Threshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}`)
    }

    // TODO Phase 2: read min/max stake from GameConfigService
    if (dto.stakeKobo <= 0) throw new BadRequestException('Invalid stake amount')

    const seed = generateSeed()
    const roundId = randomUUID()
    const seedHash = commitSeedHash(seed, roundId)

    // Debit stake before rolling
    await this.walletService.debit(userId, dto.stakeKobo, TransactionType.STAKE, roundId)

    // Roll
    const rolledNumber = generateRoll()
    const payout = calculateDicePayout(dto.stakeKobo, dto.threshold, dto.direction, rolledNumber)
    const won = payout > 0
    const multiplier = payoutMultiplier(dto.threshold, dto.direction)

    // Record bet
    await prisma.virtualBet.create({
      data: {
        userId,
        gameType: GameType.DICE,
        roundId,
        market: 'dice',
        pick: `${dto.direction}:${dto.threshold}`,
        oddsDecimal: multiplier,
        stakeKobo: BigInt(dto.stakeKobo),
        payoutKobo: BigInt(payout),
        status: won ? 'WON' : 'LOST',
      },
    })

    if (won) {
      await this.walletService.credit(userId, payout, TransactionType.WIN, `win:${roundId}`, {
        gameType: 'DICE',
        roundId,
      })
    }

    return {
      rolledNumber,
      won,
      payoutKobo: payout,
      multiplier,
      seedHash,
      seed, // revealed immediately for dice (instant game)
    }
  }

  async autoBet(userId: string, rollCount: number, dto: DiceRollDto) {
    const MAX_AUTO_ROLLS = 100
    const count = Math.min(rollCount, MAX_AUTO_ROLLS)
    const results = []

    for (let i = 0; i < count; i++) {
      try {
        const result = await this.roll(userId, dto)
        results.push(result)
      } catch (err) {
        // Stop auto-bet on insufficient balance
        if ((err as { message?: string }).message?.includes('Insufficient')) break
        throw err
      }
    }

    return { results, completedRolls: results.length }
  }

  async getUserBets(userId: string, page = 1, limit = 20) {
    const [bets, total] = await Promise.all([
      prisma.virtualBet.findMany({
        where: { userId, gameType: GameType.DICE },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.virtualBet.count({ where: { userId, gameType: GameType.DICE } }),
    ])

    return {
      bets: bets.map((b) => ({
        id: b.id,
        gameType: b.gameType,
        market: b.market,
        pick: b.pick,
        oddsDecimal: Number(b.oddsDecimal),
        stakeKobo: Number(b.stakeKobo),
        payoutKobo: b.payoutKobo ? Number(b.payoutKobo) : null,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      })),
      total,
      page,
    }
  }
}
