import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'tsdown';
import { hostConfig, clientConfig } from '../tsdown.config.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedFiles = { host: new Set(['index.js', 'index.d.ts']), client: new Set(['client.js']) };

export async function buildArtifacts({ check = false, clientOnly = false } = {}) {
  const outputs = new Map();
  const clientInputs = new Set();
  const configs = clientOnly ? [clientConfig] : [hostConfig, clientConfig];
  for (const config of configs) {
    const handle = await build({ ...config, config: false, write: false, clean: false, logLevel: 'silent' });
    try {
      const emitted = new Set();
      for (const bundle of handle.bundles) {
        for (const chunk of bundle.chunks) {
          emitted.add(chunk.fileName);
          assert.ok(expectedFiles[config.name].has(chunk.fileName), `Unexpected ${config.name} artifact: ${chunk.fileName}`);
          const target = path.join(root, 'dist', chunk.fileName);
          const contents = chunk.type === 'chunk' ? chunk.code : chunk.source;
          outputs.set(target, typeof contents === 'string' ? contents : Buffer.from(contents).toString('utf8'));
          if (config.name === 'client' && chunk.type === 'chunk') {
            assert.deepEqual(chunk.imports, [], 'The Client factory must not have external imports.');
            assert.deepEqual(chunk.dynamicImports, [], 'The Client factory must not load runtime chunks.');
            for (const id of Object.keys(chunk.modules)) {
              if (id.startsWith('\0')) continue; // Bundler-owned virtual helpers have no host capability.
              const name = path.relative(root, id).replaceAll(path.sep, '/');
              assert.ok(name.startsWith('src/'), `Client must use repository modules and the native factory: ${name}`);
              assert.doesNotMatch(name, /(?:^|\/)(?:host|config)\.ts$|\/shared\/host\/|\/tests\//,
                `Host or test code reached the Client bundle: ${name}`);
              clientInputs.add(name);
            }
          }
        }
      }
      assert.deepEqual([...emitted].sort(), [...expectedFiles[config.name]].sort(), `Missing ${config.name} artifact.`);
    } finally {
      for (const bundle of handle.bundles) await bundle[Symbol.asyncDispose]();
    }
  }
  for (const [target, contents] of outputs) {
    if (check) {
      let current;
      try { current = await readFile(target, 'utf8'); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        assert.fail(`Missing ${path.relative(root, target)}. Run npm run build before checking or shipping.`);
      }
      assert.ok(current === contents, `${path.relative(root, target)} is stale. Run npm run build and include the artifacts.`);
    } else {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
  }
  return { files: [...outputs.keys()].map(name => path.relative(root, name)), clientInputs: [...clientInputs].sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const check = process.argv.includes('--check');
  const result = await buildArtifacts({ check, clientOnly: process.argv.includes('--client') });
  console.log(`${check ? 'Passed: current' : 'Built:'} tsdown artifacts (${result.files.join(', ')}); production installation requires no compiler.`);
}
