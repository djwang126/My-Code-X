# Domain Model — Conversation View

## Related Artifacts

- [Ubiquitous Language](./domain-artifacts/conversation-view-ubiquitous-language.md)
- [Context Map](./domain-artifacts/conversation-view-domain-context-map.yaml)
- [Design Decisions](./domain-artifacts/conversation-view-design-decisions.md)
- [Discovery Note](./domain-artifacts/conversation-view-domain-discovery-note.md)

## Context Overview

| Context | Type | Responsibility |
|---------|------|----------------|
| ConversationReading | core | Owns conversation content lifecycle — selection, restore, ordered display, classification into four canonical information types. Hosts AgentCLIInboundACL and TurnCompletionPolicy. |
| Composer | core | Owns user input — per-conversation drafts, send / supplement / interrupt actions, availability coordinated with conversation restore state. |
| Notice | supporting | Owns page-level non-message banner prompts — transient vs persistent lifecycle, stacking rules. |
| AgentCLI | generic (external) | External CLI agent (codex / claude code); heterogeneous native events ACL'd at inbound boundary. |
| LiveConnection | generic (external) | Frontend↔backend real-time channel; emits connect/disconnect signals. |

---

## Bounded Context: ConversationReading

### Aggregate: Conversation

#### Structure

| Role | Name | Type | Notes |
|------|------|------|-------|
| Aggregate Root | Conversation | Entity | identity = ConversationId |
| Value Object | ConversationId | VO | opaque immutable identifier |
| Value Object | ConversationContentState | VO (tagged union) | state machine |
| Value Object | SyncStatus | VO (enum) | substate of Live |
| Value Object | RestoreError | VO | error detail in RestoreFailed |
| Value Object | FailureId | VO | upstream-supplied identifier |
| Value Object | ItemId | VO | reference to ConversationItem |
| Value Object | AgentCliType | VO | drives TurnCompletionPolicy selection |

#### Fields — Conversation

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | ConversationId | required, immutable | identity |
| agentCliType | AgentCliType | required, immutable | selects per-CLI TurnCompletionPolicy |
| contentState | ConversationContentState | required | discriminated union, see state machine |
| items | ordered list of ItemId | append-only | display order |
| failureIndex | Map<FailureId, ItemId> | may be empty | dedup routing for FailureReported |

**ConversationContentState** (discriminated union)

```
ConversationContentState =
  | Restoring
  | RestoreFailed   { error: RestoreError }
  | Empty
  | Live            { syncStatus: SyncStatus }

SyncStatus = Current | Syncing | Reconnecting | Stale
```

Allowed transitions:
```
initial        → Restoring
Restoring      → RestoreFailed | Empty | Live(Current)
Live(_)        → Live(Current) | Live(Syncing) | Live(Reconnecting) | Live(Stale)
RestoreFailed  → Restoring
```

#### Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | contentState always equals exactly one valid variant | constructor + transition methods |
| 2 | items list is append-only (no remove, no reorder) | only `appendItem` method exists |
| 3 | failureIndex never contains two entries for the same failureId | `recordFailure` checks existence first |
| 4 | failureIndex[failureId] always points to an existing ConversationItem of Failure variant | enforced by recordFailure precondition |

#### Boundary Rationale

contentState transitions, item ordering, and failureId uniqueness are global invariants over the conversation. Splitting them across aggregates would require distributed consistency. Items themselves have independent lifecycles and are a separate aggregate referenced by ID.

#### Domain Events

| Event | Payload | Emitted When |
|-------|---------|--------------|
| ConversationSelected | conversationId | User selects a conversation |
| ConversationContentRestoreSucceeded | conversationId, [ItemId] | Restore completes with content |
| ConversationContentRestoreFailed | conversationId, RestoreError | Restore fails with no readable content |

#### Repository Port

```
interface ConversationRepository {
  findById(id: ConversationId): Conversation
    raises: ConversationNotFound
  save(conversation: Conversation): void
}
```

#### Domain Errors

| Error | Condition | Severity |
|-------|-----------|----------|
| ConversationNotFound | findById receives unknown ConversationId | not-found |

---

### Aggregate: ConversationItem

#### Structure

