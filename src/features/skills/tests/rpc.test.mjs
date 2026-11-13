import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIST_SKILLS_RPC, READ_SKILL_RPC, DISCOVER_EXTERNAL_SKILLS_RPC, READ_SKILL_IMPORT_DESTINATION_RPC } from '../rpc.ts';

const source = { agent: 'Codex', path: '/codex/guide', realPath: '/shared/guide', linked: true };
const detail = {
  name: 'guide', description: 'Guide', content: 'Instructions', source: 'user-dsh', path: '/dsh/guide/SKILL.md',
  origin: '.dsh', enabled: true, modelInvocable: true, userInvocable: true,
};

test('destination previews validate the path and native state without exposing internal data', () => {
  const codec = READ_SKILL_IMPORT_DESTINATION_RPC.result.create();
  const value = { path: '/project/.dsh/skills/guide', complete: true, available: false, inherited: true };
  assert.deepEqual(codec.parse({ ...value, private: 'discard' }), value);
  for (const changed of [{ ...value, path: 1 }, { ...value, available: 'yes' }, { ...value, inherited: undefined }]) {
    assert.throws(() => codec.parse(changed), /Invalid skill import destination/);
  }
  assert.throws(() => READ_SKILL_IMPORT_DESTINATION_RPC.parameters.find(parameter => parameter.name === 'flat').codec.create().parse('true'));
});

test('native skill codecs expose current data without returning legacy import history', () => {
  const codec = READ_SKILL_RPC.result.create();
  assert.deepEqual(codec.parse(detail), detail);
  const parsed = codec.parse({ ...detail, installation: { private: 'legacy-record' }, sourceContent: 'private source' });
  assert.deepEqual(parsed, detail);
  assert.deepEqual(codec.parse({ ...detail, linkTarget: '/shared/guide/SKILL.md' }), { ...detail, linkTarget: '/shared/guide/SKILL.md' });
  for (const linkTarget of [null, '', true]) assert.throws(() => codec.parse({ ...detail, linkTarget }), /Invalid skill detail/);
  assert.throws(() => codec.parse({ ...detail, content: {} }), /Invalid skill detail/);
  const list = LIST_SKILLS_RPC.result.create();
  assert.throws(() => list.parse({ cwd: '', scope: 'user', complete: true, workspaces: [],
    skills: [{ ...detail, reason: '', canToggle: true, enabled: false }] }), /Invalid skill/);
});

test('deletion metadata validates the confirmed path, link type and revision', () => {
  const codec = READ_SKILL_RPC.result.create();
  const deletion = { path: '/dsh/skills/guide', linked: false, revision: 'a'.repeat(64) };
  assert.deepEqual(codec.parse({ ...detail, deletion: { ...deletion, private: 'discard' } }).deletion, deletion);
  for (const value of [{ ...deletion, path: '' }, { ...deletion, linked: 1 }, { ...deletion, revision: '' }, null]) {
    assert.throws(() => codec.parse({ ...detail, deletion: value }), /Invalid skill deletion/);
  }
});

test('discovery codecs validate variants without breaking catalogs from older hosts', () => {
  const codec = DISCOVER_EXTERNAL_SKILLS_RPC.result.create();
  const entry = { id: 'group', name: 'guide', description: 'Guide', source: 'Codex', path: '/codex/guide', flat: false };
  assert.deepEqual(codec.parse({ complete: true, entries: [entry] }), { complete: true, entries: [entry] });
  const variant = { id: 'candidate', description: 'Guide', path: source.path, flat: false, revision: 'digest', sources: [source] };
  const current = { ...entry, variants: [variant], sources: [source], comparison: 'same', conflict: false, inherited: true, available: true };
  assert.deepEqual(codec.parse({ complete: true, entries: [current] }).entries[0], current);
  for (const changed of [
    { ...current, variants: [{ ...variant, flat: 1 }] },
    { ...current, variants: [{ ...variant, sources: [null] }] },
    { ...current, comparison: 'similar' },
    { ...current, inherited: 'true' },
    { ...current, conflict: 1 },
    { ...current, available: 'true' },
    { ...current, sources: [{ ...source, linked: 1 }] },
    { ...current, sources: Array(401).fill(source) },
  ]) assert.throws(() => codec.parse({ complete: true, entries: [changed] }), /Invalid skill/);
});
