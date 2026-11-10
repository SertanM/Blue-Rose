import { CARD_TYPES, isContainer, isGroup } from '../cards/registry';
import { CFG } from '../core/config';
import { arrowEnds, Geo, nearestFree, SpatialIndex } from '../core/geometry';
import type { Arrow, Card, CardTypeId, Point, Rect } from '../core/types';
import { uid } from '../core/utils';
import { arrows } from './arrowLayer';
import { cards } from './cardLayer';
import { cardContext, events, selection, store } from './context';
import { ask } from './services';
import { viewport } from './viewport';

/** Geçerli sayfayı baştan çizer ve arayüze haber verir. */
export function renderPage() {
  selection.prune(id => !!(store.card(id) || store.arrow(id)));
  cards.rebuild(store.page.cards); arrows.sync(); viewport.apply();
  events.emit('page');
}

/** Bölüm kartının içinde bir şey var mı (silmeden önce onay sormak için). */
export const hasContent = (c: Card) => {
  const pg = isContainer(c) ? store.pageById(c.page) : undefined;
  return !!pg && !!(pg.cards.length || pg.arrows.length || store.state.pages.some(p => p.parent === pg.id));
};

/* ── gruplar ── */
export interface Followers {
  list: Card[]; set: Set<Card>; ids: Set<string>;
  sync(): void;
  needs(): { w: number; body: number };
}
/** Bir grubun içerik alanındaki kartlar (grupla birlikte taşınır); içlerinden biri de bir grup olabilir. */
export function followersOf(g: Card): Followers {
  const hh = g.hh ?? 0, list = store.page.cards.filter(o => o !== g && Geo.contains(g, o));
  const rel = new Map(list.map(k => [k, [k.x - g.x, k.y - (g.y + hh)]]));   // içerik alanının sol üst köşesine göre konum
  return {
    list, set: new Set(list), ids: new Set(list.map(k => k.id)),
    sync() { list.forEach(k => { const [dx, dy] = rel.get(k)!; k.x = g.x + dx; k.y = g.y + (g.hh ?? 0) + dy; cards.place(k); }); },
    /** Grup küçülürken çocukları dışarıda bırakmamak için gereken en küçük genişlik ve içerik yüksekliği (sağda/altta bir ızgara hücresi pay: tutamaçlar çakışmasın). */
    needs: () => list.length ? { w: Math.max(...list.map(k => k.x + k.w)) - g.x + CFG.GRID, body: Math.max(...list.map(k => k.y + k.h)) - (g.y + (g.hh ?? 0)) + CFG.GRID } : { w: 0, body: 0 },
  };
}
/** Listeye, içindeki grupların çocuklarını da ekler. */
export const expandWithFollowers = (list: Card[]) => { const out = new Set(list); list.forEach(c => { if (isGroup(c)) followersOf(c).list.forEach(k => out.add(k)); }); return [...out]; };

/* ── yerleşim ── */
/** Izgaraya oturmuş hedef dikdörtgen; grubun toplam boyu en az başlık + en küçük içerik kadardır. */
export function snapTarget(c: Card): Rect {
  const t = Geo.snapRect(c);
  if (isGroup(c)) t.h = Math.max(t.h, Geo.snap(c.hh ?? 0) + CFG.GROUP_MIN_BODY);
  return t;
}
/** Çarpışmayı çözerek bir kartı en yakın boş ızgara noktasına yerleştirir (kaymadan hedef konumu verir). `ignore`: yok sayılacak kartlar (grubun çocukları). */
export function freeSpotFor(c: Card, target: Rect, ignore: Set<Card> | null = null): Rect {
  const index = new SpatialIndex(store.page.cards.filter(o => o !== c && !ignore?.has(o)));
  const [dx, dy] = nearestFree((ox, oy) => index.collides({ x: target.x + ox, y: target.y + oy, w: target.w, h: target.h, type: c.type, hh: c.hh }));
  return { ...target, x: target.x + dx, y: target.y + dy };
}
export function placeFree(c: Card) { Object.assign(c, freeSpotFor(c, snapTarget(c))); }
export const overlapsAny = (c: Card, ignore: Set<Card> | null = null) => store.page.cards.some(o => o !== c && !ignore?.has(o) && Geo.collide(c, o));

/* ── ekleme ── */
export function addCard(type: CardTypeId, extra: Partial<Card> = {}, pos?: Point | null) {
  const T = CARD_TYPES[type], page = store.page;
  const c: Card = { id: uid(), type, x: 0, y: 0, w: T.size[0], h: T.size[1], text: '', color: T.color, ...extra };
  T.init?.(c, cardContext);
  const p = pos ?? viewport.centerWorld();
  c.x = p.x - c.w / 2; c.y = p.y - c.h / 2;
  placeFree(c); page.cards.push(c); cards.mount(c); store.commit();
  return c;
}

export function addArrow(pos: Point) {
  const at = (x: number, y: number) => store.page.cards.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)?.id ?? null;
  const ar: Arrow = { id: uid(), x1: pos.x - 80, y1: pos.y, x2: pos.x + 80, y2: pos.y };
  ar.a = at(ar.x1, ar.y1); ar.b = at(ar.x2, ar.y2); if (ar.a && ar.a === ar.b) ar.b = null;
  store.page.arrows.push(ar); arrows.update(ar); store.commit();
}

/* ── silme ── */
/** Silinen kartlara bağlı okları, son görünür konumlarında serbest bırakır. */
function detachArrows(cardIds: Set<string>, cardMap: Map<string, Card>) {
  store.arrowsOf(cardIds).forEach(ar => {
    const { p1, p2 } = arrowEnds(ar, cardMap);
    ar.x1 = p1[0]; ar.y1 = p1[1]; ar.x2 = p2[0]; ar.y2 = p2[1];
    if (ar.a && cardIds.has(ar.a)) ar.a = null;
    if (ar.b && cardIds.has(ar.b)) ar.b = null;
  });
}
export async function deleteItems(cardList: Card[], arrowList: Arrow[], { confirm = true } = {}) {
  if (!cardList.length && !arrowList.length) return;
  const full = cardList.filter(hasContent);
  if (confirm && full.length && !await ask(
    full.length === 1 ? `"${(full[0].text || 'Bölüm').trim()}" ve içindeki her şey silinecek.` : `${full.length} bölüm ve içindeki her şey silinecek.`, { ok: 'Sil' })) return;
  const cardIds = new Set(cardList.map(c => c.id)), arrowIds = new Set(arrowList.map(a => a.id));
  detachArrows(cardIds, store.cardMap());
  cardList.forEach(c => { if (isContainer(c) && c.page) store.removeSubtree(c.page); });
  const page = store.page;
  page.cards = page.cards.filter(c => !cardIds.has(c.id)); page.arrows = page.arrows.filter(a => !arrowIds.has(a.id));
  cardIds.forEach(id => cards.unmount(id));
  selection.prune(id => !cardIds.has(id) && !arrowIds.has(id));
  arrows.sync(); events.emit('selection'); store.commit();
}
export const deleteSelection = (confirm: boolean) => deleteItems(
  store.page.cards.filter(c => selection.has(c.id)), store.page.arrows.filter(a => selection.has(a.id)), { confirm });

/** Eski kayıtlarda alt sayfası olmayan bölüm kartına boş bir sayfa açar. */
export function ensureSubpage(c: Card) {
  if (!store.pageById(c.page)) c.page = cardContext.newSubpage().id;
}
