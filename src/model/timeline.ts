import { CFG } from '../core/config';
import type { Page, ProjectState, View } from '../core/types';
import type { Store } from './store';

interface Snapshot { meta: string; pages: { id: string; str: string }[] }

/**
 * Geri al / ileri al: her adım, projenin sayfa başına serileştirilmiş hali. Görünüm (kaydırma/zoom) ve geçerli sayfa adıma dahil değildir,
 * böylece kamera hareketi adım sayılmaz. Büyük görseller küçük kimliklerle temsil edilir, bellek şişmez.
 */
export class Timeline {
  limit = 100;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private imgs: string[] = [];
  private imgIndex = new Map<string, number>();
  private views = new Map<string, View>();
  private stack: Snapshot[];
  private i = 0;

  /** `onRestore`: durum değiştirildikten sonra ekranı yeniden çizmek için çağrılır. */
  constructor(private store: Store, private onRestore: () => void) {
    this.stack = [this.snap()];
  }
  /** Geçmişi siler ve şu anki durumu ilk adım yapar (örn. kayıtlı proje yüklendikten sonra). */
  reset() {
    clearTimeout(this.timer);
    this.imgs = []; this.imgIndex.clear(); this.views.clear(); this.dirty = false;
    this.stack = [this.snap()]; this.i = 0;
  }
  get canUndo() { return this.i > 0; }
  get canRedo() { return this.i < this.stack.length - 1; }

  private replacer = (k: string, v: unknown) => {
    if (k !== 'src' || typeof v !== 'string' || !v.startsWith('data:')) return v;
    let n = this.imgIndex.get(v);
    if (n === undefined) { n = this.imgs.length; this.imgs.push(v); this.imgIndex.set(v, n); }
    return '@img' + n;
  };
  private reviver = (k: string, v: unknown) => (k === 'src' && typeof v === 'string' && v.startsWith('@img')) ? this.imgs[+v.slice(4)] : v;
  private snap(): Snapshot {
    const s = this.store.state;
    s.pages.forEach(p => this.views.set(p.id, { ...p.v }));
    return {
      meta: JSON.stringify({ name: s.name, pal: s.pal }, this.replacer),
      pages: s.pages.map(p => { const rest: Partial<Page> = { ...p }; delete rest.v; return { id: p.id, str: JSON.stringify(rest, this.replacer) }; }),
    };
  }
  private same(a: Snapshot, b: Snapshot) { return a.meta === b.meta && a.pages.length === b.pages.length && a.pages.every((p, i) => p.id === b.pages[i].id && p.str === b.pages[i].str); }

  /** Bir değişiklik oldu: kısa bir duraksamadan sonra (yazarken tek adım) adım olarak kaydedilir. */
  markDirty() { this.dirty = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 800); }
  /** Bekleyen değişikliği bir adım olarak kapatır (yeni bir eylem başlarken çağrılır). */
  flush() {
    clearTimeout(this.timer);
    if (!this.dirty) return;
    this.dirty = false;
    const snap = this.snap();
    if (this.same(snap, this.stack[this.i])) return;   // yalnızca kamera/geçici durum değişmişti
    this.stack.length = this.i + 1; this.stack.push(snap); this.i++;
    if (this.stack.length > this.limit) { this.stack.shift(); this.i--; }
  }
  /** Bir adım geri gider; gidilecek adım yoksa false. */
  undo() { this.flush(); if (!this.canUndo) return false; this.goto(this.i - 1); return true; }
  redo() { this.flush(); if (!this.canRedo) return false; this.goto(this.i + 1); return true; }

  private goto(j: number) {
    const from = this.stack[this.i], to = this.stack[j], curId = this.store.page.id;
    const liveViews = new Map(this.store.state.pages.map(p => [p.id, p.v]));
    const state: ProjectState = { ...JSON.parse(to.meta, this.reviver), cur: 0, pages: to.pages.map(p => JSON.parse(p.str, this.reviver)) };
    state.pages.forEach(p => { p.v = liveViews.get(p.id) ?? this.views.get(p.id) ?? { ...CFG.HOME_VIEW }; });
    // Değişiklik başka bir sayfadaysa oraya git; geçerli sayfa etkilendiyse (ya da yalnızca ayar değiştiyse) olduğun yerde kal.
    const before = new Map(from.pages.map(p => [p.id, p.str])), changed = to.pages.filter(p => before.get(p.id) !== p.str).map(p => p.id);
    let idx = state.pages.findIndex(p => p.id === curId);
    if (changed.length && !changed.includes(curId)) idx = state.pages.findIndex(p => p.id === changed[0]);
    state.cur = Math.max(0, idx);
    const onChange = this.store.onChange;
    this.store.onChange = null;
    this.store.state = state; this.onRestore(); this.store.flush();
    this.store.onChange = onChange;
    this.i = j; this.dirty = false; clearTimeout(this.timer);
  }
}
