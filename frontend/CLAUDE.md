@AGENTS.md

## Claude Code specifics
- Load the `angular-best-practices` project skill before any change here and apply its checklist.
- Writing or fixing tests: load `frontend-unit-tests`, `frontend-component-tests` or `frontend-e2e-tests`.
- Markup, focus, keyboard, forms, dialogs: load `frontend-accessibility`. Layout, SCSS, images, phone/tablet
  behaviour: load `frontend-responsive`.
- If the Angular CLI MCP server is connected, call `get_best_practices` before writing new components/services and
  use `run_target` for build/test/lint.
