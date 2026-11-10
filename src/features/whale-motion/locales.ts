import type { Locales } from '../../shared/client/types.ts';

export const locales = {
  en: {
    whaleMotionEnabled: 'Whale animation',
    whaleMotionDescription: 'Let the upper-left whale wave its tail in a loop',
    whaleMotionUnavailable: 'Could not display the whale animation. Turn it off and on to retry.',
  },
  zh: {
    whaleMotionEnabled: '鲸鱼动效',
    whaleMotionDescription: '让左上角的小鲸鱼轻轻循环摆尾',
    whaleMotionUnavailable: '鲸鱼动效未能显示，请关闭后重新开启。',
  },
} satisfies Locales;
