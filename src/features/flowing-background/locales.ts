import type { Locales } from '../../shared/client/types.ts';
export const locales = {
  en: {
    flowingBackgroundEnabled: 'Homepage flowing background',
    flowingBackgroundDescription: 'Add a softly flowing blue gradient to the interface',
    flowingBackgroundLayoutUnavailable: 'The application layout could not be adapted. The background stays hidden; the native interface is preserved. Toggle the background off and on to retry.',
  },
  zh: {
    flowingBackgroundEnabled: '官网流动背景',
    flowingBackgroundDescription: '为界面添加柔和流动的蓝色渐变',
    flowingBackgroundLayoutUnavailable: '未能适配应用布局，背景已隐藏并保留原生界面。关闭后重新开启官网流动背景可重试。',
  },
} satisfies Locales;
