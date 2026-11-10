import { arrows } from './arrowLayer';
import { bindAll } from './bindings';
import { cards } from './cardLayer';
import { renderPage } from './commands';
import { events, selection, storage, store } from './context';
import { bindDom, type EditorDom } from './dom';
import { timeline } from './history';
import { initFilePickers } from './io';
import { flash } from './services';

let started = false;

/** Tuval motorunu React'in çizdiği DOM üzerinde başlatır (bir kez). */
export function startEditor(d: EditorDom) {
  if (started) return;
  started = true;
  bindDom(d);
  initFilePickers();
  store.onSaveError = () => flash('Kayıt yapılamadı (disk dolu olabilir). Çalışmanı "Dışa aktar" ile dosyaya kaydet.');
  if (storage.backend === 'localstorage') flash('Tarayıcı veritabanı açılamadı; eski kayıt yeri kullanılıyor (en fazla ~5 MB).');
  selection.on((prev, next) => {
    cards.setSelected(prev, next); arrows.setSelected(prev, next); events.emit('selection');
    if (next.size > 1) flash(`${next.size} öğe seçili`);
  });
  bindAll();
  timeline.reset();   // geçmiş, yüklenen projeden başlar
  renderPage();
}
