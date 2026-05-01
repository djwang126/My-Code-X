# My-Code-X

My-Code-X is a phone-friendly web chat for local Codex.
- Serves a chat page on your local network
- Spawns `codex app-server` locally over stdio
Never restart the '4310' main server yourself
It's my personal project so every change can be breaking changes
Main dev in on windows but the code is cross-platform(linux, macos)

The original codex is at: ../codex (relative to this repository root). Learn the app server api there.
Codex sessions/past chats lives in ~/.codex/sessions/{YYYY}/{MM}/{DD}/rollout-{timestamp}-{session-id}.jsonl, usefull for debugging and real output checking

## core code principles

- follow Rob Pike's coding philosophy to design code.
- one file should do one job/responsibility
- one folder should represent one responsibility
- feature code should stay inside the feature unless it is clearly reused
- private implementation files should not be imported across feature boundaries
- imports follow fixed directions

## tests

Full test commands for the old version: npm run test; npm run test:smoke; npm run lint
Full test commands for the new version: npm run test:new; npm run typecheck:new; npm run lint:new
Tests are colocated by default.
