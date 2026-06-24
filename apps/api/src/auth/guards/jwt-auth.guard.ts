import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { prisma } from '@qiro/db'

export const IS_PUBLIC_KEY = 'isPublic'

export interface JwtPayload {
  sub: string
  phone: string
  username: string
  jti: string
  iat: number
  exp: number
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractBearerToken(request)
    if (!token) throw new UnauthorizedException('Authentication required')

    let payload: JwtPayload
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Token expired or invalid')
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, username: true, status: true, phoneVerified: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive or suspended')
    }
    if (!user.phoneVerified) {
      throw new UnauthorizedException('Phone verification required')
    }

    // Attach to request for @CurrentUser() decorator
    ;(request as Record<string, unknown>)['user'] = { ...user, jti: payload.jti }
    return true
  }

  private extractBearerToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' && token ? token : null
  }
}
