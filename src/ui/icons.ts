import type { ArrowHead, Card, HAlign, VAlign } from '../core/types';

/** Sabit simgeler: SVG iç işaretlemesi (yalnızca bu dosyadaki sabitler; kullanıcı verisi asla buraya girmez). */
export const ICON = {
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 9"/>',
  box: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  group: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  arrow: '<path d="M5 19L19 5M19 5H9M19 5v10"/>',
  zoomIn: '<path d="M12 5v14M5 12h14"/>',
  zoomOut: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  todo: '<rect x="3.5" y="4.5" width="5" height="5" rx="1"/><path d="M4.8 7l1.2 1.2L8 6"/><rect x="3.5" y="14.5" width="5" height="5" rx="1"/><path d="M12 7h8.5M12 17h8.5"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.8h18M9.5 4v16M15 4v16"/>',
} as const;
export type IconName = keyof typeof ICON;

export const svgHtml = (inner: string) => `<svg viewBox="0 0 24 24">${inner}</svg>`;
export const BOX_ICON_HTML = svgHtml(ICON.box);

export const ALIGNS: Record<HAlign, string> = { left: 'Sola', center: 'Ortala', right: 'Sağa' };
export const ALIGN_PATHS: Record<HAlign, string> = { left: 'M4 6h16M4 12h10M4 18h13', center: 'M4 6h16M7 12h10M5.5 18h13', right: 'M4 6h16M10 12h10M7 18h13' };
export const VALIGNS: Record<VAlign, string> = { top: 'Yukarı', middle: 'Orta', bottom: 'Aşağı' };
export const VALIGN_PATHS: Record<VAlign, string> = { top: 'M4 4h16M8 8v11M16 8v7', middle: 'M4 12h16M8 6v12M16 8v8', bottom: 'M4 20h16M8 5v11M16 9v7' };
export const HEADS: Record<ArrowHead, string> = { end: 'Sağ uçta', start: 'Sol uçta', both: 'İki uçta', none: 'Yok' };

export const headPaths = (h: ArrowHead) => ['M4 12h16', ...(h === 'end' || h === 'both' ? ['M15 7l5 5-5 5'] : []), ...(h === 'start' || h === 'both' ? ['M9 7l-5 5 5 5'] : [])];

/** Sekmedeki daire: yatay ve dikey hizayı birlikte gösteren üç satırlık küçük metin simgesi. */
export const alignDotPath = (c: Card) => {
  const a = c.align || 'left', base = { top: 4, middle: 7, bottom: 10 }[c.valign || 'top'];
  const line = (i: number, len: number) => `M${a === 'left' ? 4 : a === 'right' ? 20 - len : 12 - len / 2} ${base + i * 5}h${len}`;
  return line(0, 16) + line(1, 10) + line(2, 13);
};
