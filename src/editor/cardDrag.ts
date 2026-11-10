import { isGroup } from '../cards/registry';
import { CFG } from '../core/config';
import { arrowEnds, Geo, quadAt } from '../core/geometry';
import type { Arrow, Card, Rect } from '../core/types';
import { blurActive, trackPointer, tween } from '../core/utils';
import { arrows } from './arrowLayer';
import { cards } from './cardLayer';
import { groupOffset } from './clipboard';
import { selection, store } from './context';
import { dom } from './dom';
import { expandWithFollowers, followersOf, freeSpotFor, overlapsAny, snapTarget, type Followers } from './commands';
import { viewport } from './viewport';

const KEYS = ['x', 'y', 'w', 'h'] as const;

/** Kartı hedef dikdörtgene kaydırarak götürür. */
function glide(c: Card, target: Rect, linked: Arrow[], kids: Followers | null = null) {
  const from = { x: c.x, y: c.y, w: c.w, h: c.h };
  const paint = () => { cards.place(c); kids?.sync(); arrows.updateMany(linked); };
  if (KEYS.every(k => from[k] === target[k])) { kids?.sync(); store.commit(); return; }
  tween(220, e => { KEYS.forEach(k => { c[k] = from[k] + (target[k] - from[k]) * e; }); paint(); })
    .then(() => { KEYS.forEach(k => { c[k] = target[k]; }); paint(); store.commit(); });
}
/** Bırakınca ızgaraya oturt, çakışıyorsa en yakın boş yere kaydır (grubun çocukları grupla birlikte gelir). */
function settle(c: Card, linked: Arrow[], kids: Followers | null = null) { glide(c, freeSpotFor(c, snapTarget(c), kids?.set ?? null), linked, kids); }

export type DragMode = 'move' | 'resize' | 'divider';

/** mode: 'move' taşır, 'resize' sağ alt köşeden boyutlandırır (grupta içerik yüksekliği), 'divider' grubun başlık yüksekliğini değiştirir. */
export function dragCard(ev: PointerEvent, c: Card, { mode = 'move' as DragMode, onClick = null as (() => void) | null } = {}) {
  ev.stopPropagation(); ev.preventDefault();
  const e = cards.el(c.id)!, z = viewport.v.z, o = { x: c.x, y: c.y, w: c.w, h: c.h, hh: c.hh ?? 0 };
  const kids = isGroup(c) ? followersOf(c) : null, need = kids ? kids.needs() : { w: 0, body: 0 };
  const linked = store.arrowsOf(new Set([c.id, ...(kids?.ids ?? [])]));
  trackPointer(ev, {
    threshold: onClick ? CFG.DRAG_PX : 0,
    onStart: () => { if (mode === 'move') e.classList.add('lift'); },
    onMove: (dx, dy) => {
      if (mode === 'resize') {
        c.w = Math.max(CFG.MIN_W, need.w, o.w + dx / z);
        c.h = kids ? (c.hh ?? 0) + Math.max(CFG.GROUP_MIN_BODY, need.body, o.h - o.hh + dy / z) : Math.max(70, o.h + dy / z);
      } else if (mode === 'divider') {   // başlık büyür/küçülür, içerik alanı aynı boyda aşağı/yukarı kayar
        c.hh = Math.max(CFG.GROUP_MIN_HEAD, Geo.snap(o.hh + dy / z)); c.h = o.h + (c.hh - o.hh);
      } else { c.x = o.x + dx / z; c.y = o.y + dy / z; }
      cards.place(c); kids?.sync(); e.classList.toggle('ovl', overlapsAny(c, kids?.set)); arrows.updateMany(linked);
    },
    onEnd: moved => {
      e.classList.remove('ovl', 'lift');
      if (moved || mode !== 'move') settle(c, linked, kids); else onClick?.();
    },
  });
}

