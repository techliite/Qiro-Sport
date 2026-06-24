import { Module } from '@nestjs/common'
import { DiceModule } from './dice/dice.module'
import { FootballModule } from './football/football.module'
import { HorseRacingModule } from './horse-racing/horse-racing.module'
import { VirtualController } from './virtual.controller'

@Module({
  imports: [DiceModule, FootballModule, HorseRacingModule],
  controllers: [VirtualController],
})
export class VirtualModule {}
