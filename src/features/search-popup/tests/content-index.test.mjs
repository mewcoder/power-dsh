import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { ContentIndex } from '../content-index.ts';

const HOME = '/test/profile';
const IDS = ['s1', 's2', 's3'];

function service() {
  return { async searchSessions() {}, async readSurface() { return { events: [] }; } };
}

function query(index, text, limit = 10, previews = [], ids = IDS) {
  return index.query(text, limit, previews, ids);
}

// The index reads a real SQLite database, so these tests build one with the
// engine's own schema markers. Anything that fails that contract must answer
// `available: false` rather than throw.
function fixture({ applicationId = 0x44534851, userVersion = 8, rows, generation = 1, fail = null } = {}) {
  const queries = [];
  const database = {
    prepare(sql) {
      queries.push(sql.replace(/\s+/g, ' ').trim());
      return {
        get: (...parameters) => {
          if (sql.includes('PRAGMA application_id')) return { application_id: applicationId };
          if (sql.includes('PRAGMA user_version')) return { user_version: userVersion };
          if (sql.includes('search_state')) return { generation };
          return undefined;
        },
        all: (...parameters) => {
          if (fail !== null) throw new Error(fail);
          return rows;
        },
      };
    },
    close() { queries.push('close'); },
  };
  const owner = { profileContext: { home: HOME } };
  const index = new ContentIndex(owner);
  index.service = service();
  index.connect = async () => (fail === 'open' ? null : database);
  return { index, queries };
}

const ROWS = [
  { sessionId: 's1', time: 100, createdAt: 10, text: 'Record each externally perceptible breaking change in an upgrade guide' },
  { sessionId: 's1', time: 200, createdAt: 10, text: 'dsh dsh dsh repeated term' },
  { sessionId: 's2', time: 300, createdAt: 20, text: 'another session mentioning dsh once' },
  { sessionId: 's3', time: 400, createdAt: 30, text: 'no match here' },
];

test('the index answers literal substring queries with full recall', async () => {
  const { index } = fixture({ rows: ROWS });
  const result = await query(index, 'dsh');
  assert.equal(result.available, true);
  assert.deepEqual(result.items.map(item => item.sessionId), ['s1', 's2'],
    'Sessions rank by match count, then recency.');
  assert.match(result.items[0].snippet, /dsh/);
});

test('Chinese one and two character queries match, which the FTS tokenizer cannot', async () => {
  const rows = [
    { sessionId: 's1', time: 100, createdAt: 10, text: '今天我们来讨论全文搜索的实现方案' },
    { sessionId: 's2', time: 200, createdAt: 20, text: '无关内容' },
  ];
  const { index } = fixture({ rows });
  for (const query of ['全文搜索', '搜索', '方案']) {
    const result = await index.query(query, 10, [], IDS);
    assert.deepEqual(result.items.map(item => item.sessionId), ['s1'], `Literal recall for ${query}`);
  }
});

test('the snippet is centered on the match and bounded', async () => {
  const long = `${'x'.repeat(600)}NEEDLE${'y'.repeat(600)}`;
  const { index } = fixture({ rows: [{ sessionId: 's1', time: 1, createdAt: 1, text: long }] });
  const [hit] = (await query(index, 'needle', 5)).items;
  const length = Array.from(hit.snippet).length;
  assert.ok(length <= 240, `Snippet stays bounded: ${length}`);
  assert.match(hit.snippet, /needle/i);
  assert.ok(hit.snippet.startsWith('…') && hit.snippet.endsWith('…'));
});

test('an absent, foreign or outdated database reports unavailable instead of throwing', async () => {
  const { index: absent } = fixture({ rows: ROWS, fail: 'open' });
  assert.deepEqual(await query(absent, 'dsh'), { available: false, items: [], previews: [] });

  // A real database file proves the guard: only this plugin's derived index with
  // the expected schema version is readable.
  const { DatabaseSync } = await import('node:sqlite');
  for (const [label, pragmas] of [
    ['foreign application', [`PRAGMA application_id = 12345`, `PRAGMA user_version = 8`]],
    ['outdated schema', [`PRAGMA application_id = ${0x44534851}`, `PRAGMA user_version = 7`]],
  ]) {
    const path = join(tmpdir(), `power-dsh-content-${label.replaceAll(' ', '-')}-${process.pid}.sqlite3`);
    const db = new DatabaseSync(path);
    for (const pragma of pragmas) db.exec(pragma);
    db.close();
    try {
      const real = new ContentIndex({ profileContext: { home: join(dirname(path), '..') } });
      real.path = path;
      real.service = service();
      assert.equal(await query(real, 'dsh').then(result => result.available), false, label);
    } finally {
      rmSync(path, { force: true });
    }
  }
});

