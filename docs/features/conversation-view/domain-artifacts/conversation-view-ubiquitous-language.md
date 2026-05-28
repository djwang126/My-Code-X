# Ubiquitous Language — Conversation View

## ConversationReading

| Term | Definition | Aliases / Disambiguation |
|------|------------|--------------------------|
| Active Turn | A Turn whose status is `Active`, i.e., user message received and agent reply not yet definitively complete | Not a "running" agent; the agent may have produced replies and continued working |
| Agent Reply | A message from Agent CLI, displayed as normal conversation content; may be InProgress (streaming) or Completed | Not a "response"; not a "result" |
| Conversation | The aggregate that owns the ordered message list, content state, and failure index for one dialogue session | Not "chat"; not "thread" |
| Conversation Content State | Discriminated union representing whether the conversation is Restoring / RestoreFailed / Empty / Live(syncStatus) | Replaces a `status: enum + optional fields` bag of booleans |
| Conversation Item | An ordered entry in the conversation timeline; carries one of five content variants (UserMessage / AgentReply / WorkProgress / Failure / Unrecognized) | Not "Message" (UserMessage is one variant of ConversationItem) |
| Duplicate Failure | A subsequent FailureReported event whose failureId already exists in the conversation's failureIndex; routed to repeatCount increment rather than a new item | Not a new failure |
| Failure | Item content variant representing an error reported by Agent CLI during its work; carries failureId, errorMessage, repeatCount | Not a My-Code-X system error; not a Notice |
| Failure Index | Map\<FailureId, ItemId\> on Conversation; routes incoming failures to either dedup increment or new item creation | Implementation note: domain concept, not technical detail |
| First User Message Item Id | The ItemId of the user message that started a Turn; held by Turn aggregate by ID reference only | Not the message itself |
| Item Type | The variant tag of a ConversationItem's content (UserMessage / AgentReply / WorkProgress / Failure / Unrecognized) | Determined at construction; immutable; mapped from agent CLI events at the ACL boundary |
| Last Agent Reply Item Id | The ItemId of the final agent reply in a completed Turn; only present in TurnStatus = Completed | Absent in Active turns by type (discriminated union), not by null |
| Live | Conversation content state where readable content is available; carries a syncStatus (Current / Syncing / Reconnecting / Stale) | Not the connection state; describes content freshness |
| Markdown Content | Text body of UserMessage or AgentReply; supports Markdown rendering, code blocks, tables, images | The original payload — copy button surfaces exactly this |
| Repeat Count | Counter on a Failure item, ≥ 1, incremented on each DuplicateFailure | Monotonic; only increases |
| Reply Status | Discriminated state of AgentReply (InProgress → Completed) | Forward-only state machine |
| Restoring | Initial state of conversation content while content is being loaded from upstream | Not "Loading" (Loading is a UI term) |
| Sync Status | Substate of Live (Current / Syncing / Reconnecting / Stale); drives non-blocking banner display | Distinct from connection state; expresses content freshness perception |
| Toolbar | A row beneath the first user message and the last agent reply of a completed Turn; holds time, copy, and future extensions | Only visible after Turn completion (TurnStatus = Completed) |
| Turn | A complete interaction round from user input to agent reply completion; aggregate carrying TurnStatus state machine | One Turn contains at least one user message item and one agent reply item; toolbar visibility derives from TurnStatus |
| Turn Completion Policy | A domain Policy that decides whether an AgentSignal ends an Active Turn; varies by agent CLI type | DD-002; externalized because codex and claude code signal completion differently |
| Turn Status | Discriminated state of Turn (Active → Completed); Completed carries lastAgentReplyItemId, Active does not | Type-encoded; impossible to read lastAgentReplyItemId during an Active turn |
| Unrecognized Information | Item content variant for upstream events the inbound ACL cannot map to known categories; preserves raw payload | Not an error; not a failure; product spec line 61 forbids silent drop |
| Work Progress | Item content variant representing agent work artifacts (reasoning, tool calls, file changes, searches); carries progressType, summary, status, optional detail | Not the final reply; not a Message |
| Work Progress Status | Forward-only state machine (InProgress → Completed / Failed) on a WorkProgress item | Status reversal raises WorkProgressStatusReversal |

## Composer

