import { Type } from 'class-transformer'
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested } from 'class-validator'
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
