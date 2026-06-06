import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { SportsService } from './sports.service'

@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get('fixtures')
  getFixtures(@Query('sport') sport?: string) {
    return this.sportsService.getFixtures(sport)
  }

  @Post('bets')
  placeBet(@Body() body: { userId: string; selections: unknown[]; stakeKobo: number }) {
    return this.sportsService.placeBet(body.userId, body.selections as never, body.stakeKobo)
  }

  @Get('bets')
  getBets(@Query('userId') userId: string, @Query('status') status?: string) {
    return this.sportsService.getBets(userId, status)
  }
}
