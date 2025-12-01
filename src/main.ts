import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from './auth/roles.enum';
import helmet from 'helmet';
import {
  ValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation with custom error formatting
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        // Format errors into a cleaner structure
        const formattedErrors: Record<string, string | string[]> = {};

        errors.forEach((error) => {
          const constraints = error.constraints || {};
          const messages = Object.values(constraints);

          // If only one error message, return as string; otherwise as array
          formattedErrors[error.property] =
            messages.length === 1 ? messages[0] : messages;
        });

        // If only one field has errors, return a simpler format
        const errorKeys = Object.keys(formattedErrors);
        if (errorKeys.length === 1) {
          const firstKey = errorKeys[0];
          const firstError = formattedErrors[firstKey];
          return new BadRequestException({
            message:
              typeof firstError === 'string'
                ? firstError
                : firstError.length === 1
                  ? firstError[0]
                  : firstError,
            error: 'Bad Request',
            statusCode: 400,
          });
        }

        // Multiple fields with errors
        return new BadRequestException({
          message: formattedErrors,
          error: 'Bad Request',
          statusCode: 400,
        });
      },
    }),
  );

  // Security headers
  app.use(helmet());

  // CORS
  const corsOrigins = (
    process.env.ADMIN_CORS_ORIGINS || 'http://localhost:4000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('SendCoins Admin API')
    .setDescription('API documentation for the SendCoins Admin backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Protect Swagger only in production: require valid JWT with ENGINEER role
  if (process.env.NODE_ENV === 'production') {
    const jwtService = app.get(JwtService);
    app.use(
      '/api/docs',
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
          }

          const token = authHeader.substring(7);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const payload = await jwtService.verifyAsync(token);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (payload.role !== AdminRole.ENGINEER) {
            return res.status(403).json({ message: 'Forbidden' });
          }

          return next();
        } catch {
          return res.status(401).json({ message: 'Unauthorized' });
        }
      },
    );
  }

  const port = process.env.PORT || 4005;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
