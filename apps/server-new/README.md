# server-new

`apps/server-new` is an architecture skeleton for the next server shape.

This folder is not a feature implementation. Its purpose is to describe the intended module boundaries before concrete data fields, endpoint contracts, Codex payloads, and migration details are introduced.

## Why this skeleton exists

The current server grew around one large exchange-centered flow. Over time, several different lifecycles became mixed together:

- whether an interaction context is alive
- how conversation lines are created and managed
- how one active turn runs
- how Codex is reached as an external runtime
- how HTTP requests are mapped into use cases

Those concerns change for different reasons. Keeping them behind one broad exchange service makes startup, state ownership, recovery, thread operations, and message execution hard to reason about.

This skeleton separates the large concepts first. Concrete fields can come later.

## Core split

The most important split is:

```text
slot selection != thread lifetime != turn lifetime != conversation timeline != runtime request lifetime
```

### `features/slot`

`slot` owns the client's current selection.

It answers questions like:

- which workspace did this client slot select?
- which thread did this client slot select?
- what routing key should application use for this client?

It should stay small. It is not the owner of runtime attachment, thread
recovery, thread operations, transcript state, pending requests, or one model
turn.

### `features/thread`

`thread` owns conversation-line management.

It answers questions like:

- how is a conversation line started?
- how is an existing line resumed or selected?
- how are line-level operations represented?
- how is conversation history or structure managed?

It should be thought of as the manager of durable conversation lines. It is not
the owner of a client slot selection, and it is not the owner of one turn
progressing from input to output.

### `features/turn`

`turn` owns the lifecycle of one active execution.

It answers questions like:

- when did the current execution start?
- is the current execution running, waiting, completed, interrupted, or failed?
- can the client send or interrupt right now?

It should be thought of as the execution lifecycle owner. It does not own the whole application conversation model.

### `features/conversation`

`conversation` owns the client-visible timeline.

It answers questions like:

- what timeline items should the client see?
- which item changed when runtime output arrived?
- which item has deferred details?

### `features/runtime-request`

`runtime-request` owns runtime requests waiting on client input.

It answers questions like:

- what approval, form, authentication, or tool-response interaction is open?
- is an interaction idle, submitting, resolved, or expired?
- what response shape should the client submit?

## Other large boundaries

### `adapters/codex`

`adapters/codex` owns the Codex external runtime boundary.

It is responsible for turning the external Codex process/protocol into a local `RuntimePort`. The rest of the server should think in terms of runtime commands, runtime events, and runtime results rather than raw Codex transport details.

### `http`

`http` owns request and response mapping.

It should translate HTTP input into application-level commands and translate application results back into HTTP output. It should not become the place where slot, thread, turn, conversation, runtime-request, or cross-feature behavior is implemented.

### `application`

`application` owns cross-feature use-case orchestration.

It is the place where flows that need more than one feature should live. HTTP should call application use cases instead of coordinating slot, thread, turn, conversation, runtime-request, workspace, or app-control services itself.

### `main`

`main` owns startup and composition.

It wires config, runtime adapters, feature services, and HTTP together. This is the one place where the large modules are intentionally aware of each other.

### `config`

`config` owns environment/config loading.

It should produce startup input for composition. Feature modules should receive already-prepared dependencies instead of reading process environment directly.

### `ports`

`ports` contains cross-boundary capabilities.

Ports are the small contracts that let features use external capabilities without depending on concrete adapters.

### `adapters/memory`

`adapters/memory` contains in-process adapter implementations of ports.

For example, the event bus implementation lives here because it has mutable process-local state. It does not belong in `shared`.

### `shared`

`shared` contains pure project-wide building blocks.

It should stay boring: small errors, small helpers, simple pure utilities. If a file knows a business lifecycle such as slot, thread, turn, conversation, runtime-request, workspace, or Codex, it probably belongs outside `shared`.

## How the pieces collaborate

The intended flow is:

```text
main
  creates config
  creates runtime adapter
  creates event bus
  creates slot service
  creates thread service
  creates turn service
  creates conversation service
  creates runtime-request service
  creates workspace service
  creates application use cases
  creates http app
```

HTTP then calls the application layer:

```text
http -> application
application -> slot service
application -> thread service
application -> turn service
application -> conversation service
application -> runtime-request service
application -> workspace service
```

Feature services use ports for external capabilities:

```text
thread/application -> RuntimePort
slot/thread/turn/conversation/runtime-request -> EventBusPort
```

The Codex adapter implements the runtime port:

```text
adapters/codex -> RuntimePort
```

## Data ownership principle

The owner of a concept owns the state for that concept.

Initial ownership:

```text
slot selection state -> features/slot
thread state  -> features/thread
turn state    -> features/turn
timeline state -> features/conversation
pending runtime input state -> features/runtime-request
external runtime process/protocol -> adapters/codex
request/response mapping -> http
cross-feature orchestration -> application
startup wiring -> main
```

This is the main architectural rule behind the split. It is less about directory names and more about making state ownership obvious.

## Level of detail in this draft

This skeleton intentionally stops at route markers, owner modules, broad client
contracts, and presenter boundaries.

That is deliberate. At this stage, concrete transcript projection, pending
interaction controls, resume hydration, and action result semantics should be
migrated with the real feature behavior and tests. Placeholder use cases throw
`SkeletonMigrationPendingError` instead of inventing fake runtime-to-UI behavior.

## Current status

This package is a compileable architecture draft only:

- no production routes
- client contract and presenter skeletons are present
- real application flows are intentionally migration-pending placeholders
- no real conversation data model
- slot selection model is present
- no real thread data model
- no real workspace data model
- root workspace integration is present
- import-boundary test protects the intended dependency direction
- anti-leak tests protect the client contracts from adapter vocabulary

## Architecture rules

The binding architecture rules live in [ARCHITECTURE.md](./ARCHITECTURE.md).

The most important rules are:

- feature modules do not import other feature modules
- cross-feature flows belong in `application`
- HTTP controllers call `application`, not feature services
- adapters implement ports and do not know about features
- runtime events and domain events are separate concepts
- feature state files are private implementation details
- `shared` stays pure and boring
