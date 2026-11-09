import type { Locales } from '../../shared/client/types.ts';
export const locales = {
  "en": {
    "showVersion": "Show version number",
    "versionDescription": "Show the version number at the upper left. Click it to check for updates",
    "openUpdate": "Check for updates",
    "updating": "Opening native updates…",
    "updateFailed": "Could not open updates. Please try again.",
    "desktopOnly": "Open the DSH desktop app to check for updates."
  },
  "zh": {
    "showVersion": "显示版本号",
    "versionDescription": "在左上角显示版本号，点击检查更新",
    "openUpdate": "检查更新",
    "updating": "正在打开原生更新…",
    "updateFailed": "无法打开更新，请重试。",
    "desktopOnly": "请在 DSH 桌面端检查更新。"
  }
} satisfies Locales;
