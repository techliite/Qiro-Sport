import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { FootballService } from './football.service'

@Controller('virtual/football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('current')
  getCurrentRounds() {
    return this.footballService.getCurrentRounds()
  }

  @Get('standings')
  getStandings(@Query('league') league: string) {
    return this.footballService.getStandings(league as 'A' | 'B')
  }

  @Get('results')
  getResults(@Query('league') league: string, @Query('limit') limit?: string) {
    return this.footballService.getRecentResults(league as 'A' | 'B', Number(limit ?? 20))
  }

  @Post('bet')
  placeBet(@Body() body: { userId: string; roundId: string; market: string; pick: string; stakeKobo: number }) {
    return this.footballService.placeBet(body)
  }
}