test('a query error does not leave a half-loaded cache behind', async () => {
  const { index } = fixture({ rows: ROWS, fail: 'read failed' });
  assert.equal((await query(index, 'dsh')).available, false);
  assert.equal(index.sessions, null, 'A failed load never publishes partial rows.');
});

test('an unchanged generation is reused and a new one reloads', async () => {
  const { index, queries } = fixture({ rows: ROWS, generation: 1 });
  await query(index, 'dsh');
  const loads = queries.filter(sql => sql.startsWith('SELECT d.session_id')).length;
  await query(index, 'dsh');
  assert.equal(queries.filter(sql => sql.startsWith('SELECT d.session_id')).length, loads,
    'A cached generation is not read again.');
  index.clear();
  await query(index, 'dsh');
  assert.ok(queries.filter(sql => sql.startsWith('SELECT d.session_id')).length > loads,
    'A newer generation reloads the corpus.');
});

test('named sessions yield their newest message as a preview', async () => {
  const { index } = fixture({ rows: ROWS });
  await query(index, 'dsh');
  const previews = index.previews(['s2', 's3']);
  assert.deepEqual(previews.map(row => row.sessionId).sort(), ['s2', 's3']);
  assert.match(previews.find(row => row.sessionId === 's2').snippet, /another session mentioning dsh once/,
    'The newest message is the preview, not the first one.');
  // An unknown id simply yields no preview instead of failing the whole call.
  assert.deepEqual(index.previews(['nope']), []);
});

test('the query result carries previews for the requested sessions', async () => {
  const { index } = fixture({ rows: ROWS });
  const result = await query(index, 'dsh', 10, ['s3']);
  assert.equal(result.available, true);
  assert.deepEqual(result.previews.map(row => row.sessionId), ['s3']);
});

test('an empty query matches nothing without touching the database', async () => {
  const { index, queries } = fixture({ rows: ROWS });
  assert.deepEqual((await query(index, '')).items, []);
  assert.equal(queries.length, 0);
});

test('an existing SQLite seed and warm searches do not run full native synchronization', async () => {
  const rows = [...ROWS];
  const { index } = fixture({ rows });
  let generation = 1;
  let syncs = 0;
  const database = {
    prepare(sql) {
      return { get: () => ({ generation }), all: () => rows };
    },
    close() {},
  };
  index.connect = async () => database;
  index.service.searchSessions = async (request, { signal }) => {
    assert.equal(request.limit, 1);
    assert.match(request.query, /^power-dsh-index-sync-/);
    assert.equal(signal.aborted, false);
    syncs++;
  };
  assert.deepEqual((await query(index, 'dsh')).items.map(hit => hit.sessionId), ['s1', 's2']);
  index.connect = async () => assert.fail('Warm searches must not reopen SQLite');
  await query(index, 'dsh');
  assert.equal(syncs, 0);
});

test('live current surfaces replace durable content including an empty replacement', async () => {
  const { index } = fixture({ rows: ROWS });
  const source = { id: 's1', header: { createdAt: 10 }, seq: 3, surface: { contentGeneration: 0, nodes: [0, 1, 2] } };
  index.store = { get: id => id === 's1' ? source : undefined };
  index.service.readSurface = async () => ({ events: [
    { type: 'user/message', time: 500, data: { content: [{ type: 'text', text: '实时新正文' }] } },
    { type: 'assistant/message', time: 600, data: { message: { content: [
      { type: 'reasoning', text: 'private reasoning' }, { type: 'text', text: '实时回答' },
    ] } } },
    { type: 'tool/result', time: 700, data: { message: { content: [{ type: 'text', text: 'raw output' }] } } },
  ] });
  assert.deepEqual((await query(index, '新正文')).items.map(hit => hit.sessionId), ['s1']);
  assert.deepEqual((await query(index, 'repeated')).items, []);
  assert.deepEqual((await query(index, 'private reasoning')).items, []);
  assert.deepEqual((await query(index, 'raw output')).items, []);
  assert.equal((await query(index, 'unmatched', 10, ['s1'])).previews[0].snippet, '实时回答');
  index.service.readSurface = async () => ({ events: [] });
  source.surface.contentGeneration++;
  assert.deepEqual((await query(index, '新正文')).items, []);
});

