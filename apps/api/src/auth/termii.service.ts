import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name)
  private readonly base = 'https://api.ng.termii.com/api'

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, otp: string): Promise<void> {
    const apiKey = this.config.getOrThrow<string>('TERMII_API_KEY')
    const senderId = this.config.get<string>('TERMII_SENDER_ID', 'QiroSport')

    try {
      const res = await fetch(`${this.base}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: phone,
          from: senderId,
          sms: `Your Qiro Sport code is ${otp}. Valid for 5 minutes. Never share this code.`,
          type: 'plain',
          channel: 'generic',
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        this.logger.error(`Termii rejected OTP send: ${body}`)
        throw new InternalServerErrorException('Failed to send OTP')
      }

      this.logger.log(`OTP dispatched to ${phone.slice(0, 6)}****`)
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err
      this.logger.error('Termii network error', err)
      throw new InternalServerErrorException('OTP service unavailable. Try again shortly.')
    }
  }
}
