import type { Locales } from '../../shared/client/types.ts';

export const locales = {
  en: {
    blockGoal: 'Disable Goal mode',
    blockGoalDescription: 'Disable the built-in Goal mode for new conversations',
  },
  zh: {
    blockGoal: '停用 Goal 模式',
    blockGoalDescription: '停用新对话的内置目标模式',
  },
} satisfies Locales;