test('visibility and recency are applied before the result limit', async () => {
  const rows = [
    ...Array.from({ length: 25 }, (_, position) => ({ sessionId: `hidden-${position}`, time: 1, createdAt: 1, text: 'needle needle' })),
    { sessionId: 'old', time: 1, createdAt: 1, text: 'needle needle needle' },
    { sessionId: 'recent', time: 2, createdAt: 2, text: 'needle' },
  ];
  const { index } = fixture({ rows });
  const result = await query(index, 'needle', 1, [], ['recent', 'old']);
  assert.deepEqual(result.items.map(hit => hit.sessionId), ['recent']);
  assert.deepEqual((await query(index, 'needle', 20, [], [])).items, []);
});

test('disabled enhancement never reads a retained database or returns cached content', async () => {
  let enabled = true;
  const index = new ContentIndex({ profileContext: { home: HOME } }, () => enabled);
  index.sessions = [{ id: 's1', createdAt: 1, documents: [{ time: 1, text: 'secret' }] }];
  index.connect = async () => assert.fail('A disabled enhancement must not open its retained database');
  index.service = { ...service(), searchSessions: async () => assert.fail('Disabled content search must not synchronize') };
  enabled = false;
  assert.deepEqual(await query(index, 'secret'), { available: true, items: [], previews: [] });
  assert.equal(index.sessions, null);
});

test('a host without the synchronization service cannot serve an old snapshot', async () => {
  const { index } = fixture({ rows: ROWS });
  index.service = null;
  index.sessions = [{ id: 's1', createdAt: 1, documents: [{ time: 1, text: 'dsh' }] }];
  assert.equal((await query(index, 'dsh')).available, false);
});

test('unload aborts synchronization and rejects late cache publication', async () => {
  const { index } = fixture({ rows: ROWS });
  let release;
  index.connect = () => new Promise(resolve => { release = resolve; });
  const pending = query(index, 'dsh');
  await new Promise(resolve => setImmediate(resolve));
  index.dispose();
  let closed = false;
  release({ prepare() { assert.fail('An unloaded cache must not read rows'); }, close() { closed = true; } });
  await pending;
  assert.equal(index.sessions, null);
  assert.equal(closed, true);
  assert.equal(index.service, null);
});

test('a failed native synchronization never serves stale content as successful', async () => {
  const { index } = fixture({ rows: ROWS });
  index.connect = async () => null;
  index.service.searchSessions = async () => { throw new Error('sync failed'); };
  await assert.rejects(query(index, 'dsh'), /sync failed/);
});

