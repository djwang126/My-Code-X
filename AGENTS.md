# My-Code-X

My-Code-X is a phone-friendly web chat for local Codex.
Designed for users who want to use Codex but:

1. don't like the TUI or desktop app experience
2. have to work remotely
3. prefer using a mobile device for convenience
Goal: An interactive mobile experience that is better than the Codex TUI experience.

## Cowork Rules

When investigating workspace, 先理解文件目录，再定向阅读。不要暴力搜全局
Don't touch the running '4310' my-code-x main server yourself
It's my personal project so breaking changes are acceptable
Main development is on Windows but the code is cross-platform(Linux, macOS)
Context glossary at [CONTEXT.md](./CONTEXT.md)

## Product Rule

Respect the Original Codex app server. Every parameter sent should be a deliberate decision.
The bottom line is to replicate the Codex TUI experience on mobile.
My-Code-X aims for a better user experience by providing extra utilities and user friendly interface.

## Core Code Principles

* YAGNI
* Go style / Rob pike-style simplicity
* Unix philosophy
* Hexagonal Architecture
* separation of concerns

## extra info

The original codex is at: ../codex (relative to this repository root). Learn the app server API there.
Codex sessions/past chats live in \~/.codex/sessions/{YYYY}/{MM}/{DD}/rollout-{timestamp}-{session-id}.jsonl, useful for debugging and real output checking
Full test commands for the new version: npm run test:new; npm run typecheck:new; npm run lint:new
Full test commands for the deprecated old version: npm run test; npm run test:smoke; npm run lint

