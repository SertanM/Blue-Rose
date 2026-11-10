import { CARD_TYPES, toolSize } from '../cards/registry';
import { CFG } from '../core/config';
import type { Card, Point } from '../core/types';
import { trackPointer } from '../core/utils';
import { migrate, type LegacyProject } from '../model/migrate';
import { cards } from './cardLayer';
import { addCard, placeFree, renderPage } from './commands';
import { selection, store } from './context';
import { dom } from './dom';
import { ask, flash } from './services';
import { viewport } from './viewport';

/* ── gizli dosya seçiciler ── */
const filePicker = (accept: string, onFile: (f: File) => void) => {
  const i = Object.assign(document.createElement('input'), { type: 'file', accept, hidden: true });
  i.onchange = () => { const f = i.files?.[0]; i.value = ''; if (f) onFile(f); };
  document.body.appendChild(i);
  return i;
};
let imagePicker: HTMLInputElement, projectPicker: HTMLInputElement;
export function initFilePickers() {
  imagePicker = filePicker('image/*', f => { importImage(f, pendingPos); pendingPos = null; });
  projectPicker = filePicker('.json,application/json', f => { void importProject(f); });
}

/* ── görsel içe aktarma ── */
let imageTarget: Card | null = null, pendingPos: Point | null = null;
/** Kart için görsel seçtirir: `target` verilirse onun görseli değişir, yoksa `pos`a yeni görsel kartı eklenir. */
export function pickImage(target: Card | null, pos: Point | null = null) { imageTarget = target; pendingPos = pos; imagePicker.click(); }

function readImage(file: File, done: (src: string, ratio: number) => void) {
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, CFG.IMG_MAX / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = im.width * s; cv.height = im.height * s;
      const x = cv.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
      done(cv.toDataURL('image/jpeg', .82), cv.width / cv.height);
    };
    im.src = fr.result as string;
  };
  fr.readAsDataURL(file);
}
export function importImage(file: File | undefined, pos: Point | null) {
  if (!file?.type.startsWith('image/')) return;
  readImage(file, (src, ratio) => {
    if (imageTarget) {
      const c = imageTarget; imageTarget = null; c.src = src; c.h = Math.round(c.w / ratio) + 26;
      placeFree(c); cards.remount(c); store.commit();
    } else addCard('image', { src, w: 288, h: Math.round(288 / ratio) + 26 }, pos);
  });
}
/** Tuvale bırakılan dosyalar: her görsel biraz kaydırılarak eklenir. */
export function dropFiles(files: FileList, clientX: number, clientY: number) {
  imageTarget = null;
  [...files].forEach((f, i) => { const p = viewport.toWorld(clientX, clientY); importImage(f, { x: p.x + i * 30, y: p.y + i * 30 }); });
}

/* ── araç çubuğundan sürükleyip bırakma ── */
/** Ok aracının hayaleti. */
export function arrowGhost() {
  const g = document.createElement('div');
  g.innerHTML = '<svg width="160" height="24" viewBox="0 0 160 24" stroke="currentColor" fill="currentColor"><path d="M8 12H146" stroke-width="2" fill="none"/><path d="M154 12l-10-6v12z" stroke="none"/><circle cx="8" cy="12" r="4" stroke="none"/></svg>';
  return g;
}
/** Kart türünün boş bir örneği (hayalet olarak). */
export const cardGhost = (kind: string) => () => {
  const [w, h] = toolSize(kind);
  return cards.build({ id: 'ghost', type: kind, x: 0, y: 0, w, h, text: '', color: CARD_TYPES[kind].color });
};

export interface ToolDrag { size: [number, number]; ghost(): HTMLElement; drop(pos: Point): void }
/** Araç düğmesinden tuvale sürükle-bırak: hayalet küçük başlar, tuvale yaklaştıkça gerçek boyuna büyür. */
export function dragFromTool(ev: PointerEvent, tool: ToolDrag) {
  ev.preventDefault();
  const [w, h] = tool.size, ghost = tool.ghost(), z = viewport.v.z, s0 = Math.min(44 / w, z);
  ghost.id = 'ghost'; ghost.style.width ||= w + 'px'; ghost.style.height ||= h + 'px'; ghost.style.zIndex = '50'; ghost.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
  const span = Math.max(1, viewport.rect().left + 140 - ev.clientX);
  const over = (m: PointerEvent) => { const el = document.elementFromPoint(m.clientX, m.clientY); return !!el && dom.canvas.contains(el); };
  document.body.appendChild(ghost);
  const follow = (m: PointerEvent) => {
    const q = Math.min(1, Math.max(0, (m.clientX - ev.clientX) / span)), k = q * q * (3 - 2 * q);
    ghost.style.transform = `scale(${s0 + (z - s0) * k})`; ghost.style.left = m.clientX + 'px'; ghost.style.top = m.clientY + 'px';
    ghost.classList.toggle('no', !over(m));
  };
  follow(ev);
  trackPointer(ev, {
    onMove: (_dx, _dy, m) => follow(m),
    onEnd: (_moved, m) => {
      ghost.remove(); if (!over(m)) return;
      tool.drop(viewport.toWorld(m.clientX, m.clientY));
    },
  });
}

/* ── proje dışa / içe aktarma ── */
function download(name: string, text: string, mime: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const slug = () => (store.state.name || 'gdd').toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, '-').replace(/^-|-$/g, '') || 'gdd';
export function exportProject() {
  download(`${slug()}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'gdd-board', version: 1, ...store.state }, null, 1), 'application/json');
}
export const chooseProjectFile = () => projectPicker.click();

async function importProject(file: File) {
  let d: LegacyProject;
  try { d = JSON.parse(await file.text()); if (!Array.isArray(d.pages) || !d.pages.length) throw 0; }
  catch { flash('Bu dosya geçerli bir Blue Rose dosyası değil.'); return; }
  if (!await ask(`"${d.name || file.name}" yüklenecek. Şu anki çalışman bu dosyayla değiştirilecek.`, { ok: 'Yükle' })) return;
  store.state = migrate({ name: d.name || 'İçe aktarılan GDD', cur: 0, pal: d.pal, pages: d.pages });
  selection.ids = new Set(); renderPage(); store.commit();
}
