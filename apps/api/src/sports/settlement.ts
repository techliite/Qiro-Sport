// Pure settlement rules for real-football bets. No I/O — unit tested in settlement.spec.ts.

export const TOTALS_LINE = 2.5
export const DEFAULT_MAX_PAYOUT_KOBO = 50_000_000 // ₦500,000 — override with game_config SPORTS/max_payout_kobo

export type SelectionResult = 'PENDING' | 'WON' | 'LOST' | 'VOID'

/** Outcome of one selection given the full-time score. */
export function evaluateSelection(market: string, pick: string, homeScore: number, awayScore: number): 'WON' | 'LOST' {
  let won: boolean
  if (market === 'h2h') {
    if (pick === '1') won = homeScore > awayScore
    else if (pick === 'X') won = homeScore === awayScore
    else if (pick === '2') won = awayScore > homeScore
    else throw new Error(`Unknown h2h pick: ${pick}`)
  } else if (market === 'totals') {
    const goals = homeScore + awayScore
    if (pick === 'Over') won = goals > TOTALS_LINE
    else if (pick === 'Under') won = goals < TOTALS_LINE
    else throw new Error(`Unknown totals pick: ${pick}`)
  } else {
    throw new Error(`Unknown market: ${market}`)
  }
  return won ? 'WON' : 'LOST'
}

export type BetOutcome =
  | { status: 'PENDING' }
  | { status: 'LOST' }
  | { status: 'VOID'; refundKobo: number }
  | { status: 'WON'; payoutKobo: number; effectiveOdds: number }

/**
 * Accumulator outcome from its selections.
 * - Any LOST selection loses the bet immediately, even if others are still pending.
 * - VOID selections count as odds 1.0 (standard bookmaker rule).
 * - All selections VOID → whole stake refunded.
 * - Payout floored to the kobo and capped at maxPayoutKobo.
 */
export function evaluateBet(
  stakeKobo: number,
  selections: { result: SelectionResult; oddsDecimal: number }[],
  maxPayoutKobo: number,
): BetOutcome {
  if (selections.some((s) => s.result === 'LOST')) return { status: 'LOST' }
  if (selections.some((s) => s.result === 'PENDING')) return { status: 'PENDING' }

  const live = selections.filter((s) => s.result === 'WON')
  if (live.length === 0) return { status: 'VOID', refundKobo: stakeKobo }

  const effectiveOdds = live.reduce((acc, s) => acc * s.oddsDecimal, 1)
  const payoutKobo = Math.min(Math.floor(stakeKobo * effectiveOdds), maxPayoutKobo)
  return { status: 'WON', payoutKobo, effectiveOdds }
}

/** Reads home/away goals from The Odds API scores payload (scores are keyed by team name). */
export function extractScore(
  event: { home_team: string; away_team: string; scores: { name: string; score: string }[] | null },
): { homeScore: number; awayScore: number } | null {
  const home = event.scores?.find((s) => s.name === event.home_team)
  const away = event.scores?.find((s) => s.name === event.away_team)
  // Strict digits check: Number('') is 0, which would settle a blank score as 0-0
  if (!home || !away || !/^\d+$/.test(home.score) || !/^\d+$/.test(away.score)) return null
  return { homeScore: Number(home.score), awayScore: Number(away.score) }
}
