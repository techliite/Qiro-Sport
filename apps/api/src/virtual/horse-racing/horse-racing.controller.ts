import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { HorseRacingService } from './horse-racing.service'

@Controller('virtual/horse-racing')
export class HorseRacingController {
  constructor(private readonly horseRacingService: HorseRacingService) {}

  @Get('current')
  getCurrentRace() {
    return this.horseRacingService.getCurrentRace()
  }

  @Get('results')
  getResults(@Query('limit') limit?: string) {
    return this.horseRacingService.getRecentResults(Number(limit ?? 10))
  }

  @Post('bet')
  placeBet(@Body() body: { userId: string; roundId: string; horseId: number; stakeKobo: number }) {
    return this.horseRacingService.placeBet(body)
  }
}