| Role | Name | Type | Notes |
|------|------|------|-------|
| Aggregate Root | ConversationItem | Entity | identity = ItemId |
| Value Object | ItemId | VO | opaque immutable identifier |
| Value Object | ItemContent | VO (tagged union) | one of five variants |
| Value Object | MessageContent | VO | markdown body, may be empty |
| Value Object | ReplyStatus | VO (enum) | InProgress / Completed |
| Value Object | WorkProgressStatus | VO (enum) | InProgress / Completed / Failed |
| Value Object | ProgressDetail | VO | optional expand body |
| Value Object | RepeatCount | VO | n ≥ 1 |
| Value Object | RawPayload | VO | preserved unrecognized data |

#### Fields — ConversationItem

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | ItemId | required, immutable | identity |
| conversationId | ConversationId | required, immutable | ref by ID only |
| content | ItemContent | required, variant immutable | variant tag never changes |

**ItemContent** (discriminated union)

```
ItemContent =
  | UserMessage    { body: MessageContent }
  | AgentReply     { body: MessageContent, status: ReplyStatus }
  | WorkProgress   { progressType: string, summary: string,
                     status: WorkProgressStatus, detail: ProgressDetail? }
  | Failure        { failureId: FailureId, errorMessage: string,
                     repeatCount: RepeatCount }
  | Unrecognized   { rawPayload: RawPayload }
```

Allowed transitions:
```
AgentReply:     InProgress → Completed
WorkProgress:   InProgress → Completed | Failed
Failure:        repeatCount monotonically increases (≥1)
UserMessage:    no transitions
Unrecognized:   no transitions
```

#### Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | Variant tag is fixed at construction (no reclassification) | constructor only, no setter |
| 2 | AgentReply.status is forward-only (InProgress → Completed) | `completeReply` method |
| 3 | AgentReply Completed cannot be updated again | guard in `applyContentUpdate` |
| 4 | WorkProgress.status is forward-only | guard in `advanceStatus` |
| 5 | Failure.repeatCount only increases, never decreases | only `incrementRepeatCount` method |

#### Boundary Rationale

Each item's lifecycle (status machine, repeat counter) is independent of other items. Cross-item rules (ordering, failure dedup routing) live on the Conversation aggregate, which references items by ID.

#### Domain Events

| Event | Payload | Emitted When |
|-------|---------|--------------|
| UserMessageReceived | itemId, conversationId, body | User message confirmed in list |
| AgentReplyStarted | itemId, conversationId | Agent begins reply |
| AgentReplyCompleted | itemId, finalContent | Agent reply finalized |
| WorkProgressReceived | itemId, conversationId, progressType, summary | New work progress item created |
| WorkProgressStatusChanged | itemId, newStatus | Existing work progress advanced |
| FailureReported | itemId, conversationId, failureId, errorMessage | First-time failure recorded |
| DuplicateFailureReported | itemId, repeatCount | Same failureId re-reported |
| UnrecognizedInformationReceived | itemId, conversationId, rawPayload | Item with unmapped variant |

#### Repository Port

```
interface ConversationItemRepository {
  findById(id: ItemId): ConversationItem
    raises: ConversationItemNotFound
  findByConversationId(id: ConversationId): [ConversationItem]
    // returns items in Conversation.items order
  save(item: ConversationItem): void
}
```

#### Domain Errors

| Error | Condition | Severity |
|-------|-----------|----------|
| ConversationItemNotFound | findById receives unknown ItemId | not-found |
| WorkProgressStatusReversal | advanceStatus receives an earlier status | business-rule |
| AgentReplyAlreadyCompleted | applyContentUpdate on Completed reply | business-rule |

---

### Aggregate: Turn

#### Structure

| Role | Name | Type | Notes |
|------|------|------|-------|
| Aggregate Root | Turn | Entity | identity = TurnId |
| Value Object | TurnId | VO | opaque immutable identifier |
| Value Object | TurnStatus | VO (tagged union) | Active / Completed |

#### Fields — Turn

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | TurnId | required, immutable | identity |
| conversationId | ConversationId | required, immutable | ref by ID |
| status | TurnStatus | required | type-encoded state machine |

**TurnStatus** (discriminated union)

```
TurnStatus =
  | Active    { firstUserMessageItemId: ItemId }
  | Completed { firstUserMessageItemId: ItemId,
                lastAgentReplyItemId:  ItemId }
```

