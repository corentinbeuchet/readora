# Readora — Gemini CLI context

All project rules for AI agents live in `AGENTS.md` (root), `backend/AGENTS.md` and `frontend/AGENTS.md`.
Read them before making changes; they are the single source of truth. Do not duplicate rules here.

Tip: to have Gemini CLI load them automatically, set the context file names in `.gemini/settings.json`
(current schema: `{ "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }`; older CLI versions use
`{ "contextFileName": ["AGENTS.md", "GEMINI.md"] }`).
