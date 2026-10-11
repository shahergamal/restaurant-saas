import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { allowedOrigins, config } from './config';

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      process.loadEnvFile('.env');
    } catch {
      // no local .env: rely on the real environment
    }
  }
  const cfg = config(); // fail fast on invalid environment
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cookieParser());
  app.enableCors({ origin: allowedOrigins(), credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (cfg.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Sufra API').setVersion('1').addCookieAuth('sufra_at').build());
    SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/openapi.json' });
  }
  await app.listen(cfg.API_PORT);
  Logger.log(`API listening on :${cfg.API_PORT}`, 'Bootstrap');
}
void bootstrap();
