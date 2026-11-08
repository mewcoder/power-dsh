import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFile(path.join(root, name), 'utf8');
const isFile = async (name) => (await stat(path.join(root, name))).isFile();
const keys = (value) => Object.keys(value).sort();

const manifest = JSON.parse(await read('package.json'));
assert.equal(manifest.name, 'power-dsh');
assert.equal(manifest.private, true, 'The shell must stay private until publication is scoped.');
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(manifest.dsh.client.platform, 'web');
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'));
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'));

const resources = {
  '.': './index.js',
  './client': './client.js',
  './icon': './icon.svg',
};
for (const [key, target] of Object.entries(resources)) {
  assert.equal(manifest.exports[key], target);
  assert.ok(await isFile(target), `Missing resource: ${target}`);
  assert.ok(manifest.files.includes(target.slice(2)), `Not in files: ${target}`);
}
assert.equal(manifest.exports['./locale/*.json'], './locale/*.json');
for (const pattern of ['cordis.patch.yml', 'locale/*.json', 'docs/*.md', 'scripts/check.mjs', 'CHANGELOG.md']) {
  assert.ok(manifest.files.includes(pattern), `Missing distribution entry: ${pattern}`);
}

// This deliberately validates the minimal shell patch, not the full Loader YAML dialect.
const patch = await read('cordis.patch.yml');
assert.match(patch, /^- insert:\s*\n\s+- id: power-dsh\s*\n\s+name: ['"]power-dsh['"]\s*$/);

const english = JSON.parse(await read('locale/en.json'));
const chinese = JSON.parse(await read('locale/zh.json'));
assert.deepEqual(keys(english.meta), keys(chinese.meta));
for (const dictionary of [english, chinese]) {
  assert.equal(dictionary.meta.title, 'PowerDSH', 'The plugin display title must be PowerDSH in both languages.');
  for (const field of ['title', 'description']) {
    assert.ok(typeof dictionary.meta[field] === 'string' && dictionary.meta[field].trim());
  }
}

const client = await read('client.js');
assert.ok(client.includes(`id: '${manifest.name}'`), 'Client factory id must match the package.');
const dictionaryLiteral = client.match(/const dictionaries = (\{[\s\S]*?\n    \});/);
assert.ok(dictionaryLiteral, 'Keep the inline dictionaries JSON-compatible.');
const dictionaries = JSON.parse(dictionaryLiteral[1]);
assert.deepEqual(keys(dictionaries), ['en', 'zh']);
assert.deepEqual(keys(dictionaries.en), keys(dictionaries.zh));
assert.equal(dictionaries.en.description, english.meta.description, 'English settings and plugin descriptions must match.');
assert.equal(dictionaries.zh.description, chinese.meta.description, 'Chinese settings and plugin descriptions must match.');
for (const dictionary of Object.values(dictionaries)) {
  assert.equal(dictionary.title, 'PowerDSH', 'The settings title must be PowerDSH in both languages.');
  assert.ok(Object.values(dictionary).every((value) => typeof value === 'string' && value.trim()));
}
for (const [, key] of client.matchAll(/\bt\('([^']+)'\)/g)) {
  assert.ok(Object.hasOwn(dictionaries.en, key), `Missing UI translation: ${key}`);
}

const icon = await read('icon.svg');
assert.ok(Buffer.byteLength(icon) <= 256 * 1024, 'Icon exceeds the Host size limit.');
assert.match(icon, /<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(icon, /viewBox="0 0 24 24"/);
assert.match(icon, /<\/svg>\s*$/);
assert.doesNotMatch(icon, /<script\b|<foreignObject\b|\bhref\s*=/i);

const docFiles = ['README.md', 'CHANGELOG.md', 'AGENTS.md', ...(await readdir(path.join(root, 'docs')))
  .filter((name) => name.endsWith('.md')).map((name) => `docs/${name}`)];
for (const name of docFiles) {
  const markdown = await read(name);
  for (const [, rawTarget] of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = rawTarget.replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    assert.ok(!path.isAbsolute(target), `Use repository-relative documentation links: ${name}`);
    const resolved = path.resolve(root, path.dirname(name), decodeURIComponent(target));
    assert.ok(resolved.startsWith(root), `Link leaves the repository: ${name} → ${target}`);
    assert.ok((await stat(resolved)).isFile(), `Missing link target: ${name} → ${target}`);
  }
}

const sourceFiles = (await readdir(root)).filter(name => name.endsWith('.js'));
const checkFiles = (await readdir(path.join(root, 'scripts'))).filter(name => name.endsWith('.mjs')).map(name => `scripts/${name}`);
for (const name of [...sourceFiles, ...checkFiles]) {
  assert.ok(manifest.files.includes(name), `Not in distribution: ${name}`);
  const text = await read(name);
  for (const [, specifier] of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const resolved = path.relative(root, path.resolve(root, path.dirname(name), specifier));
    assert.ok(manifest.files.includes(resolved), `Local import is not shipped: ${name} → ${specifier}`);
  }
  const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message || `Syntax check failed: ${name}`);
}
for (const resource of manifest.files.filter(name => !name.includes('*'))) {
  assert.ok(await isFile(resource), `Missing distribution file: ${resource}`);
}
console.log('Passed: JavaScript syntax, bundle manifest and resources, bilingual keys, SVG structure, and local documentation links.');
console.log('Not checked: DSH installation, live slots, rendered icons, themes, locale switching, and unload behavior.');
