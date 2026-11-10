import { COLORS } from '../core/config';
import type { Card, TodoItem, TodoState } from '../core/types';
import { trackPointer, uid } from '../core/utils';
import { CTL, h } from './dom';
import type { BodyContext, CardTypeDef } from './registry';

const focusItem = (id: string) => `.titem[data-id="${id}"] .ttext`;

/* ── saf yardımcılar (test edilir) ── */
export const stateOf = (it: TodoItem): TodoState => it.state ?? (it.done ? 'done' : 'todo');
/** Kutuya tıklayınca: yapılacak → sürüyor (sarı) → bitti (yeşil) → yapılacak. */
export const nextState = (s: TodoState): TodoState => s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo';
export const STATE_TIP: Record<TodoState, string> = { todo: 'Yapılacak · tıkla: başladım', doing: 'Sürüyor · tıkla: bitti', done: 'Bitti · tıkla: sıfırla' };
/** İlerleme çubuğu oranları (0..1): her biten madde tam, her süren madde yarım birim. */
export function progress(items: TodoItem[]) {
  const n = items.length, done = items.filter(i => stateOf(i) === 'done').length, doing = items.filter(i => stateOf(i) === 'doing').length;
  return { n, done, doing, green: n ? done / n : 0, yellow: n ? doing * .5 / n : 0 };
}

/** Kartın son çizilen ilerleme oranları: kart yeniden kurulunca çubuk eski boyundan yenisine kayarak gelir. */
const lastBar = new Map<string, { green: number; yellow: number }>();

function renderBody(body: HTMLElement, c: Card, ctx: BodyContext) {
  const items = (c.items ??= []);
  const changed = (focus?: string) => { ctx.commit(); ctx.rerender(c, focus); };
  const addAfter = (i: number) => { const it: TodoItem = { id: uid(), text: '', state: 'todo' }; items.splice(i + 1, 0, it); changed(focusItem(it.id)); };
  const p = progress(items);

  const list = h('div', { class: 'tlist' });
  items.forEach((it, i) => {
    const text = h('input', {
      class: `ttext ${CTL}`, value: it.text, placeholder: 'Madde…',
      on: {
        input: () => { it.text = text.value; ctx.commit(); },
        keydown: e => {
          if (e.key === 'Enter') { e.preventDefault(); addAfter(i); }
          else if (e.key === 'Backspace' && !text.value) { e.preventDefault(); items.splice(i, 1); changed(items[i - 1] ? focusItem(items[i - 1].id) : '.rtitle'); }
          else if (e.key === 'ArrowUp' && items[i - 1]) { e.preventDefault(); (list.querySelector(focusItem(items[i - 1].id)) as HTMLElement).focus(); }
          else if (e.key === 'ArrowDown' && items[i + 1]) { e.preventDefault(); (list.querySelector(focusItem(items[i + 1].id)) as HTMLElement).focus(); }
        },
      },
    });
    const st = stateOf(it);
    const row = h('div', { class: `titem ${st}`, 'data-id': it.id },
      h('span', { class: 'tgrip', title: 'Sürükleyerek sırala', text: '⋮⋮', on: { pointerdown: e => reorder(e, i) } }),
      h('button', { class: `tcheck ${st} ${CTL}`, title: STATE_TIP[st], tabIndex: -1, on: { click: () => { it.state = nextState(st); delete it.done; changed(); } } }),
      text,
      h('button', { class: `tdel ${CTL}`, text: '✕', title: 'Maddeyi sil', tabIndex: -1, on: { click: () => { items.splice(i, 1); changed(); } } }),
    );
    list.appendChild(row);
  });

  /** Tutamaçtan sürükleyerek sıralama: satır imleci izler, bırakınca yeni sıra kaydedilir. */
  function reorder(ev: PointerEvent, from: number) {
    ev.stopPropagation(); ev.preventDefault();
    const rows = [...list.children] as HTMLElement[], row = rows[from];
    let to = from;
    trackPointer(ev, {
      threshold: 3,
      onStart: () => row.classList.add('drag'),
      onMove: (_dx, _dy, m) => {
        // Yeni sıra: imlecin, ortasının altında kaldığı diğer satır sayısı.
        const others = rows.filter(r => r !== row);
        to = others.filter(r => { const q = r.getBoundingClientRect(); return m.clientY > q.top + q.height / 2; }).length;
        list.insertBefore(row, others[to] ?? null);
      },
      onEnd: moved => {
        row.classList.remove('drag');
        if (!moved || to === from) return;
        const [it] = items.splice(from, 1); items.splice(to, 0, it); changed();
      },
    });
  }

  // İlerleme: yeşil (biten) + sarı (süren, yarım boy). Önceki oranlardan yenisine hızlıca kayar.
  const green = h('i', { class: 'pg' }), yellow = h('i', { class: 'py' });
  const bar = h('div', { class: 'tprog', title: `${p.done} bitti · ${p.doing} sürüyor · ${p.n - p.done - p.doing} bekliyor` },
    h('b', {}, green, yellow), h('span', { text: `${p.done}/${p.n}` }));
  const prev = lastBar.get(c.id), pct = (v: number) => v * 100 + '%';
  const paint = (q: { green: number; yellow: number }) => { green.style.width = pct(q.green); yellow.style.width = pct(q.yellow); };
  if (prev && (prev.green !== p.green || prev.yellow !== p.yellow)) {
    paint(prev);
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.classList.add('anim'); paint(p); }));
  } else paint(p);
  lastBar.set(c.id, { green: p.green, yellow: p.yellow });

  body.classList.add('rich', 'todob');
  body.append(
    h('input', { class: `rtitle ${CTL}`, value: c.text ?? '', placeholder: 'Liste başlığı', on: { input: e => { c.text = (e.target as HTMLInputElement).value; ctx.commit(); }, keydown: e => { if (e.key === 'Enter') { e.preventDefault(); addAfter(-1); } } } }),
    bar,
    list,
    h('button', { class: `tadd ${CTL}`, text: '+ Madde ekle', on: { click: () => addAfter(items.length - 1) } }),
  );
}

export const TODO: CardTypeDef = {
  label: 'Yapılacaklar', size: [264, 216], color: COLORS[2], text: false,
  init(c) { c.items = [{ id: uid(), text: '', state: 'todo' }]; },
  renderBody,
  editOnClick: () => false,
};
