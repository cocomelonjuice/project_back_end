import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
import { StatusesService } from '../statuses/statuses.service';
import { IssueTypesService } from '../issue-types/issue-types.service';
import { PrioritiesService } from '../priorities/priorities.service';
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
- The user may write in English or Vietnamese (mixed is OK). Always match their language in reply_to_user/reply.
- **IDs vs names:** The server resolves human-readable values to UUIDs. Whenever the user gives a project name, project key, issue key/summary, person name, or email, put those strings in **payload** using the fields below. Do **not** ask the user for raw UUIDs in reply_to_user if they already named something in their message.
- **Payload aliases (strings the server understands):** projectName, projectKey, key, name (project); issue, summary, name (issue text/key); assignee, assigneeName, assigneeEmail, username, email (people); status, statusName, toStatus; sprint, sprintName; board, boardName; label, labelName; workflow, workflowName; role, roleName; targetUser, displayName (as applicable). You may also put a UUID in projectId/issueId/etc. when the user pastes one.
- **missing_fields:** Only list a field in missing_fields when that value is truly absent from the user message and cannot be inferred. The server may still fill gaps from the same message — avoid redundant missing_fields.
- For destructive or sensitive actions, set needs_confirmation true; the server may still require YES/NO for certain intents.
- If no tool action is needed, use intent="none".
- Use admin_* intents only for admin operations; the server enforces the admin role.
- Keep text concise and in the same language as the user (Vietnamese/English).`;

const HISTORY_LIMIT = 24;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseSelectionIndex(text: string, max: number): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const direct = t.match(/\b([1-9]\d?)\b/);
  if (direct) {
    const n = Number(direct[1]);
    if (n >= 1 && n <= max) return n - 1;
  }
  if (/\b(first|1st|đầu|dau)\b/i.test(t)) return max >= 1 ? 0 : null;
  if (/\b(second|2nd)\b/i.test(t)) return max >= 2 ? 1 : null;
  if (/\b(third|3rd)\b/i.test(t)) return max >= 3 ? 2 : null;
  return null;
}

function isSelectionState(raw: unknown): raw is ChatSelectionState {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    r.kind === 'selection' &&
    typeof r.field === 'string' &&
    Array.isArray(r.candidates) &&
    typeof r.decision === 'object' &&
    r.decision !== null
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

type SearchProjectLite = { id: string; name: string; key: string };
type SearchIssueLite = {
  id: string;
  summary: string;
  project?: { id?: string | null; key?: string | null } | null;
};
type SearchUserLite = {
  id: string;
  username: string;
  displayName?: string | null;
};

type ResolveCandidate = { id: string; display: string };
type ChatSelectionState = {
  kind: 'selection';
  field: string;
  label: string;
  candidates: ResolveCandidate[];
  decision: ActionDecision;
};
type ChatPendingState =
  | {
      intent: string;
      payload?: Record<string, unknown>;
    }
  | ChatSelectionState;

type ChatEntityContext = Partial<
  Record<
    | 'issueId'
    | 'projectId'
    | 'boardId'
    | 'sprintId'
    | 'labelId'
    | 'workflowId'
    | 'roleId'
    | 'targetUserId'
    | 'assigneeId'
    | 'reporterId',
    string
  >
>;

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
  private readonly logger = new Logger(ChatService.name);

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
    private readonly statusesService: StatusesService,
    private readonly issueTypesService: IssueTypesService,
    private readonly prioritiesService: PrioritiesService,
  ) {}

  private groqUnavailableUserMessage(
    err: unknown,
    strings: {
      unavailable: string;
      unavailableRateLimit: string;
      unavailableConfig: string;
    },
  ): string {
    if (!(err instanceof HttpException)) {
      return strings.unavailable;
    }
    const status = err.getStatus();
    if (status === 429) {
      return strings.unavailableRateLimit;
    }
    if (
      status === 503 ||
      err instanceof ServiceUnavailableException ||
      status === 401 ||
      status === 403
    ) {
      return strings.unavailableConfig;
    }
    return strings.unavailable;
  }

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
      const pendingRaw = fresh.pendingActionJson as ChatPendingState;
      if (isSelectionState(pendingRaw)) {
        const pendingSelection = pendingRaw;
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
        const idx = parseSelectionIndex(
          utterance,
          pendingSelection.candidates.length,
        );
        if (idx === null) {
          const assistantMessage = this.messageRepo.create({
            conversationId: conv.id,
            role: 'assistant',
            content: this.resolveText(
              locale,
              `Please choose a number from 1-${pendingSelection.candidates.length}, or reply NO to cancel.`,
              `Vui lòng chọn số từ 1-${pendingSelection.candidates.length}, hoặc trả lời NO để hủy.`,
            ),
          });
          await this.messageRepo.save(assistantMessage);
          fresh.updatedAt = new Date();
          await this.conversationRepo.save(fresh);
          return { userMessage, assistantMessage };
        }
        const chosen = pendingSelection.candidates[idx];
        const payload = this.toPayloadRecord(pendingSelection.decision);
        payload[pendingSelection.field] = chosen.id;
        let decisionAfterPick: ActionDecision = {
          ...pendingSelection.decision,
          payload: payload as ActionDecision['payload'],
        };
        const context = await this.buildEntityContext(conv.id);
        const resolvedAfterPick = await this.resolveIdsForDecision(
          decisionAfterPick,
          locale,
          context,
        );
        fresh.pendingActionJson = null;
        await this.conversationRepo.save(fresh);
        if (resolvedAfterPick.selection && resolvedAfterPick.clarification) {
          fresh.pendingActionJson = resolvedAfterPick.selection as Record<
            string,
            unknown
          >;
          await this.conversationRepo.save(fresh);
          const assistantMessage = this.messageRepo.create({
            conversationId: conv.id,
            role: 'assistant',
            content: resolvedAfterPick.clarification,
          });
          await this.messageRepo.save(assistantMessage);
          fresh.updatedAt = new Date();
          await this.conversationRepo.save(fresh);
          return { userMessage, assistantMessage };
        }
        decisionAfterPick = resolvedAfterPick.decision;
        const payloadErr = validateChatActionPayload(
          decisionAfterPick.intent,
          decisionAfterPick.payload,
        );
        if (payloadErr) {
          const assistantMessage = this.messageRepo.create({
            conversationId: conv.id,
            role: 'assistant',
            content: `${decisionAfterPick.reply}\n\nInvalid payload: ${payloadErr}`,
          });
          await this.messageRepo.save(assistantMessage);
          fresh.updatedAt = new Date();
          await this.conversationRepo.save(fresh);
          return { userMessage, assistantMessage };
        }
        const mustConfirm =
          decisionAfterPick.intent !== 'none' &&
          (decisionAfterPick.needs_confirmation === true ||
            intentRequiresServerConfirmation(decisionAfterPick.intent));
        if (mustConfirm) {
          fresh.pendingActionJson = {
            intent: decisionAfterPick.intent,
            payload: decisionAfterPick.payload ?? {},
          };
          await this.conversationRepo.save(fresh);
          const assistantMessage = this.messageRepo.create({
            conversationId: conv.id,
            role: 'assistant',
            content: `${decisionAfterPick.reply}${msg.confirmHint}`,
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
            decisionAfterPick,
            '',
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
        fresh.updatedAt = new Date();
        await this.conversationRepo.save(fresh);
        return { userMessage, assistantMessage };
      }
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
        const pendingDecision = this.pendingToDecision(fresh.pendingActionJson);
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
    } catch (err: unknown) {
      const safe =
        err instanceof Error ? err.message : `non-Error: ${String(err)}`;
      this.logger.warn(`Groq completion failed: ${safe}`);
      const content = this.groqUnavailableUserMessage(err, msg);

      const assistantMessage = this.messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content,
      });
      await this.messageRepo.save(assistantMessage);
      conv.updatedAt = new Date();
      await this.conversationRepo.save(conv);
      return { userMessage, assistantMessage };
    }

    let decision = this.parseActionDecision(rawReply);

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

    if (decision.intent !== 'none') {
      const context = await this.buildEntityContext(conv.id);
      decision = this.enrichDecisionFromUtterance(decision, utterance, context);
      const resolved = await this.resolveIdsForDecision(
        decision,
        locale,
        context,
      );
      if (resolved.selection && resolved.clarification) {
        fresh = await this.conversationRepo.findOne({ where: { id: conv.id } });
        if (!fresh) throw new NotFoundException('Conversation not found');
        fresh.pendingActionJson = resolved.selection as Record<string, unknown>;
        await this.conversationRepo.save(fresh);
        const assistantMessage = this.messageRepo.create({
          conversationId: conv.id,
          role: 'assistant',
          content: resolved.clarification,
        });
        await this.messageRepo.save(assistantMessage);
        conv.updatedAt = new Date();
        await this.conversationRepo.save(conv);
        return { userMessage, assistantMessage };
      }
      if (resolved.clarification) {
        const assistantMessage = this.messageRepo.create({
          conversationId: conv.id,
          role: 'assistant',
          content: resolved.clarification,
        });
        await this.messageRepo.save(assistantMessage);
        conv.updatedAt = new Date();
        await this.conversationRepo.save(conv);
        return { userMessage, assistantMessage };
      }
      decision = resolved.decision;
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

  private isManager(roles: string[]): boolean {
    return roles.some((r) => r === 'manager');
  }

  private canManageProjectsOrWorkflows(roles: string[]): boolean {
    return this.isAdmin(roles) || this.isManager(roles);
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
    const assistantStrings = chatAssistantMessages(locale);
    if (!decision) {
      return assistantStrings.invalidJson;
    }

    if (decision.missing_fields && decision.missing_fields.length > 0) {
      const payloadErr = validateChatActionPayload(
        decision.intent,
        decision.payload,
      );
      if (payloadErr) {
        return decision.reply;
      }
      // Model listed missing_fields but enrich + resolve already produced a valid payload.
    }

    if (decision.intent === 'none') {
      return decision.reply;
    }

    const managerDenied = this.actionSuccess(
      locale,
      'Administrator or manager privileges are required for this action.',
      'Cần quyền quản trị viên hoặc quản lý để thực hiện thao tác này.',
    );

    if (
      [
        'create_project',
        'update_project',
        'create_workflow',
        'update_workflow',
        'delete_workflow',
      ].includes(decision.intent)
    ) {
      if (!this.canManageProjectsOrWorkflows(userRoles)) {
        return managerDenied;
      }
    }

    if (decision.intent === 'search_global') {
      const query = decision.payload?.query?.trim();
      if (!query) {
        return decision.reply;
      }
      const type = decision.payload?.type ?? 'all';
      const limit = Math.min(Math.max(decision.payload?.limit ?? 5, 1), 10);
      const result = await this.searchService.search({ q: query, type, limit });
      const projects = result.projects as SearchProjectLite[];
      const issues = result.issues as SearchIssueLite[];
      const users = result.users as SearchUserLite[];

      const firstProject = projects[0];
      const firstIssue = issues[0];
      const firstUser = users[0];
      const projectLink = firstProject ? `/projects/${firstProject.id}` : '';
      const issueLink =
        firstIssue?.project?.id && firstIssue?.id
          ? `/projects/${firstIssue.project.id}/issues/${firstIssue.id}`
          : '';
      const userLink = firstUser ? `/users/${firstUser.id}` : '';
      const tail = `Projects: ${result.projects.length}, Issues: ${result.issues.length}, Users: ${result.users.length} (total: ${result.total}).${firstProject ? `\nTop project: ${firstProject.name} (${firstProject.key}).` : ''}${projectLink ? `\nProject link: ${projectLink}` : ''}${firstIssue ? `\nTop issue: ${firstIssue.summary}.` : ''}${issueLink ? `\nIssue link: ${issueLink}` : ''}${firstUser ? `\nTop user: ${firstUser.displayName || firstUser.username}.` : ''}${userLink ? `\nUser link: ${userLink}` : ''}`;
      return this.actionSuccess(locale, tail, `Tìm kiếm: ${tail}`);
    }

    if (decision.intent === 'get_issue') {
      const issueId = decision.payload?.issueId?.trim();
      if (!issueId) {
        return decision.reply;
      }
      const issue = await this.issuesService.findOne(issueId);
      const who =
        issue.assignee?.displayName ?? issue.assignee?.username ?? 'Unassigned';
      return this.actionSuccess(
        locale,
        `Issue: ${issue.summary}\nStatus: ${issue.status?.name ?? 'Unknown'}\nPriority: ${issue.priority?.name ?? 'Unknown'}\nAssignee: ${who}`,
        `Issue: ${issue.summary}\nTrạng thái: ${issue.status?.name ?? 'Không rõ'}\nƯu tiên: ${issue.priority?.name ?? 'Không rõ'}\nNgười được giao: ${who === 'Unassigned' ? 'Chưa giao' : who}`,
      );
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
      // Do not prepend decision.reply — it often still asks for IDs after the server resolved them.
      return this.actionSuccess(
        locale,
        `Created issue: ${created.summary}.`,
        `Đã tạo issue: ${created.summary}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Updated issue: ${updated.summary}.`,
        `Đã cập nhật issue: ${updated.summary}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Assignee: ${who}.`,
        `Người được giao: ${who === 'Unassigned' ? 'Chưa giao' : who}.`,
      );
    }

    if (decision.intent === 'transition_issue') {
      const issueId = decision.payload?.issueId?.trim();
      const statusId = decision.payload?.statusId?.trim();
      if (!issueId || !statusId) return decision.reply;
      const transitioned = await this.issuesService.transition(issueId, {
        statusId,
      });
      return this.actionSuccess(
        locale,
        `Status: ${transitioned.status?.name ?? 'Unknown'}.`,
        `Trạng thái: ${transitioned.status?.name ?? 'Không rõ'}.`,
      );
    }

    if (decision.intent === 'add_comment') {
      const issueId = decision.payload?.issueId?.trim();
      const content = decision.payload?.content?.trim();
      if (!issueId || !content) return decision.reply;
      await this.commentsService.create(issueId, userId, {
        content,
      });
      return this.actionSuccess(locale, 'Comment added.', 'Đã thêm bình luận.');
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
      return this.actionSuccess(
        locale,
        `Created project: ${created.name} (${created.key}).`,
        `Đã tạo project: ${created.name} (${created.key}).`,
      );
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
      return this.actionSuccess(
        locale,
        `Updated project: ${updated.name}.`,
        `Đã cập nhật project: ${updated.name}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Created board: ${board.name}.`,
        `Đã tạo board: ${board.name}.`,
      );
    }

    if (decision.intent === 'update_board') {
      const boardId = decision.payload?.boardId?.trim();
      if (!boardId) return decision.reply;
      const board = await this.boardsService.update(boardId, {
        name: decision.payload?.name,
        type: decision.payload?.boardType,
      });
      return this.actionSuccess(
        locale,
        `Updated board: ${board.name}.`,
        `Đã cập nhật board: ${board.name}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Created sprint: ${sprint.name} (${sprint.status}).`,
        `Đã tạo sprint: ${sprint.name} (${sprint.status}).`,
      );
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
      return this.actionSuccess(
        locale,
        `Updated sprint: ${sprint.name}.`,
        `Đã cập nhật sprint: ${sprint.name}.`,
      );
    }

    if (decision.intent === 'start_sprint') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const sprint = await this.sprintsService.start(sprintId);
      return this.actionSuccess(
        locale,
        `Sprint started: ${sprint.name}.`,
        `Đã bắt đầu sprint: ${sprint.name}.`,
      );
    }

    if (decision.intent === 'complete_sprint') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const sprint = await this.sprintsService.complete(sprintId);
      return this.actionSuccess(
        locale,
        `Sprint completed: ${sprint.name}.`,
        `Đã hoàn thành sprint: ${sprint.name}.`,
      );
    }

    if (decision.intent === 'list_sprint_issues') {
      const sprintId = decision.payload?.sprintId?.trim();
      if (!sprintId) return decision.reply;
      const issues = await this.sprintsService.findIssuesBySprint(sprintId);
      const preview = issues
        .slice(0, 5)
        .map((i) => `- ${i.summary} (${i.status?.name ?? 'Unknown'})`)
        .join('\n');
      const body = `Found ${issues.length} issue(s) in sprint.${preview ? `\n${preview}` : ''}`;
      return this.actionSuccess(
        locale,
        body,
        `Tìm thấy ${issues.length} issue trong sprint.${preview ? `\n${preview}` : ''}`,
      );
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
      const body = `Found ${issues.length} issue(s).${preview ? `\n${preview}` : ''}`;
      return this.actionSuccess(
        locale,
        body,
        `Tìm thấy ${issues.length} issue.${preview ? `\n${preview}` : ''}`,
      );
    }

    if (decision.intent === 'list_labels') {
      const labels = await this.labelsService.findAll();
      const preview = labels
        .slice(0, 12)
        .map((l) => `- ${l.name}`)
        .join('\n');
      const body = `${labels.length} label(s).${preview ? `\n${preview}` : ''}`;
      return this.actionSuccess(
        locale,
        body,
        `${labels.length} nhãn.${preview ? `\n${preview}` : ''}`,
      );
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
      return this.actionSuccess(
        locale,
        `Created label: ${created.name}.`,
        `Đã tạo nhãn: ${created.name}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Updated label: ${updated.name}.`,
        `Đã cập nhật nhãn: ${updated.name}.`,
      );
    }

    if (decision.intent === 'delete_label') {
      const labelId = decision.payload?.labelId?.trim();
      if (!labelId) return decision.reply;
      await this.labelsService.remove(labelId);
      return this.actionSuccess(locale, 'Label removed.', 'Đã xóa nhãn.');
    }

    if (decision.intent === 'add_issue_label') {
      const issueId = decision.payload?.issueId?.trim();
      const labelId = decision.payload?.labelId?.trim();
      if (!issueId || !labelId) return decision.reply;
      await this.labelsService.addLabelToIssue(issueId, labelId);
      return this.actionSuccess(
        locale,
        'Label attached to issue.',
        'Đã gắn nhãn vào issue.',
      );
    }

    if (decision.intent === 'remove_issue_label') {
      const issueId = decision.payload?.issueId?.trim();
      const labelId = decision.payload?.labelId?.trim();
      if (!issueId || !labelId) return decision.reply;
      await this.labelsService.removeLabelFromIssue(issueId, labelId);
      return this.actionSuccess(
        locale,
        'Label removed from issue.',
        'Đã gỡ nhãn khỏi issue.',
      );
    }

    if (decision.intent === 'list_workflows') {
      const workflows = await this.workflowsService.findAll();
      const preview = workflows
        .slice(0, 10)
        .map((w) => `- ${w.name} (active=${w.isActive})`)
        .join('\n');
      const body = `${workflows.length} workflow(s).${preview ? `\n${preview}` : ''}`;
      return this.actionSuccess(
        locale,
        body,
        `${workflows.length} workflow.${preview ? `\n${preview}` : ''}`,
      );
    }

    if (decision.intent === 'get_workflow') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      const w = await this.workflowsService.findOne(workflowId);
      const tr = w.transitions?.length ?? 0;
      return this.actionSuccess(
        locale,
        `Workflow: ${w.name}\nTransitions: ${tr}\nActive: ${w.isActive}`,
        `Workflow: ${w.name}\nChuyển trạng thái: ${tr}\nKích hoạt: ${w.isActive}`,
      );
    }

    if (decision.intent === 'create_workflow') {
      const name = decision.payload?.name?.trim();
      const projectId = decision.payload?.projectId?.trim();
      if (!name) return decision.reply;
      if (!projectId) {
        return this.actionSuccess(
          locale,
          'Workflow creation now requires a projectId.',
          'Tạo workflow hiện yêu cầu projectId.',
        );
      }
      const created = await this.workflowsService.create({
        name,
        description: decision.payload?.description,
        projectId,
        isActive: decision.payload?.isActive,
      });
      return this.actionSuccess(
        locale,
        `Created workflow: ${created.name}.`,
        `Đã tạo workflow: ${created.name}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Updated workflow: ${updated.name}.`,
        `Đã cập nhật workflow: ${updated.name}.`,
      );
    }

    if (decision.intent === 'delete_workflow') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      await this.workflowsService.remove(workflowId);
      return this.actionSuccess(
        locale,
        'Workflow deleted.',
        'Đã xóa workflow.',
      );
    }

    if (decision.intent === 'list_workflow_transitions') {
      const workflowId = decision.payload?.workflowId?.trim();
      if (!workflowId) return decision.reply;
      const transitions =
        await this.workflowsService.getTransitions(workflowId);
      const preview = transitions
        .map((t) => {
          return `- ${t.fromStatus?.name ?? '?'} → ${t.toStatus?.name ?? '?'}`;
        })
        .join('\n');
      const body = `${transitions.length} transition(s).${preview ? `\n${preview}` : ''}`;
      return this.actionSuccess(
        locale,
        body,
        `${transitions.length} chuyển trạng thái.${preview ? `\n${preview}` : ''}`,
      );
    }

    if (decision.intent === 'add_workflow_transition') {
      const workflowId = decision.payload?.workflowId?.trim();
      const fromStatusId = decision.payload?.fromStatusId?.trim();
      const toStatusId = decision.payload?.toStatusId?.trim();
      if (!workflowId || !fromStatusId || !toStatusId) return decision.reply;
      await this.workflowsService.addTransition(workflowId, {
        fromStatusId,
        toStatusId,
      });
      return this.actionSuccess(
        locale,
        'Transition added.',
        'Đã thêm chuyển trạng thái.',
      );
    }

    if (decision.intent === 'remove_workflow_transition') {
      const workflowId = decision.payload?.workflowId?.trim();
      const transitionId = decision.payload?.transitionId?.trim();
      if (!workflowId || !transitionId) return decision.reply;
      await this.workflowsService.removeTransition(workflowId, transitionId);
      return this.actionSuccess(
        locale,
        'Transition removed.',
        'Đã xóa chuyển trạng thái.',
      );
    }

    const adminDenied = this.actionSuccess(
      locale,
      'Administrator privileges are required for this action.',
      'Cần quyền quản trị viên để thực hiện thao tác này.',
    );

    if (decision.intent === 'admin_create_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const name = decision.payload?.name?.trim();
      if (!name) return decision.reply;
      const role = await this.rolesService.create({
        name,
        description: decision.payload?.description,
        permissions: decision.payload?.permissions,
      });
      return this.actionSuccess(
        locale,
        `Created role: ${role.name}.`,
        `Đã tạo vai trò: ${role.name}.`,
      );
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
      return this.actionSuccess(
        locale,
        `Updated role: ${role.name}.`,
        `Đã cập nhật vai trò: ${role.name}.`,
      );
    }

    if (decision.intent === 'admin_delete_role') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const roleId = decision.payload?.roleId?.trim();
      if (!roleId) return decision.reply;
      await this.rolesService.remove(roleId);
      return this.actionSuccess(locale, 'Role deleted.', 'Đã xóa vai trò.');
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
      return this.actionSuccess(
        locale,
        'Role assigned in project.',
        'Đã gán vai trò trong project.',
      );
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
      return this.actionSuccess(
        locale,
        'Role removed from user in project.',
        'Đã gỡ vai trò của user trong project.',
      );
    }

    if (decision.intent === 'admin_delete_user') {
      if (!this.isAdmin(userRoles)) return adminDenied;
      const targetUserId = decision.payload?.targetUserId?.trim();
      if (!targetUserId) return decision.reply;
      if (targetUserId === userId) {
        return this.actionSuccess(
          locale,
          'You cannot delete your own account from chat.',
          'Bạn không thể xóa tài khoản của chính mình qua chat.',
        );
      }
      await this.usersService.remove(targetUserId);
      return this.actionSuccess(locale, 'User deleted.', 'Đã xóa user.');
    }

    return decision.reply;
  }

  private isUuid(value?: string): boolean {
    return !!value && UUID_RE.test(value.trim());
  }

  private toPayloadRecord(decision: ActionDecision): Record<string, unknown> {
    const payloadRaw = decision.payload as unknown;
    if (
      typeof payloadRaw === 'object' &&
      payloadRaw !== null &&
      !Array.isArray(payloadRaw)
    ) {
      return payloadRaw as Record<string, unknown>;
    }
    return {};
  }

  private readString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const v = payload[key];
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return undefined;
  }

  private resolveText(locale: ChatLocale, en: string, vi: string): string {
    return locale === 'vi' ? vi : en;
  }

  private formatCandidates(
    locale: ChatLocale,
    label: string,
    candidates: Array<{ id: string; display: string }>,
  ): string {
    const head = this.resolveText(
      locale,
      `I found multiple ${label} matches. Please choose one (or be more specific):`,
      `Tôi tìm thấy nhiều kết quả ${label}. Vui lòng chọn một (hoặc mô tả cụ thể hơn):`,
    );
    const rows = candidates
      .slice(0, 5)
      .map((c, idx) => `${idx + 1}. ${c.display} [${c.id}]`)
      .join('\n');
    return `${head}\n${rows}`;
  }

  private uniqueById<T extends { id: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of arr) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }

  private textIncludes(haystack: string | undefined, needle: string): boolean {
    if (!haystack) return false;
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  private async resolveIdsForDecision(
    decision: ActionDecision,
    locale: ChatLocale,
    context: ChatEntityContext = {},
  ): Promise<{
    decision: ActionDecision;
    clarification?: string;
    selection?: ChatSelectionState;
  }> {
    const payload = this.toPayloadRecord(decision);
    decision.payload = payload as ActionDecision['payload'];

    type ResolveResult = {
      clarification?: string;
      selection?: ChatSelectionState;
    };

    const ensureResolved = async (
      idField: string,
      aliases: string[],
      label: string,
      resolver: (query: string) => Promise<ResolveCandidate[]>,
      required = true,
    ): Promise<ResolveResult> => {
      const existing = this.readString(payload, [idField]);
      if (existing && this.isUuid(existing)) return {};

      const query = this.readString(payload, [idField, ...aliases]);
      if (!query) {
        const hinted = context[idField as keyof ChatEntityContext];
        if (hinted && this.isUuid(hinted)) {
          payload[idField] = hinted;
          return {};
        }
        if (!required) return {};
        return {
          clarification: this.resolveText(
            locale,
            `Please specify ${label}.`,
            `Vui lòng cung cấp ${label}.`,
          ),
        };
      }

      const matches = this.uniqueById(await resolver(query));
      if (matches.length === 0) {
        return {
          clarification: this.resolveText(
            locale,
            `I could not find ${label} matching "${query}".`,
            `Không tìm thấy ${label} khớp với "${query}".`,
          ),
        };
      }
      if (matches.length > 1) {
        return {
          clarification: this.formatCandidates(locale, label, matches),
          selection: {
            kind: 'selection',
            field: idField,
            label,
            candidates: matches.slice(0, 5),
            decision: {
              ...decision,
              payload: { ...(payload as ActionDecision['payload']) },
            },
          },
        };
      }

      payload[idField] = matches[0].id;
      return {};
    };

    const resolveByIntent = async (): Promise<ResolveResult> => {
      switch (decision.intent) {
        case 'get_issue':
        case 'update_issue':
        case 'add_comment':
          return ensureResolved(
            'issueId',
            ['issue', 'summary', 'name', 'key'],
            'issue',
            (q) => this.findIssueCandidates(q),
          );
        case 'assign_issue': {
          const issueErr = await ensureResolved(
            'issueId',
            ['issue', 'summary', 'name', 'key'],
            'issue',
            (q) => this.findIssueCandidates(q),
          );
          if (issueErr.clarification) return issueErr;
          return ensureResolved(
            'assigneeId',
            ['assignee', 'assigneeName', 'assigneeEmail', 'username', 'email'],
            'assignee',
            (q) => this.findUserCandidates(q),
            false,
          );
        }
        case 'transition_issue': {
          const issueErr = await ensureResolved(
            'issueId',
            ['issue', 'summary', 'name', 'key'],
            'issue',
            (q) => this.findIssueCandidates(q),
          );
          if (issueErr.clarification) return issueErr;
          return ensureResolved(
            'statusId',
            ['status', 'statusName', 'toStatus', 'toStatusName'],
            'status',
            (q) => this.findStatusCandidates(q),
          );
        }
        case 'list_project_issues':
        case 'update_project':
          return ensureResolved(
            'projectId',
            ['project', 'projectName', 'projectKey', 'key', 'name'],
            'project',
            (q) => this.findProjectCandidates(q),
          );
        case 'create_issue': {
          const projectErr = await ensureResolved(
            'projectId',
            ['project', 'projectName', 'projectKey', 'key'],
            'project',
            (q) => this.findProjectCandidates(q),
          );
          if (projectErr.clarification) return projectErr;
          const assigneeErr = await ensureResolved(
            'assigneeId',
            ['assignee', 'assigneeName', 'assigneeEmail', 'username', 'email'],
            'assignee',
            (q) => this.findUserCandidates(q),
            false,
          );
          if (assigneeErr.clarification) return assigneeErr;
          const reporterErr = await ensureResolved(
            'reporterId',
            ['reporter', 'reporterName', 'reporterEmail'],
            'reporter',
            (q) => this.findUserCandidates(q),
            false,
          );
          if (reporterErr.clarification) return reporterErr;
          const sprintErr = await ensureResolved(
            'sprintId',
            ['sprint', 'sprintName'],
            'sprint',
            (q) => this.findSprintCandidates(q, payload),
            false,
          );
          if (sprintErr.clarification) return sprintErr;
          const statusErr = await ensureResolved(
            'statusId',
            ['status', 'statusName'],
            'status',
            (q) => this.findStatusCandidates(q),
            false,
          );
          if (statusErr.clarification) return statusErr;
          const typeErr = await ensureResolved(
            'typeId',
            ['type', 'issueType', 'issueTypeName'],
            'issue type',
            (q) => this.findIssueTypeCandidates(q),
            false,
          );
          if (typeErr.clarification) return typeErr;
          return ensureResolved(
            'priorityId',
            ['priority', 'priorityName'],
            'priority',
            (q) => this.findPriorityCandidates(q),
            false,
          );
        }
        case 'create_board':
          return ensureResolved(
            'projectId',
            ['project', 'projectName', 'projectKey', 'key'],
            'project',
            (q) => this.findProjectCandidates(q),
          );
        case 'update_board':
        case 'create_sprint':
          return ensureResolved(
            'boardId',
            ['board', 'boardName', 'name'],
            'board',
            (q) => this.findBoardCandidates(q, payload),
          );
        case 'update_sprint':
        case 'start_sprint':
        case 'complete_sprint':
        case 'list_sprint_issues':
          return ensureResolved(
            'sprintId',
            ['sprint', 'sprintName', 'name'],
            'sprint',
            (q) => this.findSprintCandidates(q, payload),
          );
        case 'update_label':
        case 'delete_label':
          return ensureResolved(
            'labelId',
            ['label', 'labelName', 'name'],
            'label',
            (q) => this.findLabelCandidates(q),
          );
        case 'add_issue_label':
        case 'remove_issue_label': {
          const issueErr = await ensureResolved(
            'issueId',
            ['issue', 'summary', 'name'],
            'issue',
            (q) => this.findIssueCandidates(q),
          );
          if (issueErr.clarification) return issueErr;
          return ensureResolved(
            'labelId',
            ['label', 'labelName', 'name'],
            'label',
            (q) => this.findLabelCandidates(q),
          );
        }
        case 'get_workflow':
        case 'update_workflow':
        case 'delete_workflow':
        case 'list_workflow_transitions':
          return ensureResolved(
            'workflowId',
            ['workflow', 'workflowName', 'name'],
            'workflow',
            (q) => this.findWorkflowCandidates(q),
          );
        case 'add_workflow_transition': {
          const workflowErr = await ensureResolved(
            'workflowId',
            ['workflow', 'workflowName', 'name'],
            'workflow',
            (q) => this.findWorkflowCandidates(q),
          );
          if (workflowErr.clarification) return workflowErr;
          const fromErr = await ensureResolved(
            'fromStatusId',
            ['fromStatus', 'fromStatusName', 'statusFrom'],
            'from status',
            (q) => this.findStatusCandidates(q),
          );
          if (fromErr.clarification) return fromErr;
          return ensureResolved(
            'toStatusId',
            ['toStatus', 'toStatusName', 'statusTo', 'status'],
            'to status',
            (q) => this.findStatusCandidates(q),
          );
        }
        case 'remove_workflow_transition': {
          const workflowErr = await ensureResolved(
            'workflowId',
            ['workflow', 'workflowName', 'name'],
            'workflow',
            (q) => this.findWorkflowCandidates(q),
          );
          if (workflowErr.clarification) return workflowErr;
          return ensureResolved(
            'transitionId',
            ['transition', 'transitionName'],
            'transition',
            (q) => this.findTransitionCandidates(q, payload),
          );
        }
        case 'create_workflow':
          return ensureResolved(
            'projectId',
            ['project', 'projectName', 'projectKey'],
            'project',
            (q) => this.findProjectCandidates(q),
            false,
          );
        case 'admin_update_role':
        case 'admin_delete_role':
          return ensureResolved(
            'roleId',
            ['role', 'roleName', 'name'],
            'role',
            (q) => this.findRoleCandidates(q),
          );
        case 'admin_assign_project_role':
        case 'admin_remove_project_role': {
          const roleErr = await ensureResolved(
            'roleId',
            ['role', 'roleName', 'name'],
            'role',
            (q) => this.findRoleCandidates(q),
          );
          if (roleErr.clarification) return roleErr;
          return ensureResolved(
            'targetUserId',
            [
              'targetUser',
              'targetUsername',
              'username',
              'email',
              'displayName',
            ],
            'user',
            (q) => this.findUserCandidates(q),
          );
        }
        case 'admin_delete_user':
          return ensureResolved(
            'targetUserId',
            [
              'targetUser',
              'targetUsername',
              'username',
              'email',
              'displayName',
            ],
            'user',
            (q) => this.findUserCandidates(q),
          );
        default:
          return {};
      }
    };

    const result = await resolveByIntent();
    return {
      decision,
      clarification: result.clarification,
      selection: result.selection,
    };
  }

  private async findProjectCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const projects = await this.projectsService.findAll();
    const q = query.trim().toLowerCase();
    const exact = projects.filter(
      (p) => p.key?.toLowerCase() === q || p.name?.toLowerCase() === q,
    );
    const fuzzy = projects.filter(
      (p) =>
        this.textIncludes(p.key, q) ||
        this.textIncludes(p.name, q) ||
        this.textIncludes(p.description, q),
    );
    return [...exact, ...fuzzy].map((p) => ({
      id: p.id,
      display: `${p.name} (${p.key})`,
    }));
  }

  private async findIssueCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const result = await this.searchService.search({
      q: query,
      type: 'issues',
      limit: 8,
    });
    const issues = result.issues as SearchIssueLite[];
    const q = query.trim().toLowerCase();
    const exact = issues.filter((i) => i.summary?.toLowerCase() === q);
    const rest = issues.filter((i) => i.summary?.toLowerCase() !== q);
    return [...exact, ...rest].map((i) => ({
      id: i.id,
      display: `${i.summary}${i.project?.key ? ` (${i.project.key})` : ''}`,
    }));
  }

  private async findUserCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const q = query.trim();
    const byUsername = await this.usersService.findByUsername(q);
    if (byUsername) {
      return [
        {
          id: byUsername.id,
          display: `${byUsername.displayName || byUsername.username} (${byUsername.username})`,
        },
      ];
    }
    const byEmail = await this.usersService.findByEmail(q);
    if (byEmail) {
      return [
        {
          id: byEmail.id,
          display: `${byEmail.displayName || byEmail.username} (${byEmail.email})`,
        },
      ];
    }
    const users = await this.usersService.findAll();
    const low = q.toLowerCase();
    const exact = users.filter(
      (u) =>
        u.username?.toLowerCase() === low ||
        u.email?.toLowerCase() === low ||
        u.displayName?.toLowerCase() === low,
    );
    const fuzzy = users.filter(
      (u) =>
        this.textIncludes(u.username, low) ||
        this.textIncludes(u.email, low) ||
        this.textIncludes(u.displayName, low),
    );
    return [...exact, ...fuzzy].map((u) => ({
      id: u.id,
      display: `${u.displayName || u.username} (${u.username})`,
    }));
  }

  private async findRoleCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const roles = await this.rolesService.findAll();
    const q = query.trim().toLowerCase();
    const exact = roles.filter((r) => r.name?.toLowerCase() === q);
    const fuzzy = roles.filter((r) => this.textIncludes(r.name, q));
    return [...exact, ...fuzzy].map((r) => ({ id: r.id, display: r.name }));
  }

  private async findLabelCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const labels = await this.labelsService.findAll();
    const q = query.trim().toLowerCase();
    const exact = labels.filter((l) => l.name?.toLowerCase() === q);
    const fuzzy = labels.filter((l) => this.textIncludes(l.name, q));
    return [...exact, ...fuzzy].map((l) => ({ id: l.id, display: l.name }));
  }

  private async findWorkflowCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const workflows = await this.workflowsService.findAll();
    const q = query.trim().toLowerCase();
    const exact = workflows.filter((w) => w.name?.toLowerCase() === q);
    const fuzzy = workflows.filter((w) => this.textIncludes(w.name, q));
    return [...exact, ...fuzzy].map((w) => ({ id: w.id, display: w.name }));
  }

  private async findStatusCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const statuses = await this.statusesService.findAll();
    const q = query.trim().toLowerCase();
    const exact = statuses.filter((s) => s.name?.toLowerCase() === q);
    const fuzzy = statuses.filter((s) => this.textIncludes(s.name, q));
    return [...exact, ...fuzzy].map((s) => ({
      id: s.id,
      display: `${s.name} (${s.category})`,
    }));
  }

  private async findIssueTypeCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const types = await this.issueTypesService.findAll();
    const q = query.trim().toLowerCase();
    const exact = types.filter((t) => t.name?.toLowerCase() === q);
    const fuzzy = types.filter((t) => this.textIncludes(t.name, q));
    return [...exact, ...fuzzy].map((t) => ({ id: t.id, display: t.name }));
  }

  private async findPriorityCandidates(
    query: string,
  ): Promise<Array<{ id: string; display: string }>> {
    const priorities = await this.prioritiesService.findAll();
    const q = query.trim().toLowerCase();
    const exact = priorities.filter((p) => p.name?.toLowerCase() === q);
    const fuzzy = priorities.filter((p) => this.textIncludes(p.name, q));
    return [...exact, ...fuzzy].map((p) => ({
      id: p.id,
      display: p.name,
    }));
  }

  private async findTransitionCandidates(
    query: string,
    payload: Record<string, unknown>,
  ): Promise<Array<{ id: string; display: string }>> {
    const workflowId = this.readString(payload, ['workflowId']);
    if (!this.isUuid(workflowId)) return [];
    const transitions = await this.workflowsService.getTransitions(workflowId!);
    const q = query.trim().toLowerCase();
    const toName = (t: (typeof transitions)[number]) =>
      `${t.fromStatus?.name ?? '?'} -> ${t.toStatus?.name ?? '?'}`;
    const exact = transitions.filter(
      (t) =>
        t.id.toLowerCase() === q ||
        toName(t).toLowerCase() === q ||
        t.id.toLowerCase().startsWith(q),
    );
    const fuzzy = transitions.filter((t) => {
      const name = toName(t).toLowerCase();
      const id = t.id.toLowerCase();
      return name.includes(q) || id.includes(q);
    });
    return this.uniqueById([...exact, ...fuzzy]).map((t) => ({
      id: t.id,
      display: toName(t),
    }));
  }

  private async findBoardCandidates(
    query: string,
    payload: Record<string, unknown>,
  ): Promise<Array<{ id: string; display: string }>> {
    const sourceProjectId = this.readString(payload, ['projectId']);
    const boards = this.isUuid(sourceProjectId)
      ? await this.boardsService.findByProject(sourceProjectId!)
      : await this.findBoardsAcrossProjects();
    const q = query.trim().toLowerCase();
    const exact = boards.filter((b) => b.name?.toLowerCase() === q);
    const fuzzy = boards.filter((b) => this.textIncludes(b.name, q));
    return [...exact, ...fuzzy].map((b) => ({
      id: b.id,
      display: b.name,
    }));
  }

  private async findSprintCandidates(
    query: string,
    payload: Record<string, unknown>,
  ): Promise<Array<{ id: string; display: string }>> {
    const sourceBoardId = this.readString(payload, ['boardId']);
    const boardIds: string[] = [];
    if (this.isUuid(sourceBoardId)) {
      boardIds.push(sourceBoardId!);
    } else {
      const projectId = this.readString(payload, ['projectId']);
      if (this.isUuid(projectId)) {
        const boards = await this.boardsService.findByProject(projectId!);
        boardIds.push(...boards.map((b) => b.id));
      } else {
        const boards = await this.findBoardsAcrossProjects();
        boardIds.push(...boards.map((b) => b.id));
      }
    }
    const all = await Promise.all(
      boardIds.slice(0, 20).map((id) => this.sprintsService.findByBoard(id)),
    );
    const sprints = all.flat();
    const q = query.trim().toLowerCase();
    const exact = sprints.filter((s) => s.name?.toLowerCase() === q);
    const fuzzy = sprints.filter((s) => this.textIncludes(s.name, q));
    return [...exact, ...fuzzy].map((s) => ({
      id: s.id,
      display: `${s.name} (${s.status})`,
    }));
  }

  private async findBoardsAcrossProjects() {
    const projects = await this.projectsService.findAll();
    const groups = await Promise.all(
      projects.slice(0, 20).map((p) => this.boardsService.findByProject(p.id)),
    );
    return this.uniqueById(groups.flat());
  }

  private async buildEntityContext(
    conversationId: string,
  ): Promise<ChatEntityContext> {
    const recent = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
    const ctx: ChatEntityContext = {};
    for (const m of recent) {
      const text = m.content;
      const issue = text.match(/Created issue:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.issueId && issue) ctx.issueId = issue[1];
      const issueVi = text.match(/Đã tạo issue:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.issueId && issueVi) ctx.issueId = issueVi[1];
      const project = text.match(/Created project:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.projectId && project) ctx.projectId = project[1];
      const board = text.match(/Created board:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.boardId && board) ctx.boardId = board[1];
      const sprint = text.match(/Created sprint:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.sprintId && sprint) ctx.sprintId = sprint[1];
      const workflow = text.match(/Created workflow:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.workflowId && workflow) ctx.workflowId = workflow[1];
      const label = text.match(/Created label:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.labelId && label) ctx.labelId = label[1];
      const role = text.match(/Created role:[^[]*\[([0-9a-f-]{36})\]/i);
      if (!ctx.roleId && role) ctx.roleId = role[1];
      const user = text.match(/User deleted\.\s*\[?([0-9a-f-]{36})\]?/i);
      if (!ctx.targetUserId && user) ctx.targetUserId = user[1];
      if (ctx.issueId && ctx.projectId && ctx.boardId && ctx.sprintId) break;
    }
    return ctx;
  }

  /** Normalize curly/smart quotes so regex extractors match reliably (EN/VI UI paste). */
  private normalizeUtteranceForExtraction(utterance: string): string {
    return utterance
      .replace(/\u201c/g, '"')
      .replace(/\u201d/g, '"')
      .replace(/\u2018/g, "'")
      .replace(/\u2019/g, "'");
  }

  /** User-visible success line without prepending stale model text (EN/VI). */
  private actionSuccess(locale: ChatLocale, en: string, vi: string): string {
    return locale === 'vi' ? vi : en;
  }

  /** Issue key (PROJ-1) or quoted title fragment for search-based resolution. */
  private extractIssueSearchQueryFromUtterance(
    utterance: string,
  ): string | undefined {
    const u = this.normalizeUtteranceForExtraction(utterance.trim());
    const key = u.match(/\b([A-Z][A-Z0-9]{0,20}-\d+)\b/);
    if (key?.[1]) {
      return key[1].trim();
    }
    const key2 = u.match(
      /\b(?:issue|ticket)\s+#?\s*([A-Z][A-Z0-9]{0,20}-\d+)\b/i,
    );
    if (key2?.[1]) {
      return key2[1].trim();
    }
    const q = `["']`;
    const quoted = u.match(
      new RegExp(`\\b(?:issue|ticket)\\s+${q}([^"']+)${q}`, 'i'),
    );
    if (quoted?.[1]?.trim()) {
      return quoted[1].trim();
    }
    return undefined;
  }

  private extractAssigneeHintFromUtterance(
    utterance: string,
  ): string | undefined {
    const u = this.normalizeUtteranceForExtraction(utterance.trim());
    const email = u.match(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i);
    if (email?.[0]) {
      return email[0].trim();
    }
    const assignTo = u.match(
      /\b(?:assign|giao)\s+(?:to|cho)\s+["']?([^"'\n,]+?)["']?(?:\s*[.,]|$)/i,
    );
    if (assignTo?.[1]?.trim()) {
      return assignTo[1].trim();
    }
    return undefined;
  }

  /** Target status name for transition (EN/VI phrasing). */
  private extractStatusNameFromUtterance(
    utterance: string,
  ): string | undefined {
    const u = this.normalizeUtteranceForExtraction(utterance.trim());
    const q = `["']`;
    const en = u.match(
      new RegExp(
        `(?:move|transition|to)\\s+(?:issue\\s+)?(?:to\\s+)?status\\s+${q}([^"']+)${q}`,
        'i',
      ),
    );
    if (en?.[1]?.trim()) {
      return en[1].trim();
    }
    const vi = u.match(
      new RegExp(
        `chuyển\\s+(?:sang\\s+)?(?:trạng\\s+thái\\s+)?${q}([^"']+)${q}`,
        'i',
      ),
    );
    if (vi?.[1]?.trim()) {
      return vi[1].trim();
    }
    const vi2 = u.match(/sang\s+trạng\s+thái\s+["']([^"']+)["']/i);
    if (vi2?.[1]?.trim()) {
      return vi2[1].trim();
    }
    return undefined;
  }

  /** Pull human-readable project name from user text when the model omits payload fields. */
  private extractProjectNameFromUtterance(
    utterance: string,
  ): string | undefined {
    const u = this.normalizeUtteranceForExtraction(utterance.trim());
    // Support straight " ' and curly “ ” around titles
    const q = `["'\u201c\u201d]`;
    const patterns: RegExp[] = [
      new RegExp(`project\\s+có\\s+title\\s+${q}([^"'\u201c\u201d]+)${q}`, 'i'),
      new RegExp(
        `dự\\s+án\\s+có\\s+title\\s+${q}([^"'\u201c\u201d]+)${q}`,
        'i',
      ),
      new RegExp(
        `trong\\s+(?:dự\\s+án|project)\\s+${q}([^"'\u201c\u201d]+)${q}`,
        'i',
      ),
      /in\s+(?:the\s+)?project\s+with\s+title\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      /project\s+with\s+title\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      /name\s+of\s+project\s+is\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      /project\s+(?:is|named|called|titled)\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      /in\s+(?:the\s+)?project\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      /\b(?:in|for)\s+project\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      /\bproject\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
    ];
    for (const re of patterns) {
      const m = u.match(re);
      if (m?.[1]?.trim()) {
        return m[1].trim();
      }
    }
    return undefined;
  }

  /** Pull issue summary/title from user text when the model omits it (avoids matching project-only lines). */
  private extractIssueSummaryFromUtterance(
    utterance: string,
  ): string | undefined {
    const u = this.normalizeUtteranceForExtraction(utterance.trim());
    const q = `["'\u201c\u201d]`;

    const viIssueTitle = u.match(
      new RegExp(`issue\\s+title\\s+là\\s+${q}([^"'\u201c\u201d]+)${q}`, 'i'),
    );
    if (viIssueTitle?.[1]?.trim()) {
      return viIssueTitle[1].trim();
    }
    const viTieuDe = u.match(
      new RegExp(
        `tiêu\\s+đề\\s+issue\\s+là\\s+${q}([^"'\u201c\u201d]+)${q}`,
        'i',
      ),
    );
    if (viTieuDe?.[1]?.trim()) {
      return viTieuDe[1].trim();
    }

    const a = u.match(
      /this\s+new\s+issue\s+should\s+be\s+with\s+title\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
    );
    if (a?.[1]?.trim()) {
      return a[1].trim();
    }
    const b = u.match(
      /new\s+issue\s+should\s+be\s+with\s+title\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
    );
    if (b?.[1]?.trim()) {
      return b[1].trim();
    }
    const c = u.match(
      /\bissue\s+titled\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
    );
    if (c?.[1]?.trim()) {
      return c[1].trim();
    }
    const d = u.match(
      /\bissue\s+title\s+is\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
    );
    if (d?.[1]?.trim()) {
      return d[1].trim();
    }
    const parts = u
      .split(/\?/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const m = last.match(
        /with\s+title\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/i,
      );
      if (m?.[1]?.trim()) {
        return m[1].trim();
      }
    }
    const withTitles = [
      ...u.matchAll(
        /with\s+title\s+["'\u201c\u201d]([^"'\u201c\u201d]+)["'\u201c\u201d]/gi,
      ),
    ];
    if (withTitles.length >= 2) {
      return withTitles[withTitles.length - 1][1].trim();
    }
    // Vietnamese: second "có title" in a sentence is often the issue when two quoted names appear
    const coTitleAll = [
      ...u.matchAll(
        new RegExp(`có\\s+title\\s+${q}([^"'\u201c\u201d]+)${q}`, 'gi'),
      ),
    ];
    if (coTitleAll.length >= 2) {
      return coTitleAll[coTitleAll.length - 1][1].trim();
    }
    return undefined;
  }

  private enrichDecisionFromUtterance(
    decision: ActionDecision,
    utterance: string,
    context: ChatEntityContext,
  ): ActionDecision {
    const payload = this.toPayloadRecord(decision);
    const text = utterance.trim().toLowerCase();
    const hasIssueRef =
      /that\s*issue|this\s*issue|issue vừa tạo|issue moi tao|vừa tạo issue|thatisssue/i.test(
        text,
      );
    const looksLikeAdminRef = /\badmin\b/i.test(text);

    const setIfMissing = (key: string, value: string | undefined) => {
      if (!value) return;
      const current = payload[key];
      if (typeof current === 'string' && current.trim()) return;
      payload[key] = value;
    };

    if (
      [
        'assign_issue',
        'update_issue',
        'transition_issue',
        'add_comment',
      ].includes(decision.intent) &&
      hasIssueRef
    ) {
      setIfMissing('issueId', context.issueId);
    }

    const enrichIssueRefIfMissing = () => {
      const issueIdRaw = this.readString(payload, ['issueId']);
      const hasIssue =
        (issueIdRaw && this.isUuid(issueIdRaw)) ||
        !!this.readString(payload, ['issue', 'summary', 'name', 'key']);
      if (!hasIssue) {
        const q = this.extractIssueSearchQueryFromUtterance(utterance);
        if (q) {
          setIfMissing('issue', q);
        }
      }
    };

    if (
      [
        'get_issue',
        'update_issue',
        'assign_issue',
        'transition_issue',
        'add_comment',
        'add_issue_label',
        'remove_issue_label',
      ].includes(decision.intent)
    ) {
      enrichIssueRefIfMissing();
    }

    if (decision.intent === 'transition_issue') {
      if (
        !this.readString(payload, [
          'statusId',
          'status',
          'statusName',
          'toStatus',
          'toStatusName',
        ])
      ) {
        const st = this.extractStatusNameFromUtterance(utterance);
        if (st) {
          setIfMissing('toStatusName', st);
        }
      }
    }

    if (decision.intent === 'assign_issue') {
      if (looksLikeAdminRef) {
        setIfMissing('assignee', 'admin');
        setIfMissing('assigneeName', 'admin');
        setIfMissing('username', 'admin');
      }
      // If user asks "assign that issue to X" and parser missed issue field.
      if (
        !this.readString(payload, ['issueId', 'issue', 'summary']) &&
        context.issueId
      ) {
        setIfMissing('issueId', context.issueId);
      }
      if (
        !this.readString(payload, [
          'assigneeId',
          'assignee',
          'assigneeName',
          'assigneeEmail',
          'username',
          'email',
        ])
      ) {
        const hint = this.extractAssigneeHintFromUtterance(utterance);
        if (hint) {
          setIfMissing('assigneeName', hint);
        }
      }
    }

    const enrichProjectNameIfMissing = () => {
      const projectIdRaw = this.readString(payload, ['projectId']);
      const hasResolvedProject =
        (projectIdRaw && this.isUuid(projectIdRaw)) ||
        !!this.readString(payload, [
          'project',
          'projectName',
          'projectKey',
          'key',
        ]);
      if (!hasResolvedProject) {
        const fromUtterance = this.extractProjectNameFromUtterance(utterance);
        if (fromUtterance) {
          setIfMissing('projectName', fromUtterance);
        }
      }
      if (
        /\b(?:project|dự\s*án)\b/i.test(utterance) &&
        !this.readString(payload, ['project', 'projectName', 'projectKey']) &&
        !(projectIdRaw && this.isUuid(projectIdRaw))
      ) {
        if (context.projectId) {
          setIfMissing('projectId', context.projectId);
        }
      }
    };

    if (decision.intent === 'create_issue') {
      enrichProjectNameIfMissing();

      if (!this.readString(payload, ['summary', 'title', 'issueTitle'])) {
        const summary = this.extractIssueSummaryFromUtterance(utterance);
        if (summary) {
          setIfMissing('summary', summary);
        }
      }
      if (
        !this.readString(payload, [
          'assigneeId',
          'assignee',
          'assigneeName',
          'assigneeEmail',
          'username',
          'email',
        ])
      ) {
        const hint = this.extractAssigneeHintFromUtterance(utterance);
        if (hint) {
          setIfMissing('assigneeName', hint);
        }
      }
    }

    if (
      [
        'list_project_issues',
        'update_project',
        'create_board',
        'create_workflow',
      ].includes(decision.intent)
    ) {
      enrichProjectNameIfMissing();
    }

    return { ...decision, payload: payload as ActionDecision['payload'] };
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
