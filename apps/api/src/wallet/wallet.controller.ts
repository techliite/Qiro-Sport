import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { WalletService } from './wallet.service'
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator'

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  getBalance(@CurrentUser() user: AuthUser) {
    return this.walletService.getBalance(user.id)
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(user.id, Number(page ?? 1), Number(limit ?? 20))
  }

  @Post('deposit/initialize')
  initializeDeposit(
    @CurrentUser() user: AuthUser,
    @Body() body: { amountKobo: number },
  ) {
    return this.walletService.initializeDeposit(user.id, body.amountKobo)
  }

  @Post('deposit/verify')
  verifyDeposit(
    @CurrentUser() user: AuthUser,
    @Body() body: { reference: string },
  ) {
    return this.walletService.verifyDeposit(user.id, body.reference)
  }

  @Post('withdraw')
  requestWithdrawal(
    @CurrentUser() user: AuthUser,
    @Body() body: { amountKobo: number; bankCode: string; accountNumber: string; accountName: string },
  ) {
    return this.walletService.requestWithdrawal(
      user.id,
      body.amountKobo,
      body.bankCode,
      body.accountNumber,
      body.accountName,
    )
  }
}
