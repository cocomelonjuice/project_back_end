import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Audit Logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all audit logs (with optional filters)' })
  @ApiQuery({
    name: 'entityType',
    required: false,
    description: 'Filter by entity type (e.g., "issue", "project")',
  })
  @ApiQuery({
    name: 'entityId',
    required: false,
    description: 'Filter by entity UUID',
  })
  @ApiResponse({ status: 200, description: 'Returns list of audit logs' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    if (entityType && entityId) {
      return this.auditLogsService.findByEntity(entityType, entityId);
    }
    return this.auditLogsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiParam({ name: 'id', description: 'Audit log UUID' })
  @ApiResponse({ status: 200, description: 'Returns audit log information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id);
  }
}
