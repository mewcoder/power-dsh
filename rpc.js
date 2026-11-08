// The dynamic Client declares matching descriptors; tests verify wire compatibility.
const booleanCodec = {
  mode: 'strict', typeSymbol: 'boolean',
  create: () => ({ parse(value) {
    if (typeof value !== 'boolean') throw new TypeError('Expected a boolean');
    return value;
  } }),
};

function policyRpc(method, resultType) {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'blocked', wire: 'blocked', source: 'json', codec: booleanCodec }],
    result: {
      mode: 'strict', typeSymbol: `power-dsh#${resultType}`,
      create: () => ({ parse(value) {
        if (!value || typeof value.blocked !== 'boolean') throw new TypeError('Invalid policy result');
        return { blocked: value.blocked };
      } }),
    },
  };
}

export const ACCOUNT_RPC = policyRpc('setAccountBlocked', 'AccountPolicyResult');
export const TELEMETRY_RPC = policyRpc('setTelemetryBlocked', 'TelemetryPolicyResult');
export const TODO_RPC = policyRpc('setTodoBlocked', 'TodoPolicyResult');
export const SEARCH_RPC = policyRpc('setSearchBlocked', 'SearchPolicyResult');
const fileCodec = {
  mode: 'strict', typeSymbol: 'power-dsh#PersonalizationFile',
  create: () => ({ parse(value) {
    if (!value || typeof value.path !== 'string' || typeof value.text !== 'string'
      || typeof value.revision !== 'string' || !/^[a-f\d]{64}$/.test(value.revision)) throw new TypeError('Invalid instruction file');
    return { path: value.path, text: value.text, revision: value.revision };
  } }),
};
const stringCodec = {
  mode: 'strict', typeSymbol: 'string',
  create: () => ({ parse(value) {
    if (typeof value !== 'string') throw new TypeError('Expected a string');
    return value;
  } }),
};
function fileRpc(method, fields) {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: stringCodec })),
    result: fileCodec,
  };
}
export const READ_PERSONALIZATION_RPC = fileRpc('readPersonalization', []);
export const SAVE_PERSONALIZATION_RPC = fileRpc('savePersonalization', ['text', 'revision']);
const skillCatalogCodec = {
  mode: 'strict', typeSymbol: 'power-dsh#SkillCatalog',
  create: () => ({ parse(value) {
    if (!value || typeof value.cwd !== 'string' || !['user', 'project'].includes(value.scope)
      || typeof value.complete !== 'boolean'
      || !Array.isArray(value.workspaces) || !value.workspaces.every(item => item && typeof item.path === 'string' && typeof item.title === 'string')
      || !Array.isArray(value.skills)) throw new TypeError('Invalid skill catalog');
    const skills = value.skills.map(row => {
      if (!row || !['name', 'description', 'source', 'path', 'origin', 'reason'].every(key => typeof row[key] === 'string')
        || !['enabled', 'modelInvocable', 'userInvocable', 'canToggle'].every(key => typeof row[key] === 'boolean')
        || row.enabled !== (row.modelInvocable || row.userInvocable)) throw new TypeError('Invalid skill entry');
      return { name: row.name, description: row.description, source: row.source, path: row.path, origin: row.origin,
        enabled: row.enabled, modelInvocable: row.modelInvocable, userInvocable: row.userInvocable,
        canToggle: row.canToggle, reason: row.reason };
    });
    return { cwd: value.cwd, scope: value.scope, workspaces: value.workspaces.map(item => ({ path: item.path, title: item.title })), complete: value.complete, skills };
  } }),
};
function skillRpc(method, fields) {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: name === 'enabled' ? booleanCodec : stringCodec })),
    result: skillCatalogCodec,
  };
}
export const LIST_SKILLS_RPC = skillRpc('listSkills', ['cwd', 'scope']);
export const SET_SKILL_ENABLED_RPC = skillRpc('setSkillEnabled', ['cwd', 'scope', 'name', 'enabled']);
const mcpCatalogCodec = {
  mode: 'strict', typeSymbol: 'power-dsh#McpCatalog',
  create: () => ({ parse(value) {
    if (!value || typeof value.complete !== 'boolean' || !Array.isArray(value.servers)) throw new TypeError('Invalid MCP catalog');
    const servers = value.servers.map(row => {
      if (!row || !['id', 'name', 'source', 'origin', 'reason'].every(key => typeof row[key] === 'string')
        || !['user', 'builtin'].includes(row.group)
        || !['stdio', 'streamable-http', 'unknown'].includes(row.transport)
        || !['pending', 'loading', 'active', 'failed', 'unloading', 'inactive', 'disabled', 'unknown'].includes(row.runtimeState)
        || !Array.isArray(row.tools) || row.tools.some(name => typeof name !== 'string')
        || !['enabled', 'stateKnown', 'canToggle'].every(key => typeof row[key] === 'boolean')) throw new TypeError('Invalid MCP entry');
      return { id: row.id, name: row.name, source: row.source, origin: row.origin, group: row.group, enabled: row.enabled,
        stateKnown: row.stateKnown, runtimeState: row.runtimeState, transport: row.transport, canToggle: row.canToggle, reason: row.reason, tools: row.tools.slice() };
    });
    return { complete: value.complete, servers };
  } }),
};
function mcpRpc(method, fields) {
  return {
    id: `power-dsh#powerDsh/${method}`,
    service: 'powerDsh', namespace: 'powerDsh', method,
    invocation: { kind: 'direct' },
    parameters: fields.map(name => ({ name, wire: name, source: 'json', codec: name === 'enabled' ? booleanCodec : stringCodec })),
    result: mcpCatalogCodec,
  };
}
export const LIST_MCP_SERVERS_RPC = mcpRpc('listMcpServers', []);
export const SET_MCP_SERVER_ENABLED_RPC = mcpRpc('setMcpServerEnabled', ['id', 'enabled']);
const soundCatalogCodec = {
  mode: 'strict', typeSymbol: 'power-dsh#SystemSounds',
  create: () => ({ parse(value) {
    if (!value || !['darwin', 'win32', 'other'].includes(value.platform) || !Array.isArray(value.sounds)
      || value.sounds.some(row => !row || typeof row.id !== 'string' || typeof row.name !== 'string')) throw new TypeError('Invalid system sounds');
    return { platform: value.platform, sounds: value.sounds.map(row => ({ id: row.id, name: row.name })) };
  } }),
};
export const LIST_SYSTEM_SOUNDS_RPC = {
  id: 'power-dsh#powerDsh/listSystemSounds', service: 'powerDsh', namespace: 'powerDsh', method: 'listSystemSounds',
  invocation: { kind: 'direct' }, parameters: [], result: soundCatalogCodec,
};
export const PLAY_SYSTEM_SOUND_RPC = {
  id: 'power-dsh#powerDsh/playSystemSound', service: 'powerDsh', namespace: 'powerDsh', method: 'playSystemSound',
  invocation: { kind: 'direct' },
  parameters: [
    { name: 'id', wire: 'id', source: 'json', codec: stringCodec },
    { name: 'preview', wire: 'preview', source: 'json', codec: booleanCodec },
  ],
  result: { mode: 'strict', typeSymbol: 'power-dsh#SoundPlayback', create: () => ({ parse(value) {
    if (!value || typeof value.played !== 'boolean') throw new TypeError('Invalid sound playback');
    return { played: value.played };
  } }) },
};
export const RESTART_STATUS_RPC = {
  id: 'power-dsh#powerDsh/restartStatus', service: 'powerDsh', namespace: 'powerDsh', method: 'restartStatus',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#RestartStatus', create: () => ({ parse(value) {
    if (!value || typeof value.supported !== 'boolean' || typeof value.running !== 'boolean'
      || !['', 'restartFailed'].includes(value.error)) throw new TypeError('Invalid restart status');
    return { supported: value.supported, running: value.running, error: value.error };
  } }) },
};
export const RESTART_APP_RPC = {
  id: 'power-dsh#powerDsh/restartApp', service: 'powerDsh', namespace: 'powerDsh', method: 'restartApp',
  invocation: { kind: 'direct' }, parameters: [],
  result: { mode: 'strict', typeSymbol: 'power-dsh#RestartAccepted', create: () => ({ parse(value) {
    if (!value || value.accepted !== true) throw new TypeError('Invalid restart acceptance');
    return { accepted: true };
  } }) },
};
export const MOD_RPC = [RESTART_STATUS_RPC, RESTART_APP_RPC, LIST_SYSTEM_SOUNDS_RPC, PLAY_SYSTEM_SOUND_RPC, ACCOUNT_RPC, TELEMETRY_RPC, TODO_RPC, SEARCH_RPC, READ_PERSONALIZATION_RPC, SAVE_PERSONALIZATION_RPC, LIST_SKILLS_RPC, SET_SKILL_ENABLED_RPC, LIST_MCP_SERVERS_RPC, SET_MCP_SERVER_ENABLED_RPC];
