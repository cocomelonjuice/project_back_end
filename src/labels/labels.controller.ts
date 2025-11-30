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
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Labels')
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new label' })
  @ApiResponse({ status: 201, description: 'Label successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Label name already exists' })
  create(@Body() createLabelDto: CreateLabelDto) {
    return this.labelsService.create(createLabelDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all labels' })
  @ApiResponse({ status: 200, description: 'Returns list of all labels' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.labelsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get label by ID' })
  @ApiParam({ name: 'id', description: 'Label UUID' })
  @ApiResponse({ status: 200, description: 'Returns label information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  findOne(@Param('id') id: string) {
    return this.labelsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update label' })
  @ApiParam({ name: 'id', description: 'Label UUID' })
  @ApiResponse({ status: 200, description: 'Label successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  update(@Param('id') id: string, @Body() updateLabelDto: UpdateLabelDto) {
    return this.labelsService.update(id, updateLabelDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete label' })
  @ApiParam({ name: 'id', description: 'Label UUID' })
  @ApiResponse({ status: 200, description: 'Label successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  remove(@Param('id') id: string) {
    return this.labelsService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('issues/:issueId/labels/:labelId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a label to an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  @ApiParam({ name: 'labelId', description: 'Label UUID' })
  @ApiResponse({ status: 200, description: 'Label successfully added to issue' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue or label not found' })
  addLabelToIssue(
    @Param('issueId') issueId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelsService.addLabelToIssue(issueId, labelId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('issues/:issueId/labels/:labelId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove a label from an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  @ApiParam({ name: 'labelId', description: 'Label UUID' })
  @ApiResponse({ status: 200, description: 'Label successfully removed from issue' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue or label not found' })
  removeLabelFromIssue(
    @Param('issueId') issueId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelsService.removeLabelFromIssue(issueId, labelId);
  }
}

