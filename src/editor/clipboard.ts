import { isContainer } from '../cards/registry';
import { CFG } from '../core/config';
import { arrowEnds, nearestFree, SpatialIndex } from '../core/geometry';
import type { Arrow, Card, Page } from '../core/types';
import { clone, uid } from '../core/utils';
import { newPage } from '../model/migrate';
import { arrows } from './arrowLayer';
import { cards } from './cardLayer';
import { selection, store } from './context';
import { expandWithFollowers } from './commands';
import { flash } from './services';
import { viewport } from './viewport';

interface Clip { cards: Card[]; arrows: Arrow[]; pages: Page[] }
let clipboard: Clip | null = null;
let lastPointer: [number, number] | null = null;
addEventListener('pointermove', e => { lastPointer = [e.clientX, e.clientY]; }, true);

export const hasClipboard = () => !!clipboard;

export function copySelection() {
  const picked = expandWithFollowers(store.page.cards.filter(c => selection.has(c.id))), ids = new Set(picked.map(c => c.id)), m = store.cardMap();
  const arrowList = store.page.arrows
    .filter(a => selection.has(a.id) || (a.a && a.b && ids.has(a.a) && ids.has(a.b)))   // iki ucu da seçili kartlardaysa ok da gelir
    .map(a => {
      const q = clone(a), { p1, p2 } = arrowEnds(a, m);
      q.x1 = p1[0]; q.y1 = p1[1]; q.x2 = p2[0]; q.y2 = p2[1];
      if (q.a && !ids.has(q.a)) q.a = null;
      if (q.b && !ids.has(q.b)) q.b = null;
      return q;
    });
  if (!picked.length && !arrowList.length) return false;
  const pages: Page[] = [], seen = new Set<string>();
  const addTree = (id: string | undefined) => {
    if (!id || seen.has(id)) return; const pg = store.pageById(id); if (!pg) return;
    seen.add(id); pages.push(clone(pg)); store.state.pages.filter(p => p.parent === id).forEach(p => addTree(p.id));
  };
  picked.forEach(c => { if (isContainer(c)) addTree(c.page); });
  clipboard = { cards: clone(picked), arrows: arrowList, pages };
  flash(`${picked.length + arrowList.length} öğe kopyalandı`);
  return true;
}

/** Yapıştırılan alt sayfaları yeni kimliklerle çoğaltır. */
function cloneSubpages(clip: Clip, pageMap: Map<string, string>) {
  clip.pages.forEach(pg => pageMap.set(pg.id, uid()));
  clip.pages.forEach(pg => {
    const q = clone(pg), cardMap = new Map<string, string>();
    q.id = pageMap.get(pg.id)!; q.parent = (pg.parent && pageMap.get(pg.parent)) || store.page.id; delete q.base;
    q.cards.forEach(c => { const n = uid(); cardMap.set(c.id, n); c.id = n; if (isContainer(c) && c.page) c.page = pageMap.get(c.page) || c.page; });
    q.arrows.forEach(a => { a.id = uid(); a.a = a.a ? cardMap.get(a.a) || null : null; a.b = a.b ? cardMap.get(a.b) || null : null; });
    store.state.pages.push(q);
  });
}

export interface VisibleArea { x1: number; y1: number; x2: number; y2: number }
/** Grubu `visible` alanı içinde kalacak ve diğer kartlara çarpmayacak en yakın kaymayı bulur. */
export function groupOffset(group: Card[], groupIds: Set<string>, visible?: VisibleArea) {
  const index = new SpatialIndex(store.page.cards.filter(o => !groupIds.has(o.id)));
  const blocked = (dx: number, dy: number) => group.some(c => index.collides({ x: c.x + dx, y: c.y + dy, w: c.w, h: c.h, type: c.type, hh: c.hh }));
  const inView = (dx: number, dy: number) => group.every(c => c.x + dx >= visible!.x1 && c.y + dy >= visible!.y1 && c.x + c.w + dx <= visible!.x2 && c.y + c.h + dy <= visible!.y2);
  return nearestFree(blocked, visible ? [inView, () => true] : [() => true], 80);
}

