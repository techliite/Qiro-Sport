import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from './auth/auth.module'
import { WalletModule } from './wallet/wallet.module'
import { PaymentsModule } from './payments/payments.module'
import { SportsModule } from './sports/sports.module'
import { VirtualModule } from './virtual/virtual.module'
import { AdminModule } from './admin/admin.module'
import { GatewayModule } from './gateway/gateway.module'
import { SchedulerModule } from './scheduler/scheduler.module'
import { GameConfigModule } from './config/game-config.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 60 },
    ]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),

    GatewayModule,
    GameConfigModule,
    AuthModule,
    WalletModule,
    PaymentsModule,
    SportsModule,
    VirtualModule,
    AdminModule,
    SchedulerModule,
  ],
})
export class AppModule {}
