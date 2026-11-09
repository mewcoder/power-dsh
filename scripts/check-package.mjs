import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { run as runProcess, runNpm } from './lib/process.mjs';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { listFiles } from './lib/files.mjs';
import { buildArtifacts } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await buildArtifacts({ check: true });
const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'power-dsh-package-check-'));
const run = (command, args, cwd = root) => runProcess(command, args, cwd);
try {
  const [packed] = JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory], root));
  assert.ok(packed && path.basename(packed.filename) === packed.filename, 'Invalid package filename');
  const files = new Set(packed.files.map(entry => entry.path));
  for (const name of files) {
    assert.ok(!path.posix.isAbsolute(name) && !name.split('/').includes('..'), `Invalid packed path: ${name}`);
    assert.doesNotMatch(name, /^(?:tests|scripts|reference|\.references|node_modules)\//, `Development files were shipped: ${name}`);
    assert.doesNotMatch(name, /(?:^|\/)tests\//, `Feature tests were shipped: ${name}`);
    assert.notEqual(name, 'AGENTS.md', 'Do not ship repository collaboration instructions.');
    if (name.startsWith('docs/')) {
      // npm also includes a directory's README when selecting files below it.
      assert.ok(['docs/README.md', 'docs/third-party-notices.md'].includes(name) || name.startsWith('docs/images/'),
        `Development documentation was shipped: ${name}`);
    }
  }
  const unpacked = path.join(directory, 'unpacked');
  await mkdir(unpacked);
  run('tar', ['-xzf', path.join(directory, packed.filename), '-C', unpacked]);
  const packageRoot = path.join(unpacked, 'package');
  const read = name => readFile(path.join(packageRoot, name), 'utf8');
  const manifest = JSON.parse(await read('package.json'));
  assert.equal(manifest.name, 'power-dsh');
  const actual = await listFiles(packageRoot);
  assert.deepEqual(actual.sort(), [...files].sort(), 'Tarball contents differ from npm pack metadata.');
  for (const target of Object.values(manifest.exports)) {
    assert.ok(target.startsWith('./'), `Invalid export target: ${target}`);
    if (target.includes('*')) {
      const [prefix, suffix] = target.slice(2).split('*');
      assert.ok([...files].some(name => name.startsWith(prefix) && name.endsWith(suffix)), `Empty export: ${target}`);
    } else assert.ok(files.has(target.slice(2)), `Export is missing: ${target}`);
  }
  const patch = manifest.dsh.bundle.patch;
  assert.ok(files.has(patch.replace(/^\.\//, '')), 'Bundle patch is missing.');
  for (const required of ['README.md', 'CHANGELOG.md', 'docs/third-party-notices.md', 'screenshots.json']) {
    assert.ok(files.has(required), `Required package resource is missing: ${required}`);
  }
  const screenshots = JSON.parse(await read('screenshots.json'));
  for (const name of screenshots) assert.ok(files.has(name), `Screenshot is missing: ${name}`);
  for (const spec of (await listFiles(root, 'src/features')).filter(name => name.endsWith('/spec.md'))) {
    assert.ok(files.has(spec), `Primary feature Spec is missing: ${spec}`);
  }
  assert.equal(manifest.exports['.'], './dist/index.js');
  assert.equal(manifest.types, './dist/index.d.ts');
  const artifacts = ['dist/client.js', 'dist/index.d.ts', 'dist/index.js'];
  assert.deepEqual(actual.filter(name => name.startsWith('dist/')).sort(), artifacts);
  assert.ok(!actual.some(name => name.startsWith('src/') && /\.(?:ts|js)$/.test(name)), 'Ship generated runtime artifacts, not compiler inputs.');
  for (const name of artifacts) {
    assert.ok(files.has(name), `Generated artifact is missing: ${name}`);
    assert.equal(await read(name), await readFile(path.join(root, name), 'utf8'), `Packed artifact differs: ${name}`);
  }
  for (const name of actual.filter(name => name.startsWith('dist/') && name.endsWith('.js'))) {
    run(process.execPath, ['--check', path.join(packageRoot, name)]);
    for (const [, specifier] of (await read(name)).matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
        assert.ok(files.has(target), `Runtime import is missing: ${name} → ${specifier}`);
      } else if (!isBuiltin(specifier)) {
        const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
        assert.ok(Object.hasOwn(manifest.dependencies ?? {}, packageName) || Object.hasOwn(manifest.peerDependencies ?? {}, packageName),
          `Runtime dependency is undeclared: ${name} → ${specifier}`);
      }
    }
  }
  let client;
  vm.runInNewContext(await read(manifest.exports['./client']), {
    window: { __ModuleLoader__: { load(definition) { assert.equal(client, undefined, 'Register the Client once.'); client = definition; } } },
  }, { filename: manifest.exports['./client'] });
  assert.equal(client?.id, manifest.name);
  assert.equal(typeof client?.factory, 'function');
  const icon = await read(manifest.exports['./icon']);
  assert.match(icon, /<svg\b/);
  assert.match(icon, /ISC License/);
  for (const language of ['en', 'zh']) {
    const target = manifest.exports['./locale/*.json'].replace('*', language);
    assert.equal(JSON.parse(await read(target)).meta.title, 'PowerDSH');
  }
  console.log(`Passed: actual tarball (${files.size} files, ${packed.size} bytes), exports, runtime imports and dependencies, Client registration, resources, and development-file exclusion.`);
  console.log('Not checked: dependency download, DSH installation, live factory activation, or rendered pages.');
} finally {
  const resolved = await realpath(directory);
  assert.equal(path.dirname(resolved), temporaryRoot, 'Cleanup must stay in the temporary root.');
  assert.ok(path.basename(resolved).startsWith('power-dsh-package-check-'), 'Unexpected cleanup target.');
  assert.notEqual(resolved, root, 'Never remove the repository.');
  await rm(resolved, { recursive: true, force: true });
}
