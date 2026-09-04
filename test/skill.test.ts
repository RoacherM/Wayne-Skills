import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installSkill, removeSkill, SKILL_SRC } from '../src/skill.ts';

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
