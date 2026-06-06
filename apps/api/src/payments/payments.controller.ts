import { Controller, Post, Body, Headers, RawBodyRequest, Req } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { Request } from 'express'

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  initiateDeposit(@Body() body: { userId: string; amountKobo: number; email: string }) {
    return this.paymentsService.initiateDeposit(body.userId, body.amountKobo, body.email)
  }

  /** Paystack webhook — HMAC-SHA512 verified before any processing */
  @Post('webhook/paystack')
  paystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.paymentsService.handlePaystackWebhook(signature, req.rawBody ?? Buffer.alloc(0))
  }

  @Post('withdraw')
  requestWithdrawal(@Body() body: { userId: string; amountKobo: number; bankCode: string; accountNumber: string }) {
    return this.paymentsService.requestWithdrawal(body)
  }

  @Post('verify-bank')
  verifyBankAccount(@Body() body: { accountNumber: string; bankCode: string }) {
    return this.paymentsService.verifyBankAccount(body.accountNumber, body.bankCode)
  }
}
