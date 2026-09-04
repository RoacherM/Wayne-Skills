import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
// @ts-ignore plain JS build script
import { bundleText, OUT } from '../scripts/build.mjs';

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
