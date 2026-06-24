import { Controller, Post, Body } from '@nestjs/common'
import { DiceService } from './dice.service'
import { DiceRollDto } from '@qiro/types'
import { CurrentUser, AuthUser } from '../../auth/decorators/current-user.decorator'

@Controller('virtual/dice')
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  @Post('roll')
  roll(@CurrentUser() user: AuthUser, @Body() body: DiceRollDto) {
    return this.diceService.roll(user.id, body)
  }

  @Post('auto-bet')
  autoBet(
    @CurrentUser() user: AuthUser,
    @Body() body: { rollCount: number; dto: DiceRollDto },
  ) {
    return this.diceService.autoBet(user.id, body.rollCount, body.dto)
  }
}
