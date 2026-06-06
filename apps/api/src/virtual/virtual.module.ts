import { Module } from '@nestjs/common'
import { DiceModule } from './dice/dice.module'
import { FootballModule } from './football/football.module'
import { HorseRacingModule } from './horse-racing/horse-racing.module'

@Module({
  imports: [DiceModule, FootballModule, HorseRacingModule],
})
export class VirtualModule {}
