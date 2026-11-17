import type { Locales } from '../../shared/client/types.ts';

export const locales = {
  en: {
    standalonePageEnabled: 'Sidebar page',
    standalonePageDescription: 'Move feature pages from the settings sidebar to a standalone page in the main sidebar',
    standaloneEmpty: 'No feature pages enabled',
    standaloneEmptyHint: 'Enable a feature in Settings → power-dsh → Management',
  },
  zh: {
    standalonePageEnabled: '侧边栏独立页面',
    standalonePageDescription: '将功能页从设置侧栏移至主侧栏的独立页面',
    standaloneEmpty: '尚未开启功能页',
    standaloneEmptyHint: '在设置 → power-dsh → 管理中开启所需功能',
  },
} satisfies Locales;
