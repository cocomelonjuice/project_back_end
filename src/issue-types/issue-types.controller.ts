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
import { IssueTypesService } from './issue-types.service';
import { CreateIssueTypeDto } from './dto/create-issue-type.dto';
import { UpdateIssueTypeDto } from './dto/update-issue-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Issue Types')
@Controller('issue-types')
export class IssueTypesController {
  constructor(private readonly issueTypesService: IssueTypesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new issue type' })
  @ApiResponse({ status: 201, description: 'Issue type successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateIssueTypeDto) {
    return this.issueTypesService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all issue types' })
  @ApiResponse({ status: 200, description: 'Returns list of all issue types' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.issueTypesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get issue type by ID' })
  @ApiParam({ name: 'id', description: 'Issue type UUID' })
  @ApiResponse({ status: 200, description: 'Returns issue type information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue type not found' })
  findOne(@Param('id') id: string) {
    return this.issueTypesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update issue type' })
  @ApiParam({ name: 'id', description: 'Issue type UUID' })
  @ApiResponse({ status: 200, description: 'Issue type successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue type not found' })
  update(@Param('id') id: string, @Body() dto: UpdateIssueTypeDto) {
    return this.issueTypesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete issue type' })
  @ApiParam({ name: 'id', description: 'Issue type UUID' })
  @ApiResponse({ status: 200, description: 'Issue type successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue type not found' })
  remove(@Param('id') id: string) {
    return this.issueTypesService.remove(id);
  }
}
