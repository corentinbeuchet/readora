// PreToolUse guard for two repo rules that must never break (AGENTS.md, backend/AGENTS.md):
//  1. a Flyway migration that is already committed is never edited: add a new V<n>__*.sql instead;
//  2. never `git add -A` / `git add .`: the user keeps unrelated uncommitted work, stage explicit paths.
// Denies with a reason Claude sees; everything else passes through untouched.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const MIGRATION = /[\\/]db[\\/]migration[\\/]V\d+__[^\\/]+\.sql$/i;
const GIT_ADD_ALL = /\bgit\s+(?:-C\s+\S+\s+)?add\s+(?:[^|;&\n]*\s)?(?:-A|--all|\.)(?=\s|$|[;&|])/;

const raw = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});
const input = JSON.parse(raw || '{}');
const toolInput = input.tool_input ?? {};

function deny(reason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } })
  );
  process.exit(0);
}

if (['Edit', 'Write', 'MultiEdit'].includes(input.tool_name)) {
  const file = String(toolInput.file_path ?? '');
  if (MIGRATION.test(file)) {
    // Untracked = a migration being written in this change: editing it is fine.
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const tracked = execFileSync('git', ['ls-files', '--', file], { cwd: root, encoding: 'utf8' }).trim();
    if (tracked) {
      deny(`${path.basename(file)} is a committed Flyway migration: never edit an applied one, add a new V<n>__*.sql instead (backend/AGENTS.md, Persistence).`);
    }
  }
}

/** The command without heredoc bodies and quoted strings, so a commit message that mentions `git add -A` passes. */
function executableText(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\s|$)/g, '')
    .replace(/@'[\s\S]*?\n'@/g, '')
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"|`[^`]*`/g, '');
}

if (['Bash', 'PowerShell'].includes(input.tool_name) && GIT_ADD_ALL.test(executableText(String(toolInput.command ?? '')))) {
  deny('Stage explicit paths only (`git add <paths>`), never `git add -A` / `git add .`: the user keeps unrelated uncommitted work (AGENTS.md, Git).');
}
