import { Controller, Get, Patch, Post, Body, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { AdminService } from './admin.service'
import { SportsSettlementService } from '../sports/sports-settlement.service'
import { Public } from '../auth/decorators/public.decorator'
import { AdminIpGuard } from './auth/admin-ip.guard'
import { AdminJwtGuard } from './auth/admin-jwt.guard'
import { CurrentAdmin, type AuthAdmin } from './auth/current-admin.decorator'

// @Public() only opts out of the player JwtAuthGuard; admin guards apply below
@Public()
@UseGuards(AdminIpGuard, AdminJwtGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sportsSettlement: SportsSettlementService,
  ) {}

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
    @CurrentAdmin() admin: AuthAdmin,
  ) {
    return this.adminService.reviewWithdrawal(id, body.status, admin.id, body.notes)
  }

  @Get('bets/sport')
  getSportBets(@Query('status') status?: string) {
    return this.adminService.getSportBets(status)
  }

  // Refunds the full stake — for postponed fixtures, palpable odds errors, or suspected fraud
  @Post('bets/sport/:id/void')
  @HttpCode(HttpStatus.OK)
  voidSportBet(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentAdmin() admin: AuthAdmin,
  ) {
    return this.sportsSettlement.voidBet(id, admin.id, body?.reason)
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
