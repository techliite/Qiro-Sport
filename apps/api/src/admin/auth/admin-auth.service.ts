import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import * as bcrypt from 'bcrypt'
import { prisma } from '@qiro/db'
import { RedisService } from '../../redis/redis.service'
import { AdminJwtPayload, adminSessionKey } from './admin-jwt.guard'
import { AdminLoginDto } from './admin-login.dto'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_SECONDS = 15 * 60
const SESSION_TTL = '8h'
const SESSION_TTL_SECONDS = 8 * 3600

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name)
  // Compared against when the username doesn't exist, so response time doesn't reveal valid usernames
  private readonly dummyHash = bcrypt.hash(randomUUID(), 12)

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async login(dto: AdminLoginDto, ip: string) {
    const lockKey = `admin:auth:lock:${dto.username}`
    const failKey = `admin:auth:fails:${dto.username}`

    if (await this.redis.exists(lockKey)) {
      const ttl = await this.redis.ttl(lockKey)
      throw new UnauthorizedException(`Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`)
    }

    const admin = await prisma.adminUser.findUnique({
      where: { username: dto.username },
      select: { id: true, username: true, passwordHash: true, ipWhitelist: true },
    })

    const passwordMatch = await bcrypt.compare(dto.password, admin?.passwordHash ?? (await this.dummyHash))

    if (!admin || !passwordMatch) {
      const attempts = await this.redis.incr(failKey)
      if (attempts === 1) await this.redis.expire(failKey, LOCKOUT_SECONDS)
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await this.redis.set(lockKey, '1', LOCKOUT_SECONDS)
        await this.redis.del(failKey)
        this.logger.warn(`Admin login locked for "${dto.username}" after ${attempts} failures (last from ${ip})`)
        throw new UnauthorizedException('Too many failed attempts. Locked for 15 minutes.')
      }
      throw new UnauthorizedException('Invalid username or password')
    }

    if (admin.ipWhitelist.length > 0 && !admin.ipWhitelist.includes(ip)) {
      this.logger.warn(`Admin "${admin.username}" login rejected from non-whitelisted IP ${ip}`)
      throw new ForbiddenException('Access denied from this IP address')
    }

    await this.redis.del(failKey)

    const jti = randomUUID()
    const payload: AdminJwtPayload = { sub: admin.id, username: admin.username, jti, typ: 'admin' }
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('ADMIN_JWT_SECRET'),
      expiresIn: SESSION_TTL,
    })
    await this.redis.set(adminSessionKey(jti), admin.id, SESSION_TTL_SECONDS)

    this.logger.log(`Admin "${admin.username}" logged in from ${ip}`)
    return { accessToken, admin: { id: admin.id, username: admin.username } }
  }

  async logout(jti: string) {
    await this.redis.del(adminSessionKey(jti))
  }
}
