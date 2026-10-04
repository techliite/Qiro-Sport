import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export interface AuthUser {
  id: string
  phone: string
  username: string
  jti: string
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request>()
    return (request as unknown as Record<string, unknown>)['user'] as AuthUser
  },
)
