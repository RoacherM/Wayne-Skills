import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installedAgents, LINKED_AGENTS, linkSkill } from '../bin/wayne-skills.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'wayne-skills-'));
const antigravity = LINKED_AGENTS.find((a) => a.id === 'antigravity');

test('only agents whose home exists are targeted, so no directory is created for the rest', () => {
  const home = fresh();
  mkdirSync(join(home, '.claude'));
  assert.deepEqual(installedAgents(home).map((a) => a.id), ['claude-code']);
  assert.ok(!existsSync(join(home, '.gemini')));
});

test('Antigravity gets a relative link into ~/.agents/skills that resolves', () => {
  const home = fresh();
  mkdirSync(join(home, '.gemini/antigravity'), { recursive: true });
  mkdirSync(join(home, '.agents/skills/demo'), { recursive: true });
  writeFileSync(join(home, '.agents/skills/demo/SKILL.md'), 'x');
  assert.deepEqual(installedAgents(home).map((a) => a.id), ['antigravity']);

  linkSkill(home, antigravity, 'demo');
  linkSkill(home, antigravity, 'demo');
  assert.equal(readlinkSync(join(home, '.gemini/config/skills/demo')), '../../../.agents/skills/demo');
  assert.ok(existsSync(join(home, '.gemini/config/skills/demo/SKILL.md')));
});

test('a real directory in the agent skills dir is left alone', () => {
  const home = fresh();
  mkdirSync(join(home, '.gemini/config/skills/demo'), { recursive: true });
  writeFileSync(join(home, '.gemini/config/skills/demo/SKILL.md'), 'mine');
  assert.match(linkSkill(home, antigravity, 'demo'), /没动/);
  assert.ok(existsSync(join(home, '.gemini/config/skills/demo/SKILL.md')));
});
