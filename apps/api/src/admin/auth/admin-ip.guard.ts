import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { getClientIp, parseIpList } from './admin-ip'

// Platform-wide allowlist for every /admin route, including login.
// Cloudflare blocks the admin subdomain by IP too; this is the second layer.
@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly logger = new Logger(AdminIpGuard.name)

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const allowed = parseIpList(this.config.get<string>('ADMIN_IP_WHITELIST'))

    if (allowed.length === 0) {
      // Fail closed in production; allow local development without config
      if (this.config.get('NODE_ENV') === 'production') {
        this.logger.error('ADMIN_IP_WHITELIST is empty — all admin access blocked')
        throw new ForbiddenException('Access denied')
      }
      return true
    }

    const ip = getClientIp(request)
    if (!allowed.includes(ip)) {
      this.logger.warn(`Blocked admin request from ${ip} to ${request.method} ${request.url}`)
      throw new ForbiddenException('Access denied')
    }
    return true
  }
}
