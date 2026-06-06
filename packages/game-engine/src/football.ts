import { randomBytes } from 'node:crypto'
import { MatchEvent, VFMarket } from '@qiro/types'

export interface TeamRating {
  id: number
  name: string
  attack: number   // 1.0 – 10.0
  defense: number  // 1.0 – 10.0
  formWeight: number // 0.1 – 1.0
}

export interface MatchResult {
  homeScore: number
  awayScore: number
  halfTimeHome: number
  halfTimeAway: number
  events: MatchEvent[]
}

const HOUSE_MARGIN = 1.08 // 8% margin baked into odds

/**
 * Expected goals for a team using attack vs opponent defense ratio,
 * scaled by form weight. Clamped to realistic range.
 */
function expectedGoals(attackRating: number, opponentDefense: number, formWeight: number): number {
  const base = (attackRating / opponentDefense) * 1.2
  const withForm = base * (0.7 + formWeight * 0.6)
  return Math.min(Math.max(withForm, 0.3), 4.5)
}

/**
 * Poisson probability mass function.
 */
function poissonPmf(lambda: number, k: number): number {
  let result = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) {
    result *= lambda / i
  }
  return result
}

/**
 * Draw a goal count from a Poisson distribution using a uniform random value.
 */
function drawGoals(lambda: number, uniformValue: number): number {
  let cumulative = 0
  for (let k = 0; k <= 10; k++) {
    cumulative += poissonPmf(lambda, k)
    if (uniformValue <= cumulative) return k
  }
  return 10
}

function uniformFloat(): number {
  const bytes = randomBytes(4)
  const uint32 = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0
  return uint32 / 0xffffffff
}

/**
 * Generate a full match result from two team ratings using a crypto RNG.
 */
export function generateMatchResult(home: TeamRating, away: TeamRating): MatchResult {
  const homeLambda = expectedGoals(home.attack, away.defense, home.formWeight)
  const awayLambda = expectedGoals(away.attack, home.defense, away.formWeight)

  const totalHome = drawGoals(homeLambda, uniformFloat())
  const totalAway = drawGoals(awayLambda, uniformFloat())

  // Split goals across halves (roughly 40% first half)
  const htHome = Math.min(Math.round(totalHome * (0.3 + uniformFloat() * 0.2)), totalHome)
  const htAway = Math.min(Math.round(totalAway * (0.3 + uniformFloat() * 0.2)), totalAway)

  // Generate goal events
  const events: MatchEvent[] = []

  const generateGoalMinutes = (count: number, teamId: number): void => {
    for (let i = 0; i < count; i++) {
      const minute = 1 + Math.floor(uniformFloat() * 90)
      events.push({ minute, type: 'GOAL', teamId })
    }
  }

  generateGoalMinutes(totalHome, home.id)
  generateGoalMinutes(totalAway, away.id)

  // Optional red card (~8% chance per match)
  if (uniformFloat() < 0.08) {
    const redTeam = uniformFloat() > 0.5 ? home.id : away.id
    const minute = 20 + Math.floor(uniformFloat() * 70)
    events.push({ minute, type: 'RED_CARD', teamId: redTeam })
  }

  events.sort((a, b) => a.minute - b.minute)

  return {
    homeScore: totalHome,
    awayScore: totalAway,
    halfTimeHome: htHome,
    halfTimeAway: htAway,
    events,
  }
}

/**
 * Generate market odds from a match result distribution.
 * Uses simple win probability estimate from lambda values.
 */
