# My-Code-X

Phone-friendly web chat for local Codex.
- Serves a chat page on your local network
- Spawns `codex app-server` locally over stdio
Never restart the '4310' main server yourself
Main dev in on windows but the code is cross-platform(linux, macos)

The original codex is at: ../codex (relative to this repository root). Learn the app server api there.
Codex sessions/past chats lives in ~/.codex/sessions/{YYYY}/{MM}/{DD}/rollout-{timestamp}-{session-id}.jsonl usefull for debugging and real output checking

## core code principles

- no file should exceed 300 lines unless there is a strong reason
- one file should do one job/responsibility
- one folder should represent one responsibility
- feature code should stay inside the feature unless it is clearly reused
- private implementation files should not be imported across feature boundaries
- imports follow fixed directions

## root layout

```text
project/
├── apps/
│   ├── web/
│   └── server/
├── packages/
│   ├── config/
│   ├── packages/
│   │   └── contracts/
│   ├── types/
│   └── utils/
└── package.json
```

## server structure

```text
server/
├── src/
│   ├── app/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── modules/
│   │   └── feautre-name/
│   │       ├── feautre-name.controller.ts
│   │       ├── feautre-name.service.ts
│   │       ├── feautre-name.repository.ts
│   │       ├── feautre-name.schema.ts
│   │       ├── feautre-name.types.ts
│   │       ├── feautre-name.service.test.ts
│   │       └── index.ts
│   ├── common/
│   │   ├── middleware/
│   │   ├── guards/
│   │   ├── errors/
│   │   └── utils/
│   ├── config/
│   ├── database/
│   └── routes/
```

## server folder rules

### `src/modules`

Business modules live here.

Each module must contain everything needed for that domain unless there is a strong reason to extract it.

## server module template

Every backend module should follow this shape when applicable:

```text
user/
├── user.controller.ts
├── user.service.ts
├── user.repository.ts
├── user.schema.ts
├── user.types.ts
├── user.service.test.ts
└── index.ts
```
## web structure

```text
web/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── store.ts
│   │   └── providers.tsx
│   ├── pages/
│   ├── features/
│   │   └── feautre-name/
│   │       ├── api.ts
│   │       ├── hooks.ts
│   │       ├── store.ts
│   │       ├── components/
│   │       ├── feautre-name.test.ts
│   │       └── index.ts
│   └── shared/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── utils/
```

## web folder rules

### `src/features`

All user-facing business features live here.

Each feature owns its API calls, local state, UI pieces, hooks, and tests.

## test rules

Full test commands: npm run test; npm run test:smoke; npm run lint
Full test duration is around 4 minutes

Tests are colocated by default.
