import { Injectable } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { VirtualLeague, RoundStatus } from '@qiro/types'

@Injectable()
export class FootballService {
  async getCurrentRounds() {
    const rounds = await prisma.virtualFootballRound.findMany({
      where: {
        status: { in: [RoundStatus.UPCOMING, RoundStatus.BETTING_OPEN, RoundStatus.IN_PROGRESS] },
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { cycleAt: 'asc' },
      take: 4, // 2 leagues × 2 states
    })
    return { rounds }
  }

  async getStandings(league: 'A' | 'B') {
    const teams = await prisma.virtualTeam.findMany({
      where: { league: league === 'A' ? VirtualLeague.A : VirtualLeague.B },
    })
    // TODO Phase 3: compute standings from settled rounds
    return { league, teams }
  }

  async getRecentResults(league: 'A' | 'B', limit = 20) {
    const rounds = await prisma.virtualFootballRound.findMany({
      where: {
        league: league === 'A' ? VirtualLeague.A : VirtualLeague.B,
        status: RoundStatus.SETTLED,
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { cycleAt: 'desc' },
      take: limit,
    })
    return { rounds }
  }

  async placeBet(data: {
    userId: string
    roundId: string
    market: string
    pick: string
    stakeKobo: number
  }) {
    // TODO Phase 3: validate round is BETTING_OPEN, check odds, debit wallet, create VirtualBet
    return { message: 'VF bet placement — implementation in Phase 3', ...data }
  }
}
