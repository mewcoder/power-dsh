// Compile-only regressions: each expected error must remain a real type error.
import type { FeatureDefinition } from '../../src/shared/types/feature.ts';
import type { Preferences, LivePreferences } from '../../src/shared/types/preferences.ts';
import * as plugin from '../../src/index.ts';
import type { PowerDshRemote, SettingsForm } from '../../src/shared/client/types.ts';
import { ACCOUNT_RPC } from '../../src/features/account-blocking/rpc.ts';

// Native plugin callers only know their base Context, before service injection.
const nativeEntry: { apply: (ctx: unknown, config: LivePreferences) => void } = plugin;
void nativeEntry;

declare const form: SettingsForm;
declare const remote: PowerDshRemote;
void form.set('showVersion', true);
void form.set('notificationSound', 'default');
void remote.setAccountBlocked(true);
void remote.setSkillEnabled('', 'user', 'code-review', false);
void remote.showWindowsNotification({ group: 'pdclient', tag: 'task', title: 'Task', body: '', attention: false, preview: false, dismiss: 'Dismiss' });
void remote.clearWindowsNotifications('pdclient', 'task');

// @ts-expect-error Native notification policy is boolean, not an arbitrary script option.
void remote.showWindowsNotification({ group: 'pdclient', tag: 'task', title: 'Task', body: '', attention: 'yes', preview: false, dismiss: 'Dismiss' });
// @ts-expect-error Native cleanup requires both the group and explicit tag or empty group selector.
void remote.clearWindowsNotifications('pdclient');

// @ts-expect-error A boolean preference cannot accept a string.
void form.set('showVersion', 'true');
// @ts-expect-error A sound identifier cannot accept a boolean.
void form.set('notificationSound', false);
// @ts-expect-error Misspelled configuration keys are not part of the contract.
void form.set('showRefreshButon', true);
// @ts-expect-error The named RPC expects a boolean, even after transport wrapping.
void remote.setAccountBlocked('true');
// @ts-expect-error RPC argument tuples retain their required parameters.
void remote.savePersonalization('instructions');

const parsedPolicy = ACCOUNT_RPC.result.create().parse({ blocked: true });
const blocked: Preferences['blockOfficialAccount'] = parsedPolicy.blocked;
// @ts-expect-error Strict codec results retain their business types.
const invalidBlocked: string = parsedPolicy.blocked;
// @ts-expect-error A feature must use a declared id.
const invalidId: FeatureDefinition['id'] = 'notification';

function catalogResult(reply: Awaited<ReturnType<PowerDshRemote['listSkills']>>) {
  if (reply.ok) {
    const name: string | undefined = reply.value.skills[0]?.name;
    // @ts-expect-error A skill response cannot be confused with an MCP catalog.
    const servers = reply.value.servers;
    return name;
  }
  return reply.error.message;
}
void blocked;
void invalidBlocked;
void invalidId;
void catalogResult;
