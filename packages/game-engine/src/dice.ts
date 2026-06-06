import { createHash, randomBytes } from 'node:crypto'
import { DiceDirection } from '@qiro/types'

export const DICE_HOUSE_EDGE = 0.02 // 2%

/**
 * Maps random bytes to a uniform integer in [0, 100].
 * Uses rejection sampling to avoid modulo bias.
 */
export function generateRoll(): number {
  const MAX_VALID = 255 - (255 % 101) // 254 — reject values above this

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const byte = randomBytes(1)[0]!
    if (byte <= MAX_VALID) {
      return byte % 101
    }
  }
}

/**
 * Win probability for a given threshold and direction.
 * threshold 75, OVER → 25 outcomes win (76-100) → 25/101
 */
export function winProbability(threshold: number, direction: DiceDirection): number {
  if (direction === DiceDirection.OVER) {
    return (100 - threshold) / 101
  }
  return threshold / 101
}

/**
 * Payout multiplier = (1 - house_edge) / win_probability
 * Floored to 2 decimal places.
 */
export function payoutMultiplier(threshold: number, direction: DiceDirection): number {
  const prob = winProbability(threshold, direction)
  return Math.floor(((1 - DICE_HOUSE_EDGE) / prob) * 100) / 100
}

/**
 * Payout in kobo. Returns 0 if the roll lost.
 * Uses integer arithmetic — no floats on money.
 */
export function calculateDicePayout(
  stakeKobo: number,
  threshold: number,
  direction: DiceDirection,
  rolledNumber: number,
): number {
  const won =
    direction === DiceDirection.OVER ? rolledNumber > threshold : rolledNumber < threshold

  if (!won) return 0

  const multiplier = payoutMultiplier(threshold, direction)
  // Floor to kobo — never round up in platform's disfavour
  return Math.floor(stakeKobo * multiplier)
}

export function commitSeedHash(seed: string, roundId: string): string {
  return createHash('sha256').update(`${seed}:${roundId}`).digest('hex')
}

export function generateSeed(): string {
  return randomBytes(32).toString('hex')
}
