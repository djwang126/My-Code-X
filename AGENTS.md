# My-Code-X

My-Code-X is a phone-friendly web chat for local Codex.
- Serves a chat page on your local network
- Spawns `codex app-server` locally over stdio
Never touch the running '4310' my-code-x main server yourself
It's my personal project so every change can be breaking changes
Main dev in on windows but the code is cross-platform(linux, macos)

The original codex is at: ../codex (relative to this repository root). Learn the app server api there.
Codex sessions/past chats lives in ~/.codex/sessions/{YYYY}/{MM}/{DD}/rollout-{timestamp}-{session-id}.jsonl, usefull for debugging and real output checking
When investigating workspace, 先理解文件目录，再定向阅读。不要暴力搜全局

## Core Code Principles

- YAGNI
- Go style / Rob pike-style simplicity
- Unix philosophy
- Hexagonal Architecture
- separation of concerns

## tests

Full test commands for the old version: npm run test; npm run test:smoke; npm run lint
Full test commands for the new version: npm run test:new; npm run typecheck:new; npm run lint:new

