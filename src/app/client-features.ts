import type { ClientFeatureSelection } from '../shared/client/types.ts';
// Explicit Client selection: each entry carries its UI factory, metadata, locale and wire contributions.
import { createClientFeature as accountBlocking } from '../features/account-blocking/client.ts';
import { definition as accountBlockingDefinition } from '../features/account-blocking/definition.ts';
import { locales as accountBlockingLocales } from '../features/account-blocking/locales.ts';
import { rpc as accountBlockingRpc } from '../features/account-blocking/rpc.ts';
import { createClientFeature as appearanceShortcut } from '../features/appearance-shortcut/client.ts';
import { definition as appearanceShortcutDefinition } from '../features/appearance-shortcut/definition.ts';
import { locales as appearanceShortcutLocales } from '../features/appearance-shortcut/locales.ts';
import { createClientFeature as doubleClickRename } from '../features/double-click-rename/client.ts';
import { definition as doubleClickRenameDefinition } from '../features/double-click-rename/definition.ts';
import { locales as doubleClickRenameLocales } from '../features/double-click-rename/locales.ts';
import { createClientFeature as mcp } from '../features/mcp/client.ts';
import { definition as mcpDefinition } from '../features/mcp/definition.ts';
import { locales as mcpLocales } from '../features/mcp/locales.ts';
import { rpc as mcpRpc } from '../features/mcp/rpc.ts';
import { createClientFeature as notifications } from '../features/notifications/client.ts';
import { definition as notificationsDefinition } from '../features/notifications/definition.ts';
import { locales as notificationsLocales } from '../features/notifications/locales.ts';
import { rpc as notificationsRpc } from '../features/notifications/rpc.ts';
import { createClientFeature as personalization } from '../features/personalization/client.ts';
import { definition as personalizationDefinition } from '../features/personalization/definition.ts';
import { locales as personalizationLocales } from '../features/personalization/locales.ts';
import { rpc as personalizationRpc } from '../features/personalization/rpc.ts';
import { createClientFeature as refreshButton } from '../features/refresh-button/client.ts';
import { definition as refreshButtonDefinition } from '../features/refresh-button/definition.ts';
import { locales as refreshButtonLocales } from '../features/refresh-button/locales.ts';
import { createClientFeature as restartButton } from '../features/restart-button/client.ts';
import { definition as restartButtonDefinition } from '../features/restart-button/definition.ts';
import { locales as restartButtonLocales } from '../features/restart-button/locales.ts';
import { rpc as restartButtonRpc } from '../features/restart-button/rpc.ts';
import { createClientFeature as searchBlocking } from '../features/search-blocking/client.ts';
import { definition as searchBlockingDefinition } from '../features/search-blocking/definition.ts';
import { locales as searchBlockingLocales } from '../features/search-blocking/locales.ts';
import { rpc as searchBlockingRpc } from '../features/search-blocking/rpc.ts';
import { createClientFeature as skills } from '../features/skills/client.ts';
import { definition as skillsDefinition } from '../features/skills/definition.ts';
import { locales as skillsLocales } from '../features/skills/locales.ts';
import { rpc as skillsRpc } from '../features/skills/rpc.ts';
import { createClientFeature as telemetryBlocking } from '../features/telemetry-blocking/client.ts';
import { definition as telemetryBlockingDefinition } from '../features/telemetry-blocking/definition.ts';
import { locales as telemetryBlockingLocales } from '../features/telemetry-blocking/locales.ts';
import { rpc as telemetryBlockingRpc } from '../features/telemetry-blocking/rpc.ts';
import { createClientFeature as todoBlocking } from '../features/todo-blocking/client.ts';
import { definition as todoBlockingDefinition } from '../features/todo-blocking/definition.ts';
import { locales as todoBlockingLocales } from '../features/todo-blocking/locales.ts';
import { rpc as todoBlockingRpc } from '../features/todo-blocking/rpc.ts';
import { createClientFeature as planBlocking } from '../features/plan-blocking/client.ts';
import { definition as planBlockingDefinition } from '../features/plan-blocking/definition.ts';
import { locales as planBlockingLocales } from '../features/plan-blocking/locales.ts';
import { rpc as planBlockingRpc } from '../features/plan-blocking/rpc.ts';
import { createClientFeature as goalBlocking } from '../features/goal-blocking/client.ts';
import { definition as goalBlockingDefinition } from '../features/goal-blocking/definition.ts';
import { locales as goalBlockingLocales } from '../features/goal-blocking/locales.ts';
import { rpc as goalBlockingRpc } from '../features/goal-blocking/rpc.ts';
import { createClientFeature as versionDisplay } from '../features/version-display/client.ts';
import { definition as versionDisplayDefinition } from '../features/version-display/definition.ts';
import { locales as versionDisplayLocales } from '../features/version-display/locales.ts';
import { createClientFeature as thinkingEffort } from '../features/thinking-effort/client.ts';
import { definition as thinkingEffortDefinition } from '../features/thinking-effort/definition.ts';
import { locales as thinkingEffortLocales } from '../features/thinking-effort/locales.ts';
import { createClientFeature as flowingBackground } from '../features/flowing-background/client.ts';
import { definition as flowingBackgroundDefinition } from '../features/flowing-background/definition.ts';
import { locales as flowingBackgroundLocales } from '../features/flowing-background/locales.ts';

export const clientFeatures: ClientFeatureSelection[] = [
  { definition: versionDisplayDefinition, create: versionDisplay, locales: versionDisplayLocales, rpc: [] },
  { definition: appearanceShortcutDefinition, create: appearanceShortcut, locales: appearanceShortcutLocales, rpc: [] },
  { definition: refreshButtonDefinition, create: refreshButton, locales: refreshButtonLocales, rpc: [] },
  { definition: restartButtonDefinition, create: restartButton, locales: restartButtonLocales, rpc: restartButtonRpc },
  { definition: notificationsDefinition, create: notifications, locales: notificationsLocales, rpc: notificationsRpc },
  { definition: personalizationDefinition, create: personalization, locales: personalizationLocales, rpc: personalizationRpc },
  { definition: skillsDefinition, create: skills, locales: skillsLocales, rpc: skillsRpc },
  { definition: mcpDefinition, create: mcp, locales: mcpLocales, rpc: mcpRpc },
  { definition: accountBlockingDefinition, create: accountBlocking, locales: accountBlockingLocales, rpc: accountBlockingRpc },
  { definition: searchBlockingDefinition, create: searchBlocking, locales: searchBlockingLocales, rpc: searchBlockingRpc },
  { definition: telemetryBlockingDefinition, create: telemetryBlocking, locales: telemetryBlockingLocales, rpc: telemetryBlockingRpc },
  { definition: todoBlockingDefinition, create: todoBlocking, locales: todoBlockingLocales, rpc: todoBlockingRpc },
  { definition: planBlockingDefinition, create: planBlocking, locales: planBlockingLocales, rpc: planBlockingRpc },
  { definition: goalBlockingDefinition, create: goalBlocking, locales: goalBlockingLocales, rpc: goalBlockingRpc },
  { definition: doubleClickRenameDefinition, create: doubleClickRename, locales: doubleClickRenameLocales, rpc: [] },
  { definition: thinkingEffortDefinition, create: thinkingEffort, locales: thinkingEffortLocales, rpc: [] },
  { definition: flowingBackgroundDefinition, create: flowingBackground, locales: flowingBackgroundLocales, rpc: [] },
];
