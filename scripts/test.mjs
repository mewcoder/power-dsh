import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listFiles } from './lib/files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await Promise.all(['tests', 'src/features'].map(directory => listFiles(root, directory))))
  .flat().filter(name => name.endsWith('.test.mjs'));
assert.ok(files.length, 'No feature or integration tests found.');
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
