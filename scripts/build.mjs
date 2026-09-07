// Bundle each skill's CLI into one plain-JS file inside the skill (skills/okr/scripts/okr.js and
// skills/terminal-diagrams/scripts/mmd2txt.js), so a skill install (`npx skills add …`) carries a runnable CLI with
// no npm step and no TypeScript stripping (Node ≥ 20).
// package.json version and docs/okr/PROTOCOL.md are baked in. Run `npm run bundle` after changing src/ or the protocol;
// (the script is named `bundle`, not `build`: npm's pacote treats a `build` script like an install script and then
// npm 11 links a global git install to its temp clone, which breaks `npm install -g github:…`).
// test/bundle.test.ts fails when the committed bundle is stale.
import { build } from 'esbuild';
import { chmodSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(ROOT, 'skills', 'okr', 'scripts', 'okr.js');
export const OUT_MMD = resolve(ROOT, 'skills', 'terminal-diagrams', 'scripts', 'mmd2txt.js');

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

// mmd2txt: Mermaid → Unicode box art, with grok-mermaid (pure TS, no deps) inlined so the skill is self-contained.
export function mmdOptions(write) {
  const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
  const engine = JSON.parse(readFileSync(resolve(ROOT, 'node_modules', 'grok-mermaid', 'package.json'), 'utf8')).version;
  return {
    entryPoints: [resolve(ROOT, 'src', 'mmd2txt.ts')],
    outfile: OUT_MMD,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: { js: `#!/usr/bin/env node\n// mmd2txt, bundled by scripts/build.mjs from github.com/RoacherM/Wayne-Skills (engine grok-mermaid ${engine}, MIT) — do not edit, edit src/mmd2txt.ts.` },
    define: { __MMD2TXT_VERSION__: JSON.stringify(`${version} (grok-mermaid ${engine})`) },
    legalComments: 'none',
    logLevel: 'warning',
    write,
  };
}

export async function bundleText(opts = options) {
  const r = await build(opts(false));
  return r.outputFiles[0].text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [opts, out] of [[options, OUT], [mmdOptions, OUT_MMD]]) {
    await build(opts(true));
    chmodSync(out, 0o755);
    console.log(`built ${out} (${(readFileSync(out).length / 1024).toFixed(0)} KB)`);
  }
}
