import { Controller, Post, Body } from '@nestjs/common'
import { DiceService } from './dice.service'
import { DiceRollDto } from '@qiro/types'

@Controller('virtual/dice')
export class DiceController {
  constructor(private readonly diceService: DiceService) {}

  @Post('roll')
  roll(@Body() body: DiceRollDto & { userId: string }) {
    return this.diceService.roll(body.userId, body)
  }

  @Post('auto-bet')
  autoBet(@Body() body: { userId: string; rollCount: number; dto: DiceRollDto }) {
    return this.diceService.autoBet(body.userId, body.rollCount, body.dto)
  }
}