| Term | Definition | Aliases / Disambiguation |
|------|------------|--------------------------|
| Agent Status | Subfield of ComposerAvailability.Available indicating agent is Idle or Working; drives main button function (send / supplement / interrupt) | Read from Agent CLI as published language; not modeled inside Composer |
| Composer Availability | Discriminated state of ComposerSession (Disabled\{reason\} / Available\{agentStatus\}) | Replaces a `disabled: bool + reason: optional` bag |
| Composer Session | The aggregate owning a single conversation's draft, availability, and interrupt confirmation state | One session per conversation; bound by ConversationId |
| Disabled Reason | Discriminated cause of a Disabled ComposerAvailability (NoConversationSelected / ContentRestoring / ConnectionUnavailable / StateUnclear) | Each reason maps to a UI hint |
| Draft | The unsent text content in the Composer, persisted per conversation; cleared only after upstream acceptance | Not a message; not a sent input |
| Empty Draft | A draft whose text is the empty string; allowed as a state but cannot trigger send | EmptyDraftCannotBeSent domain error |
| Interrupt Confirmation State | Discriminated state (Idle / AwaitingConfirmation) gating the destructive interrupt action | Two-step confirmation; product spec line 218, 228 |
| Send Result | Discriminated upstream response (Accepted / Rejected\{error\}) used to decide draft clear vs preserve | Comes from infrastructure; translated at boundary |
| Supplement | An input sent while AgentStatus = Working; carries text just like a normal Send | Same payload; different precondition |

## Notice

| Term | Definition | Aliases / Disambiguation |
|------|------------|--------------------------|
| Active Notice | A notice currently on the NoticeBoard; carries NoticeId, NoticeType, message, lifecycle | Not the abstract notice type; this is the materialized instance |
| Notice Board | The aggregate (singleton per page) managing all active notices and stacking rules | Not a list; an aggregate with invariants |
| Notice Lifecycle | Discriminated VO (Transient\{expiresAfter\} / Persistent) constructed at notice creation; immutable thereafter | Replaces an `isPersistent: bool + expiresAfter: optional` pair |
| Notice Type | Semantic category of a notice (e.g., ConnectionLost, SendFailed, RestoreFailed); used for resolution routing | Allows ResolveNotice to find the right active notice |
| Persistent Notice | A notice that must be removed via ResolveNotice; never auto-expires | Used for ongoing states (connection lost, syncing) per product spec line 172 |
| Transient Notice | A notice that auto-removes after expiresAfter elapses | Used for one-shot events (send failed) per product spec line 172 |

## Cross-Context (External)

| Term | Definition | Aliases / Disambiguation |
|------|------------|--------------------------|
| Agent CLI | The external CLI agent (codex / claude code) connected via My-Code-X backend; upstream of Conversation View | Not the My-Code-X app itself; not the backend |
| Agent CLI Inbound ACL | The anti-corruption layer that translates heterogeneous agent CLI native events into the four canonical ConversationReading information categories | One ACL per integration; codex and claude code share the same port but have different adapters |
| Agent Signal | A normalized signal class consumed by TurnCompletionPolicy (ReplyCompleted / AgentTaskFinished / AgentIdle) | Translated from agent CLI native events at the ACL boundary |
| Live Connection | Real-time channel between My-Code-X frontend and backend; produces LiveConnectionLost / LiveConnectionReconnected events | Frontend ↔ backend only; backend ↔ AgentCLI health is absorbed by ConversationReading sync state |

## Cross-Context Terms (Disambiguation)

| Term | ConversationReading Meaning | Composer Meaning | Resolution |
|------|------------------------------|-------------------|------------|
| Status | A field on ConversationItem / Turn (ReplyStatus, WorkProgressStatus, TurnStatus) describing content lifecycle | Subfield of ComposerAvailability describing agent activity (Idle / Working) | Always qualify: TurnStatus, ReplyStatus, AgentStatus, ComposerAvailability — never bare "status" |
| Failure | A ConversationItem variant displayed inside the message list, sourced from Agent CLI | A Composer outcome (SendFailed) routed to Notice as a transient banner | ConversationReading: Failure (item); Composer: SendFailed (event). Different sources, different display channels |
| Send | A Composer command (SendMessage / SendSupplement) initiating an outbound input | n/a | Single-context term; no conflict |
| Available | Substate of ComposerAvailability indicating Composer can act | n/a | Single-context term |

## Rejected Aliases

| Term Considered | Rejected For | Reason |
|-----------------|--------------|--------|
| Message | ConversationItem | "Message" loses the four-category distinction; ConversationItem is the canonical neutral term |
| Chat | Conversation | "Chat" is a UI/product surface term; we say Conversation |
| Loading | Restoring | "Loading" is a UI/technical term; Restoring is the business concept (rebuilding state from upstream) |
| Error | Failure | "Error" mixes technical and business; Failure is the agent-cli-reported business outcome inside a conversation |
| Banner | Notice | "Banner" is the UI form; Notice is the domain concept |
| isPersistent / isTransient | NoticeLifecycle variants | Boolean pair allows impossible combinations; discriminated union forbids them |
| disabled flag | ComposerAvailability variants | Same — booleans + optionals allow invalid states |
