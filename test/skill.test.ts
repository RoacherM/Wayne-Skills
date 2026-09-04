import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ensureSkill, installSkill, removeSkill, SKILL_SRC, SKILL_STAMP, skillHash } from '../src/skill.ts';

const fresh = () => mkdtempSync(join(tmpdir(), 'okr-skill-'));

test('install copies the skill and links it for Claude Code; remove undoes it', () => {
  const home = fresh();
  const r = installSkill({ home });
  assert.equal(r.agents.action, 'copied');
  assert.equal(r.claude.action, 'linked');
  assert.equal(readFileSync(join(home, '.agents/skills/okr/SKILL.md'), 'utf8'), readFileSync(join(SKILL_SRC, 'SKILL.md'), 'utf8'));
  assert.equal(readlinkSync(join(home, '.claude/skills/okr')), '../../.agents/skills/okr');
  assert.ok(existsSync(join(home, '.claude/skills/okr/SKILL.md')), 'symlink resolves');

  const again = installSkill({ home });
  assert.equal(again.agents.action, 'copied');
  assert.equal(again.claude.action, 'kept');

  const rm = removeSkill({ home });
  assert.deepEqual(rm.kept, []);
  assert.equal(rm.removed.length, 2);
  assert.ok(!existsSync(join(home, '.agents/skills/okr')));
  assert.ok(!lstatSafe(join(home, '.claude/skills/okr')));
});

test('a dev symlink in ~/.agents/skills is kept unless --force; a real dir in ~/.claude/skills is never touched', () => {
  const home = fresh();
  mkdirSync(join(home, '.agents/skills'), { recursive: true });
  symlinkSync(SKILL_SRC, join(home, '.agents/skills/okr'));
  mkdirSync(join(home, '.claude/skills/okr'), { recursive: true });
  writeFileSync(join(home, '.claude/skills/okr/SKILL.md'), 'mine');

  const r = installSkill({ home });
  assert.equal(r.agents.action, 'kept-symlink');
  assert.equal(r.claude.action, 'skipped-dir');
  assert.equal(readFileSync(join(home, '.claude/skills/okr/SKILL.md'), 'utf8'), 'mine');

  const forced = installSkill({ home, force: true });
  assert.equal(forced.agents.action, 'copied');
  assert.ok(!lstatSync(join(home, '.agents/skills/okr')).isSymbolicLink());

  const rm = removeSkill({ home });
  assert.deepEqual(rm.kept, [join(home, '.claude/skills/okr')]);
});

function lstatSafe(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

test('ensureSkill installs when missing, refreshes only its own stamped copy, ignores symlinks and foreign dirs', () => {
  const home = fresh();
  const first = ensureSkill({ home });
  assert.equal(first?.action, 'installed');
  assert.equal(readFileSync(join(home, '.agents/skills/okr', SKILL_STAMP), 'utf8').trim(), skillHash(SKILL_SRC));
  assert.equal(ensureSkill({ home }), null, 'up to date → nothing');

  // a newer packaged skill → refreshed in place
  const src2 = fresh();
  cpSync(SKILL_SRC, src2, { recursive: true });
  writeFileSync(join(src2, 'SKILL.md'), 'v2');
  assert.equal(ensureSkill({ home, src: src2 })?.action, 'updated');
  assert.equal(readFileSync(join(home, '.agents/skills/okr/SKILL.md'), 'utf8'), 'v2');

  // a copy without our stamp (skills CLI, hand-made) is not ours to touch
  rmSync(join(home, '.agents/skills/okr', SKILL_STAMP));
  assert.equal(ensureSkill({ home }), null);
  assert.equal(readFileSync(join(home, '.agents/skills/okr/SKILL.md'), 'utf8'), 'v2');

  // a dev symlink is left alone; OKR_SKIP_SKILL=1 does nothing even when missing
  rmSync(join(home, '.agents/skills/okr'), { recursive: true });
  symlinkSync(SKILL_SRC, join(home, '.agents/skills/okr'));
  assert.equal(ensureSkill({ home }), null);
  const home2 = fresh();
  assert.equal(ensureSkill({ home: home2, env: { OKR_SKIP_SKILL: '1' } }), null);
  assert.ok(!existsSync(join(home2, '.agents')));
});