test('a real SQLite cache initializes once and is recreated after clearing', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const directory = mkdtempSync(join(tmpdir(), 'power-dsh-content-sync-'));
  const path = join(directory, 'index.sqlite3');
  const index = new ContentIndex({ profileContext: { home: HOME } });
  index.path = path;
  let generation = 0;
  index.service = { ...service(), async searchSessions() {
    const database = new DatabaseSync(path);
    try {
      database.exec(`PRAGMA application_id = ${0x44534851}; PRAGMA user_version = 8;
        CREATE TABLE IF NOT EXISTS search_state(singleton INTEGER, global_generation INTEGER);
        CREATE TABLE IF NOT EXISTS persisted_sessions(id TEXT, created_at INTEGER, revision TEXT);
        CREATE TABLE IF NOT EXISTS persisted_docs(session_id TEXT, time INTEGER, text TEXT, type TEXT, surface TEXT);
        DELETE FROM search_state; DELETE FROM persisted_sessions; DELETE FROM persisted_docs;`);
      database.prepare('INSERT INTO search_state VALUES (1, ?)').run(++generation);
      database.prepare('INSERT INTO persisted_sessions VALUES (?, ?, ?)').run('s1', 1, `revision-${generation}`);
      database.prepare('INSERT INTO persisted_docs VALUES (?, ?, ?, ?, ?)')
        .run('s1', generation, `fresh generation ${generation}`, 'user/message', 'current');
      database.prepare('INSERT INTO persisted_sessions VALUES (?, ?, ?)').run('hidden', 1, 'hidden-revision');
      database.prepare('INSERT INTO persisted_docs VALUES (?, ?, ?, ?, ?)')
        .run('hidden', 1, 'unneeded hidden conversation', 'user/message', 'current');
    } finally {
      database.close();
    }
  } };
  try {
    assert.equal((await query(index, 'generation 1')).items.length, 1);
    assert.equal(index.sessions.some(session => session.id === 'hidden'), false);
    assert.equal((await query(index, 'generation 1')).items.length, 1);
    assert.equal(generation, 1);
    await index.service.searchSessions();
    index.clear();
    assert.equal((await query(index, 'generation 2')).items.length, 1);
    assert.equal(index.generation, 2);
  } finally {
    index.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('unload aborts an in-flight native synchronization without opening the cache', async () => {
  const { index } = fixture({ rows: ROWS });
  let release;
  let signal;
  index.service.searchSessions = async (_request, options) => {
    signal = options.signal;
    await new Promise(resolve => { release = resolve; });
  };
  let opens = 0;
  index.connect = async () => { opens++; return null; };
  const pending = query(index, 'dsh');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signal.aborted, false);
  index.dispose();
  assert.equal(signal.aborted, true);
  release();
  assert.deepEqual(await pending, { available: true, items: [], previews: [] });
  assert.equal(index.sessions, null);
  assert.equal(opens, 1);
});

function liveFixture() {
  const app = fixture({ rows: ROWS.map(row => ({ ...row, revision: 'original' })) });
  const source = { id: 's1', header: { createdAt: 10 }, seq: 1, surface: { contentGeneration: 0, nodes: [0] } };
  let current = source;
  let events = [{ type: 'user/message', seq: 0, time: 100, data: { content: [{ type: 'text', text: 'original message' }] } }];
  let reads = 0;
  app.index.store = { get: id => id === 's1' ? current : undefined };
  app.index.service.readSurface = async () => {
    reads++;
    return { capturedThroughSeq: current.seq - 1, events };
  };
  return { ...app, source, reads: () => reads, setEvents: value => { events = value; }, replace: value => { current = value; } };
}

test('unchanged live sessions reuse their snapshot across different queries', async () => {
  const app = liveFixture();
  for (const text of ['original', 'message', 'dsh', 'unmatched', 'original']) await query(app.index, text);
  assert.equal(app.reads(), 1);
});

test('ordinary live messages update the cached body without reading the surface again', async () => {
  const app = liveFixture();
  await query(app.index, 'original');
  const event = { type: 'assistant/message', seq: 1, time: 200,
    data: { message: { content: [{ type: 'reasoning', text: 'hidden reasoning' }, { type: 'text', text: 'new answer' }] } } };
  app.source.seq++;
  app.source.surface.nodes.push(event.seq);
  app.index.append(app.source, event);
  assert.deepEqual((await query(app.index, 'new answer')).items.map(hit => hit.sessionId), ['s1']);
  assert.deepEqual((await query(app.index, 'hidden reasoning')).items, []);
  assert.equal((await query(app.index, 'title only', 10, ['s1'])).previews[0].snippet, 'new answer');
  assert.equal(app.reads(), 1);
});

test('structural events advance the live cursor without rebuilding or indexing raw payloads', async () => {
  const app = liveFixture();
  await query(app.index, 'original');
  const event = { type: 'request/header', seq: 1, time: 200, data: { secret: 'never searchable' } };
  app.source.seq++;
  app.index.append(app.source, event);
  assert.deepEqual((await query(app.index, 'never searchable')).items, []);
  assert.equal(app.reads(), 1);
});

test('surface replacement invalidates only that session and removes old matches', async () => {
  const app = liveFixture();
  await query(app.index, 'original');
  app.source.seq++;
  app.source.surface.contentGeneration++;
  app.source.surface.nodes = [1];
  const replacement = { type: 'user/message', seq: 1, time: 200, data: { content: [{ type: 'text', text: 'replacement' }] } };
  app.setEvents([replacement]);
  app.index.append(app.source, replacement);
  assert.deepEqual((await query(app.index, 'original')).items, []);
  assert.deepEqual((await query(app.index, 'replacement')).items.map(hit => hit.sessionId), ['s1']);
  assert.equal(app.reads(), 2);
});

test('a missed event or changed session instance cannot reuse the old live snapshot', async () => {
  const app = liveFixture();
  await query(app.index, 'original');
  app.source.seq += 2;
  app.source.surface.nodes = [];
  app.setEvents([]);
  assert.deepEqual((await query(app.index, 'original')).items, []);
  assert.equal(app.reads(), 2);
  app.replace({ ...app.source });
  await query(app.index, 'original');
  assert.equal(app.reads(), 3);
});

test('cold revision checks are on demand and reread only changed candidates', async () => {
  const app = fixture({ rows: ROWS.map(row => ({ ...row, revision: 'original' })) });
  let lists = 0;
  let changed = false;
  const reads = [];
  app.index.persistence = { async list() {
    lists++;
    return IDS.map(id => ({ header: { id, createdAt: 1 }, revision: changed && id === 's1' ? 'changed' : 'original' }));
  } };
  app.index.service.readSurface = async id => {
    reads.push(id);
    return { events: [{ type: 'user/message', seq: 0, time: 1, data: { content: [{ type: 'text', text: 'fresh cold content' }] } }] };
  };
  await query(app.index, 'fresh');
  await query(app.index, 'fresh');
  assert.equal(lists, 1);
  changed = true;
  app.index.checkedAt = 0;
  assert.deepEqual((await query(app.index, 'fresh')).items.map(hit => hit.sessionId), ['s1']);
  await query(app.index, 'fresh');
  assert.equal(lists, 2);
  assert.deepEqual(reads, ['s1']);
});

test('deleted cold sessions are removed without rereading a missing source', async () => {
  const app = fixture({ rows: ROWS.map(row => ({ ...row, revision: 'original' })) });
  await query(app.index, 'dsh');
  app.index.persistence = { async list() { return []; } };
  app.index.service.readSurface = async () => assert.fail('Known deleted sessions must not be read');
  app.index.checkedAt = 0;
  assert.deepEqual((await query(app.index, 'dsh')).items, []);
});

test('created and disposed sessions refresh lazily instead of running background searches', async () => {
  const app = liveFixture();
  await query(app.index, 'original');
  app.index.invalidate('s1');
  assert.equal(app.reads(), 1);
  app.setEvents([]);
  assert.deepEqual((await query(app.index, 'original')).items, []);
  assert.equal(app.reads(), 2);
});

test('overlapping first searches share one synchronization and database load', async () => {
  const app = fixture({ rows: ROWS });
  const connect = app.index.connect.bind(app.index);
  let opens = 0;
  let release;
  app.index.connect = async () => {
    opens++;
    await new Promise(resolve => { release = resolve; });
    return connect();
  };
  const first = query(app.index, 'dsh');
  const second = query(app.index, 'change');
  release();
  await Promise.all([first, second]);
  assert.equal(opens, 1);
  assert.equal(app.queries.filter(sql => sql.startsWith('SELECT d.session_id')).length, 1);
});

test('a retained SQLite seed is checked against revisions before its first result', async () => {
  const app = fixture({ rows: ROWS.map(row => ({ ...row, revision: 'old' })) });
  const reads = [];
  app.index.persistence = { async list() {
    return IDS.map(id => ({ header: { id, createdAt: 1 }, revision: id === 's1' ? 'new' : 'old' }));
  } };
  app.index.service.searchSessions = async () => assert.fail('A usable seed must not trigger a full engine rebuild');
  app.index.service.readSurface = async id => {
    reads.push(id);
    return { events: [{ type: 'user/message', seq: 0, time: 1, data: { content: [{ type: 'text', text: 'fresh persisted message' }] } }] };
  };
  assert.deepEqual((await query(app.index, 'fresh')).items.map(hit => hit.sessionId), ['s1']);
  assert.deepEqual(reads, ['s1']);
});

test('a disabled native engine still requires restart even if an old SQLite file exists', async () => {
  const app = fixture({ rows: ROWS });
  app.index.service.config = { openAt: 'never' };
  app.index.connect = async () => assert.fail('An engine awaiting restart must not read its old seed');
  await assert.rejects(query(app.index, 'dsh'), /search is disabled/);
});

test('disabled or unused caches ignore lifecycle notifications without retaining session ids', () => {
  const app = fixture({ rows: ROWS });
  for (let position = 0; position < 100; position++) app.index.invalidate(`unused-${position}`);
  assert.equal(app.index.dirty.size, 0);
});

test('concurrent revision checks share the same listing', async () => {
  const app = fixture({ rows: ROWS.map(row => ({ ...row, revision: 'old' })) });
  await query(app.index, 'dsh');
  let lists = 0;
  let release;
  app.index.persistence = { async list() {
    lists++;
    await new Promise(resolve => { release = resolve; });
    return IDS.map(id => ({ header: { id, createdAt: 1 }, revision: 'old' }));
  } };
  app.index.checkedAt = 0;
  const first = query(app.index, 'dsh');
  const second = query(app.index, 'dsh');
  await new Promise(resolve => setImmediate(resolve));
  release();
  await Promise.all([first, second]);
  assert.equal(lists, 1);
});

test('clearing during a live read prevents late documents from repopulating the cache', async () => {
  const app = liveFixture();
  let release;
  app.index.service.readSurface = () => new Promise(resolve => { release = resolve; });
  const pending = query(app.index, 'new');
  await new Promise(resolve => setImmediate(resolve));
  app.index.clear();
  release({ events: [{ type: 'user/message', seq: 0, time: 1, data: { content: [{ type: 'text', text: 'new' }] } }] });
  assert.deepEqual((await pending).items, []);
  assert.equal(app.index.sessions, null);
  assert.equal(app.index.live.size, 0);
});

test('live initialization borrows an immutable cut and uses the already folded surface', async () => {
  const app = liveFixture();
  let disposed = 0;
  app.source.surface.nodes = [1];
  app.source.seq = 2;
  app.index.service.observeSession = async (_id, options) => {
    assert.equal(options.projectionMode, 'none');
    return { cursor: 1, events: [
      { type: 'user/message', seq: 0, time: 1, data: { content: [{ type: 'text', text: 'shadowed' }] } },
      { type: 'user/message', seq: 1, time: 2, data: { content: [{ type: 'text', text: 'current' }] } },
    ], [Symbol.dispose]() { disposed++; } };
  };
  app.index.service.readSurface = async () => assert.fail('The live surface must not be replayed and deep-cloned');
  assert.deepEqual((await query(app.index, 'current')).items.map(hit => hit.sessionId), ['s1']);
  assert.deepEqual((await query(app.index, 'shadowed')).items, []);
  assert.equal(disposed, 1);
});

test('cold changes use the canonical document projector and release the observation lease', async () => {
  const app = fixture({ rows: ROWS });
  app.index.invalidate('s1');
  let disposed = 0;
  const events = [{ type: 'user/message', seq: 0 }];
  app.index.service.observeSession = async () => ({
    cursor: 0, events, [Symbol.dispose]() { disposed++; },
  });
  app.index.project = (id, input) => {
    assert.equal(id, 's1');
    assert.equal(input, events);
    return [
      { type: 'user/message', surface: 'current', time: 1, text: 'new content' },
      { type: 'assistant/message', surface: 'shadowed', time: 1, text: 'old content' },
      { type: 'tool/result', surface: 'current', time: 1, text: 'tool output' },
    ];
  };
  app.index.service.readSurface = async () => assert.fail('The public projector avoids cloning the whole surface');
  await query(app.index, 'dsh');
  app.index.invalidate('s1');
  assert.deepEqual((await query(app.index, 'new content')).items.map(hit => hit.sessionId), ['s1']);
  assert.deepEqual((await query(app.index, 'old content')).items, []);
  assert.deepEqual((await query(app.index, 'tool output')).items, []);
  assert.equal(disposed, 1);
});

test('an observation lease is released even when canonical projection fails', async () => {
  const app = fixture({ rows: ROWS });
  await query(app.index, 'dsh');
  app.index.invalidate('s1');
  let disposed = false;
  app.index.service.observeSession = async () => ({
    cursor: 0, events: [], [Symbol.dispose]() { disposed = true; },
  });
  app.index.project = () => { throw new Error('invalid surface'); };
  await assert.rejects(query(app.index, 'dsh'), /invalid surface/);
  assert.equal(disposed, true);
});
