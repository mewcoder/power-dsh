import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MemoryStore } from '../memory-store.ts';
import { createMemoryTool } from '../memory-tool.ts';
import { memoryPolicy, renderMemoryContext } from '../injection.ts';
import { MemoryCleanup } from '../cleanup.ts';
import { MemorySources } from '../sources.ts';

export async function* completion(options, input) {
  const response = await fetch(`${options.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({
      model: options.model, messages: input.messages, stream: true, max_tokens: input.maxTokens ?? 8192,
      ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
      ...(input.tools ? { tools: input.tools } : {}),
    }),
    signal: input.signal,
  });
  if (!response.ok || !response.body) throw new Error(`Model HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        const chunk = JSON.parse(data);
        if (chunk.error) throw new Error('Model returned a stream error');
        for (const choice of chunk.choices ?? []) yield choice;
      }
      if (done) {
        if (buffer.trim() && buffer.trim() !== 'data: [DONE]') throw new Error('Incomplete model stream');
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function toolSchema(tool) {
  return { type: 'function', function: { name: tool.name, description: tool.description,
    parameters: tool.parameters } };
}

function parseArguments(tool, text) {
  const args = JSON.parse(text);
  assert.ok(args && typeof args === 'object' && !Array.isArray(args));
  for (const [name, value] of Object.entries(args)) {
    const field = tool.parameters.properties[name];
    assert.ok(field, 'Unknown memory parameter');
    assert.equal(typeof value, field.type === 'integer' ? 'number' : field.type);
    if (field.type === 'integer') assert.ok(Number.isSafeInteger(value));
    if (field.enum) assert.ok(field.enum.includes(value), 'Invalid memory enum');
  }
  for (const name of tool.parameters.required ?? []) assert.ok(Object.hasOwn(args, name), 'Missing memory parameter');
  return args;
}

export async function runMemoryLive(options) {
  assert.ok(options.apiKey && options.baseURL && options.model, 'An explicitly configured test model is required');
  const root = await mkdtemp(join(tmpdir(), 'power-dsh-memory-live-'));
  const home = join(root, 'home');
  const project = join(root, 'project');
  await mkdir(home);
  await mkdir(project);
  const flags = { memoryEnabled: true, memoryAutoCapture: true, memoryGlobalEnabled: true, memoryWorkspaceEnabled: true };
  const config = Object.fromEntries(Object.keys(flags).map(key => [key, { get: () => flags[key] }]));
  let store = new MemoryStore(home);
  const sources = new MemorySources();
  const sessions = new Map();
  sources.bind({ async readSurface(id) {
    assert.ok(sessions.has(id));
    return structuredClone(sessions.get(id));
  } });
  let tool = createMemoryTool(store, config, () => true, sources);
  let cleanup;
  const report = { model: options.model, reasoningEffort: options.reasoningEffort ?? '',
    started: new Date().toISOString(), boundary: 'Real configured model with source memory tool/store/policy and cleanup; direct protocol adapter, not native DSH/UI',
    cases: [], calls: [], previews: [], passed: false };
  const allDetails = async (scope = 'global') => {
    const snapshot = (await store.catalog()).scopes.find(row => row.id === scope);
    return snapshot ? Promise.all(snapshot.entries.map(entry => store.read(scope, entry.id))) : [];
  };
  async function runCase(name, operation) {
    const started = Date.now();
    console.log(`Starting: ${name}`);
    try {
      const detail = await operation();
      report.cases.push({ name, passed: true, elapsedMs: Date.now() - started, detail });
      console.log(`Passed: ${name}`);
    } catch (error) {
      report.cases.push({ name, passed: false, elapsedMs: Date.now() - started,
        error: error instanceof assert.AssertionError ? error.message.slice(0, 500)
          : /^(Model HTTP \d{3}|Model returned a stream error|Incomplete model stream|memory[A-Za-z]+)$/.test(error?.message)
            ? error.message : 'Model or test operation failed',
        location: String(error?.stack ?? '').split('\n').slice(1).filter(line => line.includes('/src/features/memory/')).slice(0, 3)
          .map(line => line.replace(/.*\/src\/features\/memory\//, 'memory/')) });
    }
  }
  async function chat(text, session = randomUUID()) {
    sessions.set(session, { session: { id: session, cwd: project }, events: [{ seq: 1, time: Date.now(), type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } }] });
    const signal = AbortSignal.timeout(120_000);
    const messages = [{ role: 'user', content: text }];
    for (let step = 0; step < 12; step++) {
      await store.refresh(project, true, true);
      const system = ['你是编程助手，用中文简短回答。', memoryPolicy(flags.memoryAutoCapture),
        renderMemoryContext(store.cached(project))].join('\n\n');
      let content = '';
      let finish = '';
      const calls = new Map();
      for await (const choice of completion(options, { signal, messages: [{ role: 'system', content: system }, ...messages],
        tools: [toolSchema(tool)] })) {
        content += choice.delta?.content ?? '';
        for (const delta of choice.delta?.tool_calls ?? []) {
          const call = calls.get(delta.index) ?? { id: '', type: 'function', function: { name: '', arguments: '' } };
          call.id += delta.id ?? '';
          call.function.name += delta.function?.name ?? '';
          call.function.arguments += delta.function?.arguments ?? '';
          calls.set(delta.index, call);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
      if (!calls.size) {
        assert.equal(finish, 'stop', 'Model did not finish normally');
        report.calls.push({ session, user: text, reply: content });
        return content;
      }
      assert.equal(finish, 'tool_calls');
      const ordered = [...calls.values()];
      messages.push({ role: 'assistant', content: content || null, tool_calls: ordered });
      for (const call of ordered) {
        assert.equal(call.function.name, tool.name);
        const args = parseArguments(tool, call.function.arguments);
        const result = await tool.execute(args, { signal, agent: { session: { header: { id: session, cwd: project } } } });
        report.calls.push({ session, args, result });
        console.log(`Memory tool: ${args.action} (${args.scope}), ok=${result.ok}`);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    throw new Error('Tool loop exceeded its bounded step budget');
  }
  try {
    await runCase('automatic capture and rephrased preferences across three chats', async () => {
      for (const text of [
        '我偏好用中文回答，先给结论，最多列3点。以后回答就按这个习惯。',
        '我的习惯还是结论放前面，中文说明，控制在三点以内。',
        '回答别太长，最多3条，先说结论，用中文就好。',
      ]) await chat(text);
      const entries = await allDetails();
      assert.equal(entries.length, 1, 'Rephrased preference produced extra files');
      assert.match(entries[0].content, /中文/);
      assert.match(entries[0].content, /结论/);
      assert.match(entries[0].content, /3|三/);
      return entries;
    });
    await runCase('correction updates the existing file and preserves other preferences', async () => {
      const before = (await allDetails())[0];
      await chat('把回答最多3点改成最多5点，请记住新要求。中文回答、先给结论这两项仍保留。');
      const entries = await allDetails();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, before.id);
      assert.notEqual(entries[0].revision, before.revision);
      assert.match(entries[0].content, /5|五/);
      assert.match(entries[0].content, /中文/);
      assert.match(entries[0].content, /结论/);
      return entries;
    });
    await runCase('partial forgetting removes the limit without removing unrelated preferences', async () => {
      const before = (await allDetails())[0];
      await chat('忘记回答最多5点这个限制，今后不限定条数；中文回答和先给结论仍要保留。');
      const entries = await allDetails();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].id, before.id);
      assert.notEqual(entries[0].revision, before.revision);
      assert.match(entries[0].content, /中文/);
      assert.match(entries[0].content, /结论/);
      assert.match(entries[0].content, /不限|不(?:再)?(?:限定|限制)|不作限制|取消.*(?:上限|限制)|无.*(?:上限|限制)/);
      return entries;
    });
    await runCase('automatic capture off skips incidental information and permits explicit remember', async () => {
      flags.memoryAutoCapture = false;
      const before = await allDetails();
      const workspace = await store.workspace(project);
      const projectBefore = await allDetails(workspace.id);
      const reply = await chat('顺便聊一句，我平时把代码缩进设为两个空格。');
      assert.deepEqual(await allDetails(), before);
      assert.deepEqual(await allDetails(workspace.id), projectBefore);
      assert.doesNotMatch(reply, /(?:^|[。！\n])\s*(?:(?:已经?|成功)(?:记住|记下|保存|记录)|记下了|以后[^。！\n]*(?:沿用|照做))/);
      await chat('请记住：我喜欢用两个空格缩进代码。');
      const entries = await allDetails();
      assert.ok(entries.some(entry => /缩进/.test(entry.content) && /两个|2|两/.test(entry.content)));
      return entries;
    });
    await runCase('project facts stay out of global memory', async () => {
      const before = (await store.catalog()).scopes.find(row => row.id === 'global').revision;
      await chat('请记住，仅当前测试项目使用 pnpm 安装依赖，不要使用 npm。这不是我对其他项目的偏好。');
      const workspace = await store.workspace(project);
      const entries = await allDetails(workspace.id);
      assert.ok(entries.some(entry => /pnpm/.test(entry.content)));
      assert.equal((await store.catalog()).scopes.find(row => row.id === 'global').revision, before);
      return entries;
    });
    await runCase('new store instance and fresh chat recall saved preferences', async () => {
      store.close();
      store = new MemoryStore(home);
      tool = createMemoryTool(store, config, () => true, sources);
      const reply = await chat('我之前保存了哪些回答风格偏好？请先读取有关记忆再回答，不要猜测。');
      assert.match(reply, /中文/);
      assert.match(reply, /结论/);
      return { reply, entries: await allDetails() };
    });
    await runCase('exact content under another filename reuses the existing file', async () => {
      const before = await allDetails();
      const entry = before[0];
      sessions.set('exact-duplicate', { session: { id: 'exact-duplicate', cwd: project }, events: [{ seq: 1,
        time: Date.now(), type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: entry.content }] } }] });
      const result = await tool.execute({ action: 'save', scope: 'global', type: entry.type,
        name: 'test-identical-copy', description: entry.description, content: entry.content, revision: '' },
      { signal: AbortSignal.timeout(10_000), agent: { session: { header: { id: 'exact-duplicate', cwd: project } } } });
      assert.equal(result.ok, true);
      assert.equal(result.data.reused, true);
      assert.equal(result.data.entry.id, entry.id);
      assert.equal((await allDetails()).length, before.length);
      return { id: entry.id, reused: true };
    });
    await runCase('explicit Windows fact stays brief without inferred operating rules', async () => {
      const workspace = await store.workspace(project);
      const before = [...await allDetails(), ...await allDetails(workspace.id)];
      await chat('请记住当前环境是win。');
      const entries = [...await allDetails(), ...await allDetails(workspace.id)];
      const added = entries.filter(entry => !before.some(previous => previous.id === entry.id));
      assert.equal(added.length, 1);
      for (const previous of before) assert.deepEqual(entries.find(entry => entry.id === previous.id), previous);
      const entry = added[0];
      assert.match(entry.content, /win(?:dows)?/i);
      assert.match(entry.content, /当前|本机|此.*环境|current/i);
      const claims = `${entry.description}\n${entry.content}`.split(/[\n。；]/u)
        .filter(line => !/未确认|未说明|未指定|尚不清楚|未知|不确定|待确认|不要.*推断/.test(line)).join('\n');
      assert.doesNotMatch(claims, /powershell|cmd\b|wsl|bash|CRLF|反斜杠/i, 'Windows alone does not establish a shell, line ending or path convention');
      assert.doesNotMatch(claims, /(?:偏好|默认|必须|只能|始终)[^。\n]{0,16}(?:powershell|cmd\b|wsl|bash|shell)|(?:禁止|不得|不要使用)[^。\n]{0,12}(?:linux|mac|bash)|(?:所有|全部)项目/i);
      return added;
    });
    await runCase('README language preference does not spread to documentation or UI', async () => {
      const before = await allDetails();
      await chat('请记住我的偏好：README默认中文。');
      const entries = await allDetails();
      const added = entries.filter(entry => !before.some(previous => previous.id === entry.id));
      assert.equal(added.length, 1);
      const entry = added[0];
      assert.match(entry.content, /README/i);
      assert.match(entry.content, /中文/);
      assert.doesNotMatch(`${entry.description}\n${entry.content}`, /所有.*文档|全部.*文档|一切|界面|UI|注释|沟通|回答|交流|英文|英语/i);
      return added;
    });
    await runCase('current Linux environment overrides saved Windows fact without inventing new preferences', async () => {
      const workspace = await store.workspace(project);
      const before = await allDetails(workspace.id);
      const globalBefore = await allDetails();
      const reply = await chat('本次已经换到Linux环境，这只是这次会话的信息，不要修改长期记忆。你现在应按哪个系统处理？');
      assert.match(reply, /Linux/i);
      assert.doesNotMatch(reply, /(?:必须|只能|仍(?:然)?|继续)(?:使用|按|以|遵循)[^。\n]{0,12}(?:Windows|PowerShell)/i);
      assert.deepEqual(await allDetails(workspace.id), before);
      assert.deepEqual(await allDetails(), globalBefore);
      return { reply };
    });
    await runCase('richer environment context retains explicit shell instructions and the CI exception', async () => {
      const workspace = await store.workspace(project);
      const globalBefore = await allDetails();
      await chat('补充并记住当前项目环境：本地开发用Windows，终端是PowerShell 7；因为路径经常有空格，命令里的路径要加引号。但CI仍然用Linux。这些只针对当前项目。');
      const entries = await allDetails(workspace.id);
      const content = entries.map(entry => entry.content).join('\n');
      assert.match(content, /Windows/i);
      assert.match(content, /PowerShell\s*7/i);
      assert.match(content, /空格/);
      assert.match(content, /引号/);
      assert.match(content, /CI[^。\n]{0,35}Linux|Linux[^。\n]{0,35}CI/i);
      assert.doesNotMatch(content, /CRLF|反斜杠/, 'Explicit shell and quoting guidance does not establish other platform conventions');
      assert.deepEqual(await allDetails(), globalBefore);
      return entries;
    });
    await runCase('project decision keeps its stated reason date and experimental exception', async () => {
      const workspace = await store.workspace(project);
      const globalBefore = await allDetails();
      await chat('请记住这个项目的协议决策：为了兼容旧客户端，正式发布暂不升级协议，限制到2026-11-20；实验分支可以先试新协议。');
      const entries = await allDetails(workspace.id);
      const content = entries.map(entry => entry.content).join('\n');
      assert.match(content, /兼容.*旧客户端/);
      assert.match(content, /正式发布/);
      assert.match(content, /2026[-年/]11[-月/]20/);
      assert.match(content, /实验分支/);
      assert.match(content, /(?:实验分支[^。\n]{0,30}(?:可以|可先|允许|试|升级))/);
      assert.deepEqual(await allDetails(), globalBefore);
      return entries;
    });
    const cleanupHome = join(root, 'cleanup');
    await mkdir(cleanupHome);
    store.close();
    store = new MemoryStore(cleanupHome);
    for (const [name, content] of [
      ['reply-style', '【测试】用中文回答，先给结论，最多3点。涉及代码时必须提供完整可运行示例。'],
      ['reply-duplicate', '【测试】回复先说结论，再用中文列不超过三点；代码示例必须完整且可运行。'],
      ['debug-exception', '【测试】排查错误时允许超过3点，但必须保留错误原文。异常标识 ZETA-42 不得省略。'],
      ['date-format', '【测试】输出日期统一用 YYYY-MM-DD。'],
      ['port-conflict-a', '【测试】同一个测试服务的默认端口为4100。'],
      ['port-conflict-b', '【测试】同一个测试服务的默认端口为4200。'],
    ]) await store.save('global', { type: 'user', name, description: name, content, revision: '', originSessionId: 'synthetic-fixture' });
    const oldPath = join(await store.folder('global'), 'date-format.md');
    await writeFile(oldPath, (await readFile(oldPath, 'utf8')).replace(/(created|updated): "[^"]+"/g, '$1: "2000-01-01T00:00:00.000Z"'));
    const selection = { provider: 'live-test', model: options.model,
      ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}) };
    const cleanupRuntime = {
      catalog: async () => ({ default: selection, groups: [{ id: selection.provider, name: 'Configured test model',
        models: [{ id: selection.model, name: selection.model }] }] }),
      llm: { async *stream(input) {
        for await (const choice of completion(options, { signal: input.signal, maxTokens: input.maxTokens,
          messages: [{ role: 'system', content: input.system }, ...input.messages.map(message => ({
            role: message.role, content: message.content.map(block => block.text).join('\n'),
          }))] })) {
          if (choice.delta?.content) yield { type: 'text-delta', text: choice.delta.content };
          if (choice.delta?.tool_calls?.length) yield { type: 'tool-call-delta' };
          if (choice.finish_reason) yield { type: 'finish', reason: { kind: choice.finish_reason === 'stop' ? 'stop' : 'error' } };
        }
      } },
    };
    cleanup = new MemoryCleanup(store, () => {}, () => cleanupRuntime);
    await runCase('real cleanup preview merges duplicates and application preserves exceptions, old facts and conflicts', async () => {
      const before = await allDetails();
      const preview = await cleanup.prepare('global', JSON.stringify(selection), randomUUID());
      report.previews.push(preview);
      assert.deepEqual(await allDetails(), before, 'Generating preview changed files');
      assert.ok(preview.changes.some(change => change.removed.length > 0), 'No duplicate merge proposed');
      const result = await cleanup.apply(preview.token);
      const after = await allDetails();
      assert.ok(after.length < before.length, 'Duplicate files did not decrease');
      const text = after.map(entry => entry.content).join('\n');
      for (const pattern of [/中文/, /结论/, /完整/, /可运行/, /ZETA-42/, /YYYY-MM-DD/, /错误原文/]) assert.match(text, pattern);
      for (const name of ['date-format', 'port-conflict-a', 'port-conflict-b']) {
        assert.deepEqual(after.find(entry => entry.name === name), before.find(entry => entry.name === name));
      }
      assert.ok(after.some(entry => /超过/.test(entry.content) && /3|三/.test(entry.content)), 'Debugging exception was lost');
      for (const change of preview.changes) {
        for (const entry of [change.before, ...change.removed]) {
          assert.match(await readFile(join(result.backup, `${entry.name}.md`), 'utf8'), /【测试】/);
        }
      }
      return { beforeCount: before.length, afterCount: after.length, entries: after, backupVerified: true };
    });
    await runCase('organizing again does not resurrect merged duplicates', async () => {
      const before = await allDetails();
      const preview = await cleanup.prepare('global', JSON.stringify(selection), randomUUID());
      report.previews.push(preview);
      if (preview.changes.length) await cleanup.apply(preview.token);
      const after = await allDetails();
      assert.ok(after.length <= before.length);
      for (const name of ['date-format', 'port-conflict-a', 'port-conflict-b']) {
        assert.deepEqual(after.find(entry => entry.name === name), before.find(entry => entry.name === name));
      }
      for (const pattern of [/中文/, /结论/, /完整/, /可运行/, /ZETA-42/, /YYYY-MM-DD/, /错误原文/]) {
        assert.match(after.map(entry => entry.content).join('\n'), pattern);
      }
      return { beforeCount: before.length, afterCount: after.length, suggestedChanges: preview.changes.length };
    });
    report.passed = report.cases.every(row => row.passed);
  } catch {
    report.passed = false;
  } finally {
    cleanup?.cancelAll();
    sources.close();
    store.close();
    report.finished = new Date().toISOString();
    const output = options.reportPath ?? join(tmpdir(), `power-dsh-memory-live-${randomUUID()}.json`);
    await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    await rm(root, { recursive: true, force: true });
    console.log(JSON.stringify({ passed: report.passed, cases: report.cases.map(({ name, passed }) => ({ name, passed })), report: output }));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runMemoryLive({ apiKey: process.env.MEMORY_LIVE_API_KEY, baseURL: process.env.MEMORY_LIVE_BASE_URL,
      model: process.env.MEMORY_LIVE_MODEL, reasoningEffort: process.env.MEMORY_LIVE_REASONING_EFFORT,
      reportPath: process.env.MEMORY_LIVE_REPORT });
    process.exitCode = report.passed ? 0 : 1;
  } catch { console.error('Live test setup failed; verify the explicitly supplied model configuration.'); process.exitCode = 1; }
}
