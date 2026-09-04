#!/usr/bin/env node
// Node ≥ 23.6 strips TypeScript types natively, so the CLI runs straight from source.
// Node refuses to do that for files under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING),
// which is where `npm install -g github:RoacherM/Wayne-Skills` puts us — so there we strip with Node's own API.
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

if (import.meta.url.includes('/node_modules/')) {
  // stripTypeScriptTypes / registerHooks still print an ExperimentalWarning on some Node lines; keep stderr clean for agents.
  const printers = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w.name === 'ExperimentalWarning' && /stripTypeScriptTypes|registerHooks|module\.register/.test(w.message)) return;
    for (const p of printers) p(w);
  });
  registerHooks({
    load(url, context, nextLoad) {
      if (url.startsWith('file:') && url.endsWith('.ts')) {
        const source = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'strip' });
        return { format: 'module', source, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
}

await import('../src/cli.ts');
