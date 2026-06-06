import { Module } from '@nestjs/common'
import { QiroGateway } from './qiro.gateway'

@Module({
  providers: [QiroGateway],
  exports: [QiroGateway],
})
export class GatewayModule {}
