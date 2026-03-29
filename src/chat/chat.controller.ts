import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { DeleteConversationsDto } from './dto/delete-conversations.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { pickChatLocale } from './chat-assistant-messages';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a chat conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  createConversation(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(req.user.id, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for the current user' })
  listConversations(@Req() req: any) {
    return this.chatService.listConversations(req.user.id);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Update a conversation (e.g. title)' })
  @ApiResponse({ status: 200, description: 'Conversation updated' })
  updateConversation(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chatService.updateConversation(req.user.id, id, dto);
  }

  /** POST alias: some proxies return 404 on PATCH; client uses this by default. */
  @Post('conversations/:id/update')
  @ApiOperation({ summary: 'Update a conversation (POST alias)' })
  @ApiResponse({ status: 200, description: 'Conversation updated' })
  updateConversationPost(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chatService.updateConversation(req.user.id, id, dto);
  }

  @Post('conversations/delete-many')
  @ApiOperation({ summary: 'Delete multiple conversations owned by the current user' })
  @ApiResponse({ status: 200, description: 'Returns count of deleted rows' })
  deleteMany(@Req() req: any, @Body() dto: DeleteConversationsDto) {
    return this.chatService.deleteConversations(req.user.id, dto.ids);
  }

  /** Same as DELETE; POST avoids proxies/clients that mishandle DELETE. */
  @Post('conversations/:id/remove')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove one conversation (POST alias)' })
  @ApiResponse({ status: 204, description: 'Conversation removed' })
  removeConversationPost(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.chatService.deleteConversation(req.user.id, id);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one conversation' })
  @ApiResponse({ status: 204, description: 'Conversation removed' })
  deleteOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.chatService.deleteConversation(req.user.id, id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  getMessages(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chatService.getMessages(req.user.id, id);
  }

  @Post('conversations/:id/messages')
  @UseGuards(ThrottlerGuard)
  @Throttle({ chatMessage: { limit: 25, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message and get an assistant reply' })
  sendMessage(
    @Req() req: any,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendChatMessageDto,
  ) {
    const locale = pickChatLocale(acceptLanguage);
    return this.chatService.sendMessage(
      req.user.id,
      id,
      dto.content,
      req.user.roles ?? [],
      locale,
    );
  }
}
