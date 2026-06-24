import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { IsNumber, IsString, Min } from 'class-validator'
import { PaymentsService } from './payments.service'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator'

class DepositDto {
  @IsNumber()
  @Min(10000)
  amountKobo!: number

  @IsString()
  email!: string
}

class WithdrawDto {
  @IsNumber()
  @Min(50000)
  amountKobo!: number

  @IsString()
  bankCode!: string

  @IsString()
  accountNumber!: string
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('deposit/initiate')
  initiateDeposit(@CurrentUser() user: AuthUser, @Body() body: DepositDto) {
    return this.paymentsService.initiateDeposit(user.id, body.amountKobo, body.email)
  }

  @Post('withdraw')
  requestWithdrawal(@CurrentUser() user: AuthUser, @Body() body: WithdrawDto) {
    return this.paymentsService.requestWithdrawal({
      userId: user.id,
      amountKobo: body.amountKobo,
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
    })
  }

  @Post('verify-bank')
  verifyBankAccount(@Body() body: { accountNumber: string; bankCode: string }) {
    return this.paymentsService.verifyBankAccount(body.accountNumber, body.bankCode)
  }

  @Get('banks')
  getBanks() {
    return this.paymentsService.getBanks()
  }

  /** Paystack webhook — HMAC-SHA512 verified — must be Public */
  @Public()
  @Post('webhook/paystack')
  paystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.paymentsService.handlePaystackWebhook(signature, req.rawBody ?? Buffer.alloc(0))
  }
}
