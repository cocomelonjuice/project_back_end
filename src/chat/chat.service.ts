import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GroqAiService } from '../ai/groq-ai.service';
import { BoardsService } from '../boards/boards.service';
import { CommentsService } from '../comments/comments.service';
import { IssuesService } from '../issues/issues.service';
import { QueryIssuesDto } from '../issues/dto/query-issues.dto';
import { ProjectsService } from '../projects/projects.service';
import { SearchService } from '../search/search.service';
import { SprintsService } from '../sprints/sprints.service';
import { LabelsService } from '../labels/labels.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { validateChatActionPayload } from './chat-action-payload.validator';
import {
  type ChatLocale,
  chatAssistantMessages,
} from './chat-assistant-messages';

const SYSTEM_PROMPT = `You are a helpful assistant inside a project management web app (issues, projects, boards, sprints, labels, workflows, roles).
You must ALWAYS output a single JSON object with NO markdown code fences.
Schema:
{
  "intent": "none" | "search_global" | "get_issue" | "list_project_issues" | "list_sprint_issues" | "create_issue" | "update_issue" | "assign_issue" | "transition_issue" | "add_comment" | "create_project" | "update_project" | "create_board" | "update_board" | "create_sprint" | "update_sprint" | "start_sprint" | "complete_sprint" | "list_labels" | "create_label" | "update_label" | "delete_label" | "add_issue_label" | "remove_issue_label" | "list_workflows" | "get_workflow" | "create_workflow" | "update_workflow" | "delete_workflow" | "list_workflow_transitions" | "add_workflow_transition" | "remove_workflow_transition" | "admin_create_role" | "admin_update_role" | "admin_delete_role" | "admin_assign_project_role" | "admin_remove_project_role" | "admin_delete_user",
  "reply_to_user"?: string,
  "reply"?: string,
  "missing_fields"?: string[],
  "needs_confirmation"?: boolean,
  "confidence"?: number,
  "payload": {
    "query"?: string,
    "type"?: "all" | "projects" | "issues" | "users",
    "limit"?: number,
    "issueId"?: string,
    "projectId"?: string,
    "boardId"?: string,
    "key"?: string,
    "projectType"?: string,
    "boardType"?: string,
    "summary"?: string,
    "description"?: string,
    "typeId"?: string,
    "reporterId"?: string,
    "sprintId"?: string,
    "statusId"?: string,
    "assigneeId"?: string,
    "priorityId"?: string,
    "content"?: string,
    "name"?: string,
    "goal"?: string,
    "startDate"?: string,
    "endDate"?: string,
    "sprintStatus"?: string,
    "labelId"?: string,
    "workflowId"?: string,
    "transitionId"?: string,
    "roleId"?: string,
    "targetUserId"?: string,
    "isActive"?: boolean,
    "permissions"?: string[],
    "color"?: string,
    "fromStatusId"?: string,
    "toStatusId"?: string
  }
}
Rules:
- Prefer "reply_to_user" for the user-visible message; "reply" is an accepted alias (either must be present).
- If required values are missing, list them in "missing_fields" (e.g. ["projectId"]) and explain in reply_to_user; server will not execute tools until the user fills them in.
- For destructive or sensitive actions, set needs_confirmation true; the server may still require YES/NO for certain intents.
- If no tool action is needed, use intent="none".
- Use admin_* intents only for admin operations; the server enforces the admin role.
- Keep text concise and in the same language as the user (Vietnamese/English).`;

const HISTORY_LIMIT = 24;

function isUserConfirm(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const first = t.split(/\s+/)[0] ?? '';
  return (
    /^(yes|y|ok|confirm)$/i.test(first) ||
    t === 'đồng ý' ||
    t === 'dong y' ||
    t === 'xác nhận' ||
    t === 'xac nhan'
  );
}

function isUserCancel(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const first = t.split(/\s+/)[0] ?? '';
  return (
    /^(no|n|cancel|abort|stop)$/i.test(first) ||
    t === 'hủy' ||
    t === 'huy' ||
    t === 'thôi' ||
    t === 'thoi'
  );
}

