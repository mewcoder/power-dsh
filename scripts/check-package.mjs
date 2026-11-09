import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'power-dsh-package-check-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || `${command} failed`);
  return result.stdout;
}
async function listFiles(base, prefix = '') {
  const nested = await Promise.all((await readdir(path.join(base, prefix), { withFileTypes: true })).map(entry => {
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? listFiles(base, name) : [name];
  }));
  return nested.flat();
}

try {
  const npmCommand = process.env.npm_execpath ? process.execPath : 'npm';
  const args = ['pack', '--ignore-scripts', '--json', '--pack-destination', directory];
  if (process.env.npm_execpath) args.unshift(process.env.npm_execpath);
  const [packed] = JSON.parse(run(npmCommand, args));
  assert.ok(packed && path.basename(packed.filename) === packed.filename, 'Invalid package filename');
  const files = new Set(packed.files.map(entry => entry.path));
  for (const name of files) {
    assert.ok(!path.posix.isAbsolute(name) && !name.split('/').includes('..'), `Invalid packed path: ${name}`);
    assert.doesNotMatch(name, /^(?:tests|scripts|reference|\.references|node_modules)\//, `Development files were shipped: ${name}`);
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
  for (const name of (await listFiles(path.join(root, 'src'))).filter(name => name.endsWith('.js'))) {
    const target = `src/${name}`;
    assert.ok(files.has(target), `Runtime source is missing: ${target}`);
    assert.equal(await read(target), await readFile(path.join(root, target), 'utf8'), `Packed source differs: ${target}`);
  }
  for (const name of actual.filter(name => name.startsWith('src/') && name.endsWith('.js'))) {
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
