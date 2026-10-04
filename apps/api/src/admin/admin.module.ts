import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { WalletModule } from '../wallet/wallet.module'
import { SportsModule } from '../sports/sports.module'
import { AdminAuthController } from './auth/admin-auth.controller'
import { AdminAuthService } from './auth/admin-auth.service'
import { AdminIpGuard } from './auth/admin-ip.guard'
import { AdminJwtGuard } from './auth/admin-jwt.guard'

@Module({
  // Secret passed per sign/verify call — admin tokens use ADMIN_JWT_SECRET, never the player secret
  imports: [WalletModule, SportsModule, JwtModule.register({})],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService, AdminAuthService, AdminIpGuard, AdminJwtGuard],
})
export class AdminModule {}
