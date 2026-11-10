import { CFG } from '../core/config';
import type { Page, View } from '../core/types';
import { events, store } from './context';
import { dom } from './dom';

/** Görünümü "ekran ortasındaki dünya noktası + yakınlık" olarak ifade eder (animasyonlar için). */
export interface CenterView { cx: number; cy: number; z: number }

export const viewport = {
  get v(): View { return store.page.v; },
  rect: () => dom.canvas.getBoundingClientRect(),
  toWorld(cx: number, cy: number) { const r = this.rect(), v = this.v; return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; },
  centerWorld() { const r = this.rect(), v = this.v; return { x: (r.width / 2 - v.x) / v.z, y: (r.height / 2 - v.y) / v.z }; },
  apply() {
    const { x, y, z } = this.v, g = CFG.GRID;
    dom.world.style.transform = `translate(${x}px,${y}px) scale(${z})`;
    dom.canvas.style.backgroundPosition = `${x - g / 2 * z}px ${y - g / 2 * z}px`;
    dom.canvas.style.backgroundSize = `${g * z}px ${g * z}px`;
    events.emit('view');
  },
  asCenter(view?: View): CenterView { const r = this.rect(), v = view ?? this.v; return { cx: (r.width / 2 - v.x) / v.z, cy: (r.height / 2 - v.y) / v.z, z: v.z }; },
  fromCenter(q: CenterView, view?: View) { const r = this.rect(), v = view ?? this.v; v.z = q.z; v.x = r.width / 2 - q.cx * q.z; v.y = r.height / 2 - q.cy * q.z; },
  /** "Tümünü sığdır" görünümü. */
  fit(page: Page): View {
    const cs = page.cards, r = this.rect();
    if (!cs.length) return { ...CFG.HOME_VIEW };
    const x1 = Math.min(...cs.map(c => c.x)), y1 = Math.min(...cs.map(c => c.y));
    const x2 = Math.max(...cs.map(c => c.x + c.w)), y2 = Math.max(...cs.map(c => c.y + c.h));
    const z = Math.min(1.5, Math.max(.2, Math.min((r.width - 80) / (x2 - x1), (r.height - 80) / (y2 - y1))));
    return { z, x: (r.width - (x2 - x1) * z) / 2 - x1 * z, y: (r.height - (y2 - y1) * z) / 2 - y1 * z };
  },
};
export const lerpC = (a: CenterView, b: CenterView, k: number): CenterView => ({ cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, z: a.z * (b.z / a.z) ** k });
