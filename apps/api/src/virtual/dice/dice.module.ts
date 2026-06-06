import { Module } from '@nestjs/common'
import { DiceController } from './dice.controller'
import { DiceService } from './dice.service'
import { WalletModule } from '../../wallet/wallet.module'

@Module({
  imports: [WalletModule],
  controllers: [DiceController],
  providers: [DiceService],
})
export class DiceModule {}
