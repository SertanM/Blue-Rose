import { CFG } from '../core/config';
import type { Card, Page } from '../core/types';
import { tween } from '../core/utils';
import { newPage } from '../model/migrate';
import { renderPage } from './commands';
import { selection, store } from './context';
import { dom } from './dom';
import { lerpC, viewport } from './viewport';

/** Bölümlere giriş / çıkış ve yol çubuğundan geçiş (animasyonlu). */
export const nav = {
  locked: false, until: 0,
  begin() { this.locked = true; dom.canvas.classList.add('busy'); },
  end() { dom.world.style.opacity = ''; dom.canvas.classList.remove('busy'); this.locked = false; this.until = performance.now() + 350; store.commit(); },
  get ready() { return !this.locked && performance.now() >= this.until; },
  /** Yol çubuğunda görünen ad: bölümün kartındaki yazı. */
  pageName(pg: Page) {
    if (pg === store.base) return 'Base';
    const box = store.pageById(pg.parent)?.cards.find(c => c.page === pg.id);
    return box?.text?.trim() || 'Bölüm';
  },
  switchTo(pg: Page) { store.state.cur = store.state.pages.indexOf(pg); selection.ids = new Set(); renderPage(); },

  /** İçeri: eski sayfa kısa süre sönerken yeni bölüm UZAKTAN yakına gelip "tümünü sığdır" görünümünde durur. */
  async enter(card: Card) {
    if (!this.ready) return; this.begin();
    const parent = store.page, v = parent.v, from = viewport.asCenter(v);
    const mid = { cx: from.cx + ((card.x + card.w / 2) - from.cx) * .5, cy: from.cy + ((card.y + card.h / 2) - from.cy) * .5, z: from.z * 1.3 };
    await tween(220, e => { viewport.fromCenter(lerpC(from, mid, e), v); viewport.apply(); dom.world.style.opacity = String(1 - e); }, t => t * t);
    viewport.fromCenter({ cx: card.x + card.w / 2, cy: card.y + card.h / 2, z: 1 }, v);
    let pg = store.pageById(card.page);
    if (!pg) { pg = newPage(); pg.parent = parent.id; store.state.pages.push(pg); card.page = pg.id; }
    this.switchTo(pg);
    const target = viewport.asCenter(viewport.fit(pg)), start = { ...target, z: target.z * .45 }, pv = pg.v;
    viewport.fromCenter(start, pv); viewport.apply(); dom.world.style.opacity = '0';
    await tween(600, (e, k) => { viewport.fromCenter(lerpC(start, target, e), pv); viewport.apply(); dom.world.style.opacity = String(Math.min(1, k * 1.8)); });
    viewport.fromCenter(target, pv); viewport.apply(); this.end();
  },
  /** Dışarı: çok uzaklaşınca sayfa söner, üst bölüm kutuya yakın bir görünümden açılır. */
  async exit() {
    const pg = store.page, parent = pg.parent ? store.pageById(pg.parent) : undefined;
    if (!this.ready || !parent) return; this.begin();
    const v = pg.v, from = viewport.asCenter(v);
    await tween(320, e => { viewport.fromCenter(lerpC(from, { ...from, z: from.z * .5 }, e), v); viewport.apply(); dom.world.style.opacity = String(1 - e); }, t => t * t);
    viewport.fromCenter({ cx: from.cx, cy: from.cy, z: 1 }, v);
    const box = parent.cards.find(c => c.page === pg.id), r = viewport.rect();
    const at = box ? { cx: box.x + box.w / 2, cy: box.y + box.h / 2 } : viewport.asCenter(parent.v);
    const target = { cx: at.cx, cy: at.cy, z: 1 }, start = { ...target, z: box ? Math.min(r.width * .9 / box.w, r.height * .9 / box.h) : 2.5 };
    this.switchTo(parent);
    viewport.fromCenter(start, parent.v); viewport.apply(); dom.world.style.opacity = '0';
    await tween(700, (e, k) => { viewport.fromCenter(lerpC(start, target, e), parent.v); viewport.apply(); dom.world.style.opacity = String(Math.min(1, k * 1.8)); });
    viewport.fromCenter(target, parent.v); viewport.apply(); this.end();
  },
  /** Yol çubuğundan geçiş: yeni sayfa yavaşça belirir ve yerine oturur. */
  async go(id: string) {
    const pg = store.pageById(id);
    if (!pg || pg === store.page || !this.ready) return;
    this.switchTo(pg); this.begin();
    const v = pg.v, t = viewport.asCenter(v), st = { ...t, z: t.z * 1.35 }; dom.world.style.opacity = '0';
    await tween(700, (e, k) => { viewport.fromCenter(lerpC(st, t, e), v); viewport.apply(); dom.world.style.opacity = String(Math.min(1, k * 1.6)); });
    viewport.fromCenter(t, v); viewport.apply(); this.end();
  },
};

export function zoomAt(factor: number, mx: number, my: number) {
  if (nav.locked) return;
  const v = viewport.v, z = Math.min(CFG.ZOOM.max, Math.max(CFG.ZOOM.min, v.z * factor));
  v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z;
  viewport.apply(); store.commit();
  if (factor < 1 && z < CFG.ZOOM.exitBelow && store.page !== store.base && nav.ready) nav.exit();
}
export const zoomBy = (factor: number) => { const r = viewport.rect(); zoomAt(factor, r.width / 2, r.height / 2); };
export function fitAll() { if (nav.locked) return; store.page.v = viewport.fit(store.page); viewport.apply(); store.commit(); }
