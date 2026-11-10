import { COLORS } from '../core/config';
import type { Card, CardTypeId, Page, ProjectState } from '../core/types';
import { BOX_ICON_HTML } from '../ui/icons';
import { LINK } from './link';
import { TABLE } from './table';
import { TODO } from './todo';

/** Kart türü hook'larının ihtiyaç duyduğu bağlam (kayıt defteri Store'a doğrudan bağlı değildir). */
export interface CardContext {
  state: ProjectState;
  page: Page;
  pageById(id: string | undefined): Page | undefined;
  /** Geçerli sayfanın altında yeni, boş bir alt sayfa açar. */
  newSubpage(): Page;
}

/** Gövdesini kendisi kuran (etkileşimli) kart türlerine verilen bağlam. */
export interface BodyContext extends CardContext {
  /** Kartın verisi değişti: kaydı ve geri alma adımını planlar. */
  commit(): void;
  /** Kartı verisinden yeniden kurar; `focus` verilirse bu seçiciye uyan öğeye odaklanır. */
  rerender(c: Card, focus?: string): void;
  /** İçerik sığmıyorsa kartı aşağı doğru büyütür (yer boşsa). */
  grow(c: Card): void;
}

/**
 * Bir kart türünün tüm tanımı. Yeni bir tür eklemek için `CARD_TYPES`'a bir kayıt eklemek yeterli;
 * kart katmanı, komutlar ve geometri türleri isimle değil bu bayraklar ve hook'larla tanır (açık/kapalı ilkesi).
 */
export interface CardTypeDef {
  /** Kart çubuğunda görünen ad. */
  label: string;
  size: [number, number];
  color: string;
  /** Yazı alanı var mı; yoksa gövdeyi `renderBody` kurar. */
  text: boolean;
  hint?: string;
  fontSize?: number;
  /** Bölüm: içinde alt sayfası olan kart (çift tıkla / yakınlaş: içine gir). */
  container?: boolean;
  /** Grup: başlık + içine kart alınabilen içerik alanı. */
  group?: boolean;
  /** Grubun varsayılan başlık yüksekliği. */
  head?: number;
  /** Ana eksen dikey mi (içerik alt alta dizilir). Dikey hizayı etkiler. */
  column?: boolean;
  /** Araç çubuğunda gösterilmez (yalnızca eski dosyalar için). */
  legacy?: boolean;
  /** Yeni kart oluşturulurken alanlarını doldurur. */
  init?(c: Card, ctx: CardContext): void;
  /** Metin dışı türler: kart gövdesini kurar. */
  renderBody?(body: HTMLElement, c: Card, ctx: BodyContext): void;
  /** Yazı alanından önce gövdeye / karta ek öğeler koyar. */
  decorate?(el: HTMLElement, body: HTMLElement, c: Card, ctx: CardContext): void;
  /** Tek tıklamada yazma moduna girilsin mi. Varsayılan: metinli türlerde evet. */
  editOnClick?(e: { wasSelected: boolean; onHead: boolean }): boolean;
}

export const CARD_TYPES: Record<CardTypeId, CardTypeDef> = {
  note: { label: '', size: [240, 168], color: COLORS[0], text: true, hint: 'Notunu yaz…', fontSize: 14 },
  section: { label: 'Bölüm', size: [288, 72], color: COLORS[1], text: true, hint: 'Bölüm başlığı', fontSize: 20, legacy: true },
  box: {
    label: 'Bölüm', size: [192, 120], color: COLORS[3], text: true, hint: 'Bölüm adı', fontSize: 15, container: true, column: true,
    init(c, ctx) { c.page = ctx.newSubpage().id; c.text ||= 'Yeni bölüm'; c.align = 'center'; },
    decorate(el, body, c, ctx) {
      const icon = document.createElement('div'); icon.className = 'bico'; icon.innerHTML = BOX_ICON_HTML; body.appendChild(icon);
      const n = ctx.pageById(c.page)?.cards.length ?? 0, hint = document.createElement('div');
      hint.className = 'bhint'; hint.textContent = n ? n + ' öğe · çift tıkla' : 'Çift tıkla: aç'; el.appendChild(hint);
    },
    editOnClick: ({ wasSelected }) => wasSelected,
  },
  image: {
    label: 'Görsel', size: [288, 216], color: COLORS[0], text: false,
    renderBody(body, c) {
      if (c.src) { const im = new Image(); im.src = c.src; body.appendChild(im); return; }
      const b = document.createElement('button'); b.className = 'pick'; b.textContent = 'Görsel seç'; body.appendChild(b);
    },
    editOnClick: () => false,
  },
  group: {
    label: '', size: [360, 336], color: COLORS[0], text: true, hint: 'Grup başlığı', fontSize: 16, group: true, head: 72,
    init(c) { c.hh = 72; c.text ||= 'Yeni grup'; },
    editOnClick: ({ onHead }) => onHead,   // grupta yalnızca başlığa tıklamak yazma modunu açar
  },
  link: LINK,
  todo: TODO,
  table: TABLE,
};

export const typeOf = (c: { type?: CardTypeId }) => CARD_TYPES[c.type ?? ''] ?? CARD_TYPES.note;
export const isGroupType = (t: CardTypeId | undefined) => !!(t && CARD_TYPES[t]?.group);
export const isGroup = (c: { type?: CardTypeId }) => isGroupType(c.type);
export const isContainer = (c: { type?: CardTypeId }) => !!typeOf(c).container;
export const hasText = (c: { type?: CardTypeId }) => typeOf(c).text;
export const fontSizeOf = (c: Card) => c.fs || typeOf(c).fontSize || 14;
/** Araç çubuğundan sürüklerken hayaletin boyutu. */
export const toolSize = (kind: CardTypeId): [number, number] => CARD_TYPES[kind].size;