export function generateMatchOdds(
  home: TeamRating,
  away: TeamRating,
): Record<VFMarket, Record<string, number>> {
  const homeLambda = expectedGoals(home.attack, away.defense, home.formWeight)
  const awayLambda = expectedGoals(away.attack, home.defense, away.formWeight)

  // Simulate 10,000 match outcomes to estimate probabilities
  let homeWins = 0, draws = 0, awayWins = 0
  let over25 = 0, bttsYes = 0
  const SIMS = 5000

  for (let i = 0; i < SIMS; i++) {
    const h = drawGoals(homeLambda, uniformFloat())
    const a = drawGoals(awayLambda, uniformFloat())
    if (h > a) homeWins++
    else if (h === a) draws++
    else awayWins++
    if (h + a > 2.5) over25++
    if (h > 0 && a > 0) bttsYes++
  }

  const probHome = homeWins / SIMS
  const probDraw = draws / SIMS
  const probAway = awayWins / SIMS
  const probOver = over25 / SIMS
  const probBtts = bttsYes / SIMS

  const toOdds = (p: number): number =>
    Math.max(1.05, Math.floor(((1 / p) * (1 / HOUSE_MARGIN)) * 100) / 100)

  return {
    [VFMarket.H2H]: {
      home: toOdds(probHome),
      draw: toOdds(probDraw),
      away: toOdds(probAway),
    },
    [VFMarket.OVER_UNDER]: {
      over: toOdds(probOver),
      under: toOdds(1 - probOver),
    },
    [VFMarket.BTTS]: {
      yes: toOdds(probBtts),
      no: toOdds(1 - probBtts),
    },
    [VFMarket.DOUBLE_CHANCE]: {
      home_draw: toOdds(probHome + probDraw),
      away_draw: toOdds(probAway + probDraw),
      home_away: toOdds(probHome + probAway),
    },
    [VFMarket.CORRECT_SCORE]: {
      '0-0': toOdds(Math.max(0.01, poissonPmf(homeLambda, 0) * poissonPmf(awayLambda, 0))),
      '1-0': toOdds(Math.max(0.01, poissonPmf(homeLambda, 1) * poissonPmf(awayLambda, 0))),
      '0-1': toOdds(Math.max(0.01, poissonPmf(homeLambda, 0) * poissonPmf(awayLambda, 1))),
      '1-1': toOdds(Math.max(0.01, poissonPmf(homeLambda, 1) * poissonPmf(awayLambda, 1))),
      '2-0': toOdds(Math.max(0.01, poissonPmf(homeLambda, 2) * poissonPmf(awayLambda, 0))),
      '0-2': toOdds(Math.max(0.01, poissonPmf(homeLambda, 0) * poissonPmf(awayLambda, 2))),
      '2-1': toOdds(Math.max(0.01, poissonPmf(homeLambda, 2) * poissonPmf(awayLambda, 1))),
      '1-2': toOdds(Math.max(0.01, poissonPmf(homeLambda, 1) * poissonPmf(awayLambda, 2))),
      '2-2': toOdds(Math.max(0.01, poissonPmf(homeLambda, 2) * poissonPmf(awayLambda, 2))),
      'other': 3.5,
    },
    [VFMarket.HALF_TIME]: {
      home: toOdds(probHome * 0.7),
      draw: toOdds(0.45),
      away: toOdds(probAway * 0.7),
    },
  }
}

/**
 * Update team form weight after a result.
 * Winner drifts up, loser drifts down, clamped to [0.1, 1.0].
 */
export function updateFormWeight(current: number, won: boolean, drew: boolean): number {
  const delta = won ? 0.05 : drew ? 0 : -0.05
  return Math.min(1.0, Math.max(0.1, current + delta))
}

/**
 * Evaluate whether a bet pick won given the match result.
 */
export function evaluateVFBet(
  market: VFMarket,
  pick: string,
  result: MatchResult,
): boolean {
  const { homeScore, awayScore, halfTimeHome, halfTimeAway } = result
  const totalGoals = homeScore + awayScore

  switch (market) {
    case VFMarket.H2H:
      if (pick === 'home') return homeScore > awayScore
      if (pick === 'draw') return homeScore === awayScore
      if (pick === 'away') return awayScore > homeScore
      return false

    case VFMarket.OVER_UNDER:
      if (pick === 'over') return totalGoals > 2.5
      if (pick === 'under') return totalGoals < 2.5
      return false

    case VFMarket.BTTS:
      if (pick === 'yes') return homeScore > 0 && awayScore > 0
      if (pick === 'no') return homeScore === 0 || awayScore === 0
      return false

    case VFMarket.DOUBLE_CHANCE:
      if (pick === 'home_draw') return homeScore >= awayScore
      if (pick === 'away_draw') return awayScore >= homeScore
      if (pick === 'home_away') return homeScore !== awayScore
      return false

    case VFMarket.CORRECT_SCORE:
      return pick === `${homeScore}-${awayScore}`

    case VFMarket.HALF_TIME:
      if (pick === 'home') return halfTimeHome > halfTimeAway
      if (pick === 'draw') return halfTimeHome === halfTimeAway
      if (pick === 'away') return halfTimeAway > halfTimeHome
      return false

    default:
      return false
  }
}
