import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MemoryStore } from '../src/features/memory/memory-store.ts';
import { MemorySources } from '../src/features/memory/sources.ts';
import { createMemoryTool } from '../src/features/memory/memory-tool.ts';
import { memoryPolicy, renderMemoryContext } from '../src/features/memory/injection.ts';
import { queryHistory, HISTORY_POLICY } from '../src/features/history-search/history.ts';
import { createHistoryTool } from '../src/features/history-search/tool.ts';
import { completion } from '../src/features/memory/tests/live-model.mjs';

const stamp = Date.parse('2026-11-01T00:00:00Z');
const user = (seq, text, time = stamp + seq) => ({ seq, time, type: 'user/message',
  data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } });

export async function runRetrievalLive(options) {
  assert.ok(options.apiKey && options.baseURL && options.model, 'A configured test model is required');
  const root = await mkdtemp(join(tmpdir(), 'power-dsh-retrieval-live-'));
  const project = join(root, 'project');
  await mkdir(project);
  const store = new MemoryStore(root);
  const sources = new MemorySources();
  const flags = { memoryEnabled: true, memoryAutoCapture: false, memoryGlobalEnabled: true, memoryWorkspaceEnabled: true };
  const config = Object.fromEntries(Object.keys(flags).map(key => [key, { get: () => flags[key] }]));
  const records = new Map();
  const add = (id, createdAt, events) => records.set(id, { session: { id, cwd: project, createdAt }, events });
  for (let index = 0; index < 31; index++) add(`unrelated-${index}`, stamp + 1000 + index, [user(1, '天气和无关任务')]);
  add('old-editor-decision', stamp + 2, [user(1, '设置页编辑器固定高度260px，不允许手动改变；测试主题色为薄荷绿。', stamp + 10)]);
  add('long-running-editor-chat', stamp + 1, [user(1, '编辑器讨论。', stamp + 5),
    user(4, '纠正编辑器约定：只针对设置页，最小高度260px，允许手动纵向拖动，禁止自动增高。薄荷绿主题色保留。', stamp + 100)]);
  const query = {
    async filterSessions() { return [...records.values()].map(row => ({ header: row.session })); },
    async readSession(id) { assert.ok(records.has(id)); return structuredClone(records.get(id)); },
    async readSurface(id) {
      assert.ok(records.has(id));
      const row = records.get(id);
      return structuredClone(id === 'long-running-editor-chat' ? { ...row, events: [user(20, '压缩后的上下文摘要')] } : row);
    },
  };
  sources.bind(query);
  const memory = createMemoryTool(store, config, () => true, sources);
  const history = createHistoryTool(async (request, caller, signal) => JSON.stringify({ ok: true, error: '',
    data: await queryHistory(query, caller, request, signal, () => {}) }));
  const report = { model: options.model, boundary: 'Real model; synthetic native-query adapter and temporary memory. Not DSH UI acceptance.',
    cases: [], calls: [], passed: false };
  let serial = 0;
  async function chat(text, { useMemory = true, useHistory = true } = {}) {
    const id = `acceptance-${++serial}`;
    add(id, stamp + 10000 + serial, [user(1, text, stamp + 10000 + serial)]);
    const signal = AbortSignal.timeout(120_000);
    const tools = [...(useMemory ? [memory] : []), ...(useHistory ? [history] : [])];
    const messages = [{ role: 'user', content: text }];
    const trace = [];
    const started = Date.now();
    for (let step = 0; step < 16; step++) {
      await store.refresh(project, true, true);
      const system = ['你是编程助手，用中文简短回答；不要为了测试声称没有证据的事。',
        ...(useMemory ? [memoryPolicy(flags.memoryAutoCapture), renderMemoryContext(store.cached(project))] : []),
        ...(useHistory ? [HISTORY_POLICY] : [])].join('\n\n');
      let content = '';
      let finish = '';
      const pending = new Map();
      for await (const choice of completion(options, { signal, messages: [{ role: 'system', content: system }, ...messages],
        tools: tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) })) {
        content += choice.delta?.content ?? '';
        for (const delta of choice.delta?.tool_calls ?? []) {
          const call = pending.get(delta.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
          call.id += delta.id ?? '';
          call.function.name += delta.function?.name ?? '';
          call.function.arguments += delta.function?.arguments ?? '';
          pending.set(delta.index, call);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
      if (!pending.size) {
        assert.equal(finish, 'stop');
        const result = { reply: content, trace, elapsedMs: Date.now() - started };
        report.calls.push(result);
        return result;
      }
      assert.equal(finish, 'tool_calls');
      const calls = [...pending.values()];
      messages.push({ role: 'assistant', content: content || null, tool_calls: calls });
      for (const call of calls) {
        const tool = tools.find(row => row.name === call.function.name);
        assert.ok(tool, 'Unknown tool');
        const args = JSON.parse(call.function.arguments);
        for (const [key, value] of Object.entries(args)) {
          const field = tool.parameters.properties[key];
          assert.ok(field, 'Unknown parameter');
          assert.equal(typeof value, field.type === 'integer' ? 'number' : field.type);
          if (field.type === 'integer') assert.ok(Number.isSafeInteger(value));
          if (field.enum) assert.ok(field.enum.includes(value));
        }
        for (const key of tool.parameters.required ?? []) assert.ok(Object.hasOwn(args, key));
        const output = await tool.execute(args, { signal, agent: { session: { header: { id, cwd: project } } } });
        const result = typeof output === 'string' ? JSON.parse(output) : output;
        trace.push({ tool: tool.name, args, result });
        console.log(`Tool: ${tool.name} ${args.action}, ok=${result.ok}`);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    throw new Error('Bounded tool budget exceeded');
  }
  async function check(name, operation) {
    console.log(`Starting: ${name}`);
    try { await operation(); report.cases.push({ name, passed: true }); console.log(`Passed: ${name}`); }
    catch (error) { report.cases.push({ name, passed: false, error: error instanceof assert.AssertionError ? error.message.slice(0, 400) : 'Live evaluation failed' }); throw error; }
  }
  const latest = result => {
    assert.match(result.reply, /260/);
    assert.match(result.reply, /最小|min-height/i);
    assert.match(result.reply, /手动|拖动/);
    assert.match(result.reply, /设置页/);
    assert.match(result.reply, /薄荷绿/);
    assert.match(result.reply, /long-running-editor-chat/);
    assert.ok(result.trace.some(row => row.tool === history.name && row.args.action === 'read' && row.args.sessionId === 'long-running-editor-chat'));
  };
  try {
    const workspace = await store.workspace(project);
    const stale = await store.save(workspace.id, { type: 'project', name: 'editor-rule', description: '设置页编辑器高度与主题色',
      content: '设置页编辑器固定高度260px，不可手动调整；主题色薄荷绿。', revision: '', originSessionId: 'old-editor-decision',
      source: await sources.capture({ id: 'old-editor-decision', cwd: project }, undefined, AbortSignal.timeout(10000), () => {}) }, workspace.cwd);
    await check('history alone finds later correction past thirty irrelevant sessions and cites compacted original', async () => {
      const result = await chat('设置页编辑器高度和主题色，之前最后到底怎么定的？', { useMemory: false });
      latest(result);
      assert.ok(result.trace.some(row => row.args.cursor), 'No continuation through thirty irrelevant sessions');
    });
    await check('stale memory does not override later original evidence or trigger unsolicited writes', async () => {
      const result = await chat('设置页编辑器高度和主题色，之前最后到底怎么定的？记忆可能过时，请核对。');
      latest(result);
      assert.ok(result.trace.some(row => row.tool === memory.name && row.args.action === 'read'));
      assert.equal((await store.read(workspace.id, stale.entry.id)).revision, stale.entry.revision);
      assert.ok(!result.trace.some(row => ['save', 'forget'].includes(row.args.action)));
    });
    await check('unknown topic stays unknown without fabricated agreement', async () => {
      const result = await chat('我们以前把数据库的备份保留天数定成多少？');
      assert.match(result.reply, /没(?:有|查|找)|未(?:找到|查到)|不(?:清楚|确定)|无法确认|没有.*记录/);
      assert.doesNotMatch(result.reply, /(?:定为|定成|约定|确认)(?:了|是|为)?\s*\d+\s*天/);
      assert.ok(result.trace.some(row => row.tool === history.name && row.args.action === 'search' && row.result.data.complete));
      assert.ok(result.trace.filter(row => row.tool === history.name).length <= 8, 'Unknown topic triggered excessive speculative searches');
    });
    await check('explicit correction updates same memory with verified human source and preserves unrelated fact', async () => {
      const result = await chat('请更新并记住当前项目的编辑器约定：仅设置页编辑器最小高度260px、可手动纵向拖动、禁止自动增高。薄荷绿主题色保持。');
      const rows = await store.list(workspace.id);
      assert.equal(rows.entries.length, 1);
      const current = await store.read(workspace.id, stale.entry.id);
      assert.match(current.content, /最小|min-height/);
      assert.match(current.content, /手动/);
      assert.match(current.content, /薄荷绿/);
      assert.ok(current.source?.sessionId.startsWith('acceptance-'));
      assert.ok(result.trace.some(row => row.args.action === 'save' && row.result.ok && row.result.data.sourceRecorded));
    });
    await check('fresh chat recalls corrected memory without unnecessary history scan', async () => {
      const result = await chat('当前项目已经保存的设置页编辑器和主题色约定是什么？');
      assert.match(result.reply, /最小|至少|min-height/);
      assert.match(result.reply, /手动|拖动/);
      assert.match(result.reply, /薄荷绿/);
      assert.ok(result.trace.some(row => row.tool === memory.name && row.args.action === 'read'));
      assert.ok(!result.trace.some(row => row.tool === history.name), 'Simple saved recall should not scan history');
    });
    await check('current local exception overrides stored rule without changing long-term memory', async () => {
      const before = await store.read(workspace.id, stale.entry.id);
      const result = await chat('这次只做一次性演示：设置页编辑器临时自动增高。不要改长期记忆。你会怎么处理？');
      assert.match(result.reply, /临时|一次性|本次|这次/);
      assert.match(result.reply, /自动增高/);
      assert.equal((await store.read(workspace.id, stale.entry.id)).revision, before.revision);
      assert.ok(!result.trace.some(row => ['save', 'forget'].includes(row.args.action)));
    });
    report.passed = true;
  } catch { report.passed = false; }
  finally {
    sources.close(); store.close();
    report.finished = new Date().toISOString();
    const output = options.reportPath ?? join(tmpdir(), 'power-dsh-retrieval-live-report.json');
    await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    await rm(root, { recursive: true, force: true });
    console.log(JSON.stringify({ passed: report.passed, cases: report.cases, report: output }));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runRetrievalLive({ baseURL: process.env.MEMORY_LIVE_BASE_URL, apiKey: process.env.MEMORY_LIVE_API_KEY,
      model: process.env.MEMORY_LIVE_MODEL, reasoningEffort: process.env.MEMORY_LIVE_REASONING_EFFORT, reportPath: process.env.MEMORY_LIVE_REPORT });
    process.exitCode = result.passed ? 0 : 1;
  } catch { console.error('Live evaluation setup failed; check configured model access.'); process.exitCode = 1; }
}
