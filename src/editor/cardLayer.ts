import { fontSizeOf, isGroup, typeOf, type BodyContext } from '../cards/registry';
import { CFG } from '../core/config';
import { Geo } from '../core/geometry';
import type { Card } from '../core/types';
import { $ } from '../core/utils';
import { cardContext, selection, store } from './context';
import { dom } from './dom';

/** Kartların DOM karşılıkları: kurma, yerleştirme, stil. Kart türüne özgü içerik kayıt defterindeki hook'lardan gelir. */
export class CardLayer {
  private els = new Map<string, HTMLElement>();
  private zTop = 10000;
  /** Etkileşimli kart gövdelerine verilen bağlam: kart bağlamı + kaydet / yeniden kur / büyüt. */
  private bodyCtx: BodyContext = Object.assign(Object.create(cardContext) as BodyContext, {
    commit: () => store.commit(),
    rerender: (c: Card, focus?: string) => this.rerender(c, focus),
    grow: (c: Card) => this.grow(c),
  });

  el(id: string) { return this.els.get(id); }
  /** Gruplar hep kartların altında kalır; büyük grup daha altta durur, böylece iç içe gruplar doğru sıralanır. */
  zFor(c: Card) { return isGroup(c) ? Math.max(1, 5000 - Math.round(c.w * c.h / 1000)) : ++this.zTop; }
  mount(c: Card) { const e = this.build(c); this.els.set(c.id, e); dom.world.insertBefore(e, dom.svgRoot); this.refit(c); return e; }
  unmount(id: string) { this.els.get(id)?.remove(); this.els.delete(id); }
  remount(c: Card) { const old = this.els.get(c.id), e = this.build(c); if (old) old.replaceWith(e); else dom.world.insertBefore(e, dom.svgRoot); this.els.set(c.id, e); this.refit(c); }
  /** Kartı verisinden yeniden kurar ve istenirse içindeki bir öğeye odaklanır. */
  rerender(c: Card, focus?: string) {
    this.remount(c);
    if (focus) this.els.get(c.id)?.querySelector<HTMLElement>(focus)?.focus();
    this.grow(c);
  }
  /** İçerik gövdeye sığmıyorsa kartı ızgara adımlarıyla aşağı uzatır; altında başka kart varsa uzatmaz (gövde kaydırılır). */
  grow(c: Card) {
    const body = this.els.get(c.id)?.querySelector<HTMLElement>('.body'); if (!body) return;
    const extra = body.scrollHeight - body.clientHeight; if (extra <= 1) return;
    const h = Math.ceil((c.h + extra) / CFG.GRID) * CFG.GRID, next = { ...c, h };
    if (store.page.cards.some(o => o !== c && Geo.collide(next, o))) return;
    c.h = h; this.place(c); store.commit();
  }
  rebuild(cards: Card[]) { this.els.forEach(e => e.remove()); this.els.clear(); cards.forEach(c => this.mount(c)); }
  raise(id: string) { const e = this.els.get(id), c = store.card(id); if (e && c) e.style.zIndex = String(this.zFor(c)); }
  place(c: Card) { const e = this.els.get(c.id); if (e) { this.setBox(e, c); this.refit(c); } }
  private setBox(e: HTMLElement, c: Card) {
    const s = e.style; s.left = c.x + 'px'; s.top = c.y + 'px'; s.width = c.w + 'px'; s.height = c.h + 'px';
    if (isGroup(c)) { s.setProperty('--hh', (c.hh ?? typeOf(c).head) + 'px'); s.zIndex = String(this.zFor(c)); }
  }
  setSelected(prev: Set<string>, next: Set<string>) {
    prev.forEach(id => { if (!next.has(id)) this.els.get(id)?.classList.remove('sel'); });
    next.forEach(id => { if (!prev.has(id)) this.els.get(id)?.classList.add('sel'); });
  }
  /** Özellik değişince (renk, hiza, boyut…) yalnızca ilgili stilleri günceller. */
  restyle(c: Card) {
    const e = this.els.get(c.id); if (!e) return;
    e.style.setProperty('--c', c.color); this.tint(e, c);
    const t = $<HTMLTextAreaElement>('textarea', e); if (t) this.styleText(t, c);
  }
  private tint(e: HTMLElement, c: Card) { if (c.bg) e.style.setProperty('--gbg', c.bg); else e.style.removeProperty('--gbg'); }   // grubun içerik alanı rengi
  private styleText(t: HTMLTextAreaElement, c: Card) {
    const s = t.style, va = c.valign || 'top', column = !!typeOf(c).column;   // içerik alt alta diziliyorsa ana eksen dikeydir
    s.textAlign = c.align || 'left'; s.color = c.tc || ''; s.fontSize = fontSizeOf(c) + 'px';   // panelin gösterdiği değerle çizilen boyut hep aynı
    s.flex = va === 'top' ? '' : '0 0 auto';
    s.alignSelf = !column && va !== 'top' ? (va === 'middle' ? 'center' : 'flex-end') : '';
    s.marginTop = column && va !== 'top' ? 'auto' : ''; s.marginBottom = column && va === 'middle' ? 'auto' : '';
    if (va === 'top') { s.height = ''; s.overflowY = ''; } else this.fit(t);
  }
  /** Üstte olmayan hizada yazı alanı, içeriği kadar yüksek olur (alanı aşarsa içeride kayar). Dikey hizayı bu boy sağlar. */
  fit(t: HTMLTextAreaElement) {
    const body = t.parentElement; if (!body || !t.isConnected) return;
    t.style.height = '0px';
    const icon = $('.bico', body), room = Math.max(0, body.clientHeight - (icon ? icon.offsetHeight : 0)), need = t.scrollHeight;
    t.style.height = Math.min(need, room) + 'px'; t.style.overflowY = need > room ? 'auto' : 'hidden';
  }
  refit(c: Card) { const e = this.els.get(c.id), t = e && $<HTMLTextAreaElement>('textarea', e); if (t && (c.valign || 'top') !== 'top') this.fit(t); }

  build(c: Card) {
    const T = typeOf(c), e = document.createElement('div');
    e.className = `card ${c.type}${selection.has(c.id) ? ' sel' : ''}`; e.dataset.id = c.id;
    e.style.setProperty('--c', c.color); e.style.zIndex = String(this.zFor(c)); if (T.group) this.tint(e, c);
    const groupParts = T.group ? '<div class="gbody"></div><div class="gdiv" data-tip="Başlık yüksekliği|Sürükleyerek başlığın boyunu değiştir; içerik alanı aynı boyda kalır."></div>' : '';
    e.innerHTML = `<div class="bar"><span></span><button data-a="del" data-tip="Sil|Kartı siler. Bağlı oklar serbest kalır.">✕</button></div><div class="body${T.group ? ' ghead' : ''}"></div>${groupParts}<div class="rs" data-tip="Boyutlandır|Köşeden sürükleyerek kartı büyüt ya da küçült."></div>`;
    $('.bar span', e)!.textContent = T.label;
    this.setBox(e, c);
    const body = $('.body', e)!;
    if (!T.text) { T.renderBody?.(body, c, this.bodyCtx); return e; }
    const t = document.createElement('textarea');
    t.value = c.text || ''; t.placeholder = T.hint ?? ''; this.styleText(t, c);
    T.decorate?.(e, body, c, cardContext);
    body.appendChild(t);
    return e;
  }
}
export const cards = new CardLayer();
