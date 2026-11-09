import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { AccountPolicy } from './account-policy.js';
import { TelemetryPolicy } from './telemetry-policy.js';
import { MOD_RPC } from './rpc.js';
import { OperationQueue } from './operation-queue.js';
import { PersonalizationFile } from './personalization.js';
import { SkillPolicy } from './skill-policy.js';
import { McpPolicy } from './mcp-policy.js';
import { McpProviders } from './mcp-providers.js';
import { TodoPolicy } from './todo-policy.js';
import { SearchPolicy } from './search-policy.js';
import { notificationProjection } from './notifications.js';
import { SystemSounds } from './system-sounds.js';
import { DesktopRestart } from './restart.js';

export const inject = ['settings', 'tools', 'clientModules', 'pluginManager', 'typert', 'configEditor', 'profileContext'];
export const Config = z.object({
  showVersion: z.boolean().default(false).volatile(),
  showThemeSwitcher: z.boolean().default(false).volatile(),
  showRefreshButton: z.boolean().default(false).volatile(),
  showRestartButton: z.boolean().default(false).volatile(),
  notificationsEnabled: z.boolean().default(false).volatile(),
  notificationSoundEnabled: z.boolean().default(true).volatile(),
  notificationSound: z.string().default('default').volatile(),
  blockOfficialAccount: z.boolean().default(false).volatile(),
  blockOfficialSearch: z.boolean().default(false).volatile(),
  blockOfficialTelemetry: z.boolean().default(false).volatile(),
  blockTodo: z.boolean().default(false).volatile(),
  blockDoubleClickRename: z.boolean().default(false).volatile(),
  personalizationEnabled: z.boolean().default(false).volatile(),
  skillManagerEnabled: z.boolean().default(false).volatile(),
  mcpManagerEnabled: z.boolean().default(false).volatile(),
  disabledSkills: z.array(z.object({
    name: z.string().required(), description: z.string().required(), source: z.string().required(),
    provider: z.string().required(), path: z.string().required(),
    scope: z.string().default(''), projectRoot: z.string().default(''), origin: z.string().default(''),
  })).default([]).volatile(),
});

class ModService extends TypertRemoteService {
  constructor(ctx, policy, telemetry, queue, instructions, skills, mcp, todo, sounds, restart, search) {
    super(ctx, 'powerDsh');
    this.policy = policy;
    this.telemetry = telemetry;
    this.queue = queue;
    this.instructions = instructions;
    this.skills = skills;
    this.mcp = mcp;
    this.todo = todo;
    this.sounds = sounds;
    this.restart = restart;
    this.search = search;
  }
  restartStatus() {
    return this.run(() => this.restart.status());
  }
  restartApp() {
    return this.run(() => this.restart.restart());
  }
  listSystemSounds() {
    return this.run(() => this.sounds.list());
  }
  playSystemSound(id, preview) {
    // Playback has its own overlap control and must not block policy changes.
    this.queue.ensureActive();
    if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== 'owner') {
      throw new Error('Only the profile owner can play system sounds.');
    }
    return this.sounds.play(id, preview);
  }
  run(operation) {
    if (this.ctx.invocation && this.ctx.invocation.peer.principal.kind !== 'owner') {
      throw new Error('Only the profile owner can change Mod policies.');
    }
    return this.queue.run(operation);
  }
  async setAccountBlocked(blocked) {
    return this.run(() => this.policy.setBlocked(blocked));
  }
  async setTelemetryBlocked(blocked) {
    return this.run(() => this.telemetry.setBlocked(blocked));
  }
  async setTodoBlocked(blocked) {
    return this.run(() => this.todo.setBlocked(blocked));
  }
  async setSearchBlocked(blocked) {
    return this.run(() => this.search.setBlocked(blocked));
  }
  readPersonalization() {
    return this.run(() => this.instructions.read());
  }
  savePersonalization(text, revision) {
    return this.run(() => this.instructions.save(text, revision));
  }
  listMcpServers() {
    return this.run(() => this.mcp.list());
  }
  setMcpServerEnabled(id, enabled) {
    return this.run(() => this.mcp.setEnabled(id, enabled));
  }
  listSkills(cwd, scope) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.list(cwd, scope);
    });
  }
  setSkillEnabled(cwd, scope, name, enabled) {
    return this.run(() => {
      if (!this.skills.current) throw new Error('DSH skill management is unavailable.');
      return this.skills.current.setEnabled(cwd, scope, name, enabled);
    });
  }
}

