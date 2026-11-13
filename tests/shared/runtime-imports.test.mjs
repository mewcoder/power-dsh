import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeImports } from '../../scripts/lib/runtime-imports.mjs';

test('package dependency discovery reads JavaScript imports and re-exports without interpreting product text as code', () => {
  const lines = [
    "import fs from 'node:fs';",
    "import './side-effect.js';",
    "export { value } from 'declared-package';",
    "export * from './exports.js';",
    "const lazy = import('lazy-package');",
    "const label = 'import';",
    "const action = scope === 'import' ? 'Import' : scope;",
    "const text = \"from 'private text' and import 'another text'\";",
  ];
  const code = lines.join('\n');
  assert.deepEqual(runtimeImports(code, 'client.js'), ['node:fs', './side-effect.js', 'declared-package', './exports.js', 'lazy-package']);
});
