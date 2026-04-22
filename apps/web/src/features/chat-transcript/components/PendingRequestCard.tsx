import type { PendingRequestCardProps } from '../types';
import { ApprovalRequestCard } from './pending-request-card/ApprovalRequestCard';
import { AuthRefreshRequestCard } from './pending-request-card/AuthRefreshRequestCard';
import { McpElicitationRequestCard } from './pending-request-card/McpElicitationRequestCard';
import { ToolCallRequestCard } from './pending-request-card/ToolCallRequestCard';
import { UserInputRequestCard } from './pending-request-card/UserInputRequestCard';

export function PendingRequestCard(props: PendingRequestCardProps) {
  const { request, onRequestResponse } = props;

  switch (request.kind) {
    case 'command_approval':
    case 'file_change_approval':
    case 'permissions_approval':
    case 'legacy_patch_approval':
    case 'legacy_command_approval':
      return <ApprovalRequestCard request={request} onRequestResponse={onRequestResponse} />;
    case 'user_input':
      return <UserInputRequestCard {...props} />;
    case 'mcp_elicitation':
      return <McpElicitationRequestCard request={request} onRequestResponse={onRequestResponse} />;
    case 'tool_call':
      return <ToolCallRequestCard request={request} onRequestResponse={onRequestResponse} />;
    case 'auth_refresh':
      return <AuthRefreshRequestCard request={request} onRequestResponse={onRequestResponse} />;
    default:
      return null;
  }
}
