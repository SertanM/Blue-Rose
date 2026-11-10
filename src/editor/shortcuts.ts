import { isCardField, isTyping, blurActive } from '../core/utils';
import { copySelection, pasteClipboard } from './clipboard';
import { deleteItems, deleteSelection, expandWithFollowers } from './commands';
import { selection, store } from './context';
import { redo, timeline, undo } from './history';

export interface Shortcut {
  /** `mod`: Ctrl ya da Cmd basılı; `key`: küçük harfe çevrilmiş tuş. */
  test(e: KeyboardEvent, mod: boolean, key: string): boolean;
  /** false dönerse tarayıcının varsayılan davranışı engellenmez. */
  run(): boolean | void;
}

const allIds = () => [...store.page.cards.map(c => c.id), ...store.page.arrows.map(a => a.id)];

/** Klavye kısayolları: yeni kısayol = yeni satır. */
export const SHORTCUTS: Shortcut[] = [
  { test: e => e.key === 'Delete' || e.key === 'Backspace', run: () => { if (!selection.size) return false; void deleteSelection(true); } },
  { test: (_e, m, k) => m && k === 'c', run: () => copySelection() },
  { test: (_e, m, k) => m && k === 'x', run: () => {
      if (!copySelection()) return false;
      const picked = expandWithFollowers(store.page.cards.filter(c => selection.has(c.id))), ids = new Set(picked.map(c => c.id));
      void deleteItems(picked, store.page.arrows.filter(a => selection.has(a.id) || (a.a && a.b && ids.has(a.a) && ids.has(a.b))), { confirm: false });   // kesince grubun içindekiler ve aralarındaki oklar da gider
  } },
  { test: (_e, m, k) => m && k === 'v', run: () => { pasteClipboard(); } },
  { test: (_e, m, k) => m && k === 'a', run: () => { selection.set(allIds()); } },
  { test: (e, m, k) => m && k === 'z' && !e.shiftKey, run: () => undo() },
  { test: (e, m, k) => m && (k === 'y' || (k === 'z' && e.shiftKey)), run: () => redo() },
];

export function onKeydown(ev: KeyboardEvent) {
  if (document.getElementById('dlg')) return;
  const a = document.activeElement, mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
  const inCard = isCardField(a);
  // Kartta yazarken metin seçili değilse Ctrl+C / Ctrl+X kartın kendisini kopyalar/keser.
  const cardCut = inCard && a.selectionStart === a.selectionEnd && mod && (k === 'c' || k === 'x');
  // Kart yazı alanındayken geri al/ileri al, tarayıcının yerel metin geçmişi yerine uygulamanın tek geçmişini kullanır.
  const cardHistory = inCard && mod && (k === 'z' || k === 'y');
  if (isTyping(a) && !cardCut && !cardHistory) return;
  if (cardCut || cardHistory) blurActive();
  timeline.flush();
  const cmd = SHORTCUTS.find(s => s.test(ev, mod, k));
  if (cmd && cmd.run() !== false) ev.preventDefault();
}
