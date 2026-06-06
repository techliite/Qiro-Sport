import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
