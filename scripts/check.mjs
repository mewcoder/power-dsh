import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles, matches } from './lib/files.mjs';
import { buildArtifacts } from './build.mjs';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(root, name), 'utf8');
const isFile = async name => (await stat(path.join(root, name))).isFile();
const keys = value => Object.keys(value).sort();
const filesIn = directory => listFiles(root, directory);
const manifest = JSON.parse(await read('package.json'));
assert.equal(manifest.name, 'power-dsh');
assert.match(manifest.packageManager, /^pnpm@\d+\.\d+\.\d+$/, 'Pin an exact development package-manager version.');
assert.match((await read('.node-version')).trim(), /^\d+\.\d+\.\d+$/, 'Pin a development Node version.');
assert.ok(manifest.private === undefined || typeof manifest.private === 'boolean', 'Use a valid npm private flag.');
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(manifest.dsh.client.platform, 'web');
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'));
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'));
assert.ok(!manifest.scripts.prepare && !manifest.scripts.install && !manifest.scripts.postinstall,
  'Installation must use the committed Client artifact without a build lifecycle script.');
const isShipped = name => manifest.files.some(pattern => matches(pattern, name));
for (const [key, target] of Object.entries({ '.': './dist/index.js', './client': './dist/client.js', './icon': './assets/icon.svg' })) {
  assert.equal(manifest.exports[key], target);
  assert.ok(await isFile(target), `Missing public resource: ${target}`);
  assert.ok(isShipped(target.slice(2)), `Public resource is not shipped: ${target}`);
}
assert.equal(manifest.exports['./locale/*.json'], './assets/locale/*.json');
for (const pattern of ['dist/*.js', 'dist/*.d.ts', 'src/features/*/spec.md', 'assets/locale/*.json', 'cordis.patch.yml', 'docs/third-party-notices.md', 'CHANGELOG.md', 'screenshots.json']) {
  assert.ok(manifest.files.includes(pattern), `Missing distribution entry: ${pattern}`);
}
assert.equal(manifest.types, './dist/index.d.ts');
assert.ok(await isFile(manifest.types) && isShipped(manifest.types.slice(2)), 'Ship the generated public declarations.');
assert.ok(!(await readdir(root)).some(name => /\.(?:[cm]?js|ts)$/.test(name) && name !== 'tsdown.config.ts'), 'Keep source under src/; only the build config belongs at root.');
const sourceFiles = await filesIn('src');
assert.deepEqual(sourceFiles.filter(name => !name.slice(4).includes('/')).sort(), ['src/client.ts', 'src/index.ts'],
  'Only the public entrypoints belong at the top of src/.');
