import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { FootballController } from './football.controller'
import { FootballService } from './football.service'
import { WalletModule } from '../../wallet/wallet.module'
import { GatewayModule } from '../../gateway/gateway.module'

export const VF_SCHEDULE_QUEUE = 'vf-schedule'

@Module({
  imports: [
    WalletModule,
    GatewayModule,
    BullModule.registerQueue({ name: VF_SCHEDULE_QUEUE }),
  ],
  controllers: [FootballController],
  providers: [FootballService],
  exports: [FootballService],
})
export class FootballModule {}
