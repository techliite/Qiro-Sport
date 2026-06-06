// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  STAKE = 'STAKE',
  WIN = 'WIN',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum BetStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID',
}

export enum GameType {
  DICE = 'DICE',
  VIRTUAL_FOOTBALL = 'VIRTUAL_FOOTBALL',
  HORSE_RACING = 'HORSE_RACING',
}

export enum VirtualLeague {
  A = 'A',
  B = 'B',
}

export enum RoundStatus {
  UPCOMING = 'UPCOMING',
  BETTING_OPEN = 'BETTING_OPEN',
  BETTING_CLOSED = 'BETTING_CLOSED',
  IN_PROGRESS = 'IN_PROGRESS',
  SETTLED = 'SETTLED',
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export enum DiceDirection {
  OVER = 'OVER',
  UNDER = 'UNDER',
}

// ─── Wallet / Money ───────────────────────────────────────────────────────────
// All amounts in KOBO (integer). Never use NGN floats.

export interface WalletBalance {
  balanceKobo: number
  userId: string
}

export interface TransactionRecord {
  id: string
  type: TransactionType
  amountKobo: number
  runningBalanceKobo: number
  ref: string
  createdAt: Date
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  phone: string
  username: string
  password: string
  dob: string // ISO date string YYYY-MM-DD
}

export interface LoginDto {
  phone: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// ─── Sports Betting ───────────────────────────────────────────────────────────

export enum SportMarket {
  H2H = 'h2h',
  TOTALS = 'totals',
  BTTS = 'btts',
  DOUBLE_CHANCE = 'double_chance',
}

export interface BetSelection {
  fixtureId: string
  market: SportMarket
  pick: string
  oddsDecimal: number
}

export interface PlaceBetDto {
  selections: BetSelection[]
  stakeKobo: number
}

// ─── Virtual Football ─────────────────────────────────────────────────────────

export enum VFMarket {
  H2H = '1x2',
  OVER_UNDER = 'over_under',
  BTTS = 'btts',
  DOUBLE_CHANCE = 'double_chance',
  CORRECT_SCORE = 'correct_score',
  HALF_TIME = 'half_time',
}

export interface MatchEvent {
  minute: number
  type: 'GOAL' | 'RED_CARD'
  teamId: number
}

export interface VFRoundPublic {
  id: string
  league: VirtualLeague
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
  odds: Record<VFMarket, Record<string, number>>
  status: RoundStatus
  cycleAt: string
  homeScore?: number
  awayScore?: number
  halfTimeHome?: number
  halfTimeAway?: number
  events?: MatchEvent[]
}

// ─── Virtual Horse Racing ─────────────────────────────────────────────────────

export interface HorsePublic {
  id: number
  name: string
  jockey: string
  form: number[]
  winOdds: number
}

export interface HorseRaceRoundPublic {
  id: string
  raceNumber: number
  horses: HorsePublic[]
  status: RoundStatus
  cycleAt: string
  finishingOrder?: number[] // horse IDs in finish order
}

// ─── Dice ─────────────────────────────────────────────────────────────────────

export interface DiceRollDto {
  threshold: number // 2–98
  direction: DiceDirection
  stakeKobo: number
}

export interface DiceRollResult {
  rolledNumber: number
  won: boolean
  payoutKobo: number
  multiplier: number
  seedHash: string
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export enum WsEvent {
  // Virtual Football
  VF_UPCOMING = 'vf:upcoming',
  VF_BETTING_OPEN = 'vf:betting_open',
  VF_BETTING_CLOSED = 'vf:betting_closed',
  VF_HALF_TIME = 'vf:halfTime',
  VF_RESULT = 'vf:result',
  VF_STANDINGS = 'vf:standings',

  // Horse Racing
  HR_RACE_CARD = 'hr:race_card',
  HR_BETTING_OPEN = 'hr:betting_open',
  HR_BETTING_CLOSED = 'hr:betting_closed',
  HR_IN_PROGRESS = 'hr:in_progress',
  HR_RESULT = 'hr:result',

  // User private channel
  USER_BALANCE = 'user:balance',
  USER_BET_SETTLED = 'user:bet_settled',
}

// ─── API Response wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
