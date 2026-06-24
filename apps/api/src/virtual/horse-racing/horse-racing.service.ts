import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { prisma } from '@qiro/db'
import { RoundStatus, BetStatus, TransactionType, WsEvent, GameType } from '@qiro/types'
import { createHash, randomBytes } from 'node:crypto'
import { WalletService } from '../../wallet/wallet.service'
import { QiroGateway } from '../../gateway/qiro.gateway'

const RACE_DURATION_MS   = 3 * 60 * 1000  // 3-minute races
const HOUSE_EDGE         = 1.10            // 10% house edge on win, 12% on place
const PLACE_HOUSE_EDGE   = 1.12
const MIN_STAKE_KOBO     = 10_000          // ₦100
const MAX_STAKE_KOBO     = 2_000_000       // ₦20,000
const MAX_WIN_KOBO       = 50_000_000      // ₦500,000
const HORSES_PER_RACE    = 8

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────

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

// ─── Seed horses ─────────────────────────────────────────────────────────────

const SEED_HORSES = [
  { name: 'Thunder Bolt',  jockey: 'J. Okafor',   baseRating: 88, currentRating: 88, form: [1, 2, 1, 3, 2] },
  { name: 'Royal Flash',   jockey: 'A. Ibrahim',   baseRating: 82, currentRating: 85, form: [2, 1, 3, 2, 1] },
  { name: 'Lagos Speed',   jockey: 'T. Adeyemi',   baseRating: 79, currentRating: 80, form: [3, 4, 2, 1, 3] },
  { name: 'Abuja Pride',   jockey: 'K. Mohammed',  baseRating: 85, currentRating: 83, form: [1, 3, 4, 2, 1] },
  { name: 'Sahara Runner', jockey: 'E. Nwosu',     baseRating: 77, currentRating: 78, form: [4, 2, 3, 5, 4] },
  { name: 'Delta Storm',   jockey: 'F. Peters',    baseRating: 80, currentRating: 79, form: [2, 5, 1, 4, 3] },
  { name: 'Eagle Eye',     jockey: 'S. Hassan',    baseRating: 83, currentRating: 84, form: [3, 1, 2, 1, 2] },
  { name: 'Iron Fist',     jockey: 'D. Chukwu',   baseRating: 76, currentRating: 77, form: [5, 4, 5, 3, 5] },
  { name: 'Kano Express',  jockey: 'M. Bello',     baseRating: 81, currentRating: 82, form: [2, 3, 1, 2, 4] },
  { name: 'Niger Pride',   jockey: 'O. Eze',       baseRating: 78, currentRating: 79, form: [4, 2, 4, 3, 2] },
  { name: 'Savanna King',  jockey: 'B. Danladi',   baseRating: 84, currentRating: 83, form: [1, 2, 3, 1, 2] },
  { name: 'Coast Flyer',   jockey: 'C. Obi',       baseRating: 80, currentRating: 81, form: [3, 1, 2, 4, 3] },
]

// Compute odds for a set of drawn horses
function computeHorseOdds(horses: { id: number; currentRating: number; form: number[] }[]) {
  const formScore = (form: number[]) => {
    // Lower position = better form. Score: 1st=5pts, 2nd=4pts, 3rd=3pts, 4th=2pts, 5th+=1pt
    const recent = form.slice(-5)
    return recent.reduce((acc, pos) => acc + Math.max(1, 6 - pos), 0)
  }

  const strengths = horses.map((h) => Number(h.currentRating) * 0.7 + formScore(h.form) * 3)
  const total = strengths.reduce((a, b) => a + b, 0)

  return horses.map((h, i) => {
    const winProb = strengths[i] / total
    const placeProb = Math.min(winProb * 2.5, 0.92) // rough place probability (top 2 of 8)
    const winOdds  = Math.max(1.10, +(1 / winProb / HOUSE_EDGE).toFixed(2))
    const placeOdds = Math.max(1.05, +(1 / placeProb / PLACE_HOUSE_EDGE).toFixed(2))
    return { horseId: h.id, winOdds, placeOdds }
  })
}

// Simulate race: return horse IDs sorted by finish position (1st → last)
function simulateRace(horseIds: number[], ratings: Record<number, number>, seed: string): number[] {
  const rand = mulberry32(hashToSeed(seed))
  const scores = horseIds.map((id) => ({
    id,
    score: (ratings[id] ?? 80) * (0.6 + 0.8 * rand()),
  }))
  return scores.sort((a, b) => b.score - a.score).map((s) => s.id)
}

@Injectable()
export class HorseRacingService implements OnModuleInit {
  private readonly logger = new Logger(HorseRacingService.name)

  constructor(
    private readonly walletService: WalletService,
    private readonly gateway: QiroGateway,
  ) {}

  async onModuleInit() {
    await this.ensureHorsesSeeded()
    await this.ensureRaceExists()
  }

  @Interval(10_000)
  async tick() {
    await this.settleExpiredRaces()
    await this.ensureRaceExists()
  }

