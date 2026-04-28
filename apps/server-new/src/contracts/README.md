# contracts

Frontend contracts describe broad product-facing shapes only.

They should not contain Codex protocol names, transport fields, raw payloads, or
feature-private state. Add concrete fields only when a migrated feature has
tests proving the frontend needs them.

Client actions are intent envelopes. Keep them at `kind`, `scope`, and `payload`
until a real migrated feature proves a concrete field belongs in the public
contract.
