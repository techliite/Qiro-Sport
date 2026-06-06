import { Injectable } from '@nestjs/common'
import { prisma } from '@qiro/db'
import { UserStatus } from '@qiro/types'

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
    return prisma.withdrawalRequest.update({
      where: { id },
      data: { status: status as never, reviewedById, notes },
    })
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
    const date = dateStr ? new Date(dateStr) : new Date()
    const start = new Date(date.setHours(0, 0, 0, 0))
    const end = new Date(date.setHours(23, 59, 59, 999))

    const [deposits, withdrawals] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'WITHDRAW', createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true },
        _count: true,
      }),
    ])

    return { date: start, deposits, withdrawals }
  }
}
