import type { Locales } from '../../shared/client/types.ts';
export const locales = {
  "en": {
    "showRestartButton": "Show restart button",
    "restartDescription": "Restart the application",
    "restart": "Restart application",
    "restartConfirm": "Running tasks will stop and unsaved content may be lost.",
    "restartAction": "Restart application",
    "restartFailed": "Could not restart DSH. Check whether quitting was cancelled, then try again.",
    "restartUnavailable": "Restart is unavailable. Re-enable PowerDSH and try again.",
    "restartBusy": "DSH is already preparing to restart."
  },
  "zh": {
    "showRestartButton": "显示重启按钮",
    "restartDescription": "重新启动应用",
    "restart": "重启应用",
    "restartConfirm": "运行中的任务会停止，未保存的内容可能丢失。",
    "restartAction": "重启应用",
    "restartFailed": "未能重启 DSH。请检查是否取消了退出，然后重试。",
    "restartUnavailable": "重启暂不可用，请重新启用 PowerDSH 后重试。",
    "restartBusy": "DSH 正在准备重启。"
  }
} satisfies Locales;
