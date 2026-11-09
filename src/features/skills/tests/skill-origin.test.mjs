import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skillOrigin } from '../skill-origin.ts';

function reader(packages = {}) {
  const calls = [];
  return { calls, readPackage: async path => {
    calls.push(path);
    if (!Object.hasOwn(packages, path)) throw new Error('Missing fixture manifest');
    return JSON.stringify(packages[path]);
  } };
}

test('native user/project filesystem sources expose .dsh and .agents without filesystem reads', async () => {
  const files = reader();
  assert.equal(await skillOrigin({ source: 'user-dsh' }, files), '.dsh');
  assert.equal(await skillOrigin({ source: 'user-agents' }, files), '.agents');
  assert.equal(await skillOrigin({ source: 'project-dsh' }, files), '.dsh');
  assert.equal(await skillOrigin({ source: 'project-agents' }, files), '.agents');
  assert.deepEqual(files.calls, []);
});

test('external filesystem summaries retain their real directory origin instead of losing the tag', async () => {
  const files = reader();
  assert.equal(await skillOrigin({ source: 'agent-codex', provider: 'dsh-skills-manager-external', path: '/home/test/.codex/skills/example/SKILL.md' }, files), '.codex');
  assert.equal(await skillOrigin({ source: 'agent-agents', path: '/home/test/.agents/skills/example/SKILL.md' }, files), '.agents');
  assert.equal(await skillOrigin({ source: 'project-codex', path: '/repo/.codex/skills/example/SKILL.md' }, files), '.codex');
  assert.equal(await skillOrigin({ source: 'custom', path: '/home/test/.dsh/skills/example/SKILL.md' }, files), '.dsh');
  assert.equal(await skillOrigin({ source: 'custom', resourceBase: { kind: 'directory', path: '/home/test/.agents/skills/example' } }, files), '.agents');
  assert.equal(await skillOrigin({ source: 'custom', path: 'C:\\Users\\test\\.codex\\skills\\example\\SKILL.md' }, files), '.codex');
  assert.equal(await skillOrigin({ source: 'custom', path: '/home/test/.agents/skills-old/example/SKILL.md' }, files), '');
  assert.equal(await skillOrigin({ source: 'custom', path: 'relative/.agents/skills/example/SKILL.md' }, files), '');
  assert.equal(await skillOrigin({ source: 'agent-codex', path: '/actual/.agents/skills/example/SKILL.md' }, files), '.agents');
  assert.equal(await skillOrigin({ source: 'agent-codex', provider: 'dsh-skills-manager-external' }, files), '');
  assert.equal(await skillOrigin({ source: 'custom', origin: '.codex' }, files), '.codex');
  assert.equal(await skillOrigin({ source: 'another-provider', path: '/home/test/.another-app/skills/example/SKILL.md' }, files), '.another-app');
  assert.deepEqual(files.calls, []);
});

test('installed Office provider maps to its verified package even when external assetRoot has no manifest', async () => {
  const files = reader();
  assert.equal(await skillOrigin({ name: 'office-xlsx', provider: 'dsh-office', source: 'bundled', resourceBase: { kind: 'directory', path: '/Resources/office-assets/office-xlsx' } }, files), '@deepseek-ai/dsh-skill-office');
  assert.equal(await skillOrigin({ name: 'office', provider: 'runtime', source: 'runtime' }, files), '');
  assert.equal(await skillOrigin({ name: 'custom-office', provider: 'dsh-office', source: 'runtime' }, files), '');
  assert.deepEqual(files.calls, []);
});

test('disabled skill metadata can retain a verified origin without carrying body or resource objects', async () => {
  const files = reader();
  assert.equal(await skillOrigin({ provider: 'power-dsh-disabled-skills', source: 'bundled', origin: '@example/skill-provider' }, files), '@example/skill-provider');
  assert.equal(await skillOrigin({ source: 'bundled', provider: 'dsh-office', origin: '' }, files), '@deepseek-ai/dsh-skill-office');
  assert.equal(await skillOrigin({ origin: '../../private', source: 'runtime', provider: 'runtime' }, files), '');
  assert.deepEqual(files.calls, []);
});

test('package-backed paths require matching manifest name and work in asar and pnpm layouts', async () => {
  const asar = '/Applications/DSH.app/Contents/Resources/app.asar/dsh/node_modules/@example/skills/assets/hello/SKILL.md';
  const pnpm = '/app/node_modules/.pnpm/@example+skills@1.0/node_modules/@example/skills/assets/hello/SKILL.md';
  const files = reader({
    '/Applications/DSH.app/Contents/Resources/app.asar/dsh/node_modules/@example/skills/package.json': { name: '@example/skills' },
    '/app/node_modules/.pnpm/@example+skills@1.0/node_modules/@example/skills/package.json': { name: '@example/skills' },
  });
  assert.equal(await skillOrigin({ provider: 'runtime', source: 'bundled', path: asar }, files), '@example/skills');
  assert.equal(await skillOrigin({ provider: 'runtime', source: 'bundled', resourceBase: { kind: 'directory', path: pnpm } }, files), '@example/skills');
  assert.ok(files.calls.every(path => path.endsWith('/package.json')));
});

test('unknown providers and mismatched or missing package manifests never produce guessed owner names', async () => {
  const files = reader({
    '/app/node_modules/outer/node_modules/inner/package.json': { name: 'wrong' },
    '/app/node_modules/outer/package.json': { name: 'outer' },
  });
  assert.equal(await skillOrigin({ provider: 'office', name: 'office', source: 'runtime' }, files), '');
  assert.equal(await skillOrigin({ source: 'bundled', path: '/app/node_modules/outer/node_modules/inner/assets/SKILL.md' }, files), '');
  assert.deepEqual(files.calls, ['/app/node_modules/outer/node_modules/inner/package.json']);
});
