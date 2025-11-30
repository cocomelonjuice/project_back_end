import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Swagger/OpenAPI Configuration
  const config = new DocumentBuilder()
    .setTitle('Jira-like API')
    .setDescription('Complete RESTful API documentation for Jira-like project management system')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addTag('Authentication', 'User registration and login endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Projects', 'Project CRUD operations')
    .addTag('Issue Types', 'Issue type management')
    .addTag('Priorities', 'Priority management')
    .addTag('Statuses', 'Status management')
    .addTag('Issues', 'Issue CRUD and operations')
    .addTag('Boards', 'Board management')
    .addTag('Sprints', 'Sprint management and lifecycle')
    .addTag('Comments', 'Comment management on issues')
    .addTag('Attachments', 'File attachment management')
    .addTag('Labels', 'Label management and issue tagging')
    .addTag('Workflows', 'Workflow and status transition management')
    .addTag('Roles', 'Role and permission management')
    .addTag('Notifications', 'User notification management')
    .addTag('Audit Logs', 'Audit log viewing')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep authorization token after page refresh
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
