#!/usr/bin/env node
// Installed (under node_modules): run the bundle shipped inside the skill — plain JS, Node ≥ 20.
// Repo checkout: run the TypeScript source directly (Node ≥ 23.6 strips types natively), so edits take effect at once.
if (import.meta.url.includes('/node_modules/')) await import('../skills/okr/scripts/okr.js');
else await import('../src/cli.ts');
