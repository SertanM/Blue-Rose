import { Timeline } from '../model/timeline';
import { renderPage } from './commands';
import { events, selection, store } from './context';
import { nav } from './navigation';
import { flash } from './services';

export const timeline = new Timeline(store, () => { selection.ids = new Set(); renderPage(); });
store.onChange = () => { timeline.markDirty(); events.emit('doc'); };

/** Geri al. Gezinti animasyonu sürerken çalışmaz (false döner). */
export function undo() {
  if (nav.locked) return false;
  flash(timeline.undo() ? 'Geri alındı' : 'Geri alınacak işlem yok');
  return true;
}
export function redo() {
  if (nav.locked) return false;
  flash(timeline.redo() ? 'İleri alındı' : 'İleri alınacak işlem yok');
  return true;
}
