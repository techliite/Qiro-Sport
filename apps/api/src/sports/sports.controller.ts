import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { SportsService } from './sports.service'
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator'
import { BetSelection } from '@qiro/types'

class PlaceSportBetDto {
  selections!: BetSelection[]
  stakeKobo!: number
}

@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get('fixtures')
  getFixtures(@Query('sport') sport?: string) {
    return this.sportsService.getFixtures(sport)
  }

  @Get('bets')
  getMyBets(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.sportsService.getBets(user.id, status, Number(page ?? 1))
  }

  @Post('bets')
  placeBet(@CurrentUser() user: AuthUser, @Body() body: PlaceSportBetDto) {
    return this.sportsService.placeBet(user.id, body.selections, body.stakeKobo)
  }
}
