import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';
import { AssignIssueDto } from './dto/assign-issue.dto';
import { TransitionIssueDto } from './dto/transition-issue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Issues')
@Controller()
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/issues')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new issue in a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Issue successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateIssueDto) {
    return this.issuesService.create(projectId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/issues')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all issues for a project (with optional filters)',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({
    name: 'statusId',
    required: false,
    description: 'Filter by status UUID',
  })
  @ApiQuery({
    name: 'assigneeId',
    required: false,
    description: 'Filter by assignee UUID',
  })
  @ApiQuery({
    name: 'priorityId',
    required: false,
    description: 'Filter by priority UUID',
  })
  @ApiResponse({ status: 200, description: 'Returns list of issues' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByProject(
    @Param('projectId') projectId: string,
    @Query() query: QueryIssuesDto,
  ) {
    return this.issuesService.findByProject(projectId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('issues/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get issue by ID' })
  @ApiParam({ name: 'id', description: 'Issue UUID' })
  @ApiResponse({ status: 200, description: 'Returns issue information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  findOne(@Param('id') id: string) {
    return this.issuesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('issues/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update issue' })
  @ApiParam({ name: 'id', description: 'Issue UUID' })
  @ApiResponse({ status: 200, description: 'Issue successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  update(@Param('id') id: string, @Body() dto: UpdateIssueDto) {
    return this.issuesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('issues/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete issue' })
  @ApiParam({ name: 'id', description: 'Issue UUID' })
  @ApiResponse({ status: 200, description: 'Issue successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  remove(@Param('id') id: string) {
    return this.issuesService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('issues/:id/assign')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Assign issue to a user' })
  @ApiParam({ name: 'id', description: 'Issue UUID' })
  @ApiResponse({ status: 200, description: 'Issue successfully assigned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue or user not found' })
  assign(@Param('id') id: string, @Body() dto: AssignIssueDto) {
    return this.issuesService.assign(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('issues/:id/transition')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change issue status (transition)' })
  @ApiParam({ name: 'id', description: 'Issue UUID' })
  @ApiResponse({
    status: 200,
    description: 'Issue status successfully changed',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue or status not found' })
  transition(@Param('id') id: string, @Body() dto: TransitionIssueDto) {
    return this.issuesService.transition(id, dto);
  }
}
