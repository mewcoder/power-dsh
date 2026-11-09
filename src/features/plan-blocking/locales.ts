import type { Locales } from '../../shared/client/types.ts';

export const locales = {
  en: {
    blockPlan: 'Disable Plan mode',
    blockPlanDescription: 'Disable the built-in Plan mode for new conversations',
  },
  zh: {
    blockPlan: '停用 Plan 模式',
    blockPlanDescription: '停用新对话的内置计划模式',
  },
} satisfies Locales;
