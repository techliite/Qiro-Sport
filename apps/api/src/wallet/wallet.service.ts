import { Injectable, BadRequestException } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { TransactionType } from '@qiro/types'
import { randomUUID } from 'node:crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? ''
const PAYSTACK_BASE   = 'https://api.paystack.co'
const MIN_DEPOSIT_KOBO    = 10_000   // ₦100
const MIN_WITHDRAWAL_KOBO = 50_000   // ₦500

async function paystackPost(path: string, body: unknown) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<{ status: boolean; data: Record<string, unknown> }>
}

async function paystackGet(path: string) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  })
  return res.json() as Promise<{ status: boolean; data: Record<string, unknown> }>
}

@Injectable()
export class WalletService {
  async createWallet(userId: string) {
    return prisma.wallet.create({ data: { userId, balanceKobo: 0n } })
  }

  async getBalance(userId: string) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } })
    return { balanceKobo: Number(wallet.balanceKobo) }
  }

  /**
   * Credit wallet — used for deposits, wins, refunds.
   * All mutations inside a transaction with SELECT FOR UPDATE.
   */
  async credit(
    userId: string,
    amountKobo: number,
    type: TransactionType,
    ref: string,
    metadata?: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      // Lock the wallet row to prevent concurrent mutations
      const wallet = await tx.$queryRaw<{ id: string; balance_kobo: bigint }[]>`
        SELECT id, balance_kobo FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `
      if (!wallet[0]) throw new BadRequestException('Wallet not found')

      const currentBalance = Number(wallet[0].balance_kobo)
      const newBalance = currentBalance + amountKobo

      await tx.wallet.update({
        where: { userId },
        data: { balanceKobo: BigInt(newBalance) },
      })

      await tx.transaction.create({
        data: {
          walletId: wallet[0].id,
          type,
          amountKobo: BigInt(amountKobo),
          runningBalanceKobo: BigInt(newBalance),
          ref,
          metadata: metadata ?? {},
        },
      })

      return { newBalanceKobo: newBalance }
    })
  }

  /**
   * Debit wallet — used for stakes and withdrawals.
   * Rejects if insufficient balance.
   */
  async debit(
    userId: string,
    amountKobo: number,
    type: TransactionType,
    ref: string,
    metadata?: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.$queryRaw<{ id: string; balance_kobo: bigint }[]>`
        SELECT id, balance_kobo FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `
      if (!wallet[0]) throw new BadRequestException('Wallet not found')

      const currentBalance = Number(wallet[0].balance_kobo)
      if (currentBalance < amountKobo) {
        throw new BadRequestException('Insufficient balance')
      }

      const newBalance = currentBalance - amountKobo

      await tx.wallet.update({
        where: { userId },
        data: { balanceKobo: BigInt(newBalance) },
      })

      await tx.transaction.create({
        data: {
          walletId: wallet[0].id,
          type,
          amountKobo: BigInt(amountKobo),
          runningBalanceKobo: BigInt(newBalance),
          ref: ref || randomUUID(),
          metadata: metadata ?? {},
        },
      })

      return { newBalanceKobo: newBalance }
    })
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } })
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where: { walletId: wallet.id } }),
    ])
    return { transactions, total, page, limit }
  }

  async initializeDeposit(userId: string, amountKobo: number) {
    if (amountKobo < MIN_DEPOSIT_KOBO) {
      throw new BadRequestException(`Minimum deposit is ₦${MIN_DEPOSIT_KOBO / 100}`)
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const reference = `DEP_${userId.slice(0, 8)}_${Date.now()}`
    const email = `${user.phone}@users.qirosport.ng`

    const result = await paystackPost('/transaction/initialize', {
      email,
      amount: amountKobo,
      reference,
      metadata: { userId, phone: user.phone },
      channels: ['card', 'bank', 'ussd', 'qr', 'bank_transfer'],
    })

    if (!result.status) throw new BadRequestException('Could not initialize payment')

    return {
      reference,
      accessCode: result.data.access_code as string,
      authorizationUrl: result.data.authorization_url as string,
    }
  }

  async verifyDeposit(userId: string, reference: string) {
    // Idempotency: if reference already credited, return existing transaction
    const existing = await prisma.transaction.findUnique({ where: { ref: reference } })
    if (existing) return { alreadyProcessed: true, balanceKobo: await this.getBalance(userId) }

    const result = await paystackGet(`/transaction/verify/${encodeURIComponent(reference)}`)
    if (!result.status || result.data.status !== 'success') {
      throw new BadRequestException('Payment not confirmed')
    }

    const meta = result.data.metadata as Record<string, string>
    if (meta?.userId !== userId) throw new BadRequestException('Reference mismatch')

    const amountKobo = result.data.amount as number
    return this.credit(userId, amountKobo, TransactionType.DEPOSIT, reference, {
      paystackRef: reference,
      channel: result.data.channel,
    })
  }

  async requestWithdrawal(
    userId: string,
    amountKobo: number,
    bankCode: string,
    accountNumber: string,
    accountName: string,
  ) {
    if (amountKobo < MIN_WITHDRAWAL_KOBO) {
      throw new BadRequestException(`Minimum withdrawal is ₦${MIN_WITHDRAWAL_KOBO / 100}`)
    }

    const ref = `WD_${userId.slice(0, 8)}_${Date.now()}`
    await this.debit(userId, amountKobo, TransactionType.WITHDRAW, ref, { pending: true })

    return prisma.withdrawalRequest.create({
      data: {
        userId,
        amountKobo: BigInt(amountKobo),
        bankCode,
        accountNumber,
        accountName,
        status: 'PENDING' as never,
      },
    })
  }
}
