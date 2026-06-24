import { Module } from '@nestjs/common'
import { FootballController } from './football.controller'
import { FootballService } from './football.service'
import { FootballScheduler } from './football.scheduler'
import { WalletModule } from '../../wallet/wallet.module'
import { GatewayModule } from '../../gateway/gateway.module'

@Module({
  imports: [WalletModule, GatewayModule],
  controllers: [FootballController],
  providers: [FootballService, FootballScheduler],
  exports: [FootballService],
})
export class FootballModule {}
