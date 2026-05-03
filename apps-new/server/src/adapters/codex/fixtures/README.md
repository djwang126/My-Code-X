# Codex Gateway fixtures

These fixtures are golden compatibility samples for the Codex Gateway codec.

Rules:

- Prefer payloads copied from real Codex app-server JSONL/session output.
- Keep method names and payload shapes exactly as observed.
- Minimize only unrelated fields.
- Do not invent UI semantics for host requests.
- Host request fixtures must preserve raw params instead of adding approval, form, title, prompt, or response policy.
