import { toolSize } from '../cards/registry';
import type { Point } from '../core/types';
import { addArrow, addCard } from '../editor/commands';
import { arrowGhost, cardGhost, pickImage, type ToolDrag } from '../editor/io';
import { ask, flash } from '../editor/services';
import { domainOf, LINK_SIZE, LINK_SIZE_THUMB, normalizeUrl, thumbOf } from '../cards/link';
import { fitAll, zoomBy } from '../editor/navigation';
import type { IconName } from './icons';

/** Tuvale sürüklenerek eklenen araçlar. Yeni araç = yeni satır (ne zaman, neyin ekleneceği kendi kaydında). */
export interface DropTool extends ToolDrag { kind: string; icon: IconName; tip: string }

/** Kart türü için araç: sürüklerken kartın kendisini gösterir, bırakınca o türden kart ekler. */
const cardTool = (kind: string, icon: IconName, tip: string, drop?: (pos: Point) => void): DropTool =>
  ({ kind, icon, tip, size: toolSize(kind), ghost: cardGhost(kind), drop: drop ?? (pos => { addCard(kind, {}, pos); }) });

/** Bağlantı aracı: önce adresi sorar; vazgeçilirse kart eklenmez. */
async function addLink(pos: Point) {
  const input = await ask('Bağlantı adresi:', { input: '', ok: 'Ekle' });
  if (input === null) return;
  const url = normalizeUrl(input);
  if (input.trim() && !url) { flash('Bu geçerli bir web adresi değil.'); return; }
  const [w, h] = url && thumbOf(url) ? LINK_SIZE_THUMB : LINK_SIZE;
  addCard('link', { url: url ?? undefined, text: url ? domainOf(url) : '', w, h }, pos);
}

export const DROP_TOOLS: DropTool[] = [
  cardTool('note', 'note', 'Not|Tuvale sürükleyip bırak. İçine serbest metin yaz.'),
  cardTool('image', 'image', 'Görsel|Tuvale sürükleyip bırak, ardından bilgisayarından bir görsel seç.', pos => pickImage(null, pos)),
  cardTool('box', 'box', 'Bölüm|Tuvale sürükleyip bırak. Çift tıklayınca ya da üzerine yakınlaşınca içine girersin.'),
  cardTool('group', 'group', 'Grup|Tuvale sürükleyip bırak. Başlığı ve boyanabilen bir içerik alanı vardır; içine kartları sürükle, grupla birlikte taşınırlar.'),
  cardTool('link', 'link', 'Bağlantı|Tuvale sürükleyip bırak ve adresi yaz. YouTube ve görsel bağlantılarında internet varsa küçük resim görünür.', pos => void addLink(pos)),
  cardTool('todo', 'todo', 'Yapılacaklar|Tuvale sürükleyip bırak. Enter yeni madde açar, tutamaçtan sürükleyerek sıralanır.'),
  cardTool('table', 'table', 'Tablo|Tuvale sürükleyip bırak. Hücreler arasında Tab ve Enter ile gezilir.'),
  { kind: 'arrow', icon: 'arrow', tip: 'Ok|Tuvale sürükleyip bırak. İki ucunu kartlara bırakarak bağla.', size: [160, 24], ghost: arrowGhost, drop: addArrow },
];
/** Alttaki tıklanır düğmeler. */
export interface ButtonTool { id: string; icon: IconName; tip: string; run(): void }
export const BUTTON_TOOLS: ButtonTool[] = [
  { id: 'zi', icon: 'zoomIn', tip: 'Yakınlaştır|Tuvali büyütür. Fare tekerleği de aynı işi yapar.', run: () => zoomBy(1.2) },
  { id: 'zo', icon: 'zoomOut', tip: 'Uzaklaştır|Tuvali küçültür.', run: () => zoomBy(1 / 1.2) },
  { id: 'zr', icon: 'fit', tip: 'Tümünü sığdır|Bütün kartları ekrana sığacak şekilde ortalar.', run: fitAll },
];
