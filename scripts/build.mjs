// Bundle the CLI into one plain-JS file inside the skill (skills/okr/scripts/okr.js), so a skill install
// (`npx skills add …`) carries a runnable CLI with no npm step and no TypeScript stripping (Node ≥ 20).
// package.json version and docs/okr/PROTOCOL.md are baked in. Run `npm run build` after changing src/ or the protocol;
// test/bundle.test.ts fails when the committed bundle is stale.
import { build } from 'esbuild';
import { chmodSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(ROOT, 'skills', 'okr', 'scripts', 'okr.js');

export function options(write) {
  const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
  const protocol = readFileSync(resolve(ROOT, 'docs', 'okr', 'PROTOCOL.md'), 'utf8');
  return {
    entryPoints: [resolve(ROOT, 'src', 'cli.ts')],
    outfile: OUT,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    // yaml's CJS build calls require(); an ESM bundle needs a real one.
    banner: { js: "#!/usr/bin/env node\n// okr CLI, bundled by scripts/build.mjs from github.com/RoacherM/Wayne-Skills — do not edit, edit src/.\nimport { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);" },
    define: {
      __OKR_VERSION__: JSON.stringify(version),
      __OKR_PROTOCOL__: JSON.stringify(protocol),
      __OKR_BUNDLED__: 'true',
    },
    legalComments: 'none',
    logLevel: 'warning',
    write,
  };
}

export async function bundleText() {
  const r = await build(options(false));
  return r.outputFiles[0].text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build(options(true));
  chmodSync(OUT, 0o755);
  console.log(`built ${OUT} (${(readFileSync(OUT).length / 1024).toFixed(0)} KB)`);
}
