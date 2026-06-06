import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ReconciliationService } from './reconciliation.service'
import { WalletModule } from '../wallet/wallet.module'

@Module({
  imports: [ScheduleModule.forRoot(), WalletModule],
  providers: [ReconciliationService],
})
export class SchedulerModule {}