export function apply(ctx, config) {
  // The installed managed entry may retain its legacy ID; keep writes on that entry.
  const namespace = ctx.fiber.entry?.options.id;
  if (!namespace) throw new Error('Mod preferences require a managed plugin entry.');
  const queue = new OperationQueue();
  ctx.effect(() => () => queue.close());
  const options = { ensureActive: () => queue.ensureActive() };
  const policy = new AccountPolicy(ctx, options);
  const telemetry = new TelemetryPolicy(ctx, options);
  const instructions = new PersonalizationFile(ctx.profileContext.home, options.ensureActive);
  const skills = { current: null };
  const mcp = new McpPolicy(ctx, options);
  const todo = new TodoPolicy(ctx, config, options);
  ctx.inject(['sessionProjections'], async child => {
    await child.sessionProjections.register(notificationProjection());
  });
  ctx.inject(['agents', 'agentPresets'], child => todo.bind(child));
  const search = new SearchPolicy(ctx, config, options);
  ctx.inject(['agents', 'agentPresets'], child => search.bind(child));
  const sounds = new SystemSounds(ctx, config);
  const restart = new DesktopRestart(ctx, config);
  const service = new ModService(ctx, policy, telemetry, queue, instructions, skills, mcp, todo, sounds, restart, search);
  ctx.inject(['agentPresets'], child => {
    const registry = child.agentPresets;
    child.effect(() => {
      mcp.presets = registry;
      return () => { if (mcp.presets === registry) mcp.presets = null; };
    });
  });
  ctx.inject(['loader'], child => {
    const providers = new McpProviders(child, options);
    mcp.providers = providers;
    providers.ready = providers.initialize();
    void providers.ready.catch(() => {});
    child.effect(() => () => {
      if (mcp.providers === providers) mcp.providers = null;
      providers.close();
    });
  });
  ctx.inject(['skills', 'agents', 'agentPresets', 'workspaceRegistry', 'workingDirectory', 'loader'], child => {
    const manager = new SkillPolicy(ctx, config, options);
    skills.current = manager;
    // Import the Host's scope module so its identity matches the running registry.
    manager.ready = child.loader.import('@deepseek-ai/dsh-scope').then(({ createScope }) => {
      options.ensureActive();
      if (!manager.closed) manager.bind(child, createScope);
    });
    void manager.ready.catch(() => {}); // Requests report initialization errors; do not reject Host boot.
    child.effect(() => () => {
      if (skills.current === manager) skills.current = null;
      return manager.close();
    });
  });
  ctx.effect(() => ctx.typert.register({
    package: 'power-dsh', face: 'host', schemas: [],
    model: { services: [], events: [], objects: [] }, invocations: MOD_RPC,
  }));
  ctx.effect(() => ctx.settings.configure({ auto: false }));
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'power_dsh_settings',
    description: 'Read or change Mod preferences and report the DSH version.',
    parameters: {
      showVersion: {
        type: 'boolean',
        description: 'Show the DSH version beside the upper-left brand when true. Omit to keep it unchanged.',
      },
      showThemeSwitcher: {
        type: 'boolean',
        description: 'Show the appearance shortcut at the sidebar bottom when expanded. Omit to keep it unchanged.',
      },
      showRefreshButton: {
        type: 'boolean',
        description: 'Show the interface refresh button while the sidebar is expanded. This preference does not trigger a refresh. Omit to keep it unchanged.',
      },
      showRestartButton: {
        type: 'boolean',
        description: 'Show the desktop application restart button when supported. This preference does not restart the application. Omit to keep it unchanged.',
      },
      blockDoubleClickRename: {
        type: 'boolean',
        description: 'Block double-click renaming in the sidebar session list when true. Menu and keyboard renaming remain available. Omit to keep it unchanged.',
      },
      blockTodo: {
        type: 'boolean',
        description: 'Disable the Todo tool plugin globally and in modes when true; false enables matching plugins. Existing sessions may need reopening to use a re-enabled mode revision. Session history and the conversation UI are preserved. Omit to keep it unchanged.',
      },
      blockOfficialTelemetry: {
        type: 'boolean',
        description: 'Disable built-in analytics, its exporter, feedback UI and command, Session-log uploads and plugin inventory reporting when true; false enables those plugins. Local logs and update checks are unaffected; in-flight and queued uploads may finish. Omit to keep it unchanged.',
      },
      blockOfficialSearch: {
        type: 'boolean',
        description: 'Disable built-in web_search globally and in modes when true; false enables search in active matching tool declarations. Web fetch, third-party MCP search, and other preferences are preserved. Existing sessions may need reopening after re-enabling. Omit to keep it unchanged.',
      },
      blockOfficialAccount: {
        type: 'boolean',
        description: 'Disable official-account UI, account models, and the built-in DeepSeek API-key integration when true; false enables those plugins. Separately added and third-party providers and stored credentials are preserved. Omit to keep it unchanged.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          showVersion: { type: 'boolean', required: true },
          showThemeSwitcher: { type: 'boolean', required: true },
          showRefreshButton: { type: 'boolean', required: true },
          showRestartButton: { type: 'boolean', required: true },
          blockOfficialAccount: { type: 'boolean', required: true },
          blockOfficialSearch: { type: 'boolean', required: true },
          blockDoubleClickRename: { type: 'boolean', required: true },
          blockOfficialTelemetry: { type: 'boolean', required: true },
          blockTodo: { type: 'boolean', required: true },
          telemetry: {
            type: 'object', required: true, additionalProperties: false,
            properties: {
              protected: { type: 'boolean', required: true },
              senders: {
                type: 'array', required: true, items: {
                  type: 'object', additionalProperties: false, properties: {
                    id: { type: 'string', required: true },
                    enabled: { type: 'boolean', required: true },
                    active: { type: 'boolean', required: true },
                    available: { type: 'boolean', required: true },
                  },
                },
              },
            },
          },
          version: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted();
      for (const field of ['showVersion', 'showThemeSwitcher', 'showRefreshButton', 'showRestartButton', 'blockDoubleClickRename']) {
        if (args[field] !== undefined) {
          await ctx.settings.mutate(namespace, [{ op: 'set', path: [field], value: args[field] }]);
        }
      }
      if (args.blockOfficialAccount !== undefined) {
        await service.setAccountBlocked(args.blockOfficialAccount);
      }
      if (args.blockOfficialTelemetry !== undefined) {
        await service.setTelemetryBlocked(args.blockOfficialTelemetry);
      }
      if (args.blockTodo !== undefined) {
        await service.setTodoBlocked(args.blockTodo);
      }
      if (args.blockOfficialSearch !== undefined) {
        await service.setSearchBlocked(args.blockOfficialSearch);
      }
      return {
        blockTodo: config.blockTodo.get(),
        blockOfficialTelemetry: config.blockOfficialTelemetry.get(),
        telemetry: await telemetry.status(),
        showVersion: config.showVersion.get(),
        showThemeSwitcher: config.showThemeSwitcher.get(),
        showRefreshButton: config.showRefreshButton.get(),
        showRestartButton: config.showRestartButton.get(),
        blockDoubleClickRename: config.blockDoubleClickRename.get(),
        blockOfficialAccount: config.blockOfficialAccount.get(),
        blockOfficialSearch: config.blockOfficialSearch.get(),
        version: ctx.clientModules.graph().release?.version ?? null,
      };
    },
  })));
}
