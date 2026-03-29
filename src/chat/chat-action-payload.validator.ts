/** Returns a user-facing error message, or null if payload is usable for the intent. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (payload === undefined || payload === null) return {};
  if (typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function str(
  payload: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const v = payload[key];
  if (typeof v !== 'string' || !v.trim()) {
    return `${label} is required and must be a non-empty string.`;
  }
  return null;
}

function uuid(
  payload: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const v = payload[key];
  if (typeof v !== 'string' || !UUID_RE.test(v.trim())) {
    return `${label} must be a valid UUID.`;
  }
  return null;
}

/** Optional UUID: if present, must be valid */
function optUuid(
  payload: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const v = payload[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || !UUID_RE.test(v.trim())) {
    return `${label} must be a valid UUID when provided.`;
  }
  return null;
}

export function validateChatActionPayload(
  intent: string,
  payloadUnknown: unknown,
): string | null {
  if (intent === 'none') return null;

  const payload = asRecord(payloadUnknown);
  if (payload === null) return 'payload must be a JSON object.';

  const checks: (string | null)[] = [];

  switch (intent) {
    case 'search_global':
      checks.push(str(payload, 'query', 'query'));
      break;
    case 'get_issue':
    case 'update_issue':
    case 'assign_issue':
      checks.push(uuid(payload, 'issueId', 'issueId'));
      break;
    case 'transition_issue':
      checks.push(uuid(payload, 'issueId', 'issueId'));
      checks.push(uuid(payload, 'statusId', 'statusId'));
      break;
    case 'add_comment':
      checks.push(uuid(payload, 'issueId', 'issueId'));
      checks.push(str(payload, 'content', 'content'));
      break;
    case 'list_project_issues':
      checks.push(uuid(payload, 'projectId', 'projectId'));
      break;
    case 'list_sprint_issues':
      checks.push(uuid(payload, 'sprintId', 'sprintId'));
      break;
    case 'create_issue':
      checks.push(uuid(payload, 'projectId', 'projectId'));
      checks.push(str(payload, 'summary', 'summary'));
      checks.push(optUuid(payload, 'typeId', 'typeId'));
      checks.push(optUuid(payload, 'priorityId', 'priorityId'));
      checks.push(optUuid(payload, 'statusId', 'statusId'));
      checks.push(optUuid(payload, 'assigneeId', 'assigneeId'));
      checks.push(optUuid(payload, 'reporterId', 'reporterId'));
      checks.push(optUuid(payload, 'sprintId', 'sprintId'));
      break;
    case 'create_project':
      checks.push(str(payload, 'key', 'key'));
      checks.push(str(payload, 'name', 'name'));
      checks.push(str(payload, 'projectType', 'projectType'));
      break;
    case 'update_project':
      checks.push(uuid(payload, 'projectId', 'projectId'));
      break;
    case 'create_board':
      checks.push(uuid(payload, 'projectId', 'projectId'));
      checks.push(str(payload, 'name', 'name'));
      checks.push(str(payload, 'boardType', 'boardType'));
      break;
    case 'update_board':
      checks.push(uuid(payload, 'boardId', 'boardId'));
      break;
    case 'create_sprint':
      checks.push(uuid(payload, 'boardId', 'boardId'));
      checks.push(str(payload, 'name', 'name'));
      break;
    case 'update_sprint':
    case 'start_sprint':
    case 'complete_sprint':
      checks.push(uuid(payload, 'sprintId', 'sprintId'));
      break;
    case 'list_labels':
    case 'list_workflows':
      break;
    case 'create_label':
      checks.push(str(payload, 'name', 'name'));
      break;
    case 'update_label':
    case 'delete_label':
      checks.push(uuid(payload, 'labelId', 'labelId'));
      break;
    case 'add_issue_label':
    case 'remove_issue_label':
      checks.push(uuid(payload, 'issueId', 'issueId'));
      checks.push(uuid(payload, 'labelId', 'labelId'));
      break;
    case 'get_workflow':
    case 'update_workflow':
    case 'delete_workflow':
    case 'list_workflow_transitions':
      checks.push(uuid(payload, 'workflowId', 'workflowId'));
      break;
    case 'create_workflow':
      checks.push(str(payload, 'name', 'name'));
      checks.push(optUuid(payload, 'projectId', 'projectId'));
      break;
    case 'add_workflow_transition':
      checks.push(uuid(payload, 'workflowId', 'workflowId'));
      checks.push(uuid(payload, 'fromStatusId', 'fromStatusId'));
      checks.push(uuid(payload, 'toStatusId', 'toStatusId'));
      break;
    case 'remove_workflow_transition':
      checks.push(uuid(payload, 'workflowId', 'workflowId'));
      checks.push(uuid(payload, 'transitionId', 'transitionId'));
      break;
    case 'admin_create_role':
      checks.push(str(payload, 'name', 'name'));
      break;
    case 'admin_update_role':
    case 'admin_delete_role':
      checks.push(uuid(payload, 'roleId', 'roleId'));
      break;
    case 'admin_assign_project_role':
    case 'admin_remove_project_role':
      checks.push(uuid(payload, 'projectId', 'projectId'));
      checks.push(uuid(payload, 'roleId', 'roleId'));
      checks.push(uuid(payload, 'targetUserId', 'targetUserId'));
      break;
    case 'admin_delete_user':
      checks.push(uuid(payload, 'targetUserId', 'targetUserId'));
      break;
    default:
      return null;
  }

  const first = checks.find((c) => c !== null);
  return first ?? null;
}
