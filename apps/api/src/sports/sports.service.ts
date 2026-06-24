import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { prisma } from '@qiro/db'
import { BetSelection, BetStatus, TransactionType } from '@qiro/types'
import { WalletService } from '../wallet/wallet.service'
import { randomUUID } from 'node:crypto'

// ─── Odds cache (in-memory, refreshed every 5 min by cron) ───────────────────
// In production this would be Redis. The shape mirrors The Odds API response.

interface CachedFixture {
  id: string
  sport: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  odds: {
    h2h: { home: number; draw: number; away: number }
    totals?: { over: number; under: number; line: number }
  }
  updatedAt: number
}

const fixtureCache = new Map<string, CachedFixture>()

// Fallback mock odds used when The Odds API key is not configured
const MOCK_FIXTURES: CachedFixture[] = [
  {
    id: 'mock-1', sport: 'soccer_epl', homeTeam: 'Arsenal', awayTeam: 'Chelsea',
    commenceTime: new Date(Date.now() + 2 * 3600_000).toISOString(),
    odds: { h2h: { home: 1.90, draw: 3.40, away: 3.80 }, totals: { over: 1.85, under: 1.95, line: 2.5 } },
    updatedAt: Date.now(),
  },
  {
    id: 'mock-2', sport: 'soccer_epl', homeTeam: 'Liverpool', awayTeam: 'Man City',
    commenceTime: new Date(Date.now() + 5 * 3600_000).toISOString(),
    odds: { h2h: { home: 2.60, draw: 3.20, away: 2.50 }, totals: { over: 1.90, under: 1.90, line: 2.5 } },
    updatedAt: Date.now(),
  },
  {
    id: 'mock-3', sport: 'soccer_epl', homeTeam: 'Man United', awayTeam: 'Tottenham',
    commenceTime: new Date(Date.now() + 24 * 3600_000).toISOString(),
    odds: { h2h: { home: 2.10, draw: 3.30, away: 3.20 }, totals: { over: 1.87, under: 1.93, line: 2.5 } },
    updatedAt: Date.now(),
  },
]

@Injectable()
export class SportsService {
  private readonly logger = new Logger(SportsService.name)
  private readonly oddsApiKey: string | undefined

  constructor(
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
  ) {
    this.oddsApiKey = this.config.get<string>('ODDS_API_KEY')
    // Seed mock fixtures into cache on startup
    MOCK_FIXTURES.forEach((f) => fixtureCache.set(f.id, f))
  }

  // ── Odds polling ────────────────────────────────────────────────────────────