assert.ok(!sourceFiles.some(name => name.endsWith('.js')), 'Migrate runtime source to TypeScript without parallel JS copies.');
const tsconfig = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
assert.equal(tsconfig.error, undefined);
const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, root);
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.options.strict, true, 'Enable strict project type checking.');
assert.notEqual(parsed.options.noImplicitAny, false, 'Do not weaken strict mode with implicit any.');
assert.equal(parsed.options.erasableSyntaxOnly, true, 'Source tests use native Node TypeScript stripping.');
assert.equal(parsed.options.noEmit, true);
assert.notEqual(parsed.options.allowJs, true);
const checkedSources = new Set(parsed.fileNames.map(name => path.relative(root, name).replaceAll(path.sep, '/')));
for (const name of sourceFiles.filter(name => name.endsWith('.ts'))) assert.ok(checkedSources.has(name), `Source is excluded from type checking: ${name}`);
const patch = await read('cordis.patch.yml');
assert.match(patch, /^- insert:\s*\n\s+- id: power-dsh\s*\n\s+name: ['"]power-dsh['"]\s*$/);

await buildArtifacts({ check: true });
const { hostFeatures } = await import('../src/app/host-features.ts');
const { clientFeatures } = await import('../src/app/client-features.ts');
const { dictionaries } = await import('../src/app/locales.ts');
const definitions = hostFeatures.map(feature => feature.definition);
const ids = definitions.map(feature => feature.id);
assert.equal(new Set(ids).size, ids.length, 'Duplicate feature id.');
assert.deepEqual(clientFeatures.map(feature => feature.definition.id).sort(), [...ids].sort(), 'Host/Client feature selection differs.');
const featureDirectories = (await readdir(path.join(root, 'src/features'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
assert.deepEqual(featureDirectories, [...ids].sort(), 'Feature directory or Spec is not registered.');
const ownedKeys = definitions.flatMap(feature => feature.keys);
assert.equal(new Set(ownedKeys).size, ownedKeys.length, 'Two features own the same configuration key.');
const index = await read('docs/README.md');
for (const definition of definitions) {
  const host = hostFeatures.find(feature => feature.definition.id === definition.id);
  const client = clientFeatures.find(feature => feature.definition.id === definition.id);
  assert.deepEqual(client.rpc.map(rpc => rpc.id).sort(), (host.rpc ?? []).map(rpc => rpc.id).sort(),
    `Host/Client RPC ownership differs: ${definition.id}`);
  assert.ok(['general', 'interface', 'enhance', 'simplify', 'other'].includes(definition.category));
  assert.equal(definition.spec, `src/features/${definition.id}/spec.md`);
  assert.ok(await isFile(definition.spec), `Missing primary Spec: ${definition.id}`);
  assert.ok(index.includes(`../${definition.spec}`), `Spec is missing from the documentation index: ${definition.id}`);
  assert.ok(isShipped(definition.spec), `Spec is not shipped: ${definition.id}`);
  assert.ok(sourceFiles.some(name => name.startsWith(`src/features/${definition.id}/tests/`) && name.endsWith('.test.mjs')),
    `Feature has no behavior tests: ${definition.id}`);
}
const english = JSON.parse(await read('assets/locale/en.json'));
const chinese = JSON.parse(await read('assets/locale/zh.json'));
assert.deepEqual(keys(english.meta), keys(chinese.meta));
for (const dictionary of [english, chinese]) {
  assert.equal(dictionary.meta.title, 'PowerDSH');
  for (const field of ['title', 'description']) assert.ok(typeof dictionary.meta[field] === 'string' && dictionary.meta[field].trim());
}
assert.deepEqual(keys(dictionaries), ['en', 'zh']);
assert.deepEqual(keys(dictionaries.en), keys(dictionaries.zh));
assert.equal(dictionaries.en.description, 'A DSH enhancement plugin');
assert.equal(dictionaries.zh.description, 'DSH 增强插件');
for (const dictionary of Object.values(dictionaries)) {
  assert.equal(dictionary.title, 'PowerDSH');
  assert.ok(Object.values(dictionary).every(value => typeof value === 'string' && value.trim()));
}
const icon = await read('assets/icon.svg');
assert.ok(Buffer.byteLength(icon) <= 256 * 1024);
assert.match(icon, /<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(icon, /viewBox="0 0 24 24"/);
assert.match(icon, /<\/svg>\s*$/);
assert.doesNotMatch(icon, /<script\b|<foreignObject\b|\bhref\s*=/i);

async function checkLocalTarget(name, rawTarget) {
  const target = rawTarget.replace(/^<|>$/g, '').split('#')[0];
  if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) return;
  assert.ok(!path.isAbsolute(target), `Use repository-relative documentation links: ${name}`);
  const resolved = path.relative(root, path.resolve(root, path.dirname(name), decodeURIComponent(target)));
  assert.ok(resolved && resolved !== '..' && !resolved.startsWith(`..${path.sep}`), `Link leaves the repository: ${name} → ${target}`);
  const info = await stat(path.join(root, resolved));
  assert.ok(info.isFile() || info.isDirectory(), `Missing link: ${name} → ${target}`);
}
const docFiles = ['README.md', 'CHANGELOG.md', 'AGENTS.md', ...(await filesIn('docs')).filter(name => name.endsWith('.md')),
  ...sourceFiles.filter(name => name.endsWith('/spec.md'))];
for (const name of docFiles) {
  const markdown = await read(name);
  for (const [, target] of [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g), ...markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)]) {
    await checkLocalTarget(name, target);
  }
}
const screenshots = JSON.parse(await read('screenshots.json'));
assert.ok(Array.isArray(screenshots) && screenshots.length >= 1 && screenshots.length <= 8);
for (const screenshot of screenshots) {
  assert.equal(typeof screenshot, 'string');
  await checkLocalTarget('screenshots.json', screenshot);
  assert.ok(isShipped(screenshot), `Screenshot is not shipped: ${screenshot}`);
}
const codeFiles = [sourceFiles, await filesIn('scripts'), await filesIn('tests'), ['tsdown.config.ts']].flat().filter(name => /\.(?:ts|js|mjs)$/.test(name));
for (const name of codeFiles) {
  const runtime = name.startsWith('src/') && !name.includes('/tests/');
  const text = await read(name);
  if (runtime) assert.doesNotMatch(text, /@ts-(?:nocheck|ignore)\b/, `Do not suppress source checking: ${name}`);
  if (runtime && name !== 'src/shared/client/error-feedback.ts') {
    assert.doesNotMatch(text, /\brole\s*:\s*['"]alert['"]/, `Use shared error feedback instead of a separate alert: ${name}`);
  }
  for (const [, key] of text.matchAll(/\bt\('([^']+)'\)/g)) {
    if (runtime) assert.ok(Object.hasOwn(dictionaries.en, key), `Missing translation: ${name} → ${key}`);
  }
  for (const [, specifier] of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const resolved = path.relative(root, path.resolve(root, path.dirname(name), specifier)).replaceAll(path.sep, '/');
    assert.ok(await isFile(resolved), `Missing local import: ${name} → ${specifier}`);
    if (runtime && name.startsWith('src/features/')) {
      const owner = name.split('/')[2];
      assert.ok(!resolved.startsWith('src/app/'), `Feature imports the assembly layer: ${name} → ${resolved}`);
      if (resolved.startsWith('src/features/')) assert.equal(resolved.split('/')[2], owner, `Cross-feature implementation import: ${name} → ${resolved}`);
    }
    if (runtime && name.startsWith('src/shared/')) assert.ok(resolved.startsWith('src/shared/'), `Shared code imports an assembly or feature: ${name} → ${resolved}`);
  }
  const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message || `Syntax check failed: ${name}`);
}
const distributionFiles = [...sourceFiles, ...await filesIn('assets'), ...await filesIn('docs'), ...await filesIn('dist'), ...await readdir(root)];
for (const pattern of manifest.files) {
  assert.ok(distributionFiles.some(name => matches(pattern, name)), `Empty distribution pattern: ${pattern}`);
  if (!pattern.includes('*')) assert.ok(await isFile(pattern), `Missing distribution file: ${pattern}`);
}
console.log(`Passed: ${ids.length} feature modules and primary Specs, dependency boundaries, current Client bundle, syntax, resources, bilingual keys, screenshots, and documentation links.`);
console.log('Not checked: DSH installation, real slots, rendered pages, platform behavior, or full application restart.');
