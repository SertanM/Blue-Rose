import { useRef, useState } from 'react';
import { CFG } from '../core/config';
import { trackPointer } from '../core/utils';

/**
 * Düzenleme modunda hazır değerleri sürükleyerek sıralama.
 * Sürüklerken sıra React durumunda tutulur (DOM elle taşınmaz); bırakınca `commit(yeniSıra)` çağrılır.
 */
export function useReorder(length: number, commit: (order: number[]) => void) {
  const [order, setOrder] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState(-1);
  const justDragged = useRef(false);
  const live = useRef<number[]>([]);

  const start = (ev: React.PointerEvent<HTMLElement>, index: number, container: HTMLElement | null) => {
    if (ev.button || (ev.target as Element).closest('i') || !container) return;
    const item = ev.currentTarget;
    let ghost: HTMLElement | null = null, ox = 0, oy = 0;
    live.current = Array.from({ length }, (_, i) => i);
    trackPointer(ev, {
      threshold: CFG.DRAG_PX,
      onStart: () => {
        const r = item.getBoundingClientRect(); ox = r.width / 2; oy = r.height / 2;
        ghost = item.cloneNode(true) as HTMLElement; ghost.id = 'dragghost';
        ghost.style.cssText += `;position:fixed;left:0;top:0;width:${r.width}px;height:${r.height}px;margin:0;z-index:300;pointer-events:none;box-shadow:0 6px 16px rgba(0,0,0,.4)`;
        document.body.appendChild(ghost); setDragging(index); setOrder(live.current);
      },
      onMove: (_dx, _dy, m) => {
        ghost!.style.transform = `translate(${m.clientX - ox}px,${m.clientY - oy}px) scale(1.2)`;
        const els = [...container.querySelectorAll<HTMLElement>('[data-i]:not([data-i="-1"])')];
        const dist = (e: Element) => { const q = e.getBoundingClientRect(); return Math.hypot(m.clientX - (q.left + q.width / 2), m.clientY - (q.top + q.height / 2)); };
        const self = els.find(e => +e.dataset.i! === index)!;
        let best: HTMLElement | null = null, bd = dist(self);
        els.forEach(e => { if (e !== self) { const d = dist(e); if (d < bd) { bd = d; best = e; } } });
        if (!best) return;
        const cur = live.current, from = cur.indexOf(index), to = cur.indexOf(+(best as HTMLElement).dataset.i!);
        const next = cur.filter(i => i !== index);
        next.splice(to > from ? next.indexOf(cur[to]) + 1 : next.indexOf(cur[to]), 0, index);
        live.current = next; setOrder(next);
      },
      onEnd: moved => {
        if (!moved) return;
        ghost?.remove(); setDragging(-1); setOrder(null);
        justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0);
        commit(live.current);
      },
    });
  };
  return { order: order ?? Array.from({ length }, (_, i) => i), dragging, start, justDragged };
}
