import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { WalletService } from './wallet.service'

// JwtAuthGuard will be added in Phase 0 when auth is fully wired
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@Query('userId') userId: string) {
    return this.walletService.getBalance(userId)
  }

  @Get('transactions')
  getTransactions(
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(userId, Number(page ?? 1), Number(limit ?? 20))
  }
}
