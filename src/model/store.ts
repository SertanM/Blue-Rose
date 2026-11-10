import { CFG } from '../core/config';
import type { Arrow, Card, Page, PaletteKey, ProjectState } from '../core/types';
import { blankProject, migrate } from './migrate';
import type { StorageAdapter } from './persistence';

/** Proje verisi ve kaydı. Görünüm katmanlarını tanımaz; değişiklikleri `onChange` ile bildirir. */
export class Store {
  state: ProjectState;
  onSaveError: (() => void) | null = null;
  onChange: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private warned = false;
  private cm: { src: Card[]; n: number; map: Map<string, Card> } | null = null;

  /** Boş bir projeyle başlar; kayıtlı proje `init()` ile yüklenir. */
  constructor(private storage: StorageAdapter) {
    this.state = migrate(blankProject());
  }
  /** Kayıtlı projeyi yükler. Arayüz çizilmeden önce bir kez beklenir. */
  async init() {
    const d = await this.storage.load();
    if (d) this.state = migrate(d);
  }
  get page(): Page { return this.state.pages[this.state.cur]; }
  get base(): Page { return this.state.pages[0]; }
  palette<K extends PaletteKey>(key: K): ProjectState['pal'][K] { return this.state.pal[key]; }
  pageById(id: string | undefined) { return this.state.pages.find(p => p.id === id); }
  /** Sayfanın atalarını kökten başlayarak verir (yol çubuğu için). */
  chain(page: Page = this.page) { const out: Page[] = []; for (let p: Page | undefined = page; p; p = p.parent ? this.pageById(p.parent) : undefined) out.unshift(p); return out; }
  /** Kart kimliği → kart; kart listesi değişmedikçe önbellekten döner. */
  cardMap() {
    const cs = this.page.cards;
    if (!this.cm || this.cm.src !== cs || this.cm.n !== cs.length) this.cm = { src: cs, n: cs.length, map: new Map(cs.map(c => [c.id, c])) };
    return this.cm.map;
  }
  card(id: string): Card | undefined { return this.cardMap().get(id); }
  arrow(id: string): Arrow | undefined { return this.page.arrows.find(a => a.id === id); }
  arrowsOf(cardIds: Set<string>) { return this.page.arrows.filter(a => (a.a && cardIds.has(a.a)) || (a.b && cardIds.has(a.b))); }
  /** Bir sayfa ve altındaki tüm sayfaların kimlikleri. */
  subtreeIds(rootId: string) {
    const ids = new Set([rootId]);
    for (let grew = true; grew;) { grew = false; for (const p of this.state.pages) if (!ids.has(p.id) && p.parent && ids.has(p.parent)) { ids.add(p.id); grew = true; } }
    return ids;
  }
  removeSubtree(rootId: string) {
    const ids = this.subtreeIds(rootId), curId = this.page.id;
    this.state.pages = this.state.pages.filter(p => !ids.has(p.id));
    this.state.cur = this.state.pages.findIndex(p => p.id === curId);
  }
  /** Yazma isteği: gecikmeli ve birleştirilmiş (her olayda tüm projeyi kopyalamayız). */
  commit() { this.onChange?.(); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), CFG.SAVE_DELAY); }
  /** Bekleyen kaydı hemen yazar. Durumun kopyası bu çağrı anında alınır; yazma arka planda biter. */
  flush() {
    clearTimeout(this.timer);
    void this.storage.save(this.state).then(ok => { if (!ok && !this.warned) { this.warned = true; this.onSaveError?.(); } });
  }
}
