import { isContainer, typeOf } from '../cards/registry';
import { CFG } from '../core/config';
import { blurActive, isCardField, trackPointer } from '../core/utils';
import { arrowGesture } from './arrowGestures';
import { arrows } from './arrowLayer';
import { cards } from './cardLayer';
import { dragCard, dragGroup, marquee } from './cardDrag';
import { hasClipboard, pasteClipboard } from './clipboard';
import { deleteItems, ensureSubpage } from './commands';
import { events, selection, store } from './context';
import { dom } from './dom';
import { timeline } from './history';
import { dropFiles, pickImage } from './io';
import { nav, zoomAt } from './navigation';
import { onKeydown } from './shortcuts';
import { viewport } from './viewport';

const cardOf = (t: EventTarget | null) => {
  const e = (t as Element | null)?.closest?.<HTMLElement>('.card'), c = e && store.card(e.dataset.id!);
  return e && c ? { e, c } : null;
};

/** Kartı yazma moduna alır. */
function startEdit(e: HTMLElement) {
  const t = e.querySelector('textarea'); if (!t) return;
  e.classList.add('editing'); t.focus(); t.setSelectionRange(t.value.length, t.value.length);
}

/** Kartlar: tek işleyici (olay yetkilendirme), kart başına dinleyici yok. */
function bindCards() {
  const { world } = dom;
  world.addEventListener('pointerdown', ev => {
    const hit = cardOf(ev.target); if (!hit) return;
    const { e, c } = hit, target = ev.target as Element;
    if (target.closest('.rs')) { dragCard(ev, c, { mode: 'resize' }); return; }
    if (target.closest('.gdiv')) { dragCard(ev, c, { mode: 'divider' }); return; }
    // Grubun içerik alanında sağ tık / Shift ile sürüklemek, boş tuvaldeki gibi kutu seçimi başlatır.
    if ((ev.button === 2 || ev.shiftKey) && target.closest('.gbody')) { ev.stopPropagation(); marquee(ev); return; }
    const typing = e.classList.contains('editing') && target.tagName === 'TEXTAREA';
    if (ev.button === 2 || (ev.button === 0 && ev.shiftKey && !typing)) { ev.preventDefault(); ev.stopPropagation(); blurActive(); selection.toggle(c.id); return; }
    // Etkileşimli kartlardaki denetimler (giriş kutusu, onay kutusu, düğme): kartı seçer ama sürüklemez, tıklama denetime gider.
    if (target.closest('.ctl')) {
      if (!selection.has(c.id)) { if (!isCardField(target)) blurActive(); selection.set([c.id]); }
      cards.raise(c.id); return;
    }
    if (ev.button || target.closest('button') || typing) return;
    if (isCardField(document.activeElement)) blurActive();
    cards.raise(c.id);
    if (selection.size > 1 && selection.has(c.id)) { dragGroup(ev, c); return; }
    const wasSelected = selection.single === c.id;
    selection.set([c.id]);
    const onHead = !!target.closest('.ghead'), T = typeOf(c);
    dragCard(ev, c, { onClick: () => {
      const edit = T.editOnClick ? T.editOnClick({ wasSelected, onHead }) : T.text;
      if (edit) startEdit(e);
    } });
  });
  world.addEventListener('click', ev => {
    const hit = cardOf(ev.target); if (!hit) return;
    const target = ev.target as Element;
    if (target.closest('[data-a="del"]')) void deleteItems([hit.c], [], { confirm: true });
    else if (target.closest('.pick')) pickImage(hit.c);
  });
  world.addEventListener('dblclick', ev => {
    const hit = cardOf(ev.target); if (!hit || !isContainer(hit.c) || (ev.target as Element).closest('button')) return;
    ensureSubpage(hit.c);
    void nav.enter(hit.c);
  });
  world.addEventListener('input', ev => {   // notun ve bölümün kendi yazı alanı (etkileşimli kartlar kendi alanlarını kendileri kaydeder)
    const t = ev.target as HTMLTextAreaElement, hit = t.tagName === 'TEXTAREA' && t.parentElement?.classList.contains('body') && cardOf(t); if (!hit) return;
    const { c } = hit; c.text = t.value; if ((c.valign || 'top') !== 'top') cards.fit(t); store.commit();
  });
  world.addEventListener('focusin', ev => {
    const t = ev.target as Element, e = t.closest?.<HTMLElement>('.card'); if (!isCardField(t) || !e) return;
    e.classList.add('editing');
    const id = e.dataset.id!;
    if (selection.single !== id && !(selection.size > 1 && selection.has(id))) selection.set([id]);
  });
  world.addEventListener('focusout', ev => {
    const t = ev.target as Element, e = t.closest?.('.card'); if (!isCardField(t) || !e) return;
    e.classList.remove('editing'); store.commit();
  });
  world.addEventListener('keydown', ev => { if (ev.key === 'Escape' && isCardField(ev.target as Element)) (ev.target as HTMLElement).blur(); });
}

