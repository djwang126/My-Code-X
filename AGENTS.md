# My-Code-X

My-Code-X is a phone-friendly web chat for local Codex.
Designed for users who want to use Codex but:

1. don't like the TUI or desktop app experience
2. have to work remotely
3. prefer using a mobile device for convenience
Goal: An interactive mobile experience that is better than the Codex TUI experience.

## Cowork Rule

When investigating workspace, 先理解文件目录，再定向阅读。不要暴力搜全局
It's my personal \& monorepo project so breaking changes are acceptable
Main development is on Windows but the project should work cross-platform(Linux, macOS)

User == me; product user == my-code-x user

## Product Rule

Respect the Original Codex app server. Every parameter sent should be a deliberate decision.
My-Code-X aims for a better user experience by providing extra utilities and user friendly interface over codex TUI.

## Core Code Principles

* YAGNI
* Go style / Rob pike-style simplicity
* Unix philosophy
* Hexagonal Architecture
* separation of concerns

## extra info

The original codex is at: ../codex/codex-rs learn the app server API there.
Codex sessions/past chats live in \~/.codex/sessions/{YYYY}/{MM}/{DD}/rollout-{timestamp}-{session-id}.jsonl, useful for debugging and real output checking

