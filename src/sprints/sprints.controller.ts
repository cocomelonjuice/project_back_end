import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Sprints')
@Controller()
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('boards/:boardId/sprints')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new sprint for a board' })
  @ApiParam({ name: 'boardId', description: 'Board UUID' })
  @ApiResponse({ status: 201, description: 'Sprint successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  create(
    @Param('boardId') boardId: string,
    @Body() createSprintDto: CreateSprintDto,
  ) {
    return this.sprintsService.create(boardId, createSprintDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('boards/:boardId/sprints')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all sprints for a board' })
  @ApiParam({ name: 'boardId', description: 'Board UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of sprints' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByBoard(@Param('boardId') boardId: string) {
    return this.sprintsService.findByBoard(boardId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sprints/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get sprint by ID' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Returns sprint information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  findOne(@Param('id') id: string) {
    return this.sprintsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('sprints/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update sprint' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  update(@Param('id') id: string, @Body() updateSprintDto: UpdateSprintDto) {
    return this.sprintsService.update(id, updateSprintDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sprints/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete sprint' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  remove(@Param('id') id: string) {
    return this.sprintsService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sprints/:id/start')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Start a sprint (changes status to active)' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint successfully started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Sprint cannot be started (already active or closed)' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  start(@Param('id') id: string) {
    return this.sprintsService.start(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sprints/:id/complete')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Complete a sprint (changes status to closed)' })
  @ApiParam({ name: 'id', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Sprint successfully completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Only active sprints can be completed' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  complete(@Param('id') id: string) {
    return this.sprintsService.complete(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sprints/:sprintId/issues')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all issues in a sprint' })
  @ApiParam({ name: 'sprintId', description: 'Sprint UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of issues in sprint' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  findIssuesBySprint(@Param('sprintId') sprintId: string) {
    return this.sprintsService.findIssuesBySprint(sprintId);
  }
}

