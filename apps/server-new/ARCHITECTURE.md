# server-new architecture

`server-new` is a compileable architecture draft. It exists to make module boundaries,
dependency direction, and state ownership explicit before concrete request fields,
runtime payloads, and migration details are introduced.

## Core lifecycle split

```text
session lifetime != thread lifetime != chat execution lifetime
```

- `features/session` owns live interaction context lifetime.
- `features/thread` owns durable conversation-line management.
- `features/chat` owns execution of one chat exchange.

These lifecycles may be coordinated, but they are not owned by one broad service.

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

If a flow needs session, thread, chat, workspace, or app-control together, that
coordination belongs here.

### `features/*`

Each feature owns one business lifecycle and its state.

Feature modules do not import other feature modules. Cross-feature coordination
belongs in `application`.

### `adapters/*`

Concrete implementations of external or process-local capabilities.

`adapters/codex` turns the external Codex process/protocol into a `RuntimePort`.
It must not know about chat, session, thread, HTTP, or application use cases.

### `ports`

Small cross-boundary capability contracts.

Ports let features depend on capabilities without depending on concrete adapters.

### `shared`

Pure project-wide building blocks only.

If a file knows a business lifecycle such as session, thread, chat, workspace,
app-control, or Codex, it does not belong in `shared`.

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
http -> shared
http -> http

application -> features/*
application -> ports
application -> shared
application -> application

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

The owner of a lifecycle owns the state for that lifecycle.

```text
session state -> features/session
thread state  -> features/thread
chat state    -> features/chat
runtime process/protocol -> adapters/codex
request/response mapping -> http
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

## Public API rules

- Package root exports startup-facing API only.
- HTTP depends on application use cases, not feature services.
- Application depends on feature public APIs.
- Feature public APIs do not expose internal state.
- Adapters implement ports and do not import features.
