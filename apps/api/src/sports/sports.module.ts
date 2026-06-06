import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { BullModule } from '@nestjs/bullmq'
import { SportsController } from './sports.controller'
import { SportsService } from './sports.service'
import { WalletModule } from '../wallet/wallet.module'

export const ODDS_POLL_QUEUE = 'odds-poll'
export const SETTLEMENT_QUEUE = 'sport-settlement'

@Module({
  imports: [
    HttpModule,
    WalletModule,
    BullModule.registerQueue(
      { name: ODDS_POLL_QUEUE },
      { name: SETTLEMENT_QUEUE },
    ),
  ],
  controllers: [SportsController],
  providers: [SportsService],
  exports: [SportsService],
})
export class SportsModule {}