  // ── Seed ─────────────────────────────────────────────────────────────────

  async ensureHorsesSeeded() {
    const count = await prisma.virtualHorse.count()
    if (count >= SEED_HORSES.length) return
    await prisma.virtualHorse.createMany({ data: SEED_HORSES, skipDuplicates: true })
    this.logger.log('Horses seeded')
  }

  // ── Race lifecycle ────────────────────────────────────────────────────────

  async ensureRaceExists() {
    const open = await prisma.horseRaceRound.findFirst({
      where: { status: { in: [RoundStatus.UPCOMING, RoundStatus.BETTING_OPEN] } },
    })
    if (!open) await this.generateRace()
  }

  async generateRace() {
    const allHorses = await prisma.virtualHorse.findMany()
    if (allHorses.length < HORSES_PER_RACE) throw new Error('Not enough horses seeded')

    // Pick HORSES_PER_RACE horses at random
    const shuffled = [...allHorses].sort(() => Math.random() - 0.5)
    const drawn = shuffled.slice(0, HORSES_PER_RACE)
    const horseIds = drawn.map((h) => h.id)

    const seed       = randomBytes(32).toString('hex')
    const seedHash   = createHash('sha256').update(seed).digest('hex')
    const lastRound  = await prisma.horseRaceRound.findFirst({ orderBy: { raceNumber: 'desc' } })
    const raceNumber = (lastRound?.raceNumber ?? 0) + 1

    const round = await prisma.horseRaceRound.create({
      data: {
        raceNumber,
        horseIds,
        finishingOrder: [],
        rngSeedHash: seedHash,
        rngSeed: seed,
        status: RoundStatus.BETTING_OPEN,
        cycleAt: new Date(Date.now() + RACE_DURATION_MS),
      },
    })

    const odds = computeHorseOdds(drawn.map((h) => ({ id: h.id, currentRating: Number(h.currentRating), form: h.form })))

    const payload = {
      id: round.id,
      raceNumber: round.raceNumber,
      status: round.status,
      cycleAt: round.cycleAt.toISOString(),
      seedHash: round.rngSeedHash,
      horses: drawn.map((h) => ({
        id: h.id, name: h.name, jockey: h.jockey,
        form: h.form, currentRating: Number(h.currentRating),
        ...(odds.find((o) => o.horseId === h.id) ?? {}),
      })),
    }

    this.gateway.emitHREvent(WsEvent.HR_RACE_CARD, payload)
    this.logger.log(`Generated race #${raceNumber}`)
    return round
  }

