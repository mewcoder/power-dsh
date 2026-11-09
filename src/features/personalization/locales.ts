import type { Locales } from '../../shared/client/types.ts';
export const locales = {
  "en": {
    "personalizationTab": "Personalization",
    "personalizationEnabled": "Personalization",
    "personalizationDescription": "Manage global instructions",
    "settingsLocation": "Global instructions ({path})",
    "globalPromptPlaceholder": "Add custom instructions",
    "globalPrompt": "Global instructions",
    "promptTooLong": "Instructions exceed the 20,000 character limit.",
    "promptConflict": "These instructions changed elsewhere. Copy your draft, then cancel to load the latest version."
  },
  "zh": {
    "personalizationTab": "个性化",
    "personalizationEnabled": "个性化",
    "personalizationDescription": "管理全局提示词",
    "settingsLocation": "全局指令（{path}）",
    "globalPromptPlaceholder": "添加自定义指令",
    "globalPrompt": "全局提示词",
    "promptTooLong": "提示词超过 20,000 字符上限。",
    "promptConflict": "内容已在其他位置更改，请先复制草稿，再取消以载入最新内容。"
  }
} satisfies Locales;
