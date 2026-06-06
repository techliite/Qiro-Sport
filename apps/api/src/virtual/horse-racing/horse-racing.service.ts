import { Injectable } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { RoundStatus } from '@qiro/types'

@Injectable()
export class HorseRacingService {
  async getCurrentRace() {
    const round = await prisma.horseRaceRound.findFirst({
      where: {
        status: { in: [RoundStatus.UPCOMING, RoundStatus.BETTING_OPEN, RoundStatus.IN_PROGRESS] },
      },
      orderBy: { cycleAt: 'asc' },
    })
    return { round }
  }

  async getRecentResults(limit = 10) {
    const rounds = await prisma.horseRaceRound.findMany({
      where: { status: RoundStatus.SETTLED },
      orderBy: { cycleAt: 'desc' },
      take: limit,
    })
    return { rounds }
  }

  async placeBet(data: { userId: string; roundId: string; horseId: number; stakeKobo: number }) {
    // TODO Phase 4: validate BETTING_OPEN, compute win odds, debit, create VirtualBet
    return { message: 'HR bet placement — implementation in Phase 4', ...data }
  }
}
