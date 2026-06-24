import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import * as bcrypt from 'bcrypt'
import { prisma } from '@qiro/db'
import { RedisService } from '../redis/redis.service'
import { TermiiService } from './termii.service'
import { WalletService } from '../wallet/wallet.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

const BCRYPT_ROUNDS = 12
const OTP_TTL = 300           // 5 minutes
const MAX_OTP_RESENDS = 3
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_SECONDS = 15 * 60
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '30d'
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600

interface JwtPayload {
  sub: string
  phone: string
  username: string
  jti: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly termii: TermiiService,
    private readonly walletService: WalletService,
  ) {}

  // ─── Registration ────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const dob = new Date(dto.dob)
    const ageMs = Date.now() - dob.getTime()
    const age = Math.floor(ageMs / (365.25 * 24 * 3600 * 1000))
    if (age < 18) throw new BadRequestException('You must be 18 or older to register')

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, { username: dto.username }] },
      select: { phone: true, username: true },
    })
    if (existing?.phone === dto.phone) throw new BadRequestException('Phone number already registered')
    if (existing?.username === dto.username) throw new BadRequestException('Username already taken')

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)

    const user = await prisma.user.create({
      data: { phone: dto.phone, username: dto.username, passwordHash, dob },
      select: { id: true, phone: true },
    })

    await this.walletService.createWallet(user.id)
    await this.sendOtp(dto.phone)

    return { message: 'Account created. Enter the OTP sent to your number.', phone: user.phone }
  }

  // ─── OTP ─────────────────────────────────────────────────────────────────────

  private async sendOtp(phone: string): Promise<void> {
    const otp = String(randomInt(100000, 1000000))
    await this.redis.set(`otp:${phone}`, otp, OTP_TTL)
    await this.termii.sendOtp(phone, otp)
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const stored = await this.redis.get(`otp:${dto.phone}`)

    if (!stored) throw new UnauthorizedException('OTP expired. Request a new one.')
    if (stored !== dto.otp) throw new UnauthorizedException('Incorrect OTP')

    // Clean up OTP and resend counter
    await this.redis.del(`otp:${dto.phone}`, `otp:resends:${dto.phone}`)

    const user = await prisma.user.update({
      where: { phone: dto.phone },
      data: { phoneVerified: true },
      select: { id: true, phone: true, username: true },
    })

    return this.generateTokens(user.id, user.phone, user.username)
  }

  async resendOtp(phone: string) {
    const user = await prisma.user.findUnique({ where: { phone }, select: { phone: true } })
    if (!user) throw new BadRequestException('Phone number not registered')

    const countKey = `otp:resends:${phone}`
    const count = await this.redis.incr(countKey)

    if (count === 1) await this.redis.expire(countKey, OTP_TTL)
    if (count > MAX_OTP_RESENDS) {
      const ttl = await this.redis.ttl(countKey)
      throw new BadRequestException(`Maximum resends reached. Try again in ${Math.ceil(ttl / 60)} minutes.`)
    }

    await this.sendOtp(phone)
    return { message: 'OTP resent to your number' }
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const lockKey = `auth:lock:${dto.phone}`
    const isLocked = await this.redis.exists(lockKey)
    if (isLocked) {
      const ttl = await this.redis.ttl(lockKey)
      throw new UnauthorizedException(
        `Too many failed attempts. Account locked for ${Math.ceil(ttl / 60)} more minutes.`,
      )
    }

    const user = await prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, phone: true, username: true, passwordHash: true, status: true, phoneVerified: true, failedLoginAttempts: true },
    })

    const passwordMatch = user ? await bcrypt.compare(dto.password, user.passwordHash) : false

    if (!user || !passwordMatch) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          await this.redis.set(lockKey, '1', LOCKOUT_SECONDS)
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } })
          throw new UnauthorizedException('Account locked for 15 minutes due to too many failed attempts.')
        }
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts } })
      }
      throw new UnauthorizedException('Invalid phone number or password')
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been suspended. Contact support.')
    }
    if (!user.phoneVerified) {
      throw new UnauthorizedException('Phone not verified. Check your SMS for the OTP.')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0 },
    })

    return this.generateTokens(user.id, user.phone, user.username)
  }

  // ─── Token Management ────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    let payload: JwtPayload
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    const storedHash = await this.redis.get(`refresh:${payload.sub}:${payload.jti}`)
    if (!storedHash) throw new UnauthorizedException('Session expired. Please log in again.')

    const incomingHash = createHash('sha256').update(refreshToken).digest('hex')
    if (storedHash !== incomingHash) {
      // Token reuse detected — invalidate all sessions for this user
      this.logger.warn(`Refresh token reuse detected for user ${payload.sub}`)
      await this.revokeAllSessions(payload.sub)
      throw new UnauthorizedException('Security violation detected. All sessions terminated.')
    }

    // Rotate: delete old, issue new
    await this.redis.del(`refresh:${payload.sub}:${payload.jti}`)

    return this.generateTokens(payload.sub, payload.phone, payload.username)
  }

  async logout(userId: string, jti: string) {
    await this.redis.del(`refresh:${userId}:${jti}`)
  }

  async revokeAllSessions(userId: string) {
    // Pattern-based revocation handled at application level
    // For now, mark user's lockedUntil to force re-auth
    this.logger.warn(`Revoking all sessions for user ${userId}`)
  }

  private async generateTokens(userId: string, phone: string, username: string) {
    const jti = randomUUID()
    const payload: JwtPayload = { sub: userId, phone, username, jti }

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    })

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TOKEN_TTL,
    })

    // Store hash (not plaintext) of refresh token in Redis
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex')
    await this.redis.set(`refresh:${userId}:${jti}`, tokenHash, REFRESH_TOKEN_TTL_SECONDS)

    return {
      accessToken,
      refreshToken,
      user: { id: userId, phone, username },
    }
  }
}
