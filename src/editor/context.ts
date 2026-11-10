import { CFG } from '../core/config';
import { Emitter } from '../core/emitter';
import type { CardContext } from '../cards/registry';
import { newPage } from '../model/migrate';
import { IndexedDbAdapter, LocalStorageAdapter } from '../model/persistence';
import { Selection } from '../model/selection';
import { Store } from '../model/store';

/**
 * Editörün paylaşılan durumu (kompozisyon kökü). Tuval motoru ve React arayüzü aynı örnekleri kullanır;
 * çekirdek, arayüzü yalnızca `events` üzerinden haberdar eder.
 */
export const storage = new IndexedDbAdapter('blue-rose', new LocalStorageAdapter(CFG.STORAGE_KEY));
export const store = new Store(storage);
export const selection = new Selection();

export interface AskOptions { input?: string; ok?: string }
export interface AskRequest { msg: string; opts: AskOptions; resolve: (v: string | boolean | null) => void }

export type EditorEvents = {
  /** Seçim değişti. */
  selection: void;
  /** Geçerli sayfa değişti ya da yeniden çizildi. */
  page: void;
  /** Proje verisi değişti (her commit). */
  doc: void;
  /** Kamera (kaydırma / yakınlık) değişti. */
  view: void;
  /** Durum çubuğu mesajı. */
  status: string;
  /** Onay / giriş penceresi isteği. */
  ask: AskRequest;
  /** Arayüzden bir özellik penceresini açmasını ister (örn. oka çift tıklayınca etiket). */
  openProp: string;
};
export const events = new Emitter<EditorEvents>();

/** Kart türü hook'larına verilen bağlam. */
export const cardContext: CardContext = {
  get state() { return store.state; },
  get page() { return store.page; },
  pageById: id => store.pageById(id),
  newSubpage() { const sub = newPage(); sub.parent = store.page.id; store.state.pages.push(sub); return sub; },
};

addEventListener('beforeunload', () => store.flush());
addEventListener('pagehide', () => store.flush());
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flush(); });   // sekme kapanmadan önce, yazmaya vakit kalırken