export function pasteClipboard() {
  if (!clipboard) { flash('Kopyalanmış öğe yok'); return; }
  const clip = clipboard, pts: [number, number][] = [];
  clip.cards.forEach(c => pts.push([c.x, c.y], [c.x + c.w, c.y + c.h]));
  clip.arrows.forEach(a => pts.push([a.x1, a.y1], [a.x2, a.y2]));
  const mid = (i: 0 | 1) => (Math.min(...pts.map(q => q[i])) + Math.max(...pts.map(q => q[i]))) / 2;
  const rc = viewport.rect(), v = viewport.v;
  const inside = lastPointer && lastPointer[0] >= rc.left && lastPointer[0] <= rc.right && lastPointer[1] >= rc.top && lastPointer[1] <= rc.bottom;
  const mx = inside ? lastPointer![0] - rc.left : rc.width / 2, my = inside ? lastPointer![1] - rc.top : rc.height / 2;   // grubun ortası farenin altına gelir
  const ox = Math.round(((mx - v.x) / v.z - mid(0)) / CFG.GRID) * CFG.GRID, oy = Math.round(((my - v.y) / v.z - mid(1)) / CFG.GRID) * CFG.GRID;

  const pageMap = new Map<string, string>(), idMap = new Map<string, string>();
  cloneSubpages(clip, pageMap);
  const newCards = clip.cards.map(src => {
    const c = clone(src); c.id = uid(); idMap.set(src.id, c.id); c.x += ox; c.y += oy;
    if (isContainer(c)) {
      if (src.page && pageMap.has(src.page)) c.page = pageMap.get(src.page);
      else { const sub = newPage(); sub.parent = store.page.id; store.state.pages.push(sub); c.page = sub.id; }
    }
    return c;
  });
  const newArrows = clip.arrows.map(src => {
    const a = clone(src); a.id = uid(); a.a = src.a ? idMap.get(src.a) || null : null; a.b = src.b ? idMap.get(src.b) || null : null;
    a.x1 += ox; a.y1 += oy; a.x2 += ox; a.y2 += oy; return a;
  });
  const ids = new Set(newCards.map(c => c.id));
  store.page.cards.push(...newCards); store.page.arrows.push(...newArrows);
  const visible = { x1: -v.x / v.z + 8, y1: -v.y / v.z + 8, x2: (rc.width - v.x) / v.z - 8, y2: (rc.height - v.y) / v.z - 8 };
  const [dx, dy] = groupOffset(newCards, ids, visible);
  if (dx || dy) {
    newCards.forEach(c => { c.x += dx; c.y += dy; });
    newArrows.forEach(a => { if (!a.a) { a.x1 += dx; a.y1 += dy; } if (!a.b) { a.x2 += dx; a.y2 += dy; } });
  }
  if (newCards.length) {   // yapıştırılan grup ekranın dışında kaldıysa görünür olacak kadar kaydır
    const m = 16, W = rc.width, H = rc.height;
    const l = Math.min(...newCards.map(c => c.x)) * v.z + v.x, t = Math.min(...newCards.map(c => c.y)) * v.z + v.y;
    const r = Math.max(...newCards.map(c => c.x + c.w)) * v.z + v.x, b = Math.max(...newCards.map(c => c.y + c.h)) * v.z + v.y;
    if (l < m) v.x += m - l; else if (r > W - m) v.x -= Math.min(r - (W - m), l - m);
    if (t < m) v.y += m - t; else if (b > H - m) v.y -= Math.min(b - (H - m), t - m);
    viewport.apply();
  }
  newCards.forEach(c => cards.mount(c)); arrows.sync();
  selection.set([...newCards.map(c => c.id), ...newArrows.map(a => a.id)]);
  store.commit();
}
