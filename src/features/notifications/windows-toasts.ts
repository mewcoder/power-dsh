import { Buffer } from 'node:buffer';
import type { NativeContext, NativeSubprocessHandle } from '../../shared/host/native.ts';
import { OperationQueue } from '../../shared/host/operation-queue.ts';
import type { LivePreferences } from '../../shared/types/preferences.ts';
import type { WindowsNotification, NotificationDelivery, NotificationCleared } from '../../shared/types/wire.ts';
import { parseWindowsNotification } from './rpc.ts';

interface ToastOptions { platform?: string; appId?: string; timeoutMs?: number }
interface ToastOperation { controller: AbortController; handle?: NativeSubprocessHandle }
interface ToastCommand { appId: string; group?: string; tag?: string; xml?: string; groups?: string[] }

export function windowsToastScript(command: ToastCommand) {
  const data = Buffer.from(JSON.stringify(command), 'utf8').toString('base64');
  return `$ErrorActionPreference = 'Stop'
$data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$history = [Windows.UI.Notifications.ToastNotificationManager]::History
if ($null -ne $data.groups) {
  foreach ($group in $data.groups) { $history.RemoveGroup([string]$group, [string]$data.appId) }
} elseif ($null -eq $data.xml) {
  if ([string]::IsNullOrEmpty($data.tag)) { $history.RemoveGroup([string]$data.group, [string]$data.appId) }
  else { $history.Remove([string]$data.tag, [string]$data.group, [string]$data.appId) }
} else {
  $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
  $doc.LoadXml([string]$data.xml)
  $toast = New-Object Windows.UI.Notifications.ToastNotification $doc
  $toast.Group = [string]$data.group
  $toast.Tag = [string]$data.tag
  $toast.SuppressPopup = $false
  $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier([string]$data.appId)
  if ($notifier.Setting.ToString() -ne 'Enabled') { throw 'Notifications are disabled' }
  $notifier.Show($toast)
}`;
}

const escapeXml = (text: string) => text.replace(/[\uD800-\uDFFF\uFFFE\uFFFF]/gu, '\uFFFD').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]!);

export class WindowsToasts {
  ctx: NativeContext;
  config: LivePreferences;
  platform: string;
  appId: string;
  timeoutMs: number;
  queue = new OperationQueue();
  current: ToastOperation | null = null;
  groups = new Set<string>();
  revisions = new Map<string, number>();
  closed = false;
  constructor(ctx: NativeContext, config: LivePreferences, options: ToastOptions = {}) {
    this.ctx = ctx;
    this.config = config;
    this.platform = options.platform ?? process.platform;
    this.appId = options.appId ?? process.env.DSH_APP_USER_MODEL_ID ?? 'com.deepseek.dsh';
    this.timeoutMs = options.timeoutMs ?? 10_000;
    ctx.effect(() => () => this.close());
  }

  async execute(command: Omit<ToastCommand, 'appId'>, allowed = () => true) {
    const subprocess = this.ctx.get('subprocess');
    if (this.platform !== 'win32' || !subprocess || !/^[a-zA-Z0-9._-]{1,128}$/.test(this.appId)) {
      throw new Error('notificationUnsupported');
    }
    const operation: ToastOperation = { controller: new AbortController() };
    this.current = operation;
    const timer = setTimeout(() => operation.controller.abort(), this.timeoutMs);
    const stopped = new Promise<never>((_resolve, reject) => {
      operation.controller.signal.addEventListener('abort', () => reject(new Error('notificationFailed')), { once: true });
    });
    try {
      const executable = await Promise.race([
        subprocess.resolveExecutable('powershell.exe', undefined, operation.controller.signal), stopped,
      ]);
      operation.controller.signal.throwIfAborted();
      if (!allowed()) return false;
      operation.handle = subprocess.spawn({
        argv: [executable, '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
          Buffer.from(windowsToastScript({ ...command, appId: this.appId }), 'utf16le').toString('base64')],
        cwd: process.cwd(), graceMs: 250, signal: operation.controller.signal,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 4096 } },
      });
      const outcome = await Promise.race([operation.handle.done, stopped]);
      if (!await Promise.race([operation.handle.waitForExit(operation.controller.signal), stopped])
        || outcome.exitCode !== 0 || outcome.signal !== null) throw new Error('notificationFailed');
      operation.controller.signal.throwIfAborted();
      return true;
    } catch (_error) {
      operation.controller.abort();
      throw new Error('notificationFailed');
    } finally {
      clearTimeout(timer);
      if (operation.controller.signal.aborted) operation.handle?.terminate();
      if (this.current === operation) this.current = null;
    }
  }

  show(input: WindowsNotification): Promise<NotificationDelivery> {
    const notification = parseWindowsNotification(input);
    const revision = this.revisions.get(notification.group);
    const tagKey = `${notification.group}:${notification.tag}`;
    const tagRevision = this.revisions.get(tagKey);
    const current = () => revision === this.revisions.get(notification.group) && tagRevision === this.revisions.get(tagKey);
    return this.queue.run(async () => {
      if (!current() || this.config.notificationsEnabled.get() !== true
        || (notification.preview && this.config.notificationSoundEnabled.get() !== true)) return { shown: false };
      const soundEnabled = this.config.notificationSoundEnabled.get() === true;
      const sound = this.config.notificationSound.get() || 'default';
      if (notification.preview && sound !== 'default') return { shown: false };
      const audio = soundEnabled && sound === 'default' ? '' : '<audio silent="true"/>';
      const attention = notification.attention && !notification.preview;
      const actions = attention
        ? `<actions><action activationType="system" arguments="dismiss" content="${escapeXml(notification.dismiss)}"/></actions>` : '';
      const xml = `<toast${attention ? ' scenario="reminder" duration="long"' : ''}><visual><binding template="ToastGeneric"><text>${escapeXml(notification.title)}</text><text>${escapeXml(notification.body)}</text></binding></visual>${audio}${actions}</toast>`;
      if (!this.groups.has(notification.group) && this.groups.size >= 64) throw new Error('notificationFailed');
      this.groups.add(notification.group);
      const shown = await this.execute({ group: notification.group, tag: notification.tag, xml }, () =>
        current() && this.config.notificationsEnabled.get() === true
        && this.config.notificationSoundEnabled.get() === soundEnabled && (this.config.notificationSound.get() || 'default') === sound);
      return { shown };
    });
  }

  clear(group: string, tag: string): Promise<NotificationCleared> {
    if (typeof group !== 'string' || !/^[a-z0-9]{1,16}$/.test(group) || typeof tag !== 'string' || !/^[a-z0-9]{0,16}$/.test(tag)) {
      return Promise.reject(new Error('notificationFailed'));
    }
    const key = tag ? `${group}:${tag}` : group;
    this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    return this.queue.run(async () => {
      if (!this.groups.has(group)) return { cleared: false };
      await this.execute({ group, tag });
      if (!tag) this.groups.delete(group);
      return { cleared: true };
    });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.queue.close();
    const operation = this.current;
    operation?.controller.abort();
    operation?.handle?.terminate();
    await this.queue.tail;
    const groups = [...this.groups];
    this.groups.clear();
    this.revisions.clear();
    if (groups.length) {
      try { await this.execute({ groups }); }
      catch (_error) {}
    }
  }
}
