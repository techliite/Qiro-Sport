import { Controller, Get, Query } from '@nestjs/common'
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator'
import { prisma } from '@qiro/db'
import { GameType } from '@qiro/types'

@Controller('virtual')
export class VirtualController {
  /** Aggregated bet history across all virtual games */
  @Get('my-bets')
  async getMyBets(
    @CurrentUser() user: AuthUser,
    @Query('gameType') gameType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(Number(limit ?? 20), 50)
    const skip = (Number(page ?? 1) - 1) * take

    const where = {
      userId: user.id,
      ...(gameType && Object.values(GameType).includes(gameType as GameType)
        ? { gameType: gameType as GameType }
        : {}),
    }

    const [bets, total] = await Promise.all([
      prisma.virtualBet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.virtualBet.count({ where }),
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
      page: Number(page ?? 1),
    }
  }
}
