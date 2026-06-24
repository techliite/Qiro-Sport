import { Controller, Get, Patch, Body, Query, Param } from '@nestjs/common'
import { AdminService } from './admin.service'
import { Public } from '../auth/decorators/public.decorator'

// Phase 5: replace @Public() with IP whitelist guard + dedicated AdminJwtGuard
@Public()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  searchUsers(@Query('q') query: string) {
    return this.adminService.searchUsers(query)
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string) {
    return this.adminService.setUserStatus(id, 'BANNED')
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.adminService.setUserStatus(id, 'ACTIVE')
  }

  @Patch('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.adminService.setUserStatus(id, 'SUSPENDED')
  }

  @Get('withdrawals')
  getWithdrawals(@Query('status') status?: string) {
    return this.adminService.getWithdrawals(status)
  }

  @Patch('withdrawals/:id')
  reviewWithdrawal(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; notes?: string },
  ) {
    return this.adminService.reviewWithdrawal(id, body.status, 'system', body.notes)
  }

  @Get('bets/sport')
  getSportBets(@Query('status') status?: string) {
    return this.adminService.getSportBets(status)
  }

  @Get('bets/virtual')
  getVirtualBets(@Query('gameType') gameType?: string) {
    return this.adminService.getVirtualBets(gameType)
  }

  @Get('financials/daily')
  getDailyFinancials(@Query('date') date?: string) {
    return this.adminService.getDailyFinancials(date)
  }

  @Get('config')
  getGameConfigs() {
    return this.adminService.getGameConfigs()
  }

  @Patch('config')
  setGameConfig(@Body() body: { gameType: string; key: string; value: string }) {
    return this.adminService.setGameConfig(body.gameType, body.key, body.value)
  }
}
