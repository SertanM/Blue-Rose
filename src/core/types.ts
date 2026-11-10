/** Projenin veri şeması. Kaydedilen JSON tam olarak bu tiplerden oluşur. */

export interface Point { x: number; y: number }
export interface Rect extends Point { w: number; h: number }
export type Vec = [number, number];

export type HAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type ArrowHead = 'end' | 'start' | 'both' | 'none';

/** Kart türü kimliği: `cards/types.ts` içindeki kayıt defterinin anahtarı. */
export type CardTypeId = string;

export interface Card extends Rect {
  id: string;
  type: CardTypeId;
  text?: string;
  /** Kart (grupta başlık) rengi. */
  color: string;
  /** Yazı rengi; yoksa tema rengi. */
  tc?: string;
  /** Grubun içerik alanı rengi; yoksa başlık rengi. */
  bg?: string;
  /** Yazı boyutu; yoksa türün varsayılanı. */
  fs?: number;
  align?: HAlign;
  valign?: VAlign;
  /** Görsel kartı: data: URL. */
  src?: string;
  /** Bölüm kartı: içindeki sayfanın kimliği. */
  page?: string;
  /** Grup: başlık yüksekliği. */
  hh?: number;
  /** Bağlantı kartı: adres ve kısa not (başlık `text`te). */
  url?: string;
  desc?: string;
  /** Yapılacaklar kartı: maddeler (başlık `text`te). */
  items?: TodoItem[];
  /** Tablo kartı: hücreler; ilk satır başlık satırıdır (tablo adı `text`te). */
  rows?: string[][];
}

export type TodoState = 'todo' | 'doing' | 'done';
/** Yapılacaklar maddesi. `done` eski kayıtlardan kalır; yeni kayıtlar `state` kullanır. */
export interface TodoItem { id: string; text: string; state?: TodoState; done?: boolean }

export interface Arrow {
  id: string;
  /** Bağlı olduğu kartlar (yoksa serbest uç). */
  a?: string | null;
  b?: string | null;
  /** Serbest uçların konumu. */
  x1: number; y1: number; x2: number; y2: number;
  /** Eğri: orta noktaya göre kontrol noktası kayması. */
  bx?: number; by?: number;
  col?: string;
  w?: number;
  head?: ArrowHead;
  label?: string;
}

export interface View { x: number; y: number; z: number }

export interface Page {
  id: string;
  name: string;
  cards: Card[];
  arrows: Arrow[];
  v: View;
  parent?: string;
  base?: boolean;
}

export interface Palettes {
  color: string[];
  tc: string[];
  fs: number[];
  ac: string[];
  bg: string[];
}
export type PaletteKey = keyof Palettes;

export interface ProjectState {
  name: string;
  cur: number;
  pages: Page[];
  pal: Palettes;
}
