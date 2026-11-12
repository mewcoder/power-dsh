import type { RpcDescriptor } from '../shared/types/protocol.ts';
import { NOTIFICATION_TRANSPORT_RPC } from '../features/notifications/rpc.ts';
// Browser-safe aggregation of the feature-owned wire contracts.
import { ACCOUNT_RPC } from '../features/account-blocking/rpc.ts';
import { TELEMETRY_RPC } from '../features/telemetry-blocking/rpc.ts';
import { TODO_RPC } from '../features/todo-blocking/rpc.ts';
import { PLAN_RPC } from '../features/plan-blocking/rpc.ts';
import { GOAL_RPC } from '../features/goal-blocking/rpc.ts';
import { SEARCH_RPC } from '../features/search-blocking/rpc.ts';
import { READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC } from '../features/personalization/rpc.ts';
import { LIST_SKILLS_RPC, READ_SKILL_RPC, SET_SKILL_ENABLED_RPC } from '../features/skills/rpc.ts';
import { LIST_MCP_SERVERS_RPC, READ_MCP_SERVER_RPC, SET_MCP_SERVER_ENABLED_RPC } from '../features/mcp/rpc.ts';
import { LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC, SHOW_WINDOWS_NOTIFICATION_RPC, CLEAR_WINDOWS_NOTIFICATIONS_RPC } from '../features/notifications/rpc.ts';
import { RESTART_STATUS_RPC, RESTART_APP_RPC } from '../features/restart-button/rpc.ts';
import { LIST_ARCHIVED_SESSIONS_RPC, RESTORE_ARCHIVED_SESSION_RPC, DELETE_ARCHIVED_SESSION_RPC } from '../features/archive/rpc.ts';
import { READ_WALLPAPER_RPC, SAVE_WALLPAPER_RPC, CLEAR_WALLPAPER_RPC } from '../features/wallpaper/rpc.ts';
import { LIST_PROJECTS_RPC, REMOVE_PROJECT_RPC } from '../features/projects/rpc.ts';
import { READ_USAGE_STATS_RPC } from '../features/usage-stats/rpc.ts';
import { READ_PLUGIN_RELEASE_RPC } from '../features/plugin-updates/rpc.ts';

export {
  READ_PLUGIN_RELEASE_RPC,
  ACCOUNT_RPC,
  TELEMETRY_RPC,
  TODO_RPC,
  PLAN_RPC,
  GOAL_RPC,
  SEARCH_RPC,
  READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC,
  LIST_SKILLS_RPC, READ_SKILL_RPC, SET_SKILL_ENABLED_RPC,
  LIST_MCP_SERVERS_RPC, READ_MCP_SERVER_RPC, SET_MCP_SERVER_ENABLED_RPC,
  LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC,
  SHOW_WINDOWS_NOTIFICATION_RPC, CLEAR_WINDOWS_NOTIFICATIONS_RPC,
  RESTART_STATUS_RPC, RESTART_APP_RPC,
  LIST_ARCHIVED_SESSIONS_RPC, RESTORE_ARCHIVED_SESSION_RPC, DELETE_ARCHIVED_SESSION_RPC,
  READ_WALLPAPER_RPC, SAVE_WALLPAPER_RPC, CLEAR_WALLPAPER_RPC,
  READ_USAGE_STATS_RPC,
  LIST_PROJECTS_RPC, REMOVE_PROJECT_RPC,
};

export function composeRpc<T extends RpcDescriptor[]>(descriptors: T): T {
  const ids = new Set();
  const methods = new Set();
  for (const descriptor of descriptors) {
    if (ids.has(descriptor.id)) throw new Error(`Duplicate RPC id: ${descriptor.id}`);
    if (methods.has(descriptor.method)) throw new Error(`Duplicate RPC method: ${descriptor.method}`);
    ids.add(descriptor.id);
    methods.add(descriptor.method);
  }
  return descriptors;
}

export const MOD_RPC = composeRpc([
  READ_PLUGIN_RELEASE_RPC,
  NOTIFICATION_TRANSPORT_RPC,
  RESTART_STATUS_RPC, RESTART_APP_RPC,
  LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC,
  SHOW_WINDOWS_NOTIFICATION_RPC, CLEAR_WINDOWS_NOTIFICATIONS_RPC,
  ACCOUNT_RPC, TELEMETRY_RPC, TODO_RPC, PLAN_RPC, GOAL_RPC, SEARCH_RPC,
  READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC,
  LIST_SKILLS_RPC, READ_SKILL_RPC, SET_SKILL_ENABLED_RPC,
  LIST_MCP_SERVERS_RPC, READ_MCP_SERVER_RPC, SET_MCP_SERVER_ENABLED_RPC,
  LIST_ARCHIVED_SESSIONS_RPC, RESTORE_ARCHIVED_SESSION_RPC, DELETE_ARCHIVED_SESSION_RPC,
  READ_WALLPAPER_RPC, SAVE_WALLPAPER_RPC, CLEAR_WALLPAPER_RPC,
  READ_USAGE_STATS_RPC,
  LIST_PROJECTS_RPC, REMOVE_PROJECT_RPC,
]);
