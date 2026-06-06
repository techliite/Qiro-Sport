import { Injectable, BadRequestException } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { TransactionType } from '@qiro/types'
import { randomUUID } from 'node:crypto'

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
}
