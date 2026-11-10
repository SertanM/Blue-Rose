import { describe, expect, it } from 'vitest';
import { arrowEnds, arrowGeometry, Geo, nearestFree, SpatialIndex } from '../src/core/geometry';
import type { Card } from '../src/core/types';
import { blankProject, migrate, type LegacyProject } from '../src/model/migrate';
import { MemoryAdapter } from '../src/model/persistence';
import { Selection } from '../src/model/selection';
import { Store } from '../src/model/store';
import { Timeline } from '../src/model/timeline';

const card = (o: Partial<Card>): Card => ({ id: 'c', type: 'note', x: 0, y: 0, w: 120, h: 72, color: '#fff', ...o });

describe('Geo', () => {
  it('ızgaraya oturtur ve en küçük boyutu korur', () => {
    expect(Geo.snap(37)).toBe(48);
    expect(Geo.snapRect({ x: 13, y: 11, w: 10, h: 10 })).toEqual({ x: 24, y: 0, w: 120, h: 72 });
  });
  it('grubun içerik alanındaki kart grubun çocuğudur ve çakışma sayılmaz', () => {
    const g = card({ id: 'g', type: 'group', w: 360, h: 336, hh: 72 }), inside = card({ x: 24, y: 96 }), onHead = card({ x: 24, y: 24 });
    expect(Geo.contains(g, inside)).toBe(true);
    expect(Geo.collide(g, inside)).toBe(false);
    expect(Geo.contains(g, onHead)).toBe(false);
    expect(Geo.collide(g, onHead)).toBe(true);
  });
  it('not türü grup değildir', () => {
    expect(Geo.contains(card({ w: 500, h: 500 }), card({ x: 10, y: 10 }))).toBe(false);
  });
  it('kenar noktası hedefe bakar', () => {
    expect(Geo.edge({ x: 0, y: 0, w: 100, h: 50 }, 200, 25)).toEqual([100, 25]);
  });
});

describe('yerleşim', () => {
  it('boş yerde kalır, doluysa en yakın boş ızgara noktasına kayar', () => {
    const index = new SpatialIndex([card({ x: 0, y: 0, w: 120, h: 72 })]);
    const target = { x: 0, y: 0, w: 120, h: 72 };
    expect(nearestFree((dx, dy) => index.collides({ ...target, x: dx + 500, y: dy }))).toEqual([0, 0]);
    const [dx, dy] = nearestFree((dx, dy) => index.collides({ ...target, x: dx, y: dy }));
    expect(index.collides({ ...target, x: dx, y: dy })).toBe(false);
    expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);
  });
});

describe('oklar', () => {
  it('bağlı uçlar kart kenarına oturur', () => {
    const m = new Map([['a', card({ id: 'a', x: 0, y: 0, w: 100, h: 100 })], ['b', card({ id: 'b', x: 300, y: 0, w: 100, h: 100 })]]);
    const e = arrowEnds({ id: 'r', a: 'a', b: 'b', x1: 0, y1: 0, x2: 0, y2: 0 }, m);
    expect(e.p1).toEqual([100, 50]);
    expect(e.p2).toEqual([300, 50]);
  });
  it('sola giden okta etiket yolu ters çevrilir', () => {
    const s = arrowGeometry([100, 0], [0, 0], null, 2, 'none');
    expect(s.labelPath.startsWith('M0 0')).toBe(true);
    expect(s.startHead).toBeNull();
  });
});

describe('migrate', () => {
  it('eski "links" alanını oklara çevirir ve eksik paletleri ekler', () => {
    const old = { name: 'x', cur: 0, pages: [{ id: 'p', name: 'Genel', cards: [], links: [{ a: 'a', b: 'b' }] }] } as unknown as LegacyProject;
    const d = migrate(old);
    expect(d.pages[0].arrows).toHaveLength(1);
    expect(d.pal.ac.length).toBeGreaterThan(0);
    expect(d.pages[0].base).toBe(true);
  });
  it('üst sayfası olmayan sayfalar için Base sayfasına bölüm kartı açar', () => {
    const d = blankProject();
    d.pages.push({ id: 'p2', name: 'Savaş', cards: [], arrows: [], v: { x: 0, y: 0, z: 1 } });
    const m = migrate(d);
    expect(m.pages[1].parent).toBe(m.pages[0].id);
    expect(m.pages[0].cards.find(c => c.page === 'p2')?.text).toBe('Savaş');
  });
});

describe('Store ve Timeline', () => {
  it('kaydeder ve geri / ileri alır (görünüm adım sayılmaz)', () => {
    const mem = new MemoryAdapter(), store = new Store(mem);
    let restored = 0;
    const tl = new Timeline(store, () => { restored++; });
    store.page.cards.push(card({ id: 'n1' }));
    tl.markDirty(); tl.flush();
    store.page.v.z = 3; tl.markDirty(); tl.flush();   // yalnızca kamera
    expect(tl.undo()).toBe(true);
    expect(store.page.cards).toHaveLength(0);
    expect(store.page.v.z).toBe(3);   // kamera geri alınmaz
    expect(tl.undo()).toBe(false);
    expect(tl.redo()).toBe(true);
    expect(store.page.cards).toHaveLength(1);
    expect(restored).toBe(2);
    store.flush();
    expect(mem.data?.pages[0].cards).toHaveLength(1);
  });
  it('alt ağacı siler', () => {
    const store = new Store(new MemoryAdapter());
    const base = store.base;
    store.state.pages.push({ id: 'a', name: '', parent: base.id, cards: [], arrows: [], v: { x: 0, y: 0, z: 1 } });
    store.state.pages.push({ id: 'b', name: '', parent: 'a', cards: [], arrows: [], v: { x: 0, y: 0, z: 1 } });
    expect([...store.subtreeIds('a')].sort()).toEqual(['a', 'b']);
    store.removeSubtree('a');
    expect(store.state.pages).toHaveLength(1);
  });
});

describe('Selection', () => {
  it('dinleyicilere önceki ve yeni seçimi verir', () => {
    const s = new Selection(), seen: number[] = [];
    s.on((prev, next) => seen.push(prev.size * 10 + next.size));
    s.set(['a', 'b']); s.toggle('a'); s.clear();
    expect(seen).toEqual([2, 21, 10]);
    expect(s.single).toBeNull();
  });
});
