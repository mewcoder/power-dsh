import type { ClientRuntime } from './types.ts';
export function createCatalogUI({ h }: Pick<ClientRuntime, 'h'>) {
  function SkillSearchIcon() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
      h('circle', { cx: 8.5, cy: 8.5, r: 5.5 }), h('path', { d: 'm13 13 4 4' }));
  }
  function SkillChevron() {
    return h('svg', { className: 'power-dsh-skill-chevron', width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm4 6 4 4 4-4' }));
  }
  return { SkillSearchIcon, SkillChevron };
}
