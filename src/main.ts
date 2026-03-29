import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { seedRoles } from './scripts/seed-roles';
import { assignAdminRoleToUser } from './scripts/assign-admin-role';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Frontend and Swagger origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
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
    .addTag('Chat', 'AI assistant chat (Groq) and conversation history')
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
  
  // Seed roles on startup
  try {
    const dataSource = app.get(DataSource);
    await seedRoles(dataSource);
    
    // Also try to assign admin role to user "admin" if exists (in case seed didn't catch it)
    try {
      await assignAdminRoleToUser(dataSource, 'admin');
    } catch (error) {
      // User "admin" might not exist, that's okay
      console.log('ℹ️  User "admin" not found or already has admin role');
    }
  } catch (error) {
    console.warn('⚠️  Could not seed roles:', error.message);
  }
  
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📚 Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