Allowed transitions:
```
Active → Completed   // via TurnCompletionPolicy
```

#### Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | TurnStatus is forward-only (Active → Completed) | `complete` method guard |
| 2 | lastAgentReplyItemId is inaccessible during Active | type-level (variant has no such field) |
| 3 | firstUserMessageItemId is set at construction and never changes | only via factory `begin` |

#### Boundary Rationale

Turn's state machine and its association with first user message + last agent reply form an independent consistency unit. Cross-aggregate references (ItemIds) are held by value, not as object pointers, preserving aggregate independence.

#### Domain Events

| Event | Payload | Emitted When |
|-------|---------|--------------|
| TurnCompleted | conversationId, turnId, firstUserMessageItemId, lastAgentReplyItemId | TurnCompletionPolicy returns TurnEnds |

#### Repository Port

```
interface TurnRepository {
  findById(id: TurnId): Turn
    raises: TurnNotFound
  findActiveByConversationId(id: ConversationId): Turn?
    // None when no Active Turn exists for that conversation
  save(turn: Turn): void
}
```

#### Domain Errors

| Error | Condition | Severity |
|-------|-----------|----------|
| TurnNotFound | findById receives unknown TurnId | not-found |
| TurnAlreadyCompleted | complete called on already-Completed Turn | business-rule |

---

## Bounded Context: Composer

### Aggregate: ComposerSession

#### Structure

| Role | Name | Type | Notes |
|------|------|------|-------|
| Aggregate Root | ComposerSession | Entity | identity = ConversationId |
| Value Object | ConversationId | VO | identity |
| Value Object | ComposerAvailability | VO (tagged union) | Disabled / Available |
| Value Object | DisabledReason | VO (enum) | reason for Disabled |
| Value Object | AgentStatus | VO (enum) | Idle / Working |
| Value Object | InterruptConfirmationState | VO (enum) | Idle / AwaitingConfirmation |

#### Fields — ComposerSession

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| conversationId | ConversationId | required, immutable | identity |
| draft | string | may be empty | empty allowed; send guard checks non-empty |
| availability | ComposerAvailability | required | state machine |
| interruptState | InterruptConfirmationState | required | two-step confirmation gate |

**ComposerAvailability** (discriminated union)

```
ComposerAvailability =
  | Disabled  { reason: DisabledReason }
  | Available { agentStatus: AgentStatus }

DisabledReason =
  | NoConversationSelected
  | ContentRestoring
  | ConnectionUnavailable
  | StateUnclear

AgentStatus = Idle | Working
```

**InterruptConfirmationState**

```
InterruptConfirmationState = Idle | AwaitingConfirmation
```

Allowed transitions:
```
ComposerAvailability:
  Disabled ↔ Available
  Available(Idle) ↔ Available(Working)

InterruptConfirmationState:
  Idle → AwaitingConfirmation       // via confirmInterrupt
  AwaitingConfirmation → Idle       // via executeInterrupt or cancel
```

#### Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | Empty draft cannot trigger send | `send` / `sendSupplement` guards |
| 2 | Operations fail when availability is Disabled | `send` / `sendSupplement` / `executeInterrupt` guards |
| 3 | Interrupt requires explicit confirmation | `executeInterrupt` requires AwaitingConfirmation |
| 4 | Draft clears only on upstream acceptance | only `clearDraft`, called from `acceptSendResult` |
| 5 | One ComposerSession per ConversationId | identity uniqueness |

#### Boundary Rationale

Draft lifecycle, availability state, and interrupt confirmation jointly guard "user input integrity". They share a single consistency window: it would be invalid to enable sending while restoring, or to execute interrupt while disabled. One aggregate keeps these invariants atomic.

#### Domain Events

| Event | Payload | Emitted When |
|-------|---------|--------------|
| MessageSent | conversationId, body | send accepted by upstream |
| SupplementSent | conversationId, body | sendSupplement accepted by upstream |
| InterruptConfirmed | conversationId | user confirms interrupt modal |
| InterruptExecuted | conversationId | executeInterrupt succeeds |
| SendFailed | conversationId, error | acceptSendResult receives Rejected |

#### Repository Port

