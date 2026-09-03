#!/bin/bash
# session-start-test.sh - Tests for the SessionStart hook JSON payload

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -euo pipefail

tmp_payload="$(mktemp)"
trap 'rm -f "$tmp_payload"' EXIT

has_jq=0
if command -v jq >/dev/null 2>&1; then
  has_jq=1
fi

payload="$(bash "$HOOK_DIR"/session-start.sh)"
printf '%s' "$payload" > "$tmp_payload"

HAS_JQ="$has_jq" PAYLOAD_PATH="$tmp_payload" node <<'NODE'
const fs = require('fs');

const raw = JSON.parse(fs.readFileSync(process.env.PAYLOAD_PATH, 'utf8'));
const hasJq = process.env.HAS_JQ === '1';

// Claude Code / Codex CLI require the SessionStart envelope shape:
//   {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "..."}}
const out = raw.hookSpecificOutput;
if (!out) {
  throw new Error('payload is missing hookSpecificOutput');
}
if (out.hookEventName !== 'SessionStart') {
  throw new Error(`expected hookEventName SessionStart, got ${out.hookEventName}`);
}
const context = out.additionalContext;
if (typeof context !== 'string' || context.length === 0) {
  throw new Error('additionalContext is missing or empty');
}

if (hasJq) {
  if (!context.includes('agent-skills loaded.')) {
    throw new Error('additionalContext is missing startup preface');
  }

  if (!context.includes('# Using Agent Skills')) {
    throw new Error('additionalContext is missing using-agent-skills content');
  }
} else {
  if (!context.includes('jq is required')) {
    throw new Error('additionalContext is missing jq fallback guidance');
  }
}

console.log('session-start JSON payload OK');
NODE
