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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StatusesService } from './statuses.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Statuses')
@Controller('statuses')
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new status' })
  @ApiResponse({ status: 201, description: 'Status successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateStatusDto) {
    return this.statusesService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all statuses' })
  @ApiResponse({ status: 200, description: 'Returns list of all statuses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.statusesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get status by ID' })
  @ApiParam({ name: 'id', description: 'Status UUID' })
  @ApiResponse({ status: 200, description: 'Returns status information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Status not found' })
  findOne(@Param('id') id: string) {
    return this.statusesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update status' })
  @ApiParam({ name: 'id', description: 'Status UUID' })
  @ApiResponse({ status: 200, description: 'Status successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Status not found' })
  update(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.statusesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete status' })
  @ApiParam({ name: 'id', description: 'Status UUID' })
  @ApiResponse({ status: 200, description: 'Status successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Status not found' })
  remove(@Param('id') id: string) {
    return this.statusesService.remove(id);
  }
}