```
interface ComposerSessionRepository {
  findByConversationId(id: ConversationId): ComposerSession?
    // None on first selection; Service initializes
  save(session: ComposerSession): void
}
```

#### Domain Errors

| Error | Condition | Severity |
|-------|-----------|----------|
| EmptyDraftCannotBeSent | send/sendSupplement called with empty draft | business-rule |
| ComposerUnavailable | any action while availability = Disabled | business-rule |
| InterruptNotConfirmed | executeInterrupt while interruptState = Idle | business-rule |

---

## Bounded Context: Notice

### Aggregate: NoticeBoard

#### Structure

| Role | Name | Type | Notes |
|------|------|------|-------|
| Aggregate Root | NoticeBoard | Entity | page-level singleton |
| Entity | ActiveNotice | Entity | child entity; identity = NoticeId |
| Value Object | NoticeId | VO | identity of an ActiveNotice |
| Value Object | NoticeType | VO | semantic category (ConnectionLost, SendFailed, …) |
| Value Object | NoticeLifecycle | VO (tagged union) | Transient / Persistent |
| Value Object | Duration | VO | used in Transient |

#### Fields — NoticeBoard

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| notices | ordered list of ActiveNotice | order = stack order | stacking rules enforced on raise |

#### Fields — ActiveNotice

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | NoticeId | required, immutable | identity |
| noticeType | NoticeType | required, immutable | resolution routing key |
| message | string | required | upstream-supplied text |
| lifecycle | NoticeLifecycle | required, immutable | variant fixed at construction |

**NoticeLifecycle** (discriminated union)

```
NoticeLifecycle =
  | Transient  { expiresAfter: Duration }
  | Persistent
```

#### Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | Persistent notices removable only via ResolveNotice | `resolve` is the only removal path for Persistent |
| 2 | Transient notices removable only via auto-expiry | `tickExpiry` is the only removal path for Transient |
| 3 | Lifecycle variant fixed at construction | VO immutability |
| 4 | Stacking respects product spec limits (display rules) | `raise` enforces stack policy |

#### Boundary Rationale

Lifecycle rules and stacking constraints apply across the active set. A board-level aggregate gives a single consistency window for both. ActiveNotice is a child entity (not a separate aggregate) because its lifecycle is meaningless without the board context.

#### Domain Events

| Event | Payload | Emitted When |
|-------|---------|--------------|
| NoticeRaised | noticeId, noticeType, message, lifecycle | New notice added to board |
| NoticeResolved | noticeId, noticeType | Persistent notice removed via ResolveNotice |

#### Repository Port

```
interface NoticeBoardRepository {
  get(): NoticeBoard
    // singleton; always exists
  save(board: NoticeBoard): void
}
```

#### Domain Errors

None — all invariants are type-enforced at construction or guarded by method discriminators.

---

## Application Services

### ConversationReadingAppService

#### openConversation(conversationId)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load or create Conversation | ConversationRepository |
| 2 | Transition contentState to Restoring | Conversation.beginRestoring |
| 3 | Save | ConversationRepository |

**Errors**: none new (creation is idempotent).
**Transaction**: [Conversation]. Composer side initialized separately by ComposerAppService.initializeSession.

#### restoreConversationContent(conversationId, result)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | On Success: create ConversationItems and save each; mark Live | ConversationItemRepository; Conversation.markLive |
| 2 | On Failure: mark RestoreFailed | Conversation.markRestoreFailed |
| 2 | On Empty: mark Empty | Conversation.markEmpty |
| 3 | Save Conversation | ConversationRepository |

**Errors**: ConversationNotFound propagates.
**Transaction**: [ConversationItem × N, Conversation] (atomic frontend dispatch, DD-004).

#### receiveUserMessage(conversationId, content)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | Create UserMessage item | ConversationItem.createUserMessage |
| 3 | Begin Turn(Active) with firstUserMessageItemId | Turn.begin |
| 4 | Append item id to Conversation | Conversation.appendItem |
| 5 | Save item, turn, conversation | three repositories |

**Errors**: ConversationNotFound propagates.
**Transaction**: [ConversationItem, Turn, Conversation] (atomic frontend dispatch, DD-004).

#### startReply(conversationId)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | Create AgentReply item (status=InProgress) | ConversationItem.createAgentReply |
| 3 | Append item id | Conversation.appendItem |
| 4 | Save item and conversation | two repositories |

