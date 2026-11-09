import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { buildArtifacts } from './build.mjs';
import { run, runNpm } from './lib/process.mjs';
import { Config } from '../src/app/config.ts';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await buildArtifacts({ check: true });
const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'power-dsh-install-check-'));
try {
  const [packed] = JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory], root));
  assert.ok(packed && path.basename(packed.filename) === packed.filename, 'Invalid package filename.');
  const consumer = path.join(directory, 'consumer');
  await mkdir(consumer);
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({
    name: 'power-dsh-install-check', private: true, type: 'module',
    dependencies: { [manifest.name]: `file:${path.join(directory, packed.filename)}` },
  }, null, 2) + '\n');

  // All dependency installation is restricted to this disposable consumer.
  runNpm(['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false',
    '--registry=https://registry.npmjs.org'], consumer);
  const require = createRequire(path.join(consumer, 'package.json'));
  const packageRoot = await realpath(path.join(consumer, 'node_modules', manifest.name));
  assert.ok(packageRoot.startsWith(consumer + path.sep), 'The package must not link back to the workspace.');
  const entry = await realpath(require.resolve(manifest.name));
  assert.ok(entry.startsWith(packageRoot + path.sep));
  const installed = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(installed.version, manifest.version);
  const host = await import(pathToFileURL(entry).href);
  assert.equal(typeof host.apply, 'function');
  assert.deepEqual(Object.keys(host.Config.dict).sort(), Object.keys(Config.dict).sort(), 'Packed Host configuration differs.');
  const packageRequire = createRequire(entry);
  for (const dependency of Object.keys(installed.dependencies ?? {})) {
    assert.ok((await realpath(packageRequire.resolve(dependency))).startsWith(consumer + path.sep),
      `Production dependencies must resolve inside the independent consumer: ${dependency}`);
  }
  for (const tool of ['tsdown', 'typescript', 'esbuild', 'react']) {
    let resolved;
    try { resolved = await realpath(packageRequire.resolve(tool)); }
    catch (error) { if (error.code === 'MODULE_NOT_FOUND') continue; throw error; }
    // A globally available tool is not a dependency of this installation.
    assert.ok(!resolved.startsWith(consumer + path.sep), `Development tools or React were installed in production: ${tool}`);
  }
  for (const [subpath, target] of Object.entries(installed.exports)) {
    const names = target.includes('*') ? ['en', 'zh'].map(language => subpath.replace('*', language)) : [subpath];
    for (const name of names) {
      const request = name === '.' ? manifest.name : manifest.name + name.slice(1);
      assert.ok((await realpath(require.resolve(request))).startsWith(packageRoot + path.sep), `Export leaves the installed package: ${request}`);
    }
  }
  let client;
  vm.runInNewContext(await readFile(require.resolve(`${manifest.name}/client`), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { assert.equal(client, undefined); client = value; } } },
  }, { filename: installed.exports['./client'] });
  assert.equal(client?.id, manifest.name);
  assert.equal(typeof client?.factory, 'function');
  assert.ok((await realpath(path.join(packageRoot, installed.types))).startsWith(packageRoot + path.sep));

  // Compile from the consumer directory so imports resolve only its installed
  // declarations and native SDK. The compiler itself stays in the development workspace.
  await writeFile(path.join(consumer, 'usage.ts'), [
    `import * as plugin from ${JSON.stringify(manifest.name)};`,
    "import { Context } from '@deepseek-ai/cordis';",
    'const ctx = new Context();',
    'ctx.plugin(plugin);',
    'const count: number = plugin.Config.dict ? Object.keys(plugin.Config.dict).length : 0;',
    '// @ts-expect-error The public entry requires correctly typed live preferences.',
    "plugin.apply(ctx, { showVersion: 'true' });",
    'void count;',
    '',
  ].join('\n'));
  const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  run(process.execPath, [compiler, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'usage.ts'], consumer);
  console.log(`Passed: independent production installation of ${manifest.name}@${installed.version}, compiled Host, all public exports, Client registration, public Cordis types and exclusion of build tools/React.`);
  console.log(`Checked tarball: ${packed.entryCount} files, ${packed.size} bytes; ${packed.integrity}`);
  console.log('Not checked: DSH activation, real pages, platform behavior or npm registry publication.');
} finally {
  const resolved = await realpath(directory);
  assert.equal(path.dirname(resolved), temporaryRoot, 'Cleanup must stay in the temporary root.');
  assert.ok(path.basename(resolved).startsWith('power-dsh-install-check-'), 'Unexpected cleanup target.');
  assert.notEqual(resolved, root, 'Never remove the workspace.');
  await rm(resolved, { recursive: true, force: true });
}
