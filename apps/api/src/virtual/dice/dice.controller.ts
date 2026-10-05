import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { DiceService } from './dice.service'
import { DiceAutoBetBody, DiceRollBody } from '../bet-bodies.dto'
import { CurrentUser, AuthUser } from '../../auth/decorators/current-user.decorator'

@Controller('virtual/dice')
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  @Get('my-bets')
  getMyBets(@CurrentUser() user: AuthUser, @Query('page') page?: string) {
    return this.diceService.getUserBets(user.id, Number(page ?? 1))
  }

  @Post('roll')
  roll(@CurrentUser() user: AuthUser, @Body() body: DiceRollBody) {
    return this.diceService.roll(user.id, body)
  }

  @Post('auto-bet')
  autoBet(
    @CurrentUser() user: AuthUser,
    @Body() body: DiceAutoBetBody,
  ) {
    return this.diceService.autoBet(user.id, body.rollCount, body.dto)
  }
}
