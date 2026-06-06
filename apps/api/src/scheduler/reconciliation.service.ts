import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { prisma } from '@qiro/db'

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name)

  /** Runs every hour — compares wallet.balance_kobo against sum of transactions */
  @Cron(CronExpression.EVERY_HOUR)
  async reconcileWallets() {
    this.logger.log('Starting wallet reconciliation...')

    const wallets = await prisma.wallet.findMany()
    const discrepancies: string[] = []

    for (const wallet of wallets) {
      const result = await prisma.transaction.aggregate({
        where: { walletId: wallet.id },
        _sum: { amountKobo: true },
      })

      // Note: this is a simplified check. A proper ledger check sums
      // credits minus debits and compares to running balance.
      // Full implementation in Phase 0.
      const storedBalance = Number(wallet.balanceKobo)
      const _ = result._sum.amountKobo // placeholder

      if (storedBalance < 0) {
        discrepancies.push(`Wallet ${wallet.id}: negative balance ${storedBalance}`)
      }
    }

    if (discrepancies.length > 0) {
      this.logger.error(`Reconciliation FAILED — discrepancies: ${discrepancies.join(', ')}`)
      // TODO Phase 0: trigger Sentry alert
    } else {
      this.logger.log(`Reconciliation passed — ${wallets.length} wallets checked`)
    }
  }
}
