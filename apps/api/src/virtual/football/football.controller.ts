import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { FootballService } from './football.service'
import { FootballBetBody, FootballMultiBody, FootballSinglesBody } from '../bet-bodies.dto'
import { CurrentUser, AuthUser } from '../../auth/decorators/current-user.decorator'

@Controller('virtual/football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('current')
  getCurrentRounds() {
    return this.footballService.getCurrentRounds()
  }

  @Get('results')
  getResults(@Query('league') league?: string, @Query('limit') limit?: string) {
    return this.footballService.getRecentResults(league, Number(limit ?? 10))
  }

  @Get('my-bets')
  getMyBets(@CurrentUser() user: AuthUser, @Query('page') page?: string) {
    return this.footballService.getUserBets(user.id, Number(page ?? 1))
  }

  @Post('bet')
  placeBet(
    @CurrentUser() user: AuthUser,
    @Body() body: FootballBetBody,
  ) {
    return this.footballService.placeBet({ userId: user.id, ...body })
  }

  /** Bet slip "Single": several single bets placed all-or-nothing */
  @Post('bets')
  placeSingles(@CurrentUser() user: AuthUser, @Body() body: FootballSinglesBody) {
    return this.footballService.placeSingles(user.id, body.bets)
  }

  /** Bet slip "Multiple": one accumulator at combined odds */
  @Post('multi-bet')
  placeMulti(@CurrentUser() user: AuthUser, @Body() body: FootballMultiBody) {
    return this.footballService.placeMulti(user.id, body.selections, body.stakeKobo)
  }
}