**Errors**: ConversationNotFound propagates.
**Transaction**: [ConversationItem, Conversation] (atomic frontend dispatch, DD-004).

#### completeReply(itemId, finalContent)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ConversationItem | ConversationItemRepository |
| 2 | Apply completeReply | ConversationItem.completeReply |
| 3 | Save | ConversationItemRepository |

Followed by independent call to `handleAgentSignal(conversationId, ReplyCompleted(itemId))`.

**Errors**: ConversationItemNotFound, AgentReplyAlreadyCompleted. AgentReplyAlreadyCompleted is intercepted at the ACL boundary (out-of-order delta after Completed is dropped).
**Transaction**: [ConversationItem].

#### handleAgentSignal(conversationId, signal)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation (for agentCliType) | ConversationRepository |
| 2 | Load Active Turn; return if none | TurnRepository |
| 3 | Select policy by agentCliType | TurnCompletionPolicyRegistry |
| 4 | decision = policy.decide(turn, signal) | TurnCompletionPolicy |
| 5 | On TurnEnds: turn.complete(itemId); save | TurnRepository |

**Errors**: ConversationNotFound propagates; TurnNotFound returns silently; TurnAlreadyCompleted silently ignored.
**Transaction**: [Turn].

#### reportWorkProgress(conversationId, data)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | Create WorkProgress item | ConversationItem.createWorkProgress |
| 3 | Append item id | Conversation.appendItem |
| 4 | Save item and conversation | two repositories |

**Errors**: ConversationNotFound propagates.
**Transaction**: [ConversationItem, Conversation] (atomic frontend dispatch).

#### updateWorkProgressStatus(itemId, newStatus)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ConversationItem | ConversationItemRepository |
| 2 | Advance status | ConversationItem.advanceStatus |
| 3 | Save | ConversationItemRepository |

**Errors**: ConversationItemNotFound; WorkProgressStatusReversal routed to Unrecognized at ACL boundary.
**Transaction**: [ConversationItem].

#### reportFailure(conversationId, failureId, errorMessage)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2a | If failureId in failureIndex: load existing item, increment repeatCount, save | ConversationItem.incrementRepeatCount |
| 2b | Else: create Failure item; record in failureIndex; save item and conversation | ConversationItem.createFailure; Conversation.recordFailure |

**Errors**: ConversationNotFound; ConversationItemNotFound (only in 2a, indicates corrupted index — logged).
**Transaction**: [ConversationItem] in 2a; [ConversationItem, Conversation] in 2b (atomic frontend dispatch).

#### reportInformation(conversationId, rawPayload)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | Create Unrecognized item | ConversationItem.createUnrecognized |
| 3 | Append item id | Conversation.appendItem |
| 4 | Save item and conversation | two repositories |

**Errors**: ConversationNotFound propagates.
**Transaction**: [ConversationItem, Conversation] (atomic frontend dispatch).

#### handleConnectionLoss(conversationId) — Conversation side

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | Transition Live(_) → Live(Reconnecting) | Conversation.markReconnecting |
| 3 | Save | ConversationRepository |

**Transaction**: [Conversation].

#### handleReconnect(conversationId) — Conversation side

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load Conversation | ConversationRepository |
| 2 | Transition to Restoring | Conversation.beginRestoring |
| 3 | Save | ConversationRepository |

Followed by restoreConversationContent.

**Transaction**: [Conversation].

---

### ComposerAppService

#### initializeSession(conversationId)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load or initialize ComposerSession | ComposerSessionRepository / ComposerSession.initialize |
| 2 | Set availability based on Conversation state | reads Conversation read-only |
| 3 | Save | ComposerSessionRepository |

**Transaction**: [ComposerSession].

#### sendMessage(conversationId, text)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ComposerSession | ComposerSessionRepository |
| 2 | session.send(text) — guards: Available(Idle), non-empty | ComposerSession.send |
| 3 | Save | ComposerSessionRepository |

**Errors**: ComposerUnavailable, EmptyDraftCannotBeSent — surface to UI guards (action should be unreachable when invalid).
**Transaction**: [ComposerSession]. Upstream confirmation handled via acceptSendResult.