  @Cron('0 */5 * * * *') // every 5 minutes
  async pollOdds() {
    if (!this.oddsApiKey) return // Skip when key not configured

    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${this.oddsApiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`,
      )
      if (!res.ok) { this.logger.warn(`Odds API returned ${res.status}`); return }

      const data = await res.json() as Array<{
        id: string; home_team: string; away_team: string; sport_key: string
        commence_time: string
        bookmakers: Array<{ markets: Array<{ key: string; outcomes: Array<{ name: string; price: number }> }> }>
      }>

      for (const event of data) {
        const bookmaker = event.bookmakers[0]
        if (!bookmaker) continue

        const h2hMarket = bookmaker.markets.find((m) => m.key === 'h2h')
        const totalsMarket = bookmaker.markets.find((m) => m.key === 'totals')
        if (!h2hMarket) continue

        const home = h2hMarket.outcomes.find((o) => o.name === event.home_team)?.price ?? 2
        const away = h2hMarket.outcomes.find((o) => o.name === event.away_team)?.price ?? 2
        const draw = h2hMarket.outcomes.find((o) => o.name === 'Draw')?.price ?? 3

        fixtureCache.set(event.id, {
          id: event.id,
          sport: event.sport_key,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime: event.commence_time,
          odds: {
            h2h: { home, draw, away },
            totals: totalsMarket ? {
              over: totalsMarket.outcomes.find((o) => o.name === 'Over')?.price ?? 1.90,
              under: totalsMarket.outcomes.find((o) => o.name === 'Under')?.price ?? 1.90,
              line: 2.5,
            } : undefined,
          },
          updatedAt: Date.now(),
        })
      }

      this.logger.log(`Odds refreshed — ${data.length} fixtures cached`)
    } catch (err) {
      this.logger.error('Failed to poll odds', err)
    }
  }

  // ── Public methods ──────────────────────────────────────────────────────────

  async getFixtures(sport?: string) {
    const fixtures = Array.from(fixtureCache.values())
      .filter((f) => !sport || f.sport === sport)
      .filter((f) => new Date(f.commenceTime) > new Date())
      .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())

    return { fixtures }
  }

  async placeBet(userId: string, selections: BetSelection[], stakeKobo: number) {
    if (!selections?.length) throw new BadRequestException('No selections provided')
    if (stakeKobo < 10_000) throw new BadRequestException('Minimum stake is ₦100')
    if (stakeKobo > 5_000_000) throw new BadRequestException('Maximum stake is ₦50,000')

    // Validate all selections and compute total odds
    let totalOdds = 1
    for (const sel of selections) {
      const fixture = fixtureCache.get(sel.fixtureId)
      if (!fixture) throw new BadRequestException(`Fixture ${sel.fixtureId} not found or odds expired`)

      const minsToStart = (new Date(fixture.commenceTime).getTime() - Date.now()) / 60_000
      if (minsToStart < 2) throw new BadRequestException(`Betting closed for ${fixture.homeTeam} vs ${fixture.awayTeam}`)

      // Verify the odds the client submitted haven't drifted >5% from our cache
      const cachedOdds = this.resolveOdds(fixture, sel.market, sel.pick)
      if (Math.abs(cachedOdds - sel.oddsDecimal) / cachedOdds > 0.05) {
        throw new BadRequestException(`Odds for ${sel.fixtureId} have changed — refresh and try again`)
      }

      totalOdds *= cachedOdds
    }

    totalOdds = Math.round(totalOdds * 100) / 100
    const potentialWinKobo = Math.floor(stakeKobo * totalOdds)
    const ref = `sport:stake:${randomUUID()}`

    // Debit wallet first
    await this.walletService.debit(userId, stakeKobo, TransactionType.STAKE, ref, { gameType: 'SPORT' })

    // Create bet + selections atomically
    const bet = await prisma.sportBet.create({
      data: {
        userId,
        stakeKobo: BigInt(stakeKobo),
        totalOdds,
        potentialWinKobo: BigInt(potentialWinKobo),
        selections: {
          create: selections.map((sel) => ({
            fixtureId: sel.fixtureId,
            market: sel.market,
            pick: sel.pick,
            oddsDecimal: sel.oddsDecimal,
          })),
        },
      },
      include: { selections: true },
    })

    return {
      betId: bet.id,
      stakeKobo,
      totalOdds,
      potentialWinKobo,
      selections: bet.selections.length,
    }
  }

  async getBets(userId: string, status?: string, page = 1, limit = 20) {
    const where = {
      userId,
      ...(status && Object.values(BetStatus).includes(status as BetStatus)
        ? { status: status as BetStatus }
        : {}),
    }

    const [bets, total] = await Promise.all([
      prisma.sportBet.findMany({
        where,
        include: { selections: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sportBet.count({ where }),
    ])

    return {
      bets: bets.map((b) => ({
        id: b.id,
        stakeKobo: Number(b.stakeKobo),
        totalOdds: Number(b.totalOdds),
        potentialWinKobo: Number(b.potentialWinKobo),
        actualWinKobo: b.actualWinKobo ? Number(b.actualWinKobo) : null,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        selections: b.selections.map((s) => ({
          fixtureId: s.fixtureId,
          market: s.market,
          pick: s.pick,
          oddsDecimal: Number(s.oddsDecimal),
          result: s.result,
        })),
      })),
      total,
      page,
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private resolveOdds(fixture: CachedFixture, market: string, pick: string): number {
    if (market === 'h2h') {
      if (pick === '1') return fixture.odds.h2h.home
      if (pick === 'X') return fixture.odds.h2h.draw
      if (pick === '2') return fixture.odds.h2h.away
    }
    if (market === 'totals' && fixture.odds.totals) {
      if (pick === 'Over') return fixture.odds.totals.over
      if (pick === 'Under') return fixture.odds.totals.under
    }
    throw new BadRequestException(`Unknown market/pick: ${market}/${pick}`)
  }
}
