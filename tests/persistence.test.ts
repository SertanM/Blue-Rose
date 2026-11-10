import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { blankProject } from '../src/model/migrate';
import { IndexedDbAdapter, LocalStorageAdapter, MemoryAdapter } from '../src/model/persistence';
import { Store } from '../src/model/store';

/** Node'da localStorage yok: testler için küçük bir bellek içi sürüm. */
class FakeLocalStorage {
  map = new Map<string, string>();
  quota = Infinity;
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { if (v.length > this.quota) throw new Error('QuotaExceededError'); this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}
let ls: FakeLocalStorage;
beforeEach(() => { ls = new FakeLocalStorage(); (globalThis as { localStorage?: unknown }).localStorage = ls; });

const project = (name: string) => { const p = blankProject(); p.name = name; return p; };
const adapter = (idb: IDBFactory | null = new IDBFactory()) => new IndexedDbAdapter('test', new LocalStorageAdapter('gdd-board'), idb ?? undefined);

describe('IndexedDbAdapter', () => {
  it('kaydeder ve geri yükler', async () => {
    const idb = new IDBFactory(), a = adapter(idb);
    expect(await a.load()).toBeNull();
    expect(await a.save(project('Kayıt'))).toBe(true);
    expect((await adapter(idb).load())?.name).toBe('Kayıt');   // yeni bir örnek (sayfa yenilendi gibi)
    expect(a.backend).toBe('indexeddb');
  });

  it('ilk açılışta localStorage kaydını aktarır ve eskisini yedeğe kaldırır', async () => {
    ls.setItem('gdd-board', JSON.stringify(project('Eski proje')));
    const idb = new IDBFactory();
    expect((await adapter(idb).load())?.name).toBe('Eski proje');
    expect(ls.getItem('gdd-board')).toBeNull();
    expect(JSON.parse(ls.getItem('gdd-board.backup')!).name).toBe('Eski proje');
    // İkinci açılışta IndexedDB'den gelir; yedek tekrar aktarılmaz.
    ls.setItem('gdd-board', JSON.stringify(project('Başka sekmeden kalan')));
    expect((await adapter(idb).load())?.name).toBe('Eski proje');
  });

  it('IndexedDB yoksa localStorage ile çalışır', async () => {
    const a = adapter(null);
    expect(await a.load()).toBeNull();
    expect(a.backend).toBe('localstorage');
    expect(await a.save(project('Yedek yol'))).toBe(true);
    expect(JSON.parse(ls.getItem('gdd-board')!).name).toBe('Yedek yol');
  });

  it('5 MB üstü projeyi kaydedebilir (localStorage sınırı yok)', async () => {
    ls.quota = 5_000_000;
    const big = project('Büyük'), img = 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000);
    for (let i = 0; i < 8; i++) big.pages[0].cards.push({ id: 'i' + i, type: 'image', x: i * 300, y: 0, w: 288, h: 200, color: '#fff', src: img + i });
    const idb = new IDBFactory();
    expect(await adapter(idb).save(big)).toBe(true);
    expect((await adapter(idb).load())?.pages[0].cards).toHaveLength(8);
    expect(await new LocalStorageAdapter('gdd-board').save(big)).toBe(false);   // karşılaştırma: eski yol bunu kaydedemezdi
  });

  it('kaydın kopyası çağrı anında alınır (sonraki değişiklik kayda karışmaz)', async () => {
    const idb = new IDBFactory(), a = adapter(idb);
    await a.load();
    const p = project('Önce');
    const done = a.save(p);
    p.name = 'Sonra';
    await done;
    expect((await adapter(idb).load())?.name).toBe('Önce');
  });
});

describe('Store.init', () => {
  it('kayıtlı projeyi yükler, yoksa boş projeyle kalır', async () => {
    const empty = new Store(new MemoryAdapter());
    await empty.init();
    expect(empty.state.name).toBe('Yeni Oyun GDD');
    const saved = new Store(new MemoryAdapter(project('Kayıtlı')));
    expect(saved.state.name).toBe('Yeni Oyun GDD');
    await saved.init();
    expect(saved.state.name).toBe('Kayıtlı');
    expect(saved.base.base).toBe(true);   // migrate uygulanmış
  });
});
