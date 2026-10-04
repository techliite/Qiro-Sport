import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

// Prisma returns kobo amounts as BigInt, which JSON.stringify rejects ("Do not know how to
// serialize a BigInt") — any response containing a raw row would 500. Strings keep full precision.
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString()
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })

  // Number of proxy hops in front of the API (Cloudflare → Railway = 2) so req.ip is the
  // real client IP. Admin IP whitelisting depends on this being correct.
  const trustProxy = process.env['TRUST_PROXY']
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)

  app.use(cookieParser())
  app.setGlobalPrefix('api/v1')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: [
      process.env['WEB_URL'] ?? 'http://localhost:3000',
      process.env['ADMIN_URL'] ?? 'http://localhost:3001',
    ],
    credentials: true,
  })

  const port = process.env['PORT'] ?? 4000
  await app.listen(port)
  console.log(`Qiro Sport API running on port ${port}`)
}

bootstrap()
