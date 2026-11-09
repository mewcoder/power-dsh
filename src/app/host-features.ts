import type { HostFeature } from '../shared/host/feature.ts';
// This list explicitly selects the Host features included in PowerDSH.
import { definition as versionDefinition } from '../features/version-display/definition.ts';
import * as versionConfig from '../features/version-display/config.ts';
import { definition as appearanceDefinition } from '../features/appearance-shortcut/definition.ts';
import * as appearanceConfig from '../features/appearance-shortcut/config.ts';
import { definition as refreshDefinition } from '../features/refresh-button/definition.ts';
import * as refreshConfig from '../features/refresh-button/config.ts';
import { definition as restartDefinition } from '../features/restart-button/definition.ts';
import * as restartConfig from '../features/restart-button/config.ts';
import * as restartHost from '../features/restart-button/host.ts';
import { rpc as restartRpc } from '../features/restart-button/rpc.ts';
import { definition as notificationsDefinition } from '../features/notifications/definition.ts';
import * as notificationsConfig from '../features/notifications/config.ts';
import * as notificationsHost from '../features/notifications/host.ts';
import { rpc as notificationsRpc } from '../features/notifications/rpc.ts';
import { definition as personalizationDefinition } from '../features/personalization/definition.ts';
import * as personalizationConfig from '../features/personalization/config.ts';
import * as personalizationHost from '../features/personalization/host.ts';
import { rpc as personalizationRpc } from '../features/personalization/rpc.ts';
import { definition as skillsDefinition } from '../features/skills/definition.ts';
import * as skillsConfig from '../features/skills/config.ts';
import * as skillsHost from '../features/skills/host.ts';
import { rpc as skillsRpc } from '../features/skills/rpc.ts';
import { definition as mcpDefinition } from '../features/mcp/definition.ts';
import * as mcpConfig from '../features/mcp/config.ts';
import * as mcpHost from '../features/mcp/host.ts';
import { rpc as mcpRpc } from '../features/mcp/rpc.ts';
import { definition as accountDefinition } from '../features/account-blocking/definition.ts';
import * as accountConfig from '../features/account-blocking/config.ts';
import * as accountHost from '../features/account-blocking/host.ts';
import { rpc as accountRpc } from '../features/account-blocking/rpc.ts';
import { definition as searchDefinition } from '../features/search-blocking/definition.ts';
import * as searchConfig from '../features/search-blocking/config.ts';
import * as searchHost from '../features/search-blocking/host.ts';
import { rpc as searchRpc } from '../features/search-blocking/rpc.ts';
import { definition as telemetryDefinition } from '../features/telemetry-blocking/definition.ts';
import * as telemetryConfig from '../features/telemetry-blocking/config.ts';
import * as telemetryHost from '../features/telemetry-blocking/host.ts';
import { rpc as telemetryRpc } from '../features/telemetry-blocking/rpc.ts';
import { definition as todoDefinition } from '../features/todo-blocking/definition.ts';
import * as todoConfig from '../features/todo-blocking/config.ts';
import * as todoHost from '../features/todo-blocking/host.ts';
import { rpc as todoRpc } from '../features/todo-blocking/rpc.ts';
import { definition as planDefinition } from '../features/plan-blocking/definition.ts';
import * as planConfig from '../features/plan-blocking/config.ts';
import * as planHost from '../features/plan-blocking/host.ts';
import { rpc as planRpc } from '../features/plan-blocking/rpc.ts';
import { definition as goalDefinition } from '../features/goal-blocking/definition.ts';
import * as goalConfig from '../features/goal-blocking/config.ts';
import * as goalHost from '../features/goal-blocking/host.ts';
import { rpc as goalRpc } from '../features/goal-blocking/rpc.ts';
import { definition as renameDefinition } from '../features/double-click-rename/definition.ts';
import * as renameConfig from '../features/double-click-rename/config.ts';
import { definition as effortDefinition } from '../features/thinking-effort/definition.ts';
import * as effortConfig from '../features/thinking-effort/config.ts';
import { definition as backgroundDefinition } from '../features/flowing-background/definition.ts';
import * as backgroundConfig from '../features/flowing-background/config.ts';

export const HOST_FEATURES = Object.freeze([
  { definition: versionDefinition, ...versionConfig },
  { definition: appearanceDefinition, ...appearanceConfig },
  { definition: refreshDefinition, ...refreshConfig },
  { definition: restartDefinition, ...restartConfig, ...restartHost, rpc: restartRpc },
  { definition: notificationsDefinition, ...notificationsConfig, ...notificationsHost, rpc: notificationsRpc },
  { definition: personalizationDefinition, ...personalizationConfig, ...personalizationHost, rpc: personalizationRpc },
  { definition: skillsDefinition, ...skillsConfig, ...skillsHost, rpc: skillsRpc },
  { definition: mcpDefinition, ...mcpConfig, ...mcpHost, rpc: mcpRpc },
  { definition: accountDefinition, ...accountConfig, ...accountHost, rpc: accountRpc },
  { definition: searchDefinition, ...searchConfig, ...searchHost, rpc: searchRpc },
  { definition: telemetryDefinition, ...telemetryConfig, ...telemetryHost, rpc: telemetryRpc },
  { definition: todoDefinition, ...todoConfig, ...todoHost, rpc: todoRpc },
  { definition: planDefinition, ...planConfig, ...planHost, rpc: planRpc },
  { definition: goalDefinition, ...goalConfig, ...goalHost, rpc: goalRpc },
  { definition: renameDefinition, ...renameConfig },
  { definition: effortDefinition, ...effortConfig },
  { definition: backgroundDefinition, ...backgroundConfig },
] satisfies HostFeature[]);

export const hostFeatures = HOST_FEATURES;
