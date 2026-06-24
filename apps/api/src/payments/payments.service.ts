import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import { prisma } from '@qiro/db'
import { TransactionType } from '@qiro/types'
import { WalletService } from '../wallet/wallet.service'

interface PaystackWebhookEvent {
  event: string
  data: {
    reference: string
    amount: number
    channel: string
    metadata?: { userId?: string }
  }
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly paystackBase = 'https://api.paystack.co'

  constructor(
    private readonly config: ConfigService,
    private readonly walletService: WalletService,
  ) {}

  private get paystackHeaders() {
    return {
      Authorization: `Bearer ${this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    }
  }

  // ─── Deposits ────────────────────────────────────────────────────────────────

  async initiateDeposit(userId: string, amountKobo: number, email: string) {
    if (amountKobo < 10000) throw new BadRequestException('Minimum deposit is ₦100')

    const res = await fetch(`${this.paystackBase}/transaction/initialize`, {
      method: 'POST',
      headers: this.paystackHeaders,
      body: JSON.stringify({ amount: amountKobo, email, metadata: { userId } }),
    })

    const json = await res.json() as { data: { authorization_url: string; reference: string } }
    if (!res.ok) throw new InternalServerErrorException('Could not initiate deposit')

    return { authorizationUrl: json.data.authorization_url, reference: json.data.reference }
  }

  async handlePaystackWebhook(signature: string, rawBody: Buffer) {
    const secret = this.config.getOrThrow<string>('PAYSTACK_WEBHOOK_SECRET')
    const hash = createHmac('sha512', secret).update(rawBody).digest('hex')

    if (hash !== signature) {
      this.logger.warn('Invalid Paystack webhook signature — rejected')
      return { received: false }
    }

    const event = JSON.parse(rawBody.toString()) as PaystackWebhookEvent

    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data
      const userId = metadata?.userId
      if (!userId) {
        this.logger.warn(`Webhook missing userId for ref ${reference}`)
        return { received: true }
      }

      try {
        await this.walletService.credit(userId, amount, TransactionType.DEPOSIT, reference, {
          paystackRef: reference,
          channel: event.data.channel,
        })
        this.logger.log(`Deposit credited: ₦${amount / 100} → user ${userId}`)
      } catch (err: unknown) {
        const code = (err as { code?: string }).code
        if (code === 'P2002') {
          this.logger.debug(`Duplicate webhook for ref ${reference} — ignored`)
        } else {
          this.logger.error(`Failed to process deposit ref ${reference}`, err)
          throw err
        }
      }
    }

    return { received: true }
  }

  // ─── Withdrawals ─────────────────────────────────────────────────────────────

  async requestWithdrawal(data: {
    userId: string
    amountKobo: number
    bankCode: string
    accountNumber: string
  }) {
    if (data.amountKobo < 50000) throw new BadRequestException('Minimum withdrawal is ₦500')

    // Verify bank account first
    const { accountName } = await this.verifyBankAccount(data.accountNumber, data.bankCode)

    // Debit wallet (holds the funds)
    await this.walletService.debit(
      data.userId,
      data.amountKobo,
      TransactionType.WITHDRAW,
      `wd-${Date.now()}-${data.userId.slice(0, 8)}`,
      { bankCode: data.bankCode, accountNumber: data.accountNumber },
    )

    const request = await prisma.withdrawalRequest.create({
      data: {
        userId: data.userId,
        amountKobo: BigInt(data.amountKobo),
        bankCode: data.bankCode,
        accountNumber: data.accountNumber,
        accountName,
      },
    })

    this.logger.log(`Withdrawal request #${request.id} created for user ${data.userId}`)
    return { message: 'Withdrawal request submitted. Processing within 24 hours.', requestId: request.id }
  }

  async verifyBankAccount(accountNumber: string, bankCode: string) {
    const res = await fetch(
      `${this.paystackBase}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: this.paystackHeaders },
    )

    const json = await res.json() as { data?: { account_name: string }; message?: string }
    if (!res.ok) throw new BadRequestException(json.message ?? 'Could not verify bank account')

    return { accountName: json.data!.account_name }
  }

  async getBanks() {
    const res = await fetch(`${this.paystackBase}/bank?currency=NGN&country=nigeria&use_cursor=false&perPage=100`, {
      headers: this.paystackHeaders,
    })
    const json = await res.json() as { data: { name: string; code: string }[] }
    return json.data.map((b) => ({ name: b.name, code: b.code }))
  }
}
