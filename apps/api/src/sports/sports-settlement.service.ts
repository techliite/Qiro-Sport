import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { prisma, Prisma } from '@qiro/db'
import { BetStatus, TransactionType, WsEvent } from '@qiro/types'
import { WalletService } from '../wallet/wallet.service'
import { GameConfigService } from '../config/game-config.service'
import { QiroGateway } from '../gateway/qiro.gateway'
import { BetOutcome, DEFAULT_MAX_PAYOUT_KOBO, evaluateBet, evaluateSelection, extractScore } from './settlement'

// Don't ask for scores until a match has had time to finish (90' + half-time + stoppage)
const MATCH_DURATION_MS = 115 * 60_000
// No final score this long after kick-off → treat as postponed/abandoned and void the selection
const VOID_AFTER_MS = 48 * 3600_000
// The Odds API accepts a list of event ids; keep URLs a sane length
const EVENT_ID_BATCH = 40

interface OddsApiScoreEvent {
  id: string
  completed: boolean
  home_team: string
  away_team: string
  scores: { name: string; score: string }[] | null
}

interface SettledBet {
  userId: string
  betId: string
  status: 'WON' | 'LOST' | 'VOID'
  creditKobo: number
  newBalanceKobo?: number
}

@Injectable()
export class SportsSettlementService {
  private readonly logger = new Logger(SportsSettlementService.name)
  private running = false

  constructor(
    private readonly walletService: WalletService,
    private readonly gameConfig: GameConfigService,
    private readonly gateway: QiroGateway,
    private readonly config: ConfigService,
  ) {}

  // Offset from the odds poll (on the minute) so the two don't compete for API quota at once
  @Cron('30 */5 * * * *')
  async run() {
    if (this.running) return // previous run still going
    this.running = true
    try {
      await this.settleDueSelections()
      await this.settleDecidedBets()
    } catch (err) {
      this.logger.error('Sports settlement run failed', err)
    } finally {
      this.running = false
    }
  }

  // ── Step 1: resolve selections from final scores ───────────────────────────

  private async settleDueSelections() {
    const apiKey = this.config.get<string>('ODDS_API_KEY')
    if (!apiKey) return // Mock fixtures can't be scored — void them from the admin panel

    const now = Date.now()
    const due = await prisma.sportSelection.findMany({
      where: {
        result: BetStatus.PENDING,
        sportKey: { not: null },
        commenceTime: { lte: new Date(now - MATCH_DURATION_MS) },
      },
      select: { id: true, fixtureId: true, sportKey: true, market: true, pick: true, commenceTime: true },
    })
    if (due.length === 0) return

    const bySport = new Map<string, typeof due>()
    for (const sel of due) {
      const list = bySport.get(sel.sportKey!) ?? []
      list.push(sel)
      bySport.set(sel.sportKey!, list)
    }

    for (const [sportKey, selections] of bySport) {
      const events = await this.fetchScores(apiKey, sportKey, [...new Set(selections.map((s) => s.fixtureId))])
      // API failed — leave everything pending rather than voiding on missing data
      if (!events) continue

      for (const sel of selections) {
        const event = events.get(sel.fixtureId)
        const score = event?.completed ? extractScore(event) : null

        let data: Prisma.SportSelectionUpdateManyMutationInput
        if (score) {
          try {
            data = { result: evaluateSelection(sel.market, sel.pick, score.homeScore, score.awayScore), ...score }
          } catch (err) {
            this.logger.error(`Cannot evaluate selection ${sel.id} (${sel.market}/${sel.pick}) — needs manual review`, err)
            continue
          }
        } else if (now - sel.commenceTime!.getTime() > VOID_AFTER_MS) {
          this.logger.warn(`No final score for fixture ${sel.fixtureId} after 48h — voiding selection ${sel.id}`)
          data = { result: BetStatus.VOID }
        } else {
          continue // not finished yet
        }

        await prisma.sportSelection.updateMany({ where: { id: sel.id, result: BetStatus.PENDING }, data })
      }
    }
  }

