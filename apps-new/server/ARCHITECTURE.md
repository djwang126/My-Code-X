# server-new architecture

`server-new` is a compileable architecture draft. It exists to make module boundaries,
dependency direction, and state ownership explicit before concrete request fields,
runtime payloads, and migration details are introduced.

## Core lifecycle split

```text
slot selection != thread metadata != thread actions != turn lifetime != conversation timeline != runtime request lifetime
```

- `features/slot` owns client slot selection.
- `features/thread` owns metadata for known Codex thread ids.
- `features/thread-actions` owns operations over a Codex thread id.
- `features/turn` owns one active execution lifecycle.
- `features/conversation` owns the client-visible timeline.
- `features/runtime-request` owns runtime requests waiting on user input.

These concepts may be coordinated, but they are not owned by one broad service.

## Module responsibilities

### `main`

Startup and composition only.

It creates config, adapters, feature services, application use cases, and the HTTP
app. This is the one layer that is intentionally aware of all large modules.

### `config`

Configuration loading only.

It reads process/environment input and returns prepared startup configuration.
Feature modules receive prepared dependencies and must not read environment
directly.

### `http`

Request and response mapping only.

HTTP controllers translate HTTP input into application use-case input and translate
application results into HTTP output. They do not coordinate feature services.

### `application`

Cross-feature use-case orchestration.

If a flow needs slot, thread, turn, conversation, runtime requests, workspace,
or app-control together, that coordination belongs here.

Application receives client intent and coordinates features. It must not make
HTTP input mirror runtime command fields. Runtime command details are introduced
inside the use case only when the real behavior is migrated.

### `contracts`

Frontend-facing product contracts.

Contracts describe client actions, snapshots, events, action results, timeline
items, pending interactions, and turn views. They must not expose adapter,
transport, or raw runtime protocol vocabulary.

### `presenter`

Frontend-facing projection.

Presenters convert feature-owned state and domain events into `contracts`
shapes. They are the only layer that should decide how domain state appears to
the client.

### `features/*`

Each feature owns one business concept and its state.

Feature modules do not import other feature modules. Cross-feature coordination
belongs in `application`.

### `adapters/*`

Concrete implementations of external or process-local capabilities.

`adapters/codex` turns the external Codex process/protocol into a `RuntimePort`.
It must not know about conversation, slot, thread, HTTP, or application use cases.

### `ports`

Small cross-boundary capability contracts.

Ports let features depend on capabilities without depending on concrete adapters.

### `shared`

Pure project-wide building blocks only.

If a file knows a business lifecycle such as slot, thread, turn, conversation,
runtime request, workspace, app-control, or Codex, it does not belong in `shared`.

## Import rules

Allowed high-level dependencies:

```text
main -> config
main -> adapters/*
main -> application
main -> http
main -> features/*
main -> ports
main -> shared

http -> application
http -> contracts
http -> shared
http -> http

application -> features/*
application -> contracts
application -> ports
application -> presenter
application -> shared
application -> application

contracts -> contracts
contracts -> shared

presenter -> presenter
presenter -> contracts
presenter -> features/*
presenter -> shared

features/<name> -> features/<same-name>
features/<name> -> ports
features/<name> -> shared

adapters/<name> -> adapters/<same-name>
adapters/<name> -> ports
adapters/<name> -> shared

config -> config
config -> shared

ports -> ports
ports -> shared

shared -> shared
```

Forbidden dependencies:

```text
features/* -> features/<different-name>
features/* -> http
features/* -> application
features/* -> adapters/*
features/* -> config

http -> features/*
http -> adapters/*
http -> ports
http -> config
http -> main

adapters/* -> features/*
adapters/* -> application
adapters/* -> http
adapters/* -> main
adapters/* -> config

shared -> anything outside shared
```

The import-boundary test enforces these rules.

## State ownership rules

The owner of a concept owns the state for that concept.

```text
slot selection state -> features/slot
thread metadata state -> features/thread
thread operations -> features/thread-actions
workspace thread history -> features/workspace
turn state    -> features/turn
timeline state -> features/conversation
pending runtime input state -> features/runtime-request
runtime process/protocol -> adapters/codex
request/response mapping -> http
client-facing contracts -> contracts
frontend projection -> presenter
cross-feature orchestration -> application
startup wiring -> main
```

Feature state files are private implementation details. Feature public `index.ts`
files expose services, commands, snapshots, and dependency contracts, not internal
state constructors.

## Event rules

```text
RuntimeEvent != DomainEvent
```

- Runtime events come from an external runtime adapter.
- Domain events are produced by feature code after runtime input has been
  interpreted inside the feature boundary.
- The event bus carries domain events, not raw adapter payloads.

The intended feature flow is:

```text
runtime event -> feature interpretation -> domain event -> state update -> event bus
```

Concrete event fields can be introduced later. The separation of names and
direction exists now so raw runtime payloads do not leak through the application.
The conversation skeleton intentionally stores only a revisioned timeline of
minimal text items. It does not yet classify items, track item lifecycle, project
runtime output into conversation items, or project runtime input requests into
client controls. Those mappings must be migrated with the real feature behavior
and focused tests.

## Public API rules

- Package root exports startup-facing API only.
- HTTP depends on application use cases, not feature services.
- Application depends on feature public APIs, contracts, and presenters.
- Feature public APIs do not expose internal state.
- Adapters implement ports and do not import features.
- Client action input does not predeclare runtime command fields.
- Placeholder use cases throw `SkeletonMigrationPendingError` rather than
  returning fake product behavior.
