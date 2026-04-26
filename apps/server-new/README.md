# server-new

`apps/server-new` is an architecture skeleton for the next server shape.

This folder is not a feature implementation. Its purpose is to describe the intended module boundaries before concrete data fields, endpoint contracts, Codex payloads, and migration details are introduced.

## Why this skeleton exists

The current server grew around one large chat-centered flow. Over time, several different lifecycles became mixed together:

- whether an interaction context is alive
- how conversation lines are created and managed
- how one actual chat exchange runs
- how Codex is reached as an external runtime
- how HTTP requests are mapped into use cases

Those concerns change for different reasons. Keeping them behind one broad chat service makes startup, state ownership, recovery, thread operations, and message execution hard to reason about.

This skeleton separates the large concepts first. Concrete fields can come later.

## Core split

The most important split is:

```text
session lifetime != thread lifetime != chat execution lifetime
```

### `features/session`

`session` owns the lifetime of a live interaction context.

It answers questions like:

- is there an active interaction context?
- should that context be kept alive, restored, or closed?
- what runtime-facing resources belong to that live context?
- how does the rest of the server observe session-level changes?

It should be thought of as the container for liveness and continuity. It is not the owner of thread operations, and it is not the executor of a model response.

### `features/thread`

`thread` owns conversation-line management.

It answers questions like:

- how is a conversation line started?
- how is an existing line resumed or selected?
- how are line-level operations represented?
- how is conversation history or structure managed?

It should be thought of as the manager of durable conversation lines. It is not the owner of whether a live session exists, and it is not the owner of one chat exchange progressing from input to output.

### `features/chat`

`chat` owns the execution of an actual chat exchange.

It answers questions like:

- how does an input become a runtime command?
- how are runtime events applied to an in-progress exchange?
- how does the server produce a chat snapshot or chat event?
- when is an exchange idle, active, completed, or failed?

It should be thought of as the turn/exchange executor. It does not own the whole application conversation model.

## Other large boundaries

### `adapters/codex`

`adapters/codex` owns the Codex external runtime boundary.

It is responsible for turning the external Codex process/protocol into a local `RuntimePort`. The rest of the server should think in terms of runtime commands, runtime events, and runtime results rather than raw Codex transport details.

### `http`

`http` owns request and response mapping.

It should translate HTTP input into application-level commands and translate application results back into HTTP output. It should not become the place where session, thread, chat, or cross-feature behavior is implemented.

### `application`

`application` owns cross-feature use-case orchestration.

It is the place where flows that need more than one feature should live. HTTP should call application use cases instead of coordinating session, thread, chat, workspace, or app-control services itself.

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

It should stay boring: small errors, small helpers, simple pure utilities. If a file knows a business lifecycle such as session, thread, chat, workspace, or Codex, it probably belongs outside `shared`.

## How the pieces collaborate

The intended flow is:

```text
main
  creates config
  creates runtime adapter
  creates event bus
  creates session service
  creates thread service
  creates chat service
  creates workspace service
  creates app-control service
  creates application use cases
  creates http app
```

HTTP then calls the application layer:

```text
http -> application
application -> session service
application -> thread service
application -> chat service
application -> workspace service
application -> app-control service
```

Feature services use ports for external capabilities:

```text
session/thread/chat -> RuntimePort
session/thread/chat -> EventBusPort
```

The Codex adapter implements the runtime port:

```text
adapters/codex -> RuntimePort
```

## Data ownership principle

The owner of a lifecycle owns the state for that lifecycle.

Initial ownership:

```text
session state -> features/session
thread state  -> features/thread
chat state    -> features/chat
external runtime process/protocol -> adapters/codex
request/response mapping -> http
cross-feature orchestration -> application
startup wiring -> main
```

This is the main architectural rule behind the split. It is less about directory names and more about making state ownership obvious.

## Level of detail in this draft

This skeleton intentionally uses `unknown` for commands, events, snapshots, states, and external payloads.

That is deliberate. At this stage, names such as concrete user identifiers, conversation identifiers, message fields, request payload fields, and Codex protocol fields are not the point. The point is to make the large boundaries and ownership model stable first.

## Current status

This package is a compileable architecture draft only:

- no production routes
- no real Codex transport
- no real application flows
- no real chat data model
- no real session data model
- no real thread data model
- no real workspace data model
- root workspace integration is present
- import-boundary test protects the intended dependency direction

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
