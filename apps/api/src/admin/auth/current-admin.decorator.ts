import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'

export interface AuthAdmin {
  id: string
  username: string
  jti: string
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthAdmin => {
    const request = ctx.switchToHttp().getRequest<Request>()
    return (request as unknown as Record<string, unknown>)['admin'] as AuthAdmin
  },
)
