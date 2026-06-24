import { Module } from '@nestjs/common'
import { HorseRacingController } from './horse-racing.controller'
import { HorseRacingService } from './horse-racing.service'
import { WalletModule } from '../../wallet/wallet.module'
import { GatewayModule } from '../../gateway/gateway.module'

@Module({
  imports: [WalletModule, GatewayModule],
  controllers: [HorseRacingController],
  providers: [HorseRacingService],
  exports: [HorseRacingService],
})
export class HorseRacingModule {}
