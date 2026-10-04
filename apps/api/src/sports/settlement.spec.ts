import { evaluateBet, evaluateSelection, extractScore } from './settlement'

describe('evaluateSelection', () => {
  it.each([
    ['h2h', '1', 2, 1, 'WON'],
    ['h2h', '1', 1, 1, 'LOST'],
    ['h2h', 'X', 0, 0, 'WON'],
    ['h2h', 'X', 2, 1, 'LOST'],
    ['h2h', '2', 0, 3, 'WON'],
    ['h2h', '2', 3, 0, 'LOST'],
    ['totals', 'Over', 2, 1, 'WON'],
    ['totals', 'Over', 1, 1, 'LOST'],
    ['totals', 'Under', 1, 1, 'WON'],
    ['totals', 'Under', 3, 0, 'LOST'],
  ])('%s %s at %i-%i → %s', (market, pick, home, away, expected) => {
    expect(evaluateSelection(market, pick, home, away)).toBe(expected)
  })

  it('rejects unknown markets and picks', () => {
    expect(() => evaluateSelection('btts', 'Yes', 1, 1)).toThrow()
    expect(() => evaluateSelection('h2h', 'Home', 1, 0)).toThrow()
  })
})

describe('evaluateBet', () => {
  const CAP = 100_000_000

  it('loses as soon as any selection loses, even with others pending', () => {
    expect(evaluateBet(10_000, [
      { result: 'LOST', oddsDecimal: 2 },
      { result: 'PENDING', oddsDecimal: 3 },
    ], CAP)).toEqual({ status: 'LOST' })
  })

  it('stays pending while any selection is undecided', () => {
    expect(evaluateBet(10_000, [
      { result: 'WON', oddsDecimal: 2 },
      { result: 'PENDING', oddsDecimal: 3 },
    ], CAP)).toEqual({ status: 'PENDING' })
  })

  it('pays stake × product of odds, floored to the kobo', () => {
    const outcome = evaluateBet(10_001, [
      { result: 'WON', oddsDecimal: 1.9 },
      { result: 'WON', oddsDecimal: 2.05 },
    ], CAP)
    expect(outcome).toMatchObject({ status: 'WON', payoutKobo: Math.floor(10_001 * 1.9 * 2.05) })
  })

  it('treats void selections as odds 1.0', () => {
    expect(evaluateBet(10_000, [
      { result: 'WON', oddsDecimal: 2 },
      { result: 'VOID', oddsDecimal: 5 },
    ], CAP)).toMatchObject({ status: 'WON', payoutKobo: 20_000 })
  })

  it('refunds the stake when every selection is void', () => {
    expect(evaluateBet(10_000, [
      { result: 'VOID', oddsDecimal: 2 },
      { result: 'VOID', oddsDecimal: 3 },
    ], CAP)).toEqual({ status: 'VOID', refundKobo: 10_000 })
  })

  it('caps the payout', () => {
    expect(evaluateBet(1_000_000, [{ result: 'WON', oddsDecimal: 500 }], 50_000_000))
      .toMatchObject({ status: 'WON', payoutKobo: 50_000_000 })
  })
})

describe('extractScore', () => {
  it('maps scores by team name regardless of order', () => {
    expect(extractScore({
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      scores: [{ name: 'Chelsea', score: '1' }, { name: 'Arsenal', score: '3' }],
    })).toEqual({ homeScore: 3, awayScore: 1 })
  })

  it('returns null when scores are missing or malformed', () => {
    expect(extractScore({ home_team: 'A', away_team: 'B', scores: null })).toBeNull()
    expect(extractScore({ home_team: 'A', away_team: 'B', scores: [{ name: 'A', score: '1' }] })).toBeNull()
    expect(extractScore({ home_team: 'A', away_team: 'B', scores: [{ name: 'A', score: '' }, { name: 'B', score: 'x' }] })).toBeNull()
  })
})
