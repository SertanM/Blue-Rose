import { ARROW_COLOR } from '../core/config';
import { arrowEnds, arrowGeometry } from '../core/geometry';
import type { Arrow, Card } from '../core/types';
import { selection, store } from './context';
import { dom } from './dom';

type Parts = Record<'ln' | 'hs' | 'he' | 'tp' | 'hit' | 'halo' | 'lab' | 'lt' | 'ht' | 'tl' | 'hda' | 'hdb' | 'bd' | 'del', SVGElement>;
type ArrowEl = SVGGElement & { _r: Parts };

/** Okların SVG karşılıkları: anahtarlı DOM, kısmi güncelleme. */
export class ArrowLayer {
  private els = new Map<string, ArrowEl>();
  activeId: string | null = null;

  private create(ar: Arrow) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g') as ArrowEl;
    g.setAttribute('class', 'arw'); g.dataset.id = ar.id;
    g.innerHTML = '<path class="ln"/><path class="hh"/><path class="hh"/><path class="tp"/>'
      + '<path class="hit" data-tip="Ok|Sürükleyerek taşı. Uçlarından bağla, ortasından eğ. Tıkla: özelliklerini aç."/>'
      + '<text class="alabh"><textPath startOffset="50%"></textPath></text><text class="alab" data-tip="Etiket|Çift tıkla: düzenle."><textPath startOffset="50%"></textPath></text><circle class="tl" r="4"/>'
      + '<circle class="hd" data-e="a" r="9"/><circle class="hd" data-e="b" r="9"/>'
      + '<circle class="bd" data-bend="1" data-tip="Okun ortası|Sürükleyerek oku eğ. Çift tıkla: düzleştir." r="7"/>'
      + '<g class="del" data-del="1" data-tip="Oku sil"><circle r="9"/><path d="M-3.5-3.5L3.5 3.5M3.5-3.5L-3.5 3.5"/></g>';
    const [ln, hs, he, tp, hit, halo, lab, tl, hda, hdb, bd, del] = [...g.children] as SVGElement[];
    const lt = lab.firstElementChild as SVGElement, ht = halo.firstElementChild as SVGElement;
    tp.id = 'tp-' + ar.id; lt.setAttribute('href', '#' + tp.id); ht.setAttribute('href', '#' + tp.id);
    g._r = { ln, hs, he, tp, hit, halo, lab, lt, ht, tl, hda, hdb, bd, del };
    dom.linkLayer.appendChild(g); this.els.set(ar.id, g);
    return g;
  }
  update(ar: Arrow, cardMap: Map<string, Card> = store.cardMap()) {
    const g = this.els.get(ar.id) ?? this.create(ar), r = g._r;
    const { p1, p2, C } = arrowEnds(ar, cardMap), col = ar.col || ARROW_COLOR, w = ar.w || 2;
    const s = arrowGeometry(p1, p2, C, w, ar.head || 'end');
    g.style.color = col;   // tutamaçlar ve seçim parıltısı okun renginde (CSS: currentColor)
    r.ln.setAttribute('d', s.line); r.ln.style.stroke = col; r.ln.style.strokeWidth = String(w); r.hit.setAttribute('d', s.line);
    for (const [el, d] of [[r.hs, s.startHead], [r.he, s.endHead]] as const) { el.style.display = d ? '' : 'none'; if (d) { el.setAttribute('d', d); el.style.fill = col; } }
    const label = (ar.label || '').trim();
    r.lab.style.display = r.halo.style.display = label ? '' : 'none';
    if (label) {
      r.tp.setAttribute('d', s.labelPath);
      if (r.lt.textContent !== label) { r.lt.textContent = label; r.ht.textContent = label; }
      const size = Math.max(13, w + 5) + 'px';
      Object.assign(r.lab.style, { fill: col, fontSize: size });
      Object.assign(r.halo.style, { fontSize: size, strokeWidth: (w + 8) + 'px' });   // kalın çizgide de okunsun diye puntosu okla büyür
    }
    const tip = (on: unknown) => on ? 'Bağlı uç|Sürükle: bağı koparır ya da başka karta taşır.' : 'Ok ucu|Sürükleyip bir karta bırak; karta bağlanır.';
    r.tl.setAttribute('cx', String(p1[0])); r.tl.setAttribute('cy', String(p1[1])); r.tl.classList.toggle('on', !!ar.a);
    for (const [el, p, on] of [[r.hda, p1, ar.a], [r.hdb, p2, ar.b]] as const) {
      el.setAttribute('cx', String(p[0])); el.setAttribute('cy', String(p[1])); el.classList.toggle('on', !!on); el.dataset.tip = tip(on);
    }
    r.bd.setAttribute('cx', String(s.mid[0])); r.bd.setAttribute('cy', String(s.mid[1]));
    r.del.setAttribute('transform', `translate(${s.delAt[0]} ${s.delAt[1]})`);
    g.classList.toggle('act', ar.id === this.activeId); g.classList.toggle('sel', selection.has(ar.id));
  }
  updateMany(list: Arrow[]) { const m = store.cardMap(); list.forEach(a => this.update(a, m)); }
  /** Sayfadaki oklarla DOM'u eşitler (eksik olanı kurar, fazla olanı siler). */
  sync() {
    const list = store.page.arrows, ids = new Set(list.map(a => a.id));
    this.els.forEach((g, id) => { if (!ids.has(id)) { g.remove(); this.els.delete(id); } });
    this.updateMany(list);
  }
  setSelected(prev: Set<string>, next: Set<string>) {
    for (const id of new Set([...prev, ...next])) this.els.get(id)?.classList.toggle('sel', next.has(id));
  }
}
export const arrows = new ArrowLayer();
