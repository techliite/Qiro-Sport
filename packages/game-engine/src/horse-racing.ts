import { randomBytes } from 'node:crypto'

export interface Horse {
  id: number
  name: string
  jockey: string
  currentRating: number
}

const RACE_HOUSE_MARGIN = 1.10 // 10% margin

function uniformFloat(): number {
  const bytes = randomBytes(4)
  const uint32 = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0
  return uint32 / 0xffffffff
}

/**
 * Win odds for a horse based on its rating relative to the field.
 * Higher rating → lower (better) odds.
 */
export function calculateWinOdds(horse: Horse, field: Horse[]): number {
  const totalRating = field.reduce((sum, h) => sum + h.currentRating, 0)
  const winProb = horse.currentRating / totalRating
  const fairOdds = 1 / winProb
  return Math.max(1.10, Math.floor((fairOdds / RACE_HOUSE_MARGIN) * 100) / 100)
}

/**
 * Weighted Fisher-Yates shuffle to generate finishing order.
 * Horses with higher ratings are statistically more likely to finish first.
 * Returns horse IDs in finishing order (index 0 = winner).
 */
export function generateFinishingOrder(field: Horse[]): number[] {
  // Build weighted tickets: more tickets = more likely to be drawn first
  const slots: number[] = []
  for (const horse of field) {
    const tickets = Math.round(horse.currentRating * 10)
    for (let i = 0; i < tickets; i++) {
      slots.push(horse.id)
    }
  }

  const order: number[] = []
  const seen = new Set<number>()
  const remaining = [...slots]

  while (order.length < field.length) {
    if (remaining.length === 0) break

    // Pick a random slot
    const idx = Math.floor(uniformFloat() * remaining.length)
    const horseId = remaining[idx]!

    if (!seen.has(horseId)) {
      seen.add(horseId)
      order.push(horseId)
    }

    // Remove all tickets for this horse from remaining pool
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i] === horseId) {
        remaining.splice(i, 1)
      }
    }
  }

  // Fill in any missed horses (shouldn't happen, safety net)
  for (const horse of field) {
    if (!seen.has(horse.id)) {
      order.push(horse.id)
    }
  }

  return order
}

/**
 * Rating drift after a race.
 * Winner improves, others drop slightly. Clamped to [30, 100].
 */
export function updateHorseRating(
  currentRating: number,
  finishPosition: number,
): number {
  const delta = finishPosition === 1 ? 1.0 : -0.2
  return Math.min(100, Math.max(30, currentRating + delta))
}

/**
 * Evaluate a Win bet: did the selected horse finish 1st?
 */
export function evaluateWinBet(pickedHorseId: number, finishingOrder: number[]): boolean {
  return finishingOrder[0] === pickedHorseId
}

/**
 * Append a new finish position to a horse's form array (sliding window of 5).
 */
export function updateHorseForm(currentForm: number[], newPosition: number): number[] {
  const updated = [...currentForm, newPosition]
  return updated.slice(-5)
}
