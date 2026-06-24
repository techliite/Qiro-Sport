import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { VirtualLeague, RoundStatus, BetStatus, TransactionType, WsEvent } from '@qiro/types'
import { createHash, randomBytes } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { WalletService } from '../../wallet/wallet.service'
import { QiroGateway } from '../../gateway/qiro.gateway'

const ROUND_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const HOUSE_MARGIN = 1.08               // 8% house edge
const MIN_STAKE_KOBO = 10_000           // ₦100
const MAX_STAKE_KOBO = 5_000_000        // ₦50,000
const MAX_WIN_KOBO = 100_000_000        // ₦1,000,000

// ─── Seeded PRNG (mulberry32, provably fair) ───────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashToSeed(hex: string): number {
  return parseInt(hex.slice(0, 8), 16) >>> 0
}

function poissonSample(lambda: number, rand: () => number): number {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= rand() } while (p > L && k < 15)
  return k - 1
}

// ─── Odds Engine (Poisson model) ──────────────────────────────────────────

function poissonPmf(lambda: number, k: number): number {
  if (k < 0) return 0
  let logP = -lambda + k * Math.log(Math.max(lambda, 1e-10))
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

interface MatchOdds {
  '1x2': { '1': number; X: number; '2': number }
  btts: { yes: number; no: number }
  over_under: { over: number; under: number }
}

function computeOdds(
  homeAttack: number, homeDefense: number,
  awayAttack: number, awayDefense: number,
): MatchOdds {
  const homeXG = homeAttack * (2 - awayDefense / 2) * 1.1  // home advantage
  const awayXG = awayAttack * (2 - homeDefense / 2)

  // 1X2
  let homeWin = 0, draw = 0, awayWin = 0
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poissonPmf(homeXG, h) * poissonPmf(awayXG, a)
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
    }
  }

  // BTTS
  const pBttsYes = (1 - poissonPmf(homeXG, 0)) * (1 - poissonPmf(awayXG, 0))

  // O/U 2.5
  const totalXG = homeXG + awayXG
  const pUnder = poissonPmf(totalXG, 0) + poissonPmf(totalXG, 1) + poissonPmf(totalXG, 2)

  const toOdds = (p: number) => Math.max(1.01, Math.round((1 / Math.max(p, 0.01) / HOUSE_MARGIN) * 100) / 100)

  return {
    '1x2': {
      '1': toOdds(homeWin),
      X: toOdds(draw),
      '2': toOdds(awayWin),
    },
    btts: {
      yes: toOdds(pBttsYes),
      no: toOdds(1 - pBttsYes),
    },
    over_under: {
      over: toOdds(1 - pUnder),
      under: toOdds(pUnder),
    },
  }
}

function getOddForPick(odds: MatchOdds, market: string, pick: string): number | null {
  const m = odds[market as keyof MatchOdds] as Record<string, number> | undefined
  return m ? (m[pick] ?? null) : null
}

function didWin(market: string, pick: string, homeScore: number, awayScore: number): boolean {
  const total = homeScore + awayScore
  switch (market) {
    case '1x2':
      if (pick === '1') return homeScore > awayScore
      if (pick === 'X') return homeScore === awayScore
      if (pick === '2') return awayScore > homeScore
      return false
    case 'btts':
      if (pick === 'yes') return homeScore > 0 && awayScore > 0
      if (pick === 'no') return homeScore === 0 || awayScore === 0
      return false
    case 'over_under':
      if (pick === 'over') return total > 2
      if (pick === 'under') return total <= 2
      return false
    default:
      return false
  }
}

// ─── Team seed data ─────────────────────────────────────────────────────────

