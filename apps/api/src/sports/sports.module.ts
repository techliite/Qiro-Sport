import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { SportsController } from './sports.controller'
import { SportsService } from './sports.service'
import { WalletModule } from '../wallet/wallet.module'

@Module({
  imports: [HttpModule, WalletModule],
  controllers: [SportsController],
  providers: [SportsService],
  exports: [SportsService],
})
export class SportsModule {}
