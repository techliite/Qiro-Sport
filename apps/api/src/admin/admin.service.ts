import { Injectable } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { UserStatus, TransactionType } from '@qiro/types'
import { randomUUID } from 'node:crypto'

@Injectable()
export class AdminService {
  async searchUsers(query: string) {
    return prisma.user.findMany({
      where: {
        OR: [
          { phone: { contains: query } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { wallet: true },
      take: 20,
    })
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'BANNED' | 'SUSPENDED') {
    return prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus[status] },
    })
  }

  async getWithdrawals(status?: string) {
    return prisma.withdrawalRequest.findMany({
      where: status ? { status: status as never } : {},
      include: { user: { select: { phone: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async reviewWithdrawal(id: string, status: 'APPROVED' | 'REJECTED', reviewedById: string, notes?: string) {
    const wr = await prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id },
      include: { user: { include: { wallet: true } } },
    })

    await prisma.withdrawalRequest.update({
      where: { id },
      data: { status: status as never, reviewedById, notes },
    })

    // Refund wallet on rejection
    if (status === 'REJECTED' && wr.user.wallet) {
      const wallet = wr.user.wallet
      const amount = Number(wr.amountKobo)
      const newBalance = Number(wallet.balanceKobo) + amount
      await prisma.$transaction([
        prisma.wallet.update({ where: { id: wallet.id }, data: { balanceKobo: BigInt(newBalance) } }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: TransactionType.REFUND,
            amountKobo: wr.amountKobo,
            runningBalanceKobo: BigInt(newBalance),
            ref: `WD_REFUND_${id}_${randomUUID().slice(0, 8)}`,
            metadata: { withdrawalRequestId: id, reason: notes ?? 'Rejected by admin' },
          },
        }),
      ])
    }

    return { id, status }
  }

  async getSportBets(status?: string) {
    return prisma.sportBet.findMany({
      where: status ? { status: status as never } : {},
      include: { user: { select: { username: true } }, selections: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async getVirtualBets(gameType?: string) {
    return prisma.virtualBet.findMany({
      where: gameType ? { gameType: gameType as never } : {},
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async getDailyFinancials(dateStr?: string) {
    const base = dateStr ? new Date(dateStr) : new Date()
    const start = new Date(base); start.setHours(0, 0, 0, 0)
    const end   = new Date(base); end.setHours(23, 59, 59, 999)

    const [deposits, withdrawals, stakes, wins, totalUsers, newUsers] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true }, _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'WITHDRAW', createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true }, _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'STAKE', createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true }, _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'WIN', createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true }, _count: true,
      }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
    ])

    const stakesKobo = Number(stakes._sum.amountKobo ?? 0)
    const winsKobo   = Number(wins._sum.amountKobo ?? 0)

    return {
      date: start.toISOString(),
      deposits:  { totalKobo: Number(deposits._sum.amountKobo ?? 0),  count: deposits._count },
      withdrawals:{ totalKobo: Number(withdrawals._sum.amountKobo ?? 0), count: withdrawals._count },
      stakes:    { totalKobo: stakesKobo, count: stakes._count },
      wins:      { totalKobo: winsKobo,   count: wins._count },
      ggrKobo:   stakesKobo - winsKobo,
      totalUsers,
      newUsers,
    }
  }

  async getGameConfigs() {
    return prisma.gameConfig.findMany({ orderBy: [{ gameType: 'asc' }, { key: 'asc' }] })
  }

  async setGameConfig(gameType: string, key: string, value: string) {
    return prisma.gameConfig.upsert({
      where: { gameType_key: { gameType, key } },
      update: { value },
      create: { gameType, key, value },
    })
  }
}
