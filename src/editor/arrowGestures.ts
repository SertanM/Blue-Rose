import { arrowEnds } from '../core/geometry';
import type { Arrow } from '../core/types';
import { trackPointer } from '../core/utils';
import { arrows } from './arrowLayer';
import { store } from './context';
import { dom } from './dom';
import { viewport } from './viewport';

/** Ok üzerindeki sürükleme hareketleri. */
export const arrowGesture = {
  /** Ok ucu: sürükleyince bağı koparır, karta bırakınca bağlar. */
  end(ev: PointerEvent, ar: Arrow, end: 'a' | 'b') {
    const r = viewport.rect(), v = viewport.v, kx = end === 'a' ? 'x1' : 'x2', ky = end === 'a' ? 'y1' : 'y2', other = end === 'a' ? 'b' : 'a';
    let target: HTMLElement | null = null;
    trackPointer(ev, {
      onStart: () => { const { p1, p2 } = arrowEnds(ar, store.cardMap()); [ar.x1, ar.y1] = p1; [ar.x2, ar.y2] = p2; dom.svgRoot.classList.add('dr'); arrows.activeId = ar.id; },
      onMove: (_dx, _dy, m) => {
        ar[end] = null; ar[kx] = (m.clientX - r.left - v.x) / v.z; ar[ky] = (m.clientY - r.top - v.y) / v.z;
        const hit = document.elementFromPoint(m.clientX, m.clientY)?.closest<HTMLElement>('.card') ?? null;
        const next = hit && hit.dataset.id !== ar[other] ? hit : null;
        if (next !== target) { target?.classList.remove('target'); target = next; target?.classList.add('target'); }
        arrows.update(ar);
      },
      onEnd: moved => {
        dom.svgRoot.classList.remove('dr'); arrows.activeId = null;
        if (target) { target.classList.remove('target'); ar[end] = target.dataset.id; }
        if (moved) { arrows.update(ar); store.commit(); }
      },
    });
  },
  /** Orta tutamaç: oku eğer (kontrol noktası, tutamaç imlecin altında kalacak şekilde çözülür). */
  bend(ev: PointerEvent, ar: Arrow) {
    const r = viewport.rect(), v = viewport.v;
    trackPointer(ev, {
      onStart: () => { dom.svgRoot.classList.add('dr'); arrows.activeId = ar.id; },
      onMove: (_dx, _dy, m) => {
        const wx = (m.clientX - r.left - v.x) / v.z, wy = (m.clientY - r.top - v.y) / v.z;
        const { a1, a2 } = arrowEnds(ar, store.cardMap()), mx = (a1[0] + a2[0]) / 2, my = (a1[1] + a2[1]) / 2;
        ar.bx ||= 0; ar.by ||= 0;
        for (let i = 0; i < 4; i++) { const { p1, p2 } = arrowEnds(ar, store.cardMap()); ar.bx = 2 * wx - (p1[0] + p2[0]) / 2 - mx; ar.by = 2 * wy - (p1[1] + p2[1]) / 2 - my; }
        arrows.update(ar);
      },
      onEnd: moved => {
        dom.svgRoot.classList.remove('dr'); arrows.activeId = null;
        if (!moved) return;
        if (Math.hypot(ar.bx ?? 0, ar.by ?? 0) < 8) { delete ar.bx; delete ar.by; }
        arrows.update(ar); store.commit();
      },
    });
  },
  /** Gövde: oku iki ucuyla birlikte taşır (bağlar kopar). */
  body(ev: PointerEvent, ar: Arrow) {
    const z = viewport.v.z, { p1, p2 } = arrowEnds(ar, store.cardMap());
    trackPointer(ev, {
      threshold: 3,
      onStart: () => { arrows.activeId = ar.id; ar.a = ar.b = null; },
      onMove: (dx, dy) => { ar.x1 = p1[0] + dx / z; ar.y1 = p1[1] + dy / z; ar.x2 = p2[0] + dx / z; ar.y2 = p2[1] + dy / z; arrows.update(ar); },
      onEnd: moved => { arrows.activeId = null; if (moved) { arrows.update(ar); store.commit(); } },
    });
  },
};
