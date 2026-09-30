import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { prisma } from '@qiro/db'
import { RedisService } from '../../redis/redis.service'
import { getClientIp } from './admin-ip'

export interface AdminJwtPayload {
  sub: string
  username: string
  jti: string
  typ: 'admin'
}

export const adminSessionKey = (jti: string) => `admin:session:${jti}`

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Authentication required')

    let payload: AdminJwtPayload
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('ADMIN_JWT_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Token expired or invalid')
    }
    if (payload.typ !== 'admin') throw new UnauthorizedException('Token expired or invalid')

    // Session must still exist — deleted on logout
    const session = await this.redis.get(adminSessionKey(payload.jti))
    if (session !== payload.sub) throw new UnauthorizedException('Session expired. Please log in again.')

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, ipWhitelist: true },
    })
    if (!admin) throw new UnauthorizedException('Account no longer exists')

    // Per-admin allowlist, on top of the platform-wide one in AdminIpGuard
    if (admin.ipWhitelist.length > 0 && !admin.ipWhitelist.includes(getClientIp(request))) {
      throw new ForbiddenException('Access denied from this IP address')
    }

    ;(request as unknown as Record<string, unknown>)['admin'] = { id: admin.id, username: admin.username, jti: payload.jti }
    return true
  }
}
