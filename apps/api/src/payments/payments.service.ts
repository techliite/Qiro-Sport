import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { createHmac } from 'node:crypto'
import { firstValueFrom } from 'rxjs'
import { prisma } from '@qiro/db'
import { TransactionType } from '@qiro/types'
import { WalletService } from '../wallet/wallet.service'

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly paystackBase = 'https://api.paystack.co'

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly walletService: WalletService,
  ) {}

  private get headers() {
    return { Authorization: `Bearer ${this.config.getOrThrow('PAYSTACK_SECRET_KEY')}` }
  }

  async initiateDeposit(userId: string, amountKobo: number, email: string) {
    const { data } = await firstValueFrom(
      this.http.post(
        `${this.paystackBase}/transaction/initialize`,
        { amount: amountKobo, email, metadata: { userId } },
        { headers: this.headers },
      ),
    )
    return { authorizationUrl: data.data.authorization_url, reference: data.data.reference }
  }

  async handlePaystackWebhook(signature: string, rawBody: Buffer) {
    const secret = this.config.getOrThrow('PAYSTACK_WEBHOOK_SECRET')
    const hash = createHmac('sha512', secret).update(rawBody).digest('hex')

    if (hash !== signature) {
      this.logger.warn('Invalid Paystack webhook signature — rejected')
      return { received: false }
    }

    const event = JSON.parse(rawBody.toString())

    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data
      const userId = metadata?.userId as string | undefined
      if (!userId) return { received: true }

      // Idempotency: unique constraint on ref prevents double credits
      try {
        await this.walletService.credit(userId, amount, TransactionType.DEPOSIT, reference, {
          paystackRef: reference,
          channel: event.data.channel,
        })
        this.logger.log(`Deposit credited: ${amount} kobo → user ${userId}`)
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
          this.logger.debug(`Duplicate webhook for ref ${reference} — ignored`)
        } else {
          throw err
        }
      }
    }

    return { received: true }
  }

  async requestWithdrawal(data: {
    userId: string
    amountKobo: number
    bankCode: string
    accountNumber: string
  }) {
    // TODO Phase 0: verify bank account, create withdrawal request, debit wallet
    return { message: 'Withdrawal request queued — implementation in Phase 0' }
  }

  async verifyBankAccount(accountNumber: string, bankCode: string) {
    const { data } = await firstValueFrom(
      this.http.get(
        `${this.paystackBase}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        { headers: this.headers },
      ),
    )
    return { accountName: data.data.account_name }
  }
}
