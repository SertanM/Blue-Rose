import { COLORS } from '../core/config';
import type { Card } from '../core/types';
import { CTL, h } from './dom';
import type { BodyContext, CardTypeDef } from './registry';

/* ── saf yardımcılar (test edilir) ── */
export const MAX_COLS = 12;
/** Tablonun dikdörtgen olmasını garanti eder (eksik hücreleri boş dizeyle doldurur). */
export function normalizeRows(rows: string[][] | undefined): string[][] {
  const r = rows?.length ? rows : [['Ad', 'Değer', 'Not'], ['', '', ''], ['', '', '']];
  const w = Math.max(1, ...r.map(x => x.length));
  return r.map(x => Array.from({ length: w }, (_, i) => x[i] ?? ''));
}
export const addRow = (rows: string[][], at = rows.length) => { rows.splice(at, 0, rows[0].map(() => '')); };
export const addCol = (rows: string[][], at = rows[0].length) => { if (rows[0].length < MAX_COLS) rows.forEach(r => r.splice(at, 0, '')); };
/** Başlık satırı ve son sütun silinmez. */
export const removeRow = (rows: string[][], i: number) => { if (i > 0 && rows.length > 1) rows.splice(i, 1); };
export const removeCol = (rows: string[][], j: number) => { if (rows[0].length > 1) rows.forEach(r => r.splice(j, 1)); };

const cell = (i: number, j: number) => `[data-c="${i}:${j}"]`;

function renderBody(body: HTMLElement, c: Card, ctx: BodyContext) {
  const rows = (c.rows = normalizeRows(c.rows)), cols = rows[0].length;
  const changed = (focus?: string) => { ctx.commit(); ctx.rerender(c, focus); };
  const focus = (i: number, j: number) => (body.querySelector(cell(i, j)) as HTMLInputElement | null)?.focus();

  const table = h('table', { class: 'tbl' });
  rows.forEach((r, i) => {
    const tr = h(i === 0 ? 'thead' : 'tr', {});
    const line = i === 0 ? tr.appendChild(h('tr', {})) : tr;
    r.forEach((v, j) => {
      const inp = h('input', {
        class: CTL, value: v, 'data-c': `${i}:${j}`, placeholder: i === 0 ? 'Başlık' : '',
        on: {
          input: () => { rows[i][j] = inp.value; ctx.commit(); },
          keydown: e => {
            // Enter: aşağıdaki hücre (son satırdaysa yeni satır açılır). Yukarı/aşağı ok: satırlar arasında gez.
            if (e.key === 'Enter') { e.preventDefault(); if (i + 1 < rows.length) focus(i + 1, j); else { addRow(rows); changed(cell(i + 1, j)); } }
            else if (e.key === 'ArrowDown' && i + 1 < rows.length) { e.preventDefault(); focus(i + 1, j); }
            else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); focus(i - 1, j); }
          },
        },
      });
      const td = h(i === 0 ? 'th' : 'td', {}, inp);
      if (i === 0 && cols > 1) td.appendChild(h('button', { class: `xcol ${CTL}`, text: '✕', title: 'Sütunu sil', tabIndex: -1, on: { click: () => { removeCol(rows, j); changed(); } } }));
      line.appendChild(td);
    });
    if (i > 0) line.appendChild(h('td', { class: 'xcell' }, h('button', { class: `xrow ${CTL}`, text: '✕', title: 'Satırı sil', tabIndex: -1, on: { click: () => { removeRow(rows, i); changed(); } } })));
    // Başlık satırının sonundaki yeşil +: en sağa yeni sütun ekler (üzerine gelince görünür).
    else line.appendChild(h('th', { class: 'xcell' }, cols < MAX_COLS
      ? h('button', { class: `addcol ${CTL}`, text: '+', title: 'Sütun ekle', tabIndex: -1, on: { click: () => { addCol(rows); changed(cell(0, cols)); } } })
      : null));
    table.appendChild(tr);
  });
  // Tablonun altındaki yeşil "+ Satır": en alta yeni satır ekler (tablonun üzerine gelince görünür).
  table.appendChild(h('tr', { class: 'addline' }, h('td', { colSpan: cols },
    h('button', { class: `addrow ${CTL}`, text: '+ Satır', title: 'Satır ekle', tabIndex: -1, on: { click: () => { addRow(rows); changed(cell(rows.length - 1, 0)); } } }))));

  body.classList.add('rich', 'tableb');
  body.append(
    h('input', { class: `rtitle ${CTL}`, value: c.text ?? '', placeholder: 'Tablo adı', on: { input: e => { c.text = (e.target as HTMLInputElement).value; ctx.commit(); } } }),
    h('div', { class: 'twrap' }, table),
  );
}

export const TABLE: CardTypeDef = {
  label: 'Tablo', size: [384, 216], color: COLORS[5], text: false,
  init(c) { c.rows = normalizeRows(undefined); },
  renderBody,
  editOnClick: () => false,
};
