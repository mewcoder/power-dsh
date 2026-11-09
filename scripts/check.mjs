import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFile(path.join(root, name), 'utf8');
const isFile = async (name) => (await stat(path.join(root, name))).isFile();
const keys = (value) => Object.keys(value).sort();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (pattern, name) => new RegExp(`^${pattern.split('*').map(escapeRegExp).join('[^/]*')}$`).test(name);
async function listFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const name = `${directory}/${entry.name}`;
    return entry.isDirectory() ? listFiles(name) : [name];
  }));
  return files.flat();
}

const manifest = JSON.parse(await read('package.json'));
assert.equal(manifest.name, 'power-dsh');
assert.equal(manifest.private, true, 'The shell must stay private until publication is scoped.');
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(manifest.dsh.client.platform, 'web');
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'));
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'));

const isShipped = (name) => manifest.files.some(pattern => matches(pattern, name));
const resources = {
  '.': './src/index.js',
  './client': './src/client.js',
  './icon': './assets/icon.svg',
};
for (const [key, target] of Object.entries(resources)) {
  assert.equal(manifest.exports[key], target);
  assert.ok(await isFile(target), `Missing resource: ${target}`);
  assert.ok(isShipped(target.slice(2)), `Not in files: ${target}`);
}
assert.equal(manifest.exports['./locale/*.json'], './assets/locale/*.json');
for (const pattern of ['src/*.js', 'assets/locale/*.json', 'cordis.patch.yml', 'docs/*.md', 'scripts/*.mjs', 'tests/*.test.mjs', 'CHANGELOG.md', 'screenshots.json']) {
  assert.ok(manifest.files.includes(pattern), `Missing distribution entry: ${pattern}`);
}
assert.ok(!(await readdir(root)).some(name => /\.(?:[cm]?js|ts)$/.test(name)), 'Keep runtime source in src/, not the repository root.');
assert.ok(!(await readdir(path.join(root, 'scripts'))).some(name => name.endsWith('.test.mjs')), 'Keep tests in tests/, not scripts/.');

// This deliberately validates the minimal shell patch, not the full Loader YAML dialect.
const patch = await read('cordis.patch.yml');
assert.match(patch, /^- insert:\s*\n\s+- id: power-dsh\s*\n\s+name: ['"]power-dsh['"]\s*$/);

const english = JSON.parse(await read('assets/locale/en.json'));
const chinese = JSON.parse(await read('assets/locale/zh.json'));
assert.deepEqual(keys(english.meta), keys(chinese.meta));
for (const dictionary of [english, chinese]) {
  assert.equal(dictionary.meta.title, 'PowerDSH', 'The plugin display title must be PowerDSH in both languages.');
  for (const field of ['title', 'description']) {
    assert.ok(typeof dictionary.meta[field] === 'string' && dictionary.meta[field].trim());
  }
}

const client = await read('src/client.js');
assert.ok(client.includes(`id: '${manifest.name}'`), 'Client factory id must match the package.');
const dictionaryLiteral = client.match(/const dictionaries = (\{[\s\S]*?\n    \});/);
assert.ok(dictionaryLiteral, 'Keep the inline dictionaries JSON-compatible.');
const dictionaries = JSON.parse(dictionaryLiteral[1]);
assert.deepEqual(keys(dictionaries), ['en', 'zh']);
assert.deepEqual(keys(dictionaries.en), keys(dictionaries.zh));
assert.equal(dictionaries.en.description, 'A DSH enhancement plugin', 'Keep the English settings description concise.');
assert.equal(dictionaries.zh.description, 'DSH 增强插件', 'Keep the Chinese settings description concise.');
for (const dictionary of Object.values(dictionaries)) {
  assert.equal(dictionary.title, 'PowerDSH', 'The settings title must be PowerDSH in both languages.');
  assert.ok(Object.values(dictionary).every((value) => typeof value === 'string' && value.trim()));
}
for (const [, key] of client.matchAll(/\bt\('([^']+)'\)/g)) {
  assert.ok(Object.hasOwn(dictionaries.en, key), `Missing UI translation: ${key}`);
}

const icon = await read('assets/icon.svg');
assert.ok(Buffer.byteLength(icon) <= 256 * 1024, 'Icon exceeds the Host size limit.');
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
  assert.ok(info.isFile() || info.isDirectory(), `Missing link target: ${name} → ${target}`);
}
const docFiles = ['README.md', 'CHANGELOG.md', 'AGENTS.md', ...(await listFiles('docs')).filter(name => name.endsWith('.md'))];
for (const name of docFiles) {
  const markdown = await read(name);
  const targets = [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g), ...markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)];
  for (const [, target] of targets) await checkLocalTarget(name, target);
}
const screenshots = JSON.parse(await read('screenshots.json'));
assert.ok(Array.isArray(screenshots) && screenshots.length >= 1 && screenshots.length <= 8, 'Declare 1–8 screenshots.');
for (const screenshot of screenshots) {
  assert.equal(typeof screenshot, 'string');
  await checkLocalTarget('screenshots.json', screenshot);
}

const codeFiles = (await Promise.all(['src', 'scripts', 'tests'].map(listFiles))).flat().filter(name => /\.(?:js|mjs)$/.test(name));
for (const name of codeFiles) {
  assert.ok(isShipped(name), `Not in distribution: ${name}`);
  const text = await read(name);
  for (const [, specifier] of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const resolved = path.relative(root, path.resolve(root, path.dirname(name), specifier));
    assert.ok(await isFile(resolved), `Missing local import: ${name} → ${specifier}`);
    assert.ok(isShipped(resolved), `Local import is not shipped: ${name} → ${specifier}`);
  }
  const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message || `Syntax check failed: ${name}`);
}
const distributionFiles = [...codeFiles, ...await listFiles('assets'), ...await listFiles('docs'), ...await readdir(root)];
for (const pattern of manifest.files) {
  assert.ok(distributionFiles.some(name => matches(pattern, name)), `Empty distribution pattern: ${pattern}`);
  if (!pattern.includes('*')) assert.ok(await isFile(pattern), `Missing distribution file: ${pattern}`);
}
console.log('Passed: repository layout, JavaScript syntax, bundle manifest and resources, bilingual keys, SVG, screenshots, and local documentation links.');
console.log('Not checked: DSH installation, live slots, rendered icons, themes, locale switching, and unload behavior.');
