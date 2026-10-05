import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested } from 'class-validator'
import { DiceDirection } from '@qiro/types'

// Request bodies for the three virtual games. Validating here turns bad input
// (fractional/negative stakes, unknown markets) into 400s instead of 500s from BigInt/Prisma.

export class DiceRollBody {
  @IsInt()
  @Min(2)
  @Max(98)
  threshold!: number

  @IsEnum(DiceDirection)
  direction!: DiceDirection

  @IsInt({ message: 'Stake must be a whole number of kobo' })
  @Min(1)
  stakeKobo!: number
}

export class DiceAutoBetBody {
  @IsInt()
  @Min(1)
  @Max(100)
  rollCount!: number

  @ValidateNested()
  @Type(() => DiceRollBody)
  dto!: DiceRollBody
}

export class FootballBetBody {
  @IsString()
  @IsNotEmpty()
  roundId!: string

  @IsString()
  @IsNotEmpty()
  market!: string

  @IsString()
  @IsNotEmpty()
  pick!: string

  @IsInt({ message: 'Stake must be a whole number of kobo' })
  @Min(1)
  stakeKobo!: number
}

export class HorseBetBody {
  @IsString()
  @IsNotEmpty()
  roundId!: string

  @IsInt()
  horseId!: number

  @IsIn(['win', 'place'])
  market!: 'win' | 'place'

  @IsInt({ message: 'Stake must be a whole number of kobo' })
  @Min(1)
  stakeKobo!: number
}

// ─── Bet slip batches ─────────────────────────────────────────────────────────

export class FootballSelectionBody {
  @IsString()
  @IsNotEmpty()
  roundId!: string

  @IsString()
  @IsNotEmpty()
  market!: string

  @IsString()
  @IsNotEmpty()
  pick!: string
}

/** "Single" slip: each selection is its own bet with its own stake — placed all-or-nothing. */
export class FootballSinglesBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FootballBetBody)
  bets!: FootballBetBody[]
}

/** "Multiple" slip: one stake at the combined odds; every selection must win. */
export class FootballMultiBody {
  @IsArray()
  @ArrayMinSize(2, { message: 'A Multiple needs at least 2 selections' })
  @ArrayMaxSize(10, { message: 'A Multiple can have at most 10 selections' })
  @ValidateNested({ each: true })
  @Type(() => FootballSelectionBody)
  selections!: FootballSelectionBody[]

  @IsInt({ message: 'Stake must be a whole number of kobo' })
  @Min(1)
  stakeKobo!: number
}

export class HorseSinglesBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => HorseBetBody)
  bets!: HorseBetBody[]
}
