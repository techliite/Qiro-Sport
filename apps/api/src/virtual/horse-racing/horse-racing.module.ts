import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { HorseRacingController } from './horse-racing.controller'
import { HorseRacingService } from './horse-racing.service'
import { WalletModule } from '../../wallet/wallet.module'
import { GatewayModule } from '../../gateway/gateway.module'

export const HR_SCHEDULE_QUEUE = 'hr-schedule'

@Module({
  imports: [
    WalletModule,
    GatewayModule,
    BullModule.registerQueue({ name: HR_SCHEDULE_QUEUE }),
  ],
  controllers: [HorseRacingController],
  providers: [HorseRacingService],
  exports: [HorseRacingService],
})
export class HorseRacingModule {}
