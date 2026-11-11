import type { NativeContext } from '../../shared/host/native.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { HostOptions, HostService } from '../../shared/host/feature.ts';
import { McpPolicy } from './mcp-policy.ts';
import { McpProviders } from './mcp-providers.ts';

export function createHost(ctx: NativeContext, _config: LivePreferences, { owner, ensureActive }: HostOptions) {
  const options = { ensureActive };
  const mcp = new McpPolicy(owner, options);
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
  return { mcp };
}

export const methods = {
  listMcpServers() {
    return this.run(() => this.mcp.list());
  },
  readMcpServer(id: string) {
    return this.run(() => this.mcp.read(id));
  },
  setMcpServerEnabled(id: string, enabled: boolean) {
    return this.run(() => this.mcp.setEnabled(id, enabled));
  },
} satisfies ThisType<HostService & ReturnType<typeof createHost>>;
