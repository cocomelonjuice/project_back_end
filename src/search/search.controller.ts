import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResult } from './interfaces/search-result.interface';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across projects, issues, and users' })
  @ApiQuery({ name: 'q', description: 'Search query string', required: false })
  @ApiQuery({ name: 'type', description: 'Filter by type: all, projects, issues, users', required: false })
  @ApiQuery({ name: 'limit', description: 'Number of results per type', required: false })
  @ApiQuery({ name: 'projectKey', description: 'Filter projects/issues by project key', required: false })
  @ApiQuery({ name: 'projectType', description: 'Filter projects by project type', required: false })
  @ApiQuery({ name: 'issueStatus', description: 'Filter issues by status name', required: false })
  @ApiQuery({ name: 'issuePriority', description: 'Filter issues by priority name', required: false })
  @ApiQuery({ name: 'assignee', description: 'Filter issues by assignee (name/username/email)', required: false })
  @ApiQuery({ name: 'projectKeys', description: 'Filter by multiple project keys', required: false, isArray: true })
  @ApiQuery({ name: 'projectTypes', description: 'Filter by multiple project types', required: false, isArray: true })
  @ApiQuery({ name: 'issueStatusIds', description: 'Filter by multiple issue status IDs', required: false, isArray: true })
  @ApiQuery({ name: 'issuePriorityIds', description: 'Filter by multiple issue priority IDs', required: false, isArray: true })
  @ApiQuery({ name: 'assigneeIds', description: 'Filter by multiple assignee user IDs', required: false, isArray: true })
  @ApiQuery({ name: 'issueKeys', description: 'Filter by multiple issue keys', required: false, isArray: true })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query' })
  async search(@Query() dto: SearchQueryDto): Promise<SearchResult> {
    return this.searchService.search(dto);
  }
}




