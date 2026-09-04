#!/usr/bin/env node
// Runs after `npm install -g github:RoacherM/Wayne-Skills`: drop the okr skill into the agents' skill dirs.
// Only for global installs (npm sets npm_config_global) and never fails the install. OKR_SKIP_SKILL=1 skips.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.npm_config_global !== 'true' || process.env.OKR_SKIP_SKILL === '1') process.exit(0);
const okr = resolve(dirname(fileURLToPath(import.meta.url)), 'okr.js');
const r = spawnSync(process.execPath, [okr, 'skill', 'install'], { stdio: 'inherit' });
if (r.status !== 0) console.error('okr skill 没装上，稍后手动跑：okr skill install');
process.exit(0);