#### sendSupplement(conversationId, text)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ComposerSession | ComposerSessionRepository |
| 2 | session.sendSupplement(text) — guards: Available(Working), non-empty | ComposerSession.sendSupplement |
| 3 | Save | ComposerSessionRepository |

**Errors**: as above.
**Transaction**: [ComposerSession].

#### acceptSendResult(conversationId, result)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ComposerSession | ComposerSessionRepository |
| 2 | On Accepted: clearDraft; on Rejected: preserveDraft + emit SendFailed | ComposerSession.clearDraft / preserveDraft |
| 3 | Save | ComposerSessionRepository |
| 4 | On Rejected: raise transient Notice (separate transaction) | NoticeAppService.raiseNotice |

**Transaction**: [ComposerSession]. Notice raised as separate eventual-consistency step.

#### confirmInterrupt(conversationId)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ComposerSession | ComposerSessionRepository |
| 2 | session.confirmInterrupt() — sets AwaitingConfirmation | ComposerSession.confirmInterrupt |
| 3 | Save | ComposerSessionRepository |

**Errors**: ComposerUnavailable.
**Transaction**: [ComposerSession].

#### executeInterrupt(conversationId)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ComposerSession | ComposerSessionRepository |
| 2 | session.executeInterrupt() — guard: AwaitingConfirmation | ComposerSession.executeInterrupt |
| 3 | Save | ComposerSessionRepository |

**Errors**: ComposerUnavailable, InterruptNotConfirmed (should be unreachable through UI).
**Transaction**: [ComposerSession].

#### handleConnectionLoss(conversationId) — Composer side

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load ComposerSession | ComposerSessionRepository |
| 2 | session.disable(ConnectionUnavailable) | ComposerSession.disable |
| 3 | Save | ComposerSessionRepository |

**Transaction**: [ComposerSession].

#### handleReconnect(conversationId) — Composer side

| Step | Action | Component |
|------|--------|-----------|
| 1 | Read Conversation contentState (read-only) | ConversationRepository |
| 2 | Load ComposerSession | ComposerSessionRepository |
| 3 | enable or keep disabled based on contentState variant | ComposerSession.enable / disable |
| 4 | Save | ComposerSessionRepository |

**Transaction**: [ComposerSession]. Cross-context read is read-only.

---

### NoticeAppService

#### raiseNotice(noticeType, message, lifecycle)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load NoticeBoard | NoticeBoardRepository |
| 2 | board.raise(noticeType, message, lifecycle) | NoticeBoard.raise |
| 3 | Save | NoticeBoardRepository |

**Transaction**: [NoticeBoard].

#### resolveNotice(noticeType)

| Step | Action | Component |
|------|--------|-----------|
| 1 | Load NoticeBoard | NoticeBoardRepository |
| 2 | board.resolve(noticeType) — no-op if absent | NoticeBoard.resolve |
| 3 | Save | NoticeBoardRepository |

**Transaction**: [NoticeBoard].

---

## Adopted Tactics

| Tactic | Trigger Reason | Scope | Design Summary |
|--------|---------------|-------|----------------|
| Anti-Corruption Layer | Codex vs Claude Code emit structurally different events for the same four canonical information categories; Conformist would corrupt ConversationReading's internal model on every new CLI | AgentCLI → ConversationReading boundary | AgentCLIInboundACL implements port `AgentCLIEventInbound`; maps native events to onUserMessage / onAgentReplyStarted / onAgentReplyDelta / onAgentReplyCompleted / onWorkProgress / onWorkProgressStatusChanged / onFailure / onUnrecognized / onTurnCompletionSignal; unmappable events route to Unrecognized; status reversals route to Unrecognized; failures retain upstream message verbatim (per product spec line 58) |
| Policy | Different agent CLIs signal "turn complete" differently (codex: task_complete; claude code: reply + idle); rule genuinely varies | ConversationReading (Turn completion logic) | TurnCompletionPolicy interface `(turn, agentSignal) → TurnCompletionDecision`; implementations: CodexTurnCompletionPolicy, ClaudeCodeTurnCompletionPolicy, ConservativeTurnCompletionPolicy; selected per Conversation.agentCliType via TurnCompletionPolicyRegistry; invoked by ConversationReadingAppService.handleAgentSignal |
