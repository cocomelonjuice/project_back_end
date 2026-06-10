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
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Boards')
@Controller()
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/boards')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new board for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Board successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  create(
    @Param('projectId') projectId: string,
    @Body() createBoardDto: CreateBoardDto,
  ) {
    return this.boardsService.create(projectId, createBoardDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/boards')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all boards for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of boards' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByProject(@Param('projectId') projectId: string) {
    return this.boardsService.findByProject(projectId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('boards/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get board by ID' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiResponse({ status: 200, description: 'Returns board information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  findOne(@Param('id') id: string) {
    return this.boardsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('boards/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update board' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiResponse({ status: 200, description: 'Board successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  update(@Param('id') id: string, @Body() updateBoardDto: UpdateBoardDto) {
    return this.boardsService.update(id, updateBoardDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('boards/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete board' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiResponse({ status: 200, description: 'Board successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  remove(@Param('id') id: string) {
    return this.boardsService.remove(id);
  }
}
