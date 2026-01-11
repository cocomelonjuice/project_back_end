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
  @ApiQuery({ name: 'q', description: 'Search query string', required: true })
  @ApiQuery({ name: 'type', description: 'Filter by type: all, projects, issues, users', required: false })
  @ApiQuery({ name: 'limit', description: 'Number of results per type', required: false })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query' })
  async search(@Query() dto: SearchQueryDto): Promise<SearchResult> {
    return this.searchService.search(dto);
  }
}