/** Oklar: taşıma, uçları bağlama, eğme, silme, etiket. */
function bindArrows() {
  const { linkLayer } = dom;
  const arrowOf = (t: EventTarget | null) => { const g = (t as Element).closest<SVGGElement>('.arw'); return g ? store.arrow(g.dataset.id!) : undefined; };
  linkLayer.addEventListener('pointerdown', ev => {
    const ar = arrowOf(ev.target); if (!ar) return;
    ev.stopPropagation(); ev.preventDefault();
    const t = ev.target as SVGElement;
    if (t.closest('[data-del]')) { void deleteItems([], [ar], { confirm: false }); return; }
    const bend = t.dataset.bend, end = t.dataset.e as 'a' | 'b' | undefined;
    if (ev.button === 2 || ev.shiftKey) { blurActive(); selection.toggle(ar.id); return; }
    if (ev.button) return;
    if (selection.size > 1 && selection.has(ar.id) && !bend && !end) { dragGroup(ev, null); return; }
    if (selection.single !== ar.id) { blurActive(); selection.set([ar.id]); }
    if (bend) arrowGesture.bend(ev, ar); else if (end) arrowGesture.end(ev, ar, end); else arrowGesture.body(ev, ar);
  });
  linkLayer.addEventListener('dblclick', ev => {
    const ar = arrowOf(ev.target); if (!ar) return;
    const t = ev.target as SVGElement;
    if (t.dataset.bend && (ar.bx || ar.by)) { delete ar.bx; delete ar.by; arrows.update(ar); store.commit(); return; }   // eğriyse düzleştir
    if (t.dataset.e || t.closest('[data-del]')) return;
    if (selection.single !== ar.id) selection.set([ar.id]);
    events.emit('openProp', 'al');   // oka çift tık → etiket yaz
  });
}

/** Tuval: kaydırma, kutu seçimi, yakınlaştırma, dosya bırakma. */
function bindCanvas() {
  const { canvas, world } = dom;
  canvas.addEventListener('pointerdown', ev => {
    if (ev.target !== canvas && ev.target !== world) return;
    if (ev.button === 2 || ev.shiftKey) { marquee(ev); return; }
    selection.clear(); blurActive();
    const v = viewport.v, ox = v.x, oy = v.y;
    trackPointer(ev, {
      onStart: () => { canvas.style.cursor = 'grabbing'; },
      onMove: (dx, dy) => { v.x = ox + dx; v.y = oy + dy; viewport.apply(); },
      onEnd: () => { canvas.style.cursor = ''; store.commit(); },
    });
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', ev => {
    // İçeriği taşan bir kart gövdesinin (uzun liste, tablo) üstündeyken tekerlek önce gövdeyi kaydırır.
    const rich = (ev.target as Element).closest?.<HTMLElement>('.body.rich, .twrap');
    if (rich && !ev.ctrlKey && rich.scrollHeight > rich.clientHeight + 1) {
      const atEnd = ev.deltaY > 0 ? rich.scrollTop + rich.clientHeight >= rich.scrollHeight - 1 : rich.scrollTop <= 0;
      if (!atEnd) return;
    }
    ev.preventDefault();
    if (!nav.ready) return;
    const r = viewport.rect();
    zoomAt(Math.exp(-ev.deltaY * .0015), ev.clientX - r.left, ev.clientY - r.top);
    if (ev.deltaY >= 0) return;
    const hit = cardOf(ev.target); if (!hit || !isContainer(hit.c)) return;   // Bölüm'e yakınlaşınca içine gir
    const q = hit.e.getBoundingClientRect();
    if (q.width >= r.width * CFG.ZOOM.enterRatio || q.height >= r.height * CFG.ZOOM.enterRatio) void nav.enter(hit.c);
  }, { passive: false });
  canvas.addEventListener('dragover', e => e.preventDefault());
  canvas.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer) dropFiles(e.dataTransfer.files, e.clientX, e.clientY); });
}

/** Genel klavye ve yapıştırma. */
function bindGlobal() {
  addEventListener('pointerdown', () => timeline.flush(), true);
  addEventListener('keydown', onKeydown);
  addEventListener('paste', ev => {   // yazma modundayken Ctrl+V: panoda metin yoksa kopyalanan nesneleri yapıştır
    const a = document.activeElement;
    if (isCardField(a) && hasClipboard() && !ev.clipboardData?.getData('text')) { ev.preventDefault(); a.blur(); pasteClipboard(); }
  });
}

export function bindAll() { bindCards(); bindArrows(); bindCanvas(); bindGlobal(); }
