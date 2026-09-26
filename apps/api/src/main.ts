import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  // Disable Nest's default (unbounded) body parser so we can cap request
  // body size explicitly — an unauthenticated caller (e.g. v1/public/*)
  // should not be able to send arbitrarily large payloads.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Behind a reverse proxy every request arrives from the proxy's address,
  // which would put all visitors in one rate-limit bucket. TRUST_PROXY takes
  // Express's trust-proxy setting: a hop count ("1"), "true", or a
  // comma-separated list of proxy addresses/subnets. Leave it unset when the
  // API is reached directly, or clients could spoof X-Forwarded-For.
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy);
  }

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
