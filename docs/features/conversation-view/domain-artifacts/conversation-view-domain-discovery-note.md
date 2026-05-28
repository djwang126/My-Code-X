# Domain Discovery Note — Conversation View

## 1. Domain Event Timeline

| # | Event Name | Trigger (Command) | Key Data | Classification |
|---|------------|--------------------|----------|----------------|
| 1 | ConversationSelected | SelectConversation | conversationId | pivotal |
| 2 | ConversationContentRestoreSucceeded | RestoreConversationContent | conversationId, messages | pivotal |
| 3 | ConversationContentRestoreFailed | RestoreConversationContent | conversationId, error | supporting |
| 4 | UserMessageReceived | ReceiveUserMessage | conversationId, messageContent | pivotal |
| 5 | AgentReplyStarted | StartReply | conversationId | supporting |
| 6 | AgentReplyCompleted | CompleteReply | conversationId, replyContent | pivotal |
| 7 | TurnCompleted | (Policy: derived from AgentReplyCompleted) | conversationId, turnIndex | pivotal |
| 8 | WorkProgressReceived | ReportWorkProgress | conversationId, progressType, summary | supporting |
| 9 | WorkProgressStatusChanged | UpdateWorkProgressStatus | conversationId, progressId, newStatus | supporting |
| 10 | FailureReported | ReportFailure | conversationId, failureId, errorMessage | pivotal |
| 11 | DuplicateFailureReported | ReportFailure | conversationId, failureId, repeatCount | edge |
| 12 | UnrecognizedInformationReceived | ReportInformation | conversationId, rawPayload | supporting |
| 13 | NoticeRaised | RaiseNotice | noticeType, message, persistent | supporting |
| 14 | NoticeResolved | ResolveNotice | noticeType | supporting |
| 15 | MessageSent | SendMessage | conversationId, messageContent | pivotal |
| 16 | SupplementSent | SendSupplement | conversationId, messageContent | supporting |
| 17 | InterruptConfirmed | ConfirmInterrupt | conversationId | pivotal |
| 18 | InterruptExecuted | ExecuteInterrupt | conversationId | pivotal |
| 19 | SendFailed | SendMessage | conversationId, error | supporting |
| 20 | LiveConnectionLost | DetectConnectionLoss | conversationId | supporting |
| 21 | LiveConnectionReconnected | Reconnect | conversationId | supporting |

## 2. Command → Actor Mapping

| Command | Actor | Preconditions | Triggers Event |
|---------|-------|---------------|----------------|
| SelectConversation | User | App is open | ConversationSelected |
| RestoreConversationContent | My-Code-X | Conversation selected | RestoreSucceeded / RestoreFailed |
| ReceiveUserMessage | My-Code-X | Message confirmed by upstream | UserMessageReceived |
| StartReply | Agent CLI | User message received | AgentReplyStarted |
| CompleteReply | Agent CLI | Reply in progress | AgentReplyCompleted |
| ReportWorkProgress | Agent CLI | Agent working | WorkProgressReceived |
| UpdateWorkProgressStatus | Agent CLI | Progress item exists | WorkProgressStatusChanged |
| ReportFailure | Agent CLI | Agent working | FailureReported / DuplicateFailureReported |
| ReportInformation | Agent CLI | Agent working | UnrecognizedInformationReceived |
| RaiseNotice | My-Code-X | Error or state change detected | NoticeRaised |
| ResolveNotice | My-Code-X | Persistent notice active, state recovered | NoticeResolved |
| SendMessage | User | Composer enabled, non-empty input, agent idle | MessageSent / SendFailed |
| SendSupplement | User | Composer enabled, non-empty input, agent working | SupplementSent / SendFailed |
| ConfirmInterrupt | User | Agent working, interrupt modal shown | InterruptConfirmed |
| ExecuteInterrupt | My-Code-X | Interrupt confirmed | InterruptExecuted |
| DetectConnectionLoss | My-Code-X | Live connection active | LiveConnectionLost |
| Reconnect | My-Code-X | Connection lost | LiveConnectionReconnected |