import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { IssueTypesModule } from './issue-types/issue-types.module';
import { PrioritiesModule } from './priorities/priorities.module';
import { StatusesModule } from './statuses/statuses.module';
import { IssuesModule } from './issues/issues.module';
import { BoardsModule } from './boards/boards.module';
import { SprintsModule } from './sprints/sprints.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { LabelsModule } from './labels/labels.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { RolesModule } from './roles/roles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { SearchModule } from './search/search.module';
import { ChatModule } from './chat/chat.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 600 },
        { name: 'chatMessage', ttl: 60_000, limit: 25 },
      ],
    }),
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Configure TypeORM with PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const isProduction = nodeEnv === 'production';
        const host = configService.get<string>('DB_HOST', 'localhost');
        const port = configService.get<number>('DB_PORT', 5431); // Changed default to 5431
        const username = configService.get<string>('DB_USERNAME', 'postgres');
        const dbSslRaw = configService.get<string>('DB_SSL');
        const enableSsl =
          typeof dbSslRaw === 'string'
            ? ['1', 'true', 'yes', 'on'].includes(dbSslRaw.toLowerCase())
            : isProduction;
        // Trim whitespace and ensure it's a string
        const password = (
          configService.get<string>('DB_PASSWORD') || 'password'
        ).trim();
        const database = configService.get<string>('DB_DATABASE', 'postgres');

        // Log connection details (remove in production)
        console.log('Database connected:', { host, port, username, database });

        return {
          type: 'postgres',
          host,
          port,
          username,
          password: String(password).trim(), // Ensure it's always a string and trim whitespace
          database,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Set to false in production, use migrations instead
          logging: true, // Enable SQL query logging for development
          // Neon/managed Postgres typically requires TLS in production, while local DB commonly runs without SSL.
          // DB_SSL can explicitly override this behavior for troubleshooting environment-specific connection issues.
          // Neon/Postgres managed trên production thường bắt buộc TLS, còn DB local thường không cần SSL.
          // Có thể dùng DB_SSL để override thủ công khi cần debug lỗi kết nối theo từng môi trường.
          ssl: enableSsl ? { rejectUnauthorized: false } : false,
          timezone: 'UTC', // Ensure all timestamps are stored and retrieved in UTC
          extra: {
            trustServerCertificate: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    ProjectsModule,
    IssueTypesModule,
    PrioritiesModule,
    StatusesModule,
    IssuesModule,
    BoardsModule,
    SprintsModule,
    CommentsModule,
    AttachmentsModule,
    LabelsModule,
    WorkflowsModule,
    RolesModule,
    NotificationsModule,
    AuditLogsModule,
    SearchModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
