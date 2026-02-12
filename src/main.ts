import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import {
  ValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import basicAuth from 'express-basic-auth';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

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

  // Security headers with CSP configured for Swagger UI CDN assets
  // Note: This CSP only applies to backend API responses, not frontend pages
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Swagger UI and Monaco Editor may need inline styles
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net', // Monaco Editor CDN
            'https://fonts.googleapis.com', // Google Fonts
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Swagger UI initialization script
            "'unsafe-eval'", // Monaco Editor may need eval
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net', // Monaco Editor CDN
          ],
          workerSrc: [
            "'self'",
            'blob:', // Monaco Editor web workers
          ],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:', 'https://fonts.gstatic.com'],
        },
      },
    }),
  );

  // CORS - Allow specific origins
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://sendcoinsfrontend.vercel.app',
    'https://sendcoins-admin-frontend.vercel.app',
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, origin?: string | boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      // For development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, origin);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  // Protect Swagger with HTTP Basic Auth in production (before Swagger setup)
  if (process.env.NODE_ENV === 'production') {
    app.use(
      '/api/docs',
      basicAuth({
        users: { admin: 'SwaggerDocs2025!' },
        challenge: true,
        realm: 'SendCoins Admin API Docs',
      }),
    );
  }

  const config = new DocumentBuilder()
    .setTitle('SendCoins Admin API')
    .setDescription('API documentation for the SendCoins Admin backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Register redirect routes BEFORE Swagger setup so they take precedence
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    const cdnBase = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.5';
    const expressApp = app.getHttpAdapter().getInstance();

    // Redirect static asset requests to CDN (registered before Swagger, so they're matched first)
    expressApp.get('/api/docs/swagger-ui.css', (req: any, res: any) => {
      res.redirect(301, `${cdnBase}/swagger-ui.min.css`);
    });
    expressApp.get('/api/docs/swagger-ui-bundle.js', (req: any, res: any) => {
      res.redirect(301, `${cdnBase}/swagger-ui-bundle.min.js`);
    });
    expressApp.get(
      '/api/docs/swagger-ui-standalone-preset.js',
      (req: any, res: any) => {
        res.redirect(301, `${cdnBase}/swagger-ui-standalone-preset.min.js`);
      },
    );
  }

  const swaggerOptions: any = {
    customSiteTitle: 'SendCoins Admin API Docs',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  // Use CDN assets in production/serverless
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    const cdnBase = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.5';
    swaggerOptions.customJs = [
      `${cdnBase}/swagger-ui-bundle.min.js`,
      `${cdnBase}/swagger-ui-standalone-preset.min.js`,
    ];
    swaggerOptions.customCssUrl = `${cdnBase}/swagger-ui.min.css`;
  }

  SwaggerModule.setup('api/docs', app, document, swaggerOptions);

  const port = process.env.PORT || 4005;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