  private async fetchScores(apiKey: string, sportKey: string, eventIds: string[]) {
    const events = new Map<string, OddsApiScoreEvent>()
    for (let i = 0; i < eventIds.length; i += EVENT_ID_BATCH) {
      const ids = eventIds.slice(i, i + EVENT_ID_BATCH).join(',')
      const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/scores/` +
        `?apiKey=${apiKey}&daysFrom=3&eventIds=${encodeURIComponent(ids)}`
      try {
        const res = await fetch(url)
        if (!res.ok) {
          this.logger.warn(`Scores API returned ${res.status} for ${sportKey}`)
          return null
        }
        for (const event of (await res.json()) as OddsApiScoreEvent[]) events.set(event.id, event)
      } catch (err) {
        this.logger.error(`Failed to fetch scores for ${sportKey}`, err)
        return null
      }
    }
    return events
  }

  // ── Step 2: settle bets whose selections are decided ───────────────────────

  // Picks up every pending bet with at least one decided selection, so a crash between
  // step 1 and step 2 is recovered on the next run.
  private async settleDecidedBets() {
    const bets = await prisma.sportBet.findMany({
      where: { status: BetStatus.PENDING, selections: { some: { result: { not: BetStatus.PENDING } } } },
      select: { id: true },
    })
    for (const { id } of bets) {
      try {
        await this.settleBet(id)
      } catch (err) {
        this.logger.error(`Failed to settle sport bet ${id}`, err)
      }
    }
  }

  async settleBet(betId: string) {
    const maxPayout = await this.gameConfig.getNumber('SPORTS', 'max_payout_kobo', DEFAULT_MAX_PAYOUT_KOBO)

    const settled = await prisma.$transaction(async (tx) => {
      const bet = await tx.sportBet.findUnique({ where: { id: betId }, include: { selections: true } })
      if (!bet || bet.status !== BetStatus.PENDING) return null

      const outcome = evaluateBet(
        Number(bet.stakeKobo),
        bet.selections.map((s) => ({ result: s.result, oddsDecimal: Number(s.oddsDecimal) })),
        maxPayout,
      )
      if (outcome.status === 'PENDING') return null
      return this.applyOutcome(tx, bet, outcome)
    })

    if (settled) this.notify(settled)
    return settled
  }

  // ── Manual void (admin) ────────────────────────────────────────────────────

  async voidBet(betId: string, adminId: string, reason?: string) {
    const settled = await prisma.$transaction(async (tx) => {
      const bet = await tx.sportBet.findUnique({ where: { id: betId } })
      if (!bet) throw new NotFoundException('Bet not found')
      if (bet.status !== BetStatus.PENDING) throw new BadRequestException(`Bet is already ${bet.status.toLowerCase()}`)

      await tx.sportSelection.updateMany({
        where: { betId, result: BetStatus.PENDING },
        data: { result: BetStatus.VOID },
      })
      const result = await this.applyOutcome(
        tx,
        bet,
        { status: 'VOID', refundKobo: Number(bet.stakeKobo) },
        { voidedBy: adminId, reason: reason ?? null },
      )
      if (!result) throw new BadRequestException('Bet was settled by another process')
      return result
    })

    this.logger.log(`Sport bet ${betId} voided by admin ${adminId}${reason ? `: ${reason}` : ''}`)
    this.notify(settled)
    return { betId, status: settled.status, refundKobo: settled.creditKobo }
  }

  // ── Shared ─────────────────────────────────────────────────────────────────

  private async applyOutcome(
    tx: Prisma.TransactionClient,
    bet: { id: string; userId: string },
    outcome: Exclude<BetOutcome, { status: 'PENDING' }>,
    metadata: Record<string, unknown> = {},
  ): Promise<SettledBet | null> {
    const creditKobo = outcome.status === 'WON' ? outcome.payoutKobo : outcome.status === 'VOID' ? outcome.refundKobo : 0

    // Guarded claim: if another worker already settled this bet, count is 0 and we stop
    const claimed = await tx.sportBet.updateMany({
      where: { id: bet.id, status: BetStatus.PENDING },
      data: {
        status: outcome.status,
        actualWinKobo: outcome.status === 'VOID' ? null : BigInt(creditKobo),
        settledAt: new Date(),
      },
    })
    if (claimed.count === 0) return null

    let newBalanceKobo: number | undefined
    if (creditKobo > 0) {
      const won = outcome.status === 'WON'
      ;({ newBalanceKobo } = await this.walletService.creditInTx(
        tx,
        bet.userId,
        creditKobo,
        won ? TransactionType.WIN : TransactionType.REFUND,
        `sport:${won ? 'win' : 'refund'}:${bet.id}`, // unique ref — a second credit for this bet fails
        { gameType: 'SPORT', betId: bet.id, ...metadata },
      ))
    }

    return { userId: bet.userId, betId: bet.id, status: outcome.status, creditKobo, newBalanceKobo }
  }

  private notify(settled: SettledBet) {
    this.gateway.emitToUser(settled.userId, WsEvent.USER_BET_SETTLED, {
      betId: settled.betId,
      game: 'SPORT',
      status: settled.status,
      won: settled.status === 'WON',
      payoutKobo: settled.creditKobo,
    })
    if (settled.newBalanceKobo !== undefined) {
      this.gateway.emitToUser(settled.userId, WsEvent.USER_BALANCE, { balanceKobo: settled.newBalanceKobo })
    }
  }
}
