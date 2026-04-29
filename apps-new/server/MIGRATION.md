# server-new migration guide

`server-new` is a skeleton first. Do not fill placeholders with invented
behavior just to make a path look complete.

## Migration rule

Migrate one real product behavior at a time:

```text
old behavior + frontend consumption + tests
  -> owning feature state/event
  -> presenter mapping
  -> client contract/event
  -> HTTP/SSE wiring
```

## Do

- keep Codex protocol details inside `adapters/codex`
- keep lifecycle state in the owning `features/*` module
- keep HTTP input at the client-action intent level
- put cross-feature orchestration in `application`
- put frontend-facing projection in `presenter`
- add focused tests before replacing a `SkeletonMigrationPendingError`

## Do not

- default runtime output to an assistant message
- default pending interactions to empty controls
- add runtime command fields to client action input before migrating the real behavior
- expose raw adapter payloads through client contracts
- add HTTP handlers that call feature services directly
- keep dead route tables for APIs that are not actually wired

## Client input skeleton rule

HTTP parses a `ClientAction` envelope only: `kind`, `scope`, and `payload`.
Application use cases receive client intent and decide later how that intent maps
to domain commands or runtime commands.

Do not add runtime command fields such as settings, sandbox details, prompt
overrides, content item transport paths, or base instructions to client action
input during skeleton work. Add concrete fields only with the real migrated
feature and focused tests.

## Placeholder policy

If the real behavior is not being migrated in the current change, prefer an
explicit `SkeletonMigrationPendingError` over a plausible-looking fake
implementation.
