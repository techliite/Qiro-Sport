import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../../auth/decorators/public.decorator'
import { AdminAuthService } from './admin-auth.service'
import { AdminIpGuard } from './admin-ip.guard'
import { AdminJwtGuard } from './admin-jwt.guard'
import { AdminLoginDto } from './admin-login.dto'
import { CurrentAdmin, type AuthAdmin } from './current-admin.decorator'
import { getClientIp } from './admin-ip'

// @Public() only opts out of the player JwtAuthGuard; admin guards apply below
@Public()
@UseGuards(AdminIpGuard)
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuthService.login(dto, getClientIp(req))
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtGuard)
  async logout(@CurrentAdmin() admin: AuthAdmin) {
    await this.adminAuthService.logout(admin.jti)
    return { message: 'Logged out' }
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: AuthAdmin) {
    return { id: admin.id, username: admin.username }
  }
}