  async settleExpiredRaces() {
    const expired = await prisma.horseRaceRound.findMany({
      where: { status: RoundStatus.BETTING_OPEN, cycleAt: { lte: new Date() } },
    })
    for (const race of expired) {
      await this.settleRace(race)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async settleRace(race: any) {
    const claimed = await prisma.horseRaceRound.updateMany({
      where: { id: race.id, status: RoundStatus.BETTING_OPEN },
      data: { status: RoundStatus.IN_PROGRESS },
    })
    if (claimed.count === 0) return

    const horses = await prisma.virtualHorse.findMany({ where: { id: { in: race.horseIds } } })
    const ratings: Record<number, number> = {}
    for (const h of horses) ratings[h.id] = Number(h.currentRating)

    const finishingOrder = simulateRace(race.horseIds as number[], ratings, race.rngSeed)
    const winner  = finishingOrder[0]
    const second  = finishingOrder[1]

    // Settle bets
    const bets = await prisma.virtualBet.findMany({ where: { roundId: race.id, status: BetStatus.PENDING } })

    for (const bet of bets) {
      const betHorseId = Number(bet.pick)
      const market     = bet.market // 'win' | 'place'

      let won = false
      if (market === 'win')   won = betHorseId === winner
      if (market === 'place') won = betHorseId === winner || betHorseId === second

      const payoutKobo = won
        ? Math.min(Math.floor(Number(bet.stakeKobo) * Number(bet.oddsDecimal)), MAX_WIN_KOBO)
        : 0

      await prisma.virtualBet.update({
        where: { id: bet.id },
        data: { status: won ? BetStatus.WON : BetStatus.LOST, payoutKobo: BigInt(payoutKobo) },
      })

      if (won && payoutKobo > 0) {
        const { newBalanceKobo } = await this.walletService.credit(
          bet.userId, payoutKobo, TransactionType.WIN,
          `hr:win:${bet.id}`, { betId: bet.id, raceId: race.id, horseId: betHorseId },
        )
        this.gateway.emitToUser(bet.userId, WsEvent.USER_BET_SETTLED, { betId: bet.id, won: true, payoutKobo })
        this.gateway.emitToUser(bet.userId, WsEvent.USER_BALANCE, { balanceKobo: newBalanceKobo })
      } else {
        this.gateway.emitToUser(bet.userId, WsEvent.USER_BET_SETTLED, { betId: bet.id, won: false, payoutKobo: 0 })
      }
    }

    await prisma.horseRaceRound.update({
      where: { id: race.id },
      data: { status: RoundStatus.SETTLED, finishingOrder },
    })

    const finishNames = finishingOrder.slice(0, 4).map((id) => horses.find((h) => h.id === id)?.name ?? `Horse ${id}`)

    this.gateway.emitHREvent(WsEvent.HR_RESULT, {
      raceId: race.id,
      raceNumber: race.raceNumber,
      finishingOrder,
      finishNames,
      winner: horses.find((h) => h.id === winner)?.name,
      seed: race.rngSeed,
    })

    this.logger.log(`Settled race #${race.raceNumber}: ${finishNames[0]} wins (${bets.length} bets)`)
  }

  // ── Bet placement ─────────────────────────────────────────────────────────

  async placeBet(data: { userId: string; roundId: string; horseId: number; market: 'win' | 'place'; stakeKobo: number }) {
    if (data.stakeKobo < MIN_STAKE_KOBO) throw new BadRequestException(`Min stake ₦${MIN_STAKE_KOBO / 100}`)
    if (data.stakeKobo > MAX_STAKE_KOBO) throw new BadRequestException(`Max stake ₦${MAX_STAKE_KOBO / 100}`)

    const race = await prisma.horseRaceRound.findUniqueOrThrow({ where: { id: data.roundId } })
    if (race.status !== RoundStatus.BETTING_OPEN) throw new BadRequestException('Betting is closed for this race')

    const msToRace = new Date(race.cycleAt).getTime() - Date.now()
    if (msToRace < 15_000) throw new BadRequestException('Betting closes 15 seconds before race time')

    if (!(race.horseIds as number[]).includes(data.horseId)) {
      throw new BadRequestException('Horse not in this race')
    }

    const horses = await prisma.virtualHorse.findMany({ where: { id: { in: race.horseIds as number[] } } })
    const odds = computeHorseOdds(horses.map((h) => ({ id: h.id, currentRating: Number(h.currentRating), form: h.form })))
    const horseOdds = odds.find((o) => o.horseId === data.horseId)
    if (!horseOdds) throw new BadRequestException('Odds not found')

    const oddsDecimal = data.market === 'win' ? horseOdds.winOdds : horseOdds.placeOdds
    const ref = `hr:stake:${data.userId}:${data.roundId}:${data.horseId}:${data.market}`

    await this.walletService.debit(data.userId, data.stakeKobo, TransactionType.STAKE, ref, {
      raceId: data.roundId, horseId: data.horseId, market: data.market,
    })

    return prisma.virtualBet.create({
      data: {
        userId: data.userId,
        gameType: GameType.HORSE_RACING,
        roundId: data.roundId,
        market: data.market,
        pick: String(data.horseId), // horseId stored as pick; market = 'win' | 'place'
        oddsDecimal,
        stakeKobo: BigInt(data.stakeKobo),
        status: BetStatus.PENDING,
      },
    })
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getCurrentRace() {
    const round = await prisma.horseRaceRound.findFirst({
      where: { status: { in: [RoundStatus.UPCOMING, RoundStatus.BETTING_OPEN] } },
      orderBy: { cycleAt: 'asc' },
    })
    if (!round) return null

    const horses = await prisma.virtualHorse.findMany({ where: { id: { in: round.horseIds as number[] } } })
    const odds = computeHorseOdds(horses.map((h) => ({ id: h.id, currentRating: Number(h.currentRating), form: h.form })))

    return {
      id: round.id,
      raceNumber: round.raceNumber,
      status: round.status,
      cycleAt: round.cycleAt.toISOString(),
      seedHash: round.rngSeedHash,
      horses: horses.map((h) => ({
        id: h.id, name: h.name, jockey: h.jockey, form: h.form,
        currentRating: Number(h.currentRating),
        ...(odds.find((o) => o.horseId === h.id) ?? {}),
      })),
    }
  }

  async getUserBets(userId: string, page = 1, limit = 20) {
    const [bets, total] = await Promise.all([
      prisma.virtualBet.findMany({
        where: { userId, gameType: GameType.HORSE_RACING },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.virtualBet.count({ where: { userId, gameType: GameType.HORSE_RACING } }),
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

  async getRecentResults(limit = 10) {
    const rounds = await prisma.horseRaceRound.findMany({
      where: { status: RoundStatus.SETTLED },
      orderBy: { cycleAt: 'desc' },
      take: limit,
    })

    const results = await Promise.all(rounds.map(async (round) => {
      const horses = await prisma.virtualHorse.findMany({ where: { id: { in: round.horseIds as number[] } } })
      const finishing = (round.finishingOrder as number[]).slice(0, 4)
        .map((id) => horses.find((h) => h.id === id))
        .filter(Boolean)
      return {
        id: round.id,
        raceNumber: round.raceNumber,
        cycleAt: round.cycleAt.toISOString(),
        finishingOrder: finishing.map((h) => ({ id: h!.id, name: h!.name })),
        seed: round.rngSeed,
      }
    }))

    return results
  }
}
