import { Module } from '@nestjs/common'
import { DiceController } from './dice.controller'
import { DiceService } from './dice.service'
import { WalletModule } from '../../wallet/wallet.module'
import { GameConfigModule } from '../../config/game-config.module'

@Module({
  imports: [WalletModule, GameConfigModule],
  controllers: [DiceController],
  providers: [DiceService],
})
export class DiceModule {}