const SEED_TEAMS = [
  // League A
  { name: 'Madrid FC',     attack: 1.80, defense: 1.75, formWeight: 0.600, league: 'A' },
  { name: 'London United', attack: 1.65, defense: 1.60, formWeight: 0.540, league: 'A' },
  { name: 'Paris City',    attack: 1.70, defense: 1.55, formWeight: 0.560, league: 'A' },
  { name: 'Bayern SC',     attack: 1.75, defense: 1.70, formWeight: 0.580, league: 'A' },
  { name: 'Roma FC',       attack: 1.55, defense: 1.50, formWeight: 0.510, league: 'A' },
  { name: 'Ajax SC',       attack: 1.60, defense: 1.65, formWeight: 0.520, league: 'A' },
  // League B
  { name: 'Lisbon FC',     attack: 1.40, defense: 1.35, formWeight: 0.480, league: 'B' },
  { name: 'Vienna SC',     attack: 1.35, defense: 1.40, formWeight: 0.470, league: 'B' },
  { name: 'Porto Athletic',attack: 1.45, defense: 1.30, formWeight: 0.490, league: 'B' },
  { name: 'Bruges City',   attack: 1.30, defense: 1.45, formWeight: 0.460, league: 'B' },
  { name: 'Sevilla Utd',   attack: 1.35, defense: 1.35, formWeight: 0.465, league: 'B' },
  { name: 'Belgrade SC',   attack: 1.40, defense: 1.40, formWeight: 0.475, league: 'B' },
]

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FootballService implements OnModuleInit {
  private readonly logger = new Logger(FootballService.name)

  constructor(
    private readonly walletService: WalletService,
    private readonly gateway: QiroGateway,
  ) {}

  async onModuleInit() {
    await this.ensureTeamsSeeded()
    await this.ensureRoundsExist()
  }

  // ── Startup & Scheduling ─────────────────────────────────────────────────

  async ensureTeamsSeeded() {
    const count = await prisma.virtualTeam.count()
    if (count >= SEED_TEAMS.length) return

    await prisma.virtualTeam.createMany({
      data: SEED_TEAMS.map((t) => ({
        name: t.name,
        attack: t.attack,
        defense: t.defense,
        formWeight: t.formWeight,
        league: t.league === 'A' ? VirtualLeague.A : VirtualLeague.B,
      })),
      skipDuplicates: true,
    })
    this.logger.log('Virtual teams seeded')
  }

  async ensureRoundsExist() {
    await Promise.all([
      this.ensureLeagueHasRound(VirtualLeague.A),
      this.ensureLeagueHasRound(VirtualLeague.B),
    ])
  }

  private async ensureLeagueHasRound(league: VirtualLeague) {
    const existing = await prisma.virtualFootballRound.findFirst({
      where: { league, status: RoundStatus.BETTING_OPEN },
    })
    if (!existing) {
      await this.generateRound(league)
    }
  }

  async tick() {
    await this.settleExpiredRounds()
    await this.ensureRoundsExist()
  }

  // ── Round Generation ─────────────────────────────────────────────────────

  async generateRound(league: VirtualLeague) {
    const teams = await prisma.virtualTeam.findMany({ where: { league } })
    if (teams.length < 2) throw new Error(`Not enough teams in league ${league}`)

    // Pick two distinct teams, avoiding the same matchup as the last round
    const lastRound = await prisma.virtualFootballRound.findFirst({
      where: { league },
      orderBy: { createdAt: 'desc' },
    })

    const available = teams.filter(
      (t) => !lastRound || (t.id !== lastRound.homeTeamId && t.id !== lastRound.awayTeamId),
    )
    const pool = available.length >= 2 ? available : teams

    const shuffleIdx = Math.floor(Math.random() * pool.length)
    const homeTeam = pool[shuffleIdx]
    const awayPool = pool.filter((t) => t.id !== homeTeam.id)
    const awayTeam = awayPool[Math.floor(Math.random() * awayPool.length)]

    const seed = randomBytes(32).toString('hex')
    const rngSeedHash = createHash('sha256').update(seed).digest('hex')

    const round = await prisma.virtualFootballRound.create({
      data: {
        league,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        rngSeedHash,
        rngSeed: seed,
        status: RoundStatus.BETTING_OPEN,
        cycleAt: new Date(Date.now() + ROUND_DURATION_MS),
      },
      include: { homeTeam: true, awayTeam: true },
    })

    const odds = computeOdds(
      Number(homeTeam.attack), Number(homeTeam.defense),
      Number(awayTeam.attack), Number(awayTeam.defense),
    )

    this.gateway.emitVFEvent(league, WsEvent.VF_UPCOMING, { round: this.formatRound(round, odds) })
    this.logger.log(`Generated round ${round.id} (${league}): ${homeTeam.name} vs ${awayTeam.name}`)

    return round
  }

  // ── Settlement ────────────────────────────────────────────────────────────

  async settleExpiredRounds() {
    const expired = await prisma.virtualFootballRound.findMany({
      where: { status: RoundStatus.BETTING_OPEN, cycleAt: { lte: new Date() } },
      include: { homeTeam: true, awayTeam: true },
    })
    for (const round of expired) {
      await this.settleRound(round)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async settleRound(round: any) {
    if (!round) return

    // Atomic claim — prevent double settlement
    const claimed = await prisma.virtualFootballRound.updateMany({
      where: { id: round.id, status: RoundStatus.BETTING_OPEN },
      data: { status: RoundStatus.IN_PROGRESS },
    })
    if (claimed.count === 0) return

    const seed = round.rngSeed!
    const rand = mulberry32(hashToSeed(seed))

    const homeXG = Number(round.homeTeam.attack) * (2 - Number(round.awayTeam.defense) / 2) * 1.1
    const awayXG = Number(round.awayTeam.attack) * (2 - Number(round.homeTeam.defense) / 2)

    const homeScore = poissonSample(homeXG, rand)
    const awayScore = poissonSample(awayXG, rand)

    // Half-time scores: each goal independently assigned to first half (47% probability)
    let halfTimeHome = 0
    for (let i = 0; i < homeScore; i++) { if (rand() < 0.47) halfTimeHome++ }
    let halfTimeAway = 0
    for (let i = 0; i < awayScore; i++) { if (rand() < 0.47) halfTimeAway++ }

    // Generate goal events
    const events: { minute: number; type: string; teamId: number }[] = []
    for (let i = 0; i < homeScore; i++) {
      events.push({ minute: Math.floor(rand() * 90) + 1, type: 'GOAL', teamId: round.homeTeamId })
    }
    for (let i = 0; i < awayScore; i++) {
      events.push({ minute: Math.floor(rand() * 90) + 1, type: 'GOAL', teamId: round.awayTeamId })
    }
    events.sort((a, b) => a.minute - b.minute)

    // Settle bets
    const bets = await prisma.virtualBet.findMany({
      where: { roundId: round.id, status: BetStatus.PENDING },
    })

    for (const bet of bets) {
      const won = didWin(bet.market, bet.pick, homeScore, awayScore)
      const payoutKobo = won
        ? Math.min(Math.floor(Number(bet.stakeKobo) * Number(bet.oddsDecimal)), MAX_WIN_KOBO)
        : 0

      await prisma.virtualBet.update({
        where: { id: bet.id },
        data: {
          status: won ? BetStatus.WON : BetStatus.LOST,
          payoutKobo: BigInt(payoutKobo),
        },
      })

      if (won && payoutKobo > 0) {
        const { newBalanceKobo } = await this.walletService.credit(
          bet.userId,
          payoutKobo,
          TransactionType.WIN,
          `vf:win:${bet.id}`,
          { betId: bet.id, roundId: round.id, market: bet.market, pick: bet.pick },
        )
        this.gateway.emitToUser(bet.userId, WsEvent.USER_BET_SETTLED, {
          betId: bet.id, won: true, payoutKobo,
        })
        this.gateway.emitToUser(bet.userId, WsEvent.USER_BALANCE, { balanceKobo: newBalanceKobo })
      } else if (!won) {
        this.gateway.emitToUser(bet.userId, WsEvent.USER_BET_SETTLED, {
          betId: bet.id, won: false, payoutKobo: 0,
        })
      }
    }

    // Finalize round
    const settled = await prisma.virtualFootballRound.update({
      where: { id: round.id },
      data: {
        status: RoundStatus.SETTLED,
        homeScore,
        awayScore,
        halfTimeHome,
        halfTimeAway,
        events,
      },
      include: { homeTeam: true, awayTeam: true },
    })

    this.gateway.emitVFEvent(round.league, WsEvent.VF_RESULT, {
      roundId: round.id,
      homeScore,
      awayScore,
      halfTimeHome,
      halfTimeAway,
      events,
      homeTeam: (settled.homeTeam as { name: string }).name,
      awayTeam: (settled.awayTeam as { name: string }).name,
      seed,
    })

    this.logger.log(`Settled round ${round.id}: ${homeScore}-${awayScore} (${bets.length} bets)`)
  }

  // ── Bet Placement ─────────────────────────────────────────────────────────

  async placeBet(data: {
    userId: string
    roundId: string
    market: string
    pick: string
    stakeKobo: number
  }) {
    const { userId, roundId, market, pick, stakeKobo } = data

    if (!Number.isInteger(stakeKobo) || stakeKobo < MIN_STAKE_KOBO) {
      throw new BadRequestException(`Minimum stake is ₦${MIN_STAKE_KOBO / 100}`)
    }
    if (stakeKobo > MAX_STAKE_KOBO) {
      throw new BadRequestException(`Maximum stake is ₦${MAX_STAKE_KOBO / 100}`)
    }

    const round = await prisma.virtualFootballRound.findUnique({
      where: { id: roundId },
      include: { homeTeam: true, awayTeam: true },
    })
    if (!round) throw new BadRequestException('Round not found')
    if (round.status !== RoundStatus.BETTING_OPEN) {
      throw new BadRequestException('Betting is closed for this round')
    }
    if (round.cycleAt.getTime() - Date.now() < 30_000) {
      throw new BadRequestException('Betting has closed for this round')
    }

    const odds = computeOdds(
      Number(round.homeTeam.attack), Number(round.homeTeam.defense),
      Number(round.awayTeam.attack), Number(round.awayTeam.defense),
    )
    const oddsDecimal = getOddForPick(odds, market, pick)
    if (!oddsDecimal) throw new BadRequestException('Invalid market or pick')

    const potentialPayout = Math.min(Math.floor(stakeKobo * oddsDecimal), MAX_WIN_KOBO)

    await this.walletService.debit(userId, stakeKobo, TransactionType.STAKE, `vf:stake:${randomUUID()}`, {
      roundId, market, pick, oddsDecimal,
    })

    const bet = await prisma.virtualBet.create({
      data: {
        userId,
        gameType: 'VIRTUAL_FOOTBALL',
        roundId,
        market,
        pick,
        oddsDecimal,
        stakeKobo: BigInt(stakeKobo),
        status: BetStatus.PENDING,
      },
    })

    return { bet: { ...bet, stakeKobo: Number(bet.stakeKobo) }, potentialPayoutKobo: potentialPayout, odds }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getCurrentRounds() {
    const rounds = await prisma.virtualFootballRound.findMany({
      where: { status: { in: [RoundStatus.BETTING_OPEN, RoundStatus.IN_PROGRESS] } },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { cycleAt: 'asc' },
    })

    return rounds.map((r) => {
      const odds = computeOdds(
        Number(r.homeTeam.attack), Number(r.homeTeam.defense),
        Number(r.awayTeam.attack), Number(r.awayTeam.defense),
      )
      return this.formatRound(r, odds)
    })
  }

  async getRecentResults(league?: string, limit = 10) {
    const where: Record<string, unknown> = { status: RoundStatus.SETTLED }
    if (league) where['league'] = league === 'A' ? VirtualLeague.A : VirtualLeague.B

    const rounds = await prisma.virtualFootballRound.findMany({
      where,
      include: { homeTeam: true, awayTeam: true },
      orderBy: { cycleAt: 'desc' },
      take: limit,
    })

    return rounds.map((r) => ({
      id: r.id,
      league: r.league,
      homeTeam: { id: r.homeTeam.id, name: (r.homeTeam as { name: string }).name },
      awayTeam: { id: r.awayTeam.id, name: (r.awayTeam as { name: string }).name },
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      halfTimeHome: r.halfTimeHome,
      halfTimeAway: r.halfTimeAway,
      events: r.events,
      rngSeedHash: r.rngSeedHash,
      rngSeed: r.rngSeed,
      cycleAt: r.cycleAt.toISOString(),
    }))
  }

  async getUserBets(userId: string, page = 1, limit = 20) {
    const [bets, total] = await Promise.all([
      prisma.virtualBet.findMany({
        where: { userId, gameType: 'VIRTUAL_FOOTBALL' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.virtualBet.count({ where: { userId, gameType: 'VIRTUAL_FOOTBALL' } }),
    ])

    return {
      bets: bets.map((b) => ({
        ...b,
        stakeKobo: Number(b.stakeKobo),
        payoutKobo: b.payoutKobo ? Number(b.payoutKobo) : null,
        oddsDecimal: Number(b.oddsDecimal),
      })),
      total,
      page,
      limit,
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formatRound(
    r: { id: string; league: VirtualLeague; cycleAt: Date; status: RoundStatus; rngSeedHash: string; homeTeamId: number; awayTeamId: number; homeTeam: { id: number; name: string }; awayTeam: { id: number; name: string } },
    odds: MatchOdds,
  ) {
    return {
      id: r.id,
      league: r.league,
      homeTeam: { id: r.homeTeam.id, name: r.homeTeam.name },
      awayTeam: { id: r.awayTeam.id, name: r.awayTeam.name },
      odds,
      status: r.status,
      cycleAt: r.cycleAt.toISOString(),
      rngSeedHash: r.rngSeedHash,
    }
  }
}