/** Çoklu seçimi (grupların çocuklarıyla) birlikte taşır. */
export function dragGroup(ev: PointerEvent, primary: Card | null) {
  ev.stopPropagation(); ev.preventDefault();
  const z = viewport.v.z, group = expandWithFollowers(store.page.cards.filter(x => selection.has(x.id))), ids = new Set(group.map(x => x.id));
  const sel = store.page.arrows.filter(a => selection.has(a.id));
  const origin = new Map(group.map(c => [c, [c.x, c.y]])), arrowOrigin = new Map(sel.map(a => [a, [a.x1, a.y1, a.x2, a.y2]]));
  const affected = [...new Set([...sel, ...store.arrowsOf(ids)])];
  const apply = (dx: number, dy: number, paint: boolean) => {
    origin.forEach(([x, y], c) => { c.x = x + dx; c.y = y + dy; if (paint) cards.place(c); });
    arrowOrigin.forEach(([x1, y1, x2, y2], a) => { if (!a.a) { a.x1 = x1 + dx; a.y1 = y1 + dy; } if (!a.b) { a.x2 = x2 + dx; a.y2 = y2 + dy; } });
    if (paint) arrows.updateMany(affected);
  };
  const lift = (on: boolean) => group.forEach(c => cards.el(c.id)?.classList.toggle('lift', on));
  trackPointer(ev, {
    threshold: CFG.DRAG_PX,
    onStart: () => lift(true),
    onMove: (dx, dy) => apply(dx / z, dy / z, true),
    onEnd: moved => {
      lift(false);
      if (!moved) { if (primary) selection.set([primary.id]); return; }
      const ref = primary || group[0], o = ref && origin.get(ref);
      const dx = o ? Geo.snap(ref.x) - o[0] : 0, dy = o ? Geo.snap(ref.y) - o[1] : 0;
      apply(dx, dy, false);
      const [fx, fy] = groupOffset(group, ids);
      apply(dx + fx, dy + fy, true); store.commit();
    },
  });
}

/** Kutu seçimi: sürüklenen dikdörtgenin değdiği kartlar ve oklar seçilir. */
export function marquee(ev: PointerEvent) {
  ev.preventDefault(); blurActive();
  const r = viewport.rect(), v = viewport.v, additive = ev.shiftKey || ev.ctrlKey || ev.metaKey, base = additive ? [...selection.ids] : [];
  const box = document.createElement('div'); box.className = 'mq'; dom.canvas.appendChild(box);
  const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
  trackPointer(ev, {
    onMove: (_dx, _dy, m) => {
      const x = m.clientX - r.left, y = m.clientY - r.top, l = Math.min(sx, x), t = Math.min(sy, y), w = Math.abs(x - sx), h = Math.abs(y - sy);
      Object.assign(box.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
      const X1 = (l - v.x) / v.z, Y1 = (t - v.y) / v.z, X2 = (l + w - v.x) / v.z, Y2 = (t + h - v.y) / v.z, ids = new Set(base), cm = store.cardMap();
      // Seçim kutusunu tamamen içine alan grup seçilmez: grubun içinde kutu çizince yalnızca içindekiler seçilir.
      const encloses = (c: Card) => isGroup(c) && c.x <= X1 && c.y <= Y1 && c.x + c.w >= X2 && c.y + c.h >= Y2;
      store.page.cards.forEach(c => { if (c.x <= X2 && c.x + c.w >= X1 && c.y <= Y2 && c.y + c.h >= Y1 && !encloses(c)) ids.add(c.id); });
      store.page.arrows.forEach(a => {
        const { p1, p2, C } = arrowEnds(a, cm);
        for (let i = 0; i <= 16; i++) {
          const [px, py] = quadAt(p1, p2, C, i / 16);
          if (px >= X1 && px <= X2 && py >= Y1 && py <= Y2) { ids.add(a.id); break; }
        }
      });
      cards.setSelected(selection.ids, ids); arrows.setSelected(selection.ids, ids); selection.ids = ids;   // canlı önizleme, bildirim yok
    },
    onEnd: () => { box.remove(); selection.set([...selection.ids]); },
  });
}
