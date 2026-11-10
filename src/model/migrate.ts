import { CFG, COLORS, defaultPalettes } from '../core/config';
import type { Page, ProjectState } from '../core/types';
import { uid } from '../core/utils';

export const newPage = (name = ''): Page => ({ id: uid(), name, cards: [], arrows: [], v: { ...CFG.HOME_VIEW } });
export const blankProject = (): ProjectState => ({ name: 'Yeni Oyun GDD', cur: 0, pages: [newPage('Genel')], pal: defaultPalettes() });

/** Eski kayıtlarda bulunabilen alanlar. */
type LegacyPage = Page & { links?: { id?: string; a: string; b: string }[] };
export type LegacyProject = Omit<ProjectState, 'pal' | 'pages'> & { pal?: Partial<ProjectState['pal']>; pages: LegacyPage[] };

/** Eski dosya biçimlerini güncel şemaya taşır; ilk sayfa "base" sayfadır. */
export function migrate(d: LegacyProject): ProjectState {
  d.pages.forEach(p => {
    p.cards ??= []; p.v ??= { ...CFG.HOME_VIEW };
    if (!p.arrows) { p.arrows = (p.links || []).map(l => ({ id: l.id || uid(), a: l.a, b: l.b, x1: 0, y1: 0, x2: 0, y2: 0 })); delete p.links; }
  });
  const def = defaultPalettes();
  d.pal ??= def; d.pal.ac ??= def.ac; d.pal.bg ??= def.bg;
  const base = d.pages[0]; base.base = true;
  d.pages.slice(1).forEach((p, i) => {
    if (p.parent) return;
    p.parent = base.id;
    const y = base.cards.length ? Math.max(...base.cards.map(c => c.y + c.h)) + 48 : 0;
    base.cards.push({ id: uid(), type: 'box', page: p.id, text: p.name || 'Sayfa', x: i * 216, y: Math.round(y / CFG.GRID) * CFG.GRID, w: 192, h: 120, color: COLORS[3], align: 'center' });
  });
  return d as ProjectState;
}
