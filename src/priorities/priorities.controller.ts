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
import { PrioritiesService } from './priorities.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Priorities')
@Controller('priorities')
export class PrioritiesController {
  constructor(private readonly prioritiesService: PrioritiesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new priority' })
  @ApiResponse({ status: 201, description: 'Priority successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreatePriorityDto) {
    return this.prioritiesService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all priorities' })
  @ApiResponse({ status: 200, description: 'Returns list of all priorities' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.prioritiesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get priority by ID' })
  @ApiParam({ name: 'id', description: 'Priority UUID' })
  @ApiResponse({ status: 200, description: 'Returns priority information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Priority not found' })
  findOne(@Param('id') id: string) {
    return this.prioritiesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update priority' })
  @ApiParam({ name: 'id', description: 'Priority UUID' })
  @ApiResponse({ status: 200, description: 'Priority successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Priority not found' })
  update(@Param('id') id: string, @Body() dto: UpdatePriorityDto) {
    return this.prioritiesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete priority' })
  @ApiParam({ name: 'id', description: 'Priority UUID' })
  @ApiResponse({ status: 200, description: 'Priority successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Priority not found' })
  remove(@Param('id') id: string) {
    return this.prioritiesService.remove(id);
  }
}




