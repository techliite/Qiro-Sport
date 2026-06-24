import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { FootballService } from './football.service'

@Injectable()
export class FootballScheduler {
  private readonly logger = new Logger(FootballScheduler.name)

  constructor(private readonly footballService: FootballService) {}

  @Interval(10_000) // every 10 seconds: settle expired rounds, create new ones
  async tick() {
    try {
      await this.footballService.tick()
    } catch (err) {
      this.logger.error('Scheduler tick failed', err)
    }
  }
}
