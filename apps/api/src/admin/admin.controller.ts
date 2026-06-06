import { Controller, Get, Post, Patch, Body, Query, Param } from '@nestjs/common'
import { AdminService } from './admin.service'

// IP whitelist guard + AdminJwtGuard will be added in Phase 5
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

  @Get('withdrawals')
  getWithdrawals(@Query('status') status?: string) {
    return this.adminService.getWithdrawals(status)
  }

  @Patch('withdrawals/:id/approve')
  approveWithdrawal(@Param('id') id: string, @Body('adminId') adminId: string) {
    return this.adminService.reviewWithdrawal(id, 'APPROVED', adminId)
  }

  @Patch('withdrawals/:id/reject')
  rejectWithdrawal(
    @Param('id') id: string,
    @Body() body: { adminId: string; notes: string },
  ) {
    return this.adminService.reviewWithdrawal(id, 'REJECTED', body.adminId, body.notes)
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
}
