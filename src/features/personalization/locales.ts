import type { Locales } from '../../shared/client/types.ts';
export const locales = {
  "en": {
    "personalizationTab": "Global instructions",
    "personalizationEnabled": "Global instructions",
    "personalizationDescription": "Edit global instructions in settings",
    "settingsLocation": "{path}",
    "globalPromptPlaceholder": "Add custom instructions",
    "globalPrompt": "Global instructions",
    "promptTooLong": "Instructions exceed the 20,000 character limit.",
    "promptConflict": "These instructions changed elsewhere. Copy your draft, then cancel to load the latest version."
  },
  "zh": {
    "personalizationTab": "全局指令",
    "personalizationEnabled": "全局指令",
    "personalizationDescription": "在设置中编辑全局指令",
    "settingsLocation": "{path}",
    "globalPromptPlaceholder": "添加自定义指令",
    "globalPrompt": "全局指令",
    "promptTooLong": "全局指令超过 20,000 字符上限。",
    "promptConflict": "内容已在其他位置更改，请先复制草稿，再取消以载入最新内容。"
  }
} satisfies Locales;
