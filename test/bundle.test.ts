import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
// @ts-ignore plain JS build script
import { bundleText, mmdOptions, OUT, OUT_MMD } from '../scripts/build.mjs';

test('committed bundle matches the source (run `npm run bundle` when this fails)', async () => {
  const fresh = await bundleText();
  assert.equal(readFileSync(OUT, 'utf8'), fresh, `${OUT} is stale`);
  assert.ok(statSync(OUT).mode & 0o111, 'bundle is executable');
});

test('bundle runs standalone: version and protocol are baked in', () => {
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const v = spawnSync(process.execPath, [OUT, 'version'], { encoding: 'utf8' });
  assert.equal(v.stdout.trim(), version);
  const p = spawnSync(process.execPath, [OUT, 'protocol', '--json'], { encoding: 'utf8', env: { ...process.env, OKR_SKIP_SKILL: '1' } });
  const j = JSON.parse(p.stdout);
  assert.equal(j.path, 'bundled');
  assert.equal(j.protocol, readFileSync(new URL('../docs/okr/PROTOCOL.md', import.meta.url), 'utf8'));
});

test('terminal-diagrams bundle matches the source (run `npm run bundle` when this fails)', async () => {
  const fresh = await bundleText(mmdOptions);
  assert.equal(readFileSync(OUT_MMD, 'utf8'), fresh, `${OUT_MMD} is stale`);
  assert.ok(statSync(OUT_MMD).mode & 0o111, 'bundle is executable');
});

test('mmd2txt renders a flowchart, flips a wide one, and rewrites markdown fences', () => {
  const ok = spawnSync(process.execPath, [OUT_MMD], { input: 'graph LR\n  A[start] --> B[end]', encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /start/);
  assert.match(ok.stdout, /[─│┌┐└┘]/, 'box drawing');
  assert.doesNotMatch(ok.stdout, /-->/, 'no raw source');

  const wide = spawnSync(process.execPath, [OUT_MMD, '--max-width', '30'], { input: 'graph LR\n  A[aaaaaaaaaa] --> B[bbbbbbbbbb] --> C[cccccccccc]', encoding: 'utf8' });
  assert.match(wide.stderr, /re-laid out the other way/);

  const md = spawnSync(process.execPath, [OUT_MMD, '--md'], { input: 'x\n\n```mermaid\ngraph LR\n  A --> B\n```\n\ny\n', encoding: 'utf8' });
  assert.equal(md.status, 0, md.stderr);
  assert.match(md.stdout, /^x\n\n```text\n[\s\S]*\n```\n\ny\n$/);

  const bad = spawnSync(process.execPath, [OUT_MMD], { input: 'pie\n  "a": 1', encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unsupported/);
});
