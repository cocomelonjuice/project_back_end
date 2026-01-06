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
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { CreateTransitionDto } from './dto/create-transition.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found (if projectId provided)' })
  create(@Body() createWorkflowDto: CreateWorkflowDto) {
    return this.workflowsService.create(createWorkflowDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all workflows' })
  @ApiResponse({ status: 200, description: 'Returns list of all workflows' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.workflowsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get workflow by ID' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Returns workflow information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  findOne(@Param('id') id: string) {
    return this.workflowsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  update(@Param('id') id: string, @Body() updateWorkflowDto: UpdateWorkflowDto) {
    return this.workflowsService.update(id, updateWorkflowDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  remove(@Param('id') id: string) {
    return this.workflowsService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/transitions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all status transitions for a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of workflow transitions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  getTransitions(@Param('id') id: string) {
    return this.workflowsService.getTransitions(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/transitions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a status transition to a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 201, description: 'Transition successfully added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow or status not found' })
  addTransition(
    @Param('id') id: string,
    @Body() createTransitionDto: CreateTransitionDto,
  ) {
    return this.workflowsService.addTransition(id, createTransitionDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/transitions/:transitionId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove a status transition from a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiParam({ name: 'transitionId', description: 'Transition UUID' })
  @ApiResponse({ status: 200, description: 'Transition successfully removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workflow or transition not found' })
  removeTransition(
    @Param('id') id: string,
    @Param('transitionId') transitionId: string,
  ) {
    return this.workflowsService.removeTransition(id, transitionId);
  }
}