function intentRequiresServerConfirmation(intent: string): boolean {
  const need = new Set<string>([
    'delete_label',
    'delete_workflow',
    'remove_issue_label',
    'remove_workflow_transition',
    'admin_delete_role',
    'admin_assign_project_role',
    'admin_remove_project_role',
    'admin_delete_user',
  ]);
  return need.has(intent);
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

type ChatIntent =
  | 'none'
  | 'search_global'
  | 'get_issue'
  | 'list_project_issues'
  | 'list_sprint_issues'
  | 'create_issue'
  | 'update_issue'
  | 'assign_issue'
  | 'transition_issue'
  | 'add_comment'
  | 'create_project'
  | 'update_project'
  | 'create_board'
  | 'update_board'
  | 'create_sprint'
  | 'update_sprint'
  | 'start_sprint'
  | 'complete_sprint'
  | 'list_labels'
  | 'create_label'
  | 'update_label'
  | 'delete_label'
  | 'add_issue_label'
  | 'remove_issue_label'
  | 'list_workflows'
  | 'get_workflow'
  | 'create_workflow'
  | 'update_workflow'
  | 'delete_workflow'
  | 'list_workflow_transitions'
  | 'add_workflow_transition'
  | 'remove_workflow_transition'
  | 'admin_create_role'
  | 'admin_update_role'
  | 'admin_delete_role'
  | 'admin_assign_project_role'
  | 'admin_remove_project_role'
  | 'admin_delete_user';

type ActionDecision = {
  intent: ChatIntent;
  /** Normalized user-visible text (from reply_to_user or reply). */
  reply: string;
  reply_to_user?: string;
  missing_fields?: string[];
  needs_confirmation?: boolean;
  confidence?: number;
  payload?: {
    query?: string;
    type?: 'all' | 'projects' | 'issues' | 'users';
    limit?: number;
    issueId?: string;
    projectId?: string;
    boardId?: string;
    key?: string;
    projectType?: string;
    boardType?: string;
    name?: string;
    summary?: string;
    description?: string;
    typeId?: string;
    reporterId?: string;
    sprintId?: string;
    statusId?: string;
    assigneeId?: string;
    priorityId?: string;
    content?: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    sprintStatus?: string;
    labelId?: string;
    workflowId?: string;
    transitionId?: string;
    roleId?: string;
    targetUserId?: string;
    isActive?: boolean;
    permissions?: string[];
    color?: string;
    fromStatusId?: string;
    toStatusId?: string;
  };
};

const VALID_CHAT_INTENTS = new Set<string>([
  'none',
  'search_global',
  'get_issue',
  'list_project_issues',
  'list_sprint_issues',
  'create_issue',
  'update_issue',
  'assign_issue',
  'transition_issue',
  'add_comment',
  'create_project',
  'update_project',
  'create_board',
  'update_board',
  'create_sprint',
  'update_sprint',
  'start_sprint',
  'complete_sprint',
  'list_labels',
  'create_label',
  'update_label',
  'delete_label',
  'add_issue_label',
  'remove_issue_label',
  'list_workflows',
  'get_workflow',
  'create_workflow',
  'update_workflow',
  'delete_workflow',
  'list_workflow_transitions',
  'add_workflow_transition',
  'remove_workflow_transition',
  'admin_create_role',
  'admin_update_role',
  'admin_delete_role',
  'admin_assign_project_role',
  'admin_remove_project_role',
  'admin_delete_user',
]);

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly groqAi: GroqAiService,
    private readonly searchService: SearchService,
    private readonly issuesService: IssuesService,
    private readonly commentsService: CommentsService,
    private readonly projectsService: ProjectsService,
    private readonly boardsService: BoardsService,
    private readonly sprintsService: SprintsService,
    private readonly labelsService: LabelsService,
    private readonly workflowsService: WorkflowsService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
  ) {}

  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ChatConversation> {
    const conv = this.conversationRepo.create({
      userId,
      projectId: dto.projectId ?? null,
      title: dto.title?.trim() || null,
    });
    return this.conversationRepo.save(conv);
  }

  async listConversations(userId: string): Promise<ChatConversation[]> {
    return this.conversationRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async updateConversation(
    userId: string,
    id: string,
    dto: UpdateConversationDto,
  ): Promise<ChatConversation> {
    const conv = await this.getOwnedConversationOrThrow(userId, id);
    if (dto.title !== undefined) {
      conv.title = dto.title.trim() || null;
    }
    return this.conversationRepo.save(conv);
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const conv = await this.getOwnedConversationOrThrow(userId, id);
    await this.conversationRepo.remove(conv);
  }

  async deleteConversations(
    userId: string,
    ids: string[],
  ): Promise<{ deleted: number }> {
    const unique = [...new Set(ids)];
    const result = await this.conversationRepo.delete({
      userId,
      id: In(unique),
    });
    return { deleted: result.affected ?? 0 };
  }

  async getMessages(
    userId: string,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    await this.getOwnedConversationOrThrow(userId, conversationId);
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
    userRoles: string[] = [],
    locale: ChatLocale = 'en',
  ): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    const msg = chatAssistantMessages(locale);
    const conv = await this.getOwnedConversationOrThrow(userId, conversationId);

    const userMessage = this.messageRepo.create({
      conversationId: conv.id,
      role: 'user',
      content: content.trim(),
    });
    await this.messageRepo.save(userMessage);

    const utterance = content.trim();

    let fresh = await this.conversationRepo.findOne({ where: { id: conv.id } });
    if (!fresh) {
      throw new NotFoundException('Conversation not found');
    }

    if (fresh.pendingActionJson) {
      if (isUserCancel(utterance)) {
        fresh.pendingActionJson = null;
        await this.conversationRepo.save(fresh);
        const assistantMessage = this.messageRepo.create({
          conversationId: conv.id,
          role: 'assistant',
          content: msg.cancelled,
        });
        await this.messageRepo.save(assistantMessage);
        fresh.updatedAt = new Date();
        await this.conversationRepo.save(fresh);
        return { userMessage, assistantMessage };
      }
      if (isUserConfirm(utterance)) {
        const pendingDecision = this.pendingToDecision(
          fresh.pendingActionJson as Record<string, unknown>,
        );
        fresh.pendingActionJson = null;
        await this.conversationRepo.save(fresh);
        let replyText: string;
        if (!pendingDecision) {
          replyText = msg.confirmInvalid;
        } else {
          try {
            replyText = await this.resolveAssistantReply(
              userId,
              userRoles,
              pendingDecision,
              '',
              locale,
            );
          } catch (err: unknown) {
            replyText = this.formatExecutionError(err, msg);
          }
        }
        const assistantMessage = this.messageRepo.create({
          conversationId: conv.id,
          role: 'assistant',
          content: replyText,
        });
        await this.messageRepo.save(assistantMessage);
        fresh.updatedAt = new Date();
        await this.conversationRepo.save(fresh);
        return { userMessage, assistantMessage };
      }
      fresh.pendingActionJson = null;
      await this.conversationRepo.save(fresh);
    }

    const recent = await this.messageRepo.find({
      where: { conversationId: conv.id },
      order: { createdAt: 'DESC' },
      take: HISTORY_LIMIT,
    });
    recent.reverse();

    const completionMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...recent.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let rawReply: string;
    try {
      rawReply = await this.groqAi.complete(completionMessages);
    } catch {
      const assistantMessage = this.messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: msg.unavailable,
      });
      await this.messageRepo.save(assistantMessage);
      conv.updatedAt = new Date();
      await this.conversationRepo.save(conv);
      return { userMessage, assistantMessage };
    }

    const decision = this.parseActionDecision(rawReply);

    if (!decision) {
      const assistantMessage = this.messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: msg.invalidJson,
      });
      await this.messageRepo.save(assistantMessage);
      conv.updatedAt = new Date();
      await this.conversationRepo.save(conv);
      return { userMessage, assistantMessage };
    }

    if (decision.missing_fields && decision.missing_fields.length > 0) {
      const assistantMessage = this.messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: decision.reply,
      });
      await this.messageRepo.save(assistantMessage);
      conv.updatedAt = new Date();
      await this.conversationRepo.save(conv);
      return { userMessage, assistantMessage };
    }

    if (decision.intent !== 'none') {
      const payloadErr = validateChatActionPayload(
        decision.intent,
        decision.payload,
      );
      if (payloadErr) {
        const assistantMessage = this.messageRepo.create({
          conversationId: conv.id,
          role: 'assistant',
          content: `${decision.reply}\n\nInvalid payload: ${payloadErr}`,
        });
        await this.messageRepo.save(assistantMessage);
        conv.updatedAt = new Date();
        await this.conversationRepo.save(conv);
        return { userMessage, assistantMessage };
      }
    }

    const mustConfirm =
      decision.intent !== 'none' &&
      (decision.needs_confirmation === true ||
        intentRequiresServerConfirmation(decision.intent));

    if (mustConfirm) {
      fresh = await this.conversationRepo.findOne({ where: { id: conv.id } });
      if (!fresh) {
        throw new NotFoundException('Conversation not found');
      }
      fresh.pendingActionJson = {
        intent: decision.intent,
        payload: decision.payload ?? {},
      };
      await this.conversationRepo.save(fresh);
      const assistantMessage = this.messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: `${decision.reply}${msg.confirmHint}`,
      });
      await this.messageRepo.save(assistantMessage);
      fresh.updatedAt = new Date();
      await this.conversationRepo.save(fresh);
      return { userMessage, assistantMessage };
    }

    let replyText: string;
    try {
      replyText = await this.resolveAssistantReply(
        userId,
        userRoles,
        decision,
        rawReply,
        locale,
      );
    } catch (err: unknown) {
      replyText = this.formatExecutionError(err, msg);
    }

    const assistantMessage = this.messageRepo.create({
      conversationId: conv.id,
      role: 'assistant',
      content: replyText,
    });
    await this.messageRepo.save(assistantMessage);

    conv.updatedAt = new Date();
    await this.conversationRepo.save(conv);

    return { userMessage, assistantMessage };
  }

  private pendingToDecision(
    raw: Record<string, unknown>,
  ): ActionDecision | null {
    const intent = raw.intent;
    if (typeof intent !== 'string' || !VALID_CHAT_INTENTS.has(intent)) {
      return null;
    }
    const payloadRaw = raw.payload;
    const payload =
      typeof payloadRaw === 'object' &&
      payloadRaw !== null &&
      !Array.isArray(payloadRaw)
        ? (payloadRaw as ActionDecision['payload'])
        : undefined;
    return {
      intent: intent as ChatIntent,
      payload,
      reply: 'Confirmed.',
      reply_to_user: 'Confirmed.',
    };
  }

  private parseActionDecision(raw: string): ActionDecision | null {
    const trimmed = raw.trim();
    const blockMatch = trimmed.match(/\{[\s\S]*\}/);
    const jsonCandidate = blockMatch ? blockMatch[0] : trimmed;
    try {
      const parsed = JSON.parse(jsonCandidate) as ActionDecision;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.intent !== 'string'
      ) {
        return null;
      }
      const ru =
        typeof parsed.reply_to_user === 'string'
          ? parsed.reply_to_user.trim()
          : '';
      const r = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
      const merged = ru || r;
      if (!merged) {
        return null;
      }
      if (!VALID_CHAT_INTENTS.has(parsed.intent)) {
        return null;
      }
      let missingFields: string[] | undefined;
      if (parsed.missing_fields != null) {
        if (!Array.isArray(parsed.missing_fields)) {
          return null;
        }
        missingFields = parsed.missing_fields
          .map((x) => String(x))
          .filter(Boolean);
      }
      if (
        parsed.needs_confirmation != null &&
        typeof parsed.needs_confirmation !== 'boolean'
      ) {
        return null;
      }
      if (parsed.confidence != null && typeof parsed.confidence !== 'number') {
        return null;
      }
      parsed.reply = merged;
      parsed.missing_fields = missingFields;
      return parsed;
    } catch {
      return null;
    }
  }

  private isAdmin(roles: string[]): boolean {
    return roles.some((r) => r === 'admin');
  }

  private formatExecutionError(
    err: unknown,
    msg: ReturnType<typeof chatAssistantMessages>,
  ): string {
    if (err instanceof HttpException) {
      const r = err.getResponse();
      if (typeof r === 'string') {
        return `${msg.actionFailed}\n\n${r}`;
      }
      if (r && typeof r === 'object' && 'message' in r) {
        const m = (r as { message?: string | string[] }).message;
        const text = Array.isArray(m) ? m.join(', ') : String(m ?? '');
        return `${msg.actionFailed}\n\n${text}`;
      }
    }
    return msg.genericActionError;
  }

  private async resolveAssistantReply(
    userId: string,
    userRoles: string[],
    decision: ActionDecision | null,
    rawReply: string,
    locale: ChatLocale,
  ): Promise<string> {
    const msg = chatAssistantMessages(locale);
    if (!decision) {
      return msg.invalidJson;
    }

    if (decision.missing_fields && decision.missing_fields.length > 0) {
      return decision.reply;
    }

    if (decision.intent === 'none') {
      return decision.reply;
    }

    if (decision.intent === 'search_global') {
      const query = decision.payload?.query?.trim();
      if (!query) {
        return decision.reply;
      }
      const type = decision.payload?.type ?? 'all';
      const limit = Math.min(Math.max(decision.payload?.limit ?? 5, 1), 10);
      const result = await this.searchService.search({ q: query, type, limit });

      const firstProject = result.projects[0];
      const firstIssue = result.issues[0];
      const firstUser = result.users[0];
      return `${decision.reply}\n\nProjects: ${result.projects.length}, Issues: ${result.issues.length}, Users: ${result.users.length} (total: ${result.total}).${firstProject ? `\nTop project: ${firstProject.name} (${firstProject.key}).` : ''}${firstIssue ? `\nTop issue: ${firstIssue.summary}${firstIssue.id ? ` [${firstIssue.id}]` : ''}.` : ''}${firstUser ? `\nTop user: ${firstUser.displayName || firstUser.username}.` : ''}`;
    }

    if (decision.intent === 'get_issue') {
      const issueId = decision.payload?.issueId?.trim();
      if (!issueId) {
        return decision.reply;
      }
      const issue = await this.issuesService.findOne(issueId);
      return `${decision.reply}\n\nIssue: ${issue.summary}\nStatus: ${issue.status?.name ?? 'Unknown'}\nPriority: ${issue.priority?.name ?? 'Unknown'}\nAssignee: ${issue.assignee?.displayName ?? issue.assignee?.username ?? 'Unassigned'}`;
    }

    if (decision.intent === 'create_issue') {
      const projectId = decision.payload?.projectId?.trim();
      const summary = decision.payload?.summary?.trim();
      if (!projectId || !summary) return decision.reply;
      const created = await this.issuesService.create(projectId, {
        summary,
        description: decision.payload?.description,
        typeId: decision.payload?.typeId,
        priorityId: decision.payload?.priorityId,
        statusId: decision.payload?.statusId,
        assigneeId: decision.payload?.assigneeId,
        reporterId: decision.payload?.reporterId,
        sprintId: decision.payload?.sprintId,
      });
      return `${decision.reply}\n\nCreated issue: ${created.summary} [${created.id}]`;
    }

    if (decision.intent === 'update_issue') {
      const issueId = decision.payload?.issueId?.trim();
      if (!issueId) return decision.reply;
      const updated = await this.issuesService.update(issueId, {
        summary: decision.payload?.summary,
        description: decision.payload?.description,
        typeId: decision.payload?.typeId,
        priorityId: decision.payload?.priorityId,
        statusId: decision.payload?.statusId,
        assigneeId: decision.payload?.assigneeId,
        reporterId: decision.payload?.reporterId,
        sprintId: decision.payload?.sprintId,
      });
      return `${decision.reply}\n\nUpdated issue: ${updated.summary} [${updated.id}]`;
    }

    if (decision.intent === 'assign_issue') {
      const issueId = decision.payload?.issueId?.trim();
      if (!issueId) return decision.reply;
      const assigned = await this.issuesService.assign(issueId, {
        assigneeId: decision.payload?.assigneeId ?? null,
      });
      const who =
        assigned.assignee?.displayName ??
        assigned.assignee?.username ??
        'Unassigned';
      return `${decision.reply}\n\nIssue ${assigned.id} assignee: ${who}`;
    }

    if (decision.intent === 'transition_issue') {
      const issueId = decision.payload?.issueId?.trim();
      const statusId = decision.payload?.statusId?.trim();
      if (!issueId || !statusId) return decision.reply;
      const transitioned = await this.issuesService.transition(issueId, {
        statusId,
      });
      return `${decision.reply}\n\nIssue ${transitioned.id} moved to status: ${transitioned.status?.name ?? 'Unknown'}`;
    }

    if (decision.intent === 'add_comment') {
      const issueId = decision.payload?.issueId?.trim();
      const content = decision.payload?.content?.trim();
      if (!issueId || !content) return decision.reply;
      const comment = await this.commentsService.create(issueId, userId, {
        content,
      });
      return `${decision.reply}\n\nComment added: ${comment.id}`;
    }

    if (decision.intent === 'create_project') {
      const key = decision.payload?.key?.trim();
      const name = decision.payload?.name?.trim();
      const projectType = decision.payload?.projectType?.trim();
      if (!key || !name || !projectType) return decision.reply;
      const created = await this.projectsService.create({
        key,
        name,
        type: projectType,
        description: decision.payload?.description,
      });
      return `${decision.reply}\n\nCreated project: ${created.name} (${created.key}) [${created.id}]`;
    }

    if (decision.intent === 'update_project') {
      const projectId = decision.payload?.projectId?.trim();
      if (!projectId) return decision.reply;
      const updated = await this.projectsService.update(projectId, {
        key: decision.payload?.key,
        name: decision.payload?.name,
        type: decision.payload?.projectType,
        description: decision.payload?.description,
      });
      return `${decision.reply}\n\nUpdated project: ${updated.name} [${updated.id}]`;
    }

    if (decision.intent === 'create_board') {
      const projectId = decision.payload?.projectId?.trim();
      const name = decision.payload?.name?.trim();
      const boardType = decision.payload?.boardType?.trim();
      if (!projectId || !name || !boardType) return decision.reply;
      const board = await this.boardsService.create(projectId, {
        name,
        type: boardType,
      });
      return `${decision.reply}\n\nCreated board: ${board.name} [${board.id}]`;
    }

    if (decision.intent === 'update_board') {
      const boardId = decision.payload?.boardId?.trim();
      if (!boardId) return decision.reply;
      const board = await this.boardsService.update(boardId, {
        name: decision.payload?.name,
        type: decision.payload?.boardType,
      });
      return `${decision.reply}\n\nUpdated board: ${board.name} [${board.id}]`;
    }

    if (decision.intent === 'create_sprint') {
      const boardId = decision.payload?.boardId?.trim();
      const name = decision.payload?.name?.trim();
      if (!boardId || !name) return decision.reply;
      const sprint = await this.sprintsService.create(boardId, {
        name,
        goal: decision.payload?.goal,
        startDate: parseOptionalDate(decision.payload?.startDate),
        endDate: parseOptionalDate(decision.payload?.endDate),
        status: decision.payload?.sprintStatus,
      });
      return `${decision.reply}\n\nCreated sprint: ${sprint.name} [${sprint.id}] status=${sprint.status}`;
    }

    if (decision.intent === 'update_sprint') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const sprint = await this.sprintsService.update(sprintId, {
        name: decision.payload?.name,
        goal: decision.payload?.goal,
        startDate: parseOptionalDate(decision.payload?.startDate),
        endDate: parseOptionalDate(decision.payload?.endDate),
        status: decision.payload?.sprintStatus,
      });
      return `${decision.reply}\n\nUpdated sprint: ${sprint.name} [${sprint.id}]`;
    }

    if (decision.intent === 'start_sprint') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const sprint = await this.sprintsService.start(sprintId);
      return `${decision.reply}\n\nSprint started: ${sprint.name} [${sprint.id}]`;
    }

    if (decision.intent === 'complete_sprint') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const sprint = await this.sprintsService.complete(sprintId);
      return `${decision.reply}\n\nSprint completed: ${sprint.name} [${sprint.id}]`;
    }

    if (decision.intent === 'list_sprint_issues') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const issues = await this.sprintsService.findIssuesBySprint(sprintId);
      const preview = issues
        .slice(0, 5)
        .map((i) => `- ${i.summary} (${i.status?.name ?? 'Unknown'})`)
        .join('\n');
      return `${decision.reply}\n\nFound ${issues.length} issue(s) in sprint.${preview ? `\n${preview}` : ''}`;
    }

    if (decision.intent === 'list_project_issues') {
      const projectId = decision.payload?.projectId?.trim();
      if (!projectId) {
        return decision.reply;
      }
      const query: QueryIssuesDto = {
        statusId: decision.payload?.statusId,
        assigneeId: decision.payload?.assigneeId,
        priorityId: decision.payload?.priorityId,
      };
      const issues = await this.issuesService.findByProject(projectId, query);
      const preview = issues
        .slice(0, 5)
        .map((i) => `- ${i.summary} (${i.status?.name ?? 'Unknown'})`)
        .join('\n');
      return `${decision.reply}\n\nFound ${issues.length} issue(s).${preview ? `\n${preview}` : ''}`;
    }

    if (decision.intent === 'list_labels') {
      const labels = await this.labelsService.findAll();
      const preview = labels
        .slice(0, 12)
        .map((l) => `- ${l.name} (${l.id})`)
        .join('\n');
      return `${decision.reply}\n\n${labels.length} label(s).${preview ? `\n${preview}` : ''}`;
    }

    if (decision.intent === 'create_label') {
      const name = decision.payload?.name?.trim();
      if (!name) return decision.reply;
      const colorRaw = decision.payload?.color?.trim();
      const color =
        colorRaw && /^#[0-9A-Fa-f]{6}$/.test(colorRaw) ? colorRaw : undefined;
      const created = await this.labelsService.create({
        name,
        color,
        description: decision.payload?.description?.trim(),
      });
      return `${decision.reply}\n\nCreated label: ${created.name} [${created.id}]`;
    }

    if (decision.intent === 'update_label') {
      const labelId = decision.payload?.labelId?.trim();
      if (!labelId) return decision.reply;
      const colorRaw = decision.payload?.color?.trim();
      const color =
        colorRaw && /^#[0-9A-Fa-f]{6}$/.test(colorRaw) ? colorRaw : undefined;
      const updated = await this.labelsService.update(labelId, {
        name: decision.payload?.name?.trim(),
        ...(color !== undefined ? { color } : {}),
        description: decision.payload?.description,
      });
      return `${decision.reply}\n\nUpdated label: ${updated.name} [${updated.id}]`;
    }

    if (decision.intent === 'delete_label') {
      const labelId = decision.payload?.labelId?.trim();
      if (!labelId) return decision.reply;
      await this.labelsService.remove(labelId);
      return `${decision.reply}\n\nLabel removed.`;
    }

    if (decision.intent === 'add_issue_label') {
      const issueId = decision.payload?.issueId?.trim();
      const labelId = decision.payload?.labelId?.trim();
      if (!issueId || !labelId) return decision.reply;
      const issue = await this.labelsService.addLabelToIssue(issueId, labelId);
      return `${decision.reply}\n\nLabel attached to issue [${issue.id}].`;
    }

    if (decision.intent === 'remove_issue_label') {
      const issueId = decision.payload?.issueId?.trim();
      const labelId = decision.payload?.labelId?.trim();
      if (!issueId || !labelId) return decision.reply;
      const issue = await this.labelsService.removeLabelFromIssue(
        issueId,
        labelId,
      );
      return `${decision.reply}\n\nLabel removed from issue [${issue.id}].`;
    }

    if (decision.intent === 'list_workflows') {
      const workflows = await this.workflowsService.findAll();
      const preview = workflows
        .slice(0, 10)
        .map((w) => `- ${w.name} (${w.id}) active=${w.isActive}`)
        .join('\n');
      return `${decision.reply}\n\n${workflows.length} workflow(s).${preview ? `\n${preview}` : ''}`;
    }

    if (decision.intent === 'get_workflow') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      const w = await this.workflowsService.findOne(workflowId);
      const tr = w.transitions?.length ?? 0;
      return `${decision.reply}\n\nWorkflow: ${w.name}\nTransitions: ${tr}\nActive: ${w.isActive}`;
    }

    if (decision.intent === 'create_workflow') {
      const name = decision.payload?.name?.trim();
      if (!name) return decision.reply;
      const created = await this.workflowsService.create({
        name,
        description: decision.payload?.description,
        projectId: decision.payload?.projectId,
        isActive: decision.payload?.isActive,
      });
      return `${decision.reply}\n\nCreated workflow: ${created.name} [${created.id}]`;
    }

    if (decision.intent === 'update_workflow') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      const updated = await this.workflowsService.update(workflowId, {
        name: decision.payload?.name,
        description: decision.payload?.description,
        projectId: decision.payload?.projectId,
        isActive: decision.payload?.isActive,
      });
      return `${decision.reply}\n\nUpdated workflow: ${updated.name} [${updated.id}]`;
    }

    if (decision.intent === 'delete_workflow') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      await this.workflowsService.remove(workflowId);
      return `${decision.reply}\n\nWorkflow deleted.`;
    }

    if (decision.intent === 'list_workflow_transitions') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      const transitions =
        await this.workflowsService.getTransitions(workflowId);
      const preview = transitions
        .map((t) => {
          return `- ${t.fromStatus?.name ?? '?'} → ${t.toStatus?.name ?? '?'} [${t.id}]`;
        })
        .join('\n');
      return `${decision.reply}\n\n${transitions.length} transition(s).${preview ? `\n${preview}` : ''}`;
    }

    if (decision.intent === 'add_workflow_transition') {
      const workflowId = decision.payload?.workflowId?.trim();
      const fromStatusId = decision.payload?.fromStatusId?.trim();
      const toStatusId = decision.payload?.toStatusId?.trim();
      if (!workflowId || !fromStatusId || !toStatusId) return decision.reply;
      const t = await this.workflowsService.addTransition(workflowId, {
        fromStatusId,
        toStatusId,
      });
      return `${decision.reply}\n\nTransition added [${t.id}].`;
    }

    if (decision.intent === 'remove_workflow_transition') {
      const workflowId = decision.payload?.workflowId?.trim();
      const transitionId = decision.payload?.transitionId?.trim();
      if (!workflowId || !transitionId) return decision.reply;
      await this.workflowsService.removeTransition(workflowId, transitionId);
      return `${decision.reply}\n\nTransition removed.`;
    }

    const adminDenied = `${decision.reply}\n\nAdministrator privileges are required for this action.`;

    if (decision.intent === 'admin_create_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const name = decision.payload?.name?.trim();
      if (!name) return decision.reply;
      const role = await this.rolesService.create({
        name,
        description: decision.payload?.description,
        permissions: decision.payload?.permissions,
      });
      return `${decision.reply}\n\nCreated role: ${role.name} [${role.id}]`;
    }

    if (decision.intent === 'admin_update_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const roleId = decision.payload?.roleId?.trim();
      if (!roleId) return decision.reply;
      const role = await this.rolesService.update(roleId, {
        name: decision.payload?.name,
        description: decision.payload?.description,
        permissions: decision.payload?.permissions,
      });
      return `${decision.reply}\n\nUpdated role: ${role.name} [${role.id}]`;
    }

    if (decision.intent === 'admin_delete_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const roleId = decision.payload?.roleId?.trim();
      if (!roleId) return decision.reply;
      await this.rolesService.remove(roleId);
      return `${decision.reply}\n\nRole deleted.`;
    }

    if (decision.intent === 'admin_assign_project_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const projectId = decision.payload?.projectId?.trim();
      const roleId = decision.payload?.roleId?.trim();
      const targetUserId = decision.payload?.targetUserId?.trim();
      if (!projectId || !roleId || !targetUserId) return decision.reply;
      await this.rolesService.assignRoleToUserInProject(
        projectId,
        roleId,
        targetUserId,
      );
      return `${decision.reply}\n\nRole assigned in project.`;
    }

    if (decision.intent === 'admin_remove_project_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const projectId = decision.payload?.projectId?.trim();
      const roleId = decision.payload?.roleId?.trim();
      const targetUserId = decision.payload?.targetUserId?.trim();
      if (!projectId || !roleId || !targetUserId) return decision.reply;
      await this.rolesService.removeRoleFromUserInProject(
        projectId,
        roleId,
        targetUserId,
      );
      return `${decision.reply}\n\nRole removed from user in project.`;
    }

    if (decision.intent === 'admin_delete_user') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const targetUserId = decision.payload?.targetUserId?.trim();
      if (!targetUserId) return decision.reply;
      if (targetUserId === userId) {
        return `${decision.reply}\n\nYou cannot delete your own account from chat.`;
      }
      await this.usersService.remove(targetUserId);
      return `${decision.reply}\n\nUser deleted.`;
    }

    return decision.reply;
  }

  private async getOwnedConversationOrThrow(
    userId: string,
    conversationId: string,
  ): Promise<ChatConversation> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    if (conv.userId !== userId) {
      throw new ForbiddenException('Not allowed to access this conversation');
    }
    return conv;
  }
}
