import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import { prisma } from '@qiro/db'
import { WalletService } from '../wallet/wallet.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

const BCRYPT_ROUNDS = 12
const OTP_TTL_MS = 5 * 60 * 1000
const MAX_OTP_RESENDS = 3
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly walletService: WalletService,
  ) {}

  async register(dto: RegisterDto) {
    const dob = new Date(dto.dob)
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
    if (age < 18) {
      throw new BadRequestException('You must be 18 or older to register')
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, { username: dto.username }] },
    })
    if (existing) throw new BadRequestException('Phone or username already in use')

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)

    const user = await prisma.user.create({
      data: { phone: dto.phone, username: dto.username, passwordHash, dob },
    })

    await this.walletService.createWallet(user.id)
    await this.sendOtp(user.phone)

    return { message: 'OTP sent to your phone number', userId: user.id }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // TODO Phase 0: validate OTP from Redis, mark phone as verified, return tokens
    return { message: 'Phone verified — implementation in Phase 0' }
  }

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({ where: { phone: dto.phone } })
    if (!user) throw new UnauthorizedException('Invalid credentials')

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.')
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash)

    if (!passwordMatch) {
      const attempts = user.failedLoginAttempts + 1
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, ...(lockedUntil && { lockedUntil }) },
      })
      throw new UnauthorizedException('Invalid credentials')
    }

    // Reset failed attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })

    return this.generateTokens(user.id, user.phone)
  }

  async refresh(refreshToken: string) {
    // TODO Phase 0: verify refresh token from Redis, rotate, return new pair
    return { message: 'Refresh token rotation — implementation in Phase 0' }
  }

  async resendOtp(phone: string) {
    // TODO Phase 0: check resend count in Redis (max 3), send OTP via Termii
    return { message: 'OTP resent' }
  }

  private async sendOtp(phone: string) {
    // TODO Phase 0: generate 6-digit OTP, store in Redis with TTL, call Termii API
    console.log(`[OTP] Would send OTP to ${phone} — Termii integration in Phase 0`)
  }

  private async generateTokens(userId: string, phone: string) {
    const payload = { sub: userId, phone }
    const accessToken = this.jwtService.sign(payload)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    })
    // TODO Phase 0: store refresh token in Redis
    return { accessToken, refreshToken }
  }
}
