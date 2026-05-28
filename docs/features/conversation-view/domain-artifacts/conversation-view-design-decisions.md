# Design Decisions — Conversation View

## DD-001: UserMessageReceived kept as independent event

| Field | Value |
|-------|-------|
| Status | accepted |

### Context

UserMessageReceived and MessageSent describe overlapping facts: the user sent a message and it appeared in the conversation. Merging them would simplify the model but couples Composer behavior to message list behavior.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A — Merge into MessageSent | Simpler model, fewer events | Upstream may confirm receipt asynchronously or fail silently; tight coupling |
| B — Keep separate | Defensive against upstream surprises; clear separation of concerns | Two events for one user action |

### Decision

Option B — keep UserMessageReceived as an independent Domain Event.

### Rationale

Upstream (Agent CLI) behavior is unpredictable. Separating "user sent" from "message confirmed in list" provides resilience against edge cases where the upstream acknowledges differently than expected.

## DD-002: TurnCompleted as Policy-derived event

| Field | Value |
|-------|-------|
| Status | accepted |

### Context

TurnCompleted drives toolbar visibility. It could be modeled as a direct Command result or as a Policy that fires after AgentReplyCompleted when the agent stops working.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A — Independent Command/Event | Explicit, simple | No clear Actor; artificial Command |
| B — Policy derived from AgentReplyCompleted | Reflects reality that turn completion is a consequence, not a command | Adds Policy concept early |

### Decision

Option B — TurnCompleted is derived by a Policy when AgentReplyCompleted fires and the agent does not continue working.

### Rationale

Product spec states "进行中的轮次不显示工具栏", implying agent may reply but continue. TurnCompleted is a judgment about completion state, not a direct command.

## DD-003: LiveConnection scoped to frontend↔backend only

| Field | Value |
|-------|-------|
| Phase / Step | Phase 2 · Step 1 (bounded-context-identification) |
| Status | accepted |

### Context

The product spec uses ambiguous "connection" language. Two candidate connections exist: frontend↔backend and backend↔AgentCLI. The boundary of LiveConnection determines what flows in as integration events versus what is absorbed as internal sync state.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A — Both connections under one LiveConnection | Single concept | Conflates two failure modes with different recovery semantics; backend↔AgentCLI is backend's concern, not Conversation View's |
| B — Frontend↔backend only | Matches "弱网、切后台" wording; respects feature scope | Backend↔AgentCLI health must be expressed via another channel |

### Decision

Option B — LiveConnection refers only to the frontend↔backend real-time channel.

### Rationale

Product spec wording ("弱网、切后台", "重连") points to client-side network state. Backend↔AgentCLI health surfaces through content flow signals (sync status, stale flags), already covered by ConversationContentState.Live.syncStatus. Mixing the two would pull backend concerns into a frontend feature model.

### Consequences

LiveConnection emits only LiveConnectionLost / LiveConnectionReconnected. Backend-side agent stalls do not produce LiveConnection events; they appear as Live(Syncing) or Live(Stale) sync substates.

## DD-004: Cross-aggregate updates as atomic frontend dispatch, not Saga

| Field | Value |
|-------|-------|
| Phase / Step | Phase 5 · Step 1 (application-service revision) |
| Status | accepted |

### Context

Several application service methods modify multiple aggregates in one call (receiveUserMessage touches Conversation + ConversationItem + Turn; reportFailure's new-failure branch touches ConversationItem + Conversation). Vernon's rule prefers one aggregate per transaction; the alternatives are splitting the aggregates further or introducing a Saga.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A — Saga / Process Manager | Honors Vernon's rule strictly | Compensation has no business meaning here; adds machinery without value |
| B — Split aggregates further | Pure boundaries | Pushes consistency outside the model; weakens invariants |
| C — Atomic frontend dispatch | Frontend store dispatch is naturally atomic; consistency window unobservable | Multiple aggregate types in one transaction |

### Decision

Option C — accept atomic frontend dispatch as the consistency mechanism for these specific operations.

### Rationale

Conversation View is a frontend feature. Its "transactions" are frontend store dispatches, which are inherently atomic and synchronous. No cross-network or cross-process compensation is meaningful. A Saga here would invent failure modes that cannot occur.

### Consequences

Application Service methods may modify multiple aggregates per call when (1) all aggregates live in the same frontend store and (2) no asynchronous boundary is crossed. Transaction-boundary annotations in service drafts reflect this.

## DD-005: ACL adopted for Agent CLI inbound, not Composer-to-Agent

| Field | Value |
|-------|-------|
| Phase / Step | Phase 4 (anti-corruption-layer evaluation) |
| Status | accepted |

### Context

Two relationships involve Agent CLI: inbound events (replies, work progress, failures) and outbound Composer queries (agent idle/working state). The question is whether both warrant an ACL.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A — ACL both directions | Symmetric | Composer side has no concept distortion; ACL would be overhead |
| B — ACL inbound only | Protects the four-category invariant where concept distortion is real | Composer remains Conformist |

### Decision

Option B — ACL only on the inbound side.

### Rationale

Inbound events from different CLIs are structurally and semantically heterogeneous; without translation, every new CLI corrupts ConversationReading's four-category model. The outbound concept (agent idle/working) is simple and stable across CLIs; Conformist is sufficient and cheaper.

### Consequences

AgentCLIInboundACL is the single inbound translation layer. Composer reads agent state as published language directly, with per-CLI action support degrading naturally via UI guards.

## DD-006: TurnCompletion externalized as Policy, not inline rule

| Field | Value |
|-------|-------|
| Phase / Step | Phase 4 (policy evaluation) |
| Status | accepted |

### Context

DD-002 established TurnCompleted is derived, not commanded. The follow-up question is whether the derivation rule belongs inline in the Aggregate / Service or is externalized as a Policy.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| A — Inline in Service | One less abstraction | Each new CLI requires modifying ConversationReading internals |
| B — Externalized Policy with per-CLI implementation | Variation handled at the edge | Adds Policy registry concept |

### Decision

Option B — TurnCompletionPolicy interface with per-CLI implementations selected by Conversation.agentCliType.

### Rationale

The rule genuinely varies: codex signals completion via task_complete; claude code via reply + idle sequence. Variation is real, not speculative. Externalizing the rule keeps ConversationReading internals stable across CLI integrations.

### Consequences

A TurnCompletionPolicy port lives in the domain layer; per-CLI implementations register against a Selection key. Application Service queries the registry by agentCliType and applies the chosen policy.
