import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendants, mount } from '../../../../tests/helpers/client-fixture.mjs';

const task = (title, status) => ({ id: title, title, status, target: 'session', selection: null, error: '' });
const reply = tasks => ({ ok: true, value: { revision: '{}', tasks, models: [] } });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('automation model settings default to enabled tasks and filter the loaded native catalog', async () => {
  const app = await mount({ featureIds: ['task-models'], localeLanguage: 'zh' });
  app.set({ taskModelsEnabled: true });
  const tasks = [task('Ended task', 'ended'), task('Enabled task', 'active'), task('Paused task', 'paused')];
  app.setTaskModelsReply(reply(tasks));
  const render = () => descendants(app.renderTaskModels());
  const button = label => render().find(node => node.type === 'button' && node.props.children.includes(label));
  const titles = () => render().filter(node => node.type === 'h3').map(node => node.props.children[0]);
  render();
  await settle();
  assert.equal(button('已开启').props['aria-pressed'], true);
  assert.deepEqual(titles(), ['Enabled task']);
  button('已暂停').props.onClick();
  assert.deepEqual(titles(), ['Paused task']);
  button('已结束').props.onClick();
  assert.deepEqual(titles(), ['Ended task']);
  button('全部').props.onClick();
  assert.deepEqual(titles(), ['Ended task', 'Enabled task', 'Paused task']);
  assert.equal(app.rpcCalls.filter(call => call.method === 'readTaskModels').length, 1);

  button('已开启').props.onClick();
  app.setTaskModelsReply(reply([tasks[0]]));
  await button('刷新').props.onClick();
  assert.equal(button('已开启').props['aria-pressed'], true);
  assert.deepEqual(titles(), ['暂无已开启的自动化任务']);
  button('已结束').props.onClick();
  assert.deepEqual(titles(), ['Ended task']);
  app.unmount();
});
