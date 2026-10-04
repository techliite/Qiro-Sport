import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name)
  private readonly base = 'https://api.ng.termii.com/api'

  // Temporary stand-in while Termii isn't set up: codes go to the server log instead of SMS.
  // Anyone who can read the logs can sign in as any user — turn it off before real users arrive.
  private readonly logOnly: boolean

  constructor(private readonly config: ConfigService) {
    this.logOnly = this.config.get<string>('OTP_LOG_ONLY') === 'true'
    if (this.logOnly) {
      this.logger.warn('OTP_LOG_ONLY is on — OTP codes are written to the log and NOT sent by SMS')
    }
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    if (this.logOnly) {
      this.logger.warn(`[OTP_LOG_ONLY] OTP for ${phone}: ${otp}`)
      return
    }

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
