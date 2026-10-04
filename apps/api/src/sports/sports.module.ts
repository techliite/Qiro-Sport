import { Module } from '@nestjs/common'
import { SportsController } from './sports.controller'
import { SportsService } from './sports.service'
import { SportsSettlementService } from './sports-settlement.service'
import { WalletModule } from '../wallet/wallet.module'
import { GameConfigModule } from '../config/game-config.module'
import { GatewayModule } from '../gateway/gateway.module'

@Module({
  imports: [WalletModule, GameConfigModule, GatewayModule],
  controllers: [SportsController],
  providers: [SportsService, SportsSettlementService],
  exports: [SportsService, SportsSettlementService],
})
export class SportsModule {}
