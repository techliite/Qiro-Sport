import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { HorseRacingService } from './horse-racing.service'
import { CurrentUser, type AuthUser } from '../../auth/decorators/current-user.decorator'

@Controller('virtual/horse-racing')
export class HorseRacingController {
  constructor(private readonly hrService: HorseRacingService) {}

  @Get('current')
  getCurrentRace() {
    return this.hrService.getCurrentRace()
  }

  @Get('my-bets')
  getMyBets(@CurrentUser() user: AuthUser, @Query('page') page?: string) {
    return this.hrService.getUserBets(user.id, Number(page ?? 1))
  }

  @Get('results')
  getResults(@Query('limit') limit?: string) {
    return this.hrService.getRecentResults(Number(limit ?? 10))
  }

  @Post('bet')
  placeBet(
    @CurrentUser() user: AuthUser,
    @Body() body: { roundId: string; horseId: number; market: 'win' | 'place'; stakeKobo: number },
  ) {
    return this.hrService.placeBet({ userId: user.id, ...body })
  }
}
