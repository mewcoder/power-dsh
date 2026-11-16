import type { Locales } from '../../shared/client/types.ts';

export const locales = {
  zh: {
    historySearchEnabled: '历史对话检索（实验性）',
    historySearchDescription: '允许 AI 按需查阅当前项目的历史聊天，追溯过去的约定与处理过程',
  },
  en: {
    historySearchEnabled: 'Chat history retrieval (experimental)',
    historySearchDescription: 'Allow AI to look up past chats in the current project for earlier decisions and solutions',
  },
} satisfies Locales;
