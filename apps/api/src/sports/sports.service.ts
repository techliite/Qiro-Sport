import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { ODDS_POLL_QUEUE } from './sports.module'
import { BetSelection } from '@qiro/types'

@Injectable()
export class SportsService {
  constructor(@InjectQueue(ODDS_POLL_QUEUE) private readonly oddsPollQueue: Queue) {}

  async getFixtures(sport?: string) {
    // TODO Phase 1: return cached odds from Redis
    return { fixtures: [], sport }
  }

  async placeBet(userId: string, selections: BetSelection[], stakeKobo: number) {
    // TODO Phase 1: validate selections, check odds freshness, debit wallet, create bet
    return { message: 'Bet placement — implementation in Phase 1', userId, stakeKobo }
  }

  async getBets(userId: string, status?: string) {
    // TODO Phase 1: query sport_bets with optional status filter
    return { bets: [], userId, status }
  }
}
