import type { CSSProperties } from 'react';
import { fontSizeOf, hasText, isGroup } from '../cards/registry';
import { ARROW_COLOR } from '../core/config';
import type { Arrow, ArrowHead, Card, HAlign, PaletteKey, VAlign } from '../core/types';
import { contrast } from '../core/utils';
import { pickImage } from '../editor/io';
import { ALIGNS, ALIGN_PATHS, HEADS, VALIGNS, VALIGN_PATHS, alignDotPath, headPaths, type IconName } from '../ui/icons';

/** Panel dairesinin görünümü: arka plan, yazı ya da simge. */
export interface DotView { style?: CSSProperties; text?: string | number; icon?: IconName; paths?: string | string[]; has?: boolean }

interface Base<O> {
  id: string;
  /** Nesne türü; panel bu türdeki seçimde gösterilir. */
  on: 'card' | 'arrow';
  /** Bu nesneye uygulanır mı (varsayılan: evet). */
  applies?(o: O): boolean;
  label: string | ((o: O) => string);
  title: string | ((o: O) => string);
  /** İpucu: "Başlık|Açıklama". */
  tip: string;
  /** Daire nötr zeminli mi (renk değil, simge/sayı gösterir). */
  nb?: boolean;
  dot(o: O): DotView;
}
export interface PaletteProp<O> extends Base<O> { flyout: 'palette'; list: Exclude<PaletteKey, 'fs'>; allowDefault?: boolean; defaultGlyph?: string; defaultTip?: string; get(o: O): string; set(o: O, v: string): void }
export interface NumberProp<O> extends Base<O> { flyout: 'number'; list?: 'fs'; values?: number[]; editable?: boolean; min: number; max: number; get(o: O): number; set(o: O, v: number): void }
export interface ChoiceGroup<O> { id: string; label?: string; options: Record<string, string>; icon(k: string): string | string[]; get(o: O): string; set(o: O, v: string): void }
export interface ChoiceProp<O> extends Base<O> { flyout: 'choice'; groups: ChoiceGroup<O>[] }
export interface ActionProp<O> extends Base<O> { flyout: 'action'; icon: IconName; actionLabel: string; note: string; run(o: O): void }
export interface TextProp<O> extends Base<O> { flyout: 'text'; placeholder: string; maxLength: number; note: string; get(o: O): string; set(o: O, v: string): void }

export type PropDef<O> = PaletteProp<O> | NumberProp<O> | ChoiceProp<O> | ActionProp<O> | TextProp<O>;
// Kayıt defteri hem kart hem ok özelliklerini taşır; nesne türü `on` ile eşleştirilir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProp = PropDef<any>;

const notImage = (c: Card) => hasText(c);
const MSG_PICK = 'Tıkla: renk seç, ekle ya da düzenle.';
const card = <P extends PropDef<Card>>(p: P) => p;
const arrow = <P extends PropDef<Arrow>>(p: P) => p;

/** Özellik paneli kayıt defteri: yeni bir özellik eklemek için buraya bir kayıt eklemek yeterli; panel kodu değişmez. */
export const PROPS: AnyProp[] = [
  card({ id: 'img', on: 'card', applies: c => c.type === 'image', label: 'Görsel', nb: true, title: 'Görsel', tip: 'Görsel|Tıkla: bu görselin yerine başka bir görsel seç.', flyout: 'action',
    icon: 'image', actionLabel: 'Başka görsel seç…', note: 'Seçtiğin görsel bu kartın yerine geçer; kart yeni görselin oranına uyar.',
    run: c => pickImage(c), dot: () => ({ icon: 'image' }) }),
  card({ id: 'color', on: 'card', label: c => isGroup(c) ? 'Başlık' : 'Kart', title: c => isGroup(c) ? 'Başlık rengi' : 'Kart rengi', tip: `Renk|Kartın (grupta başlığın) rengi. ${MSG_PICK}`, flyout: 'palette', list: 'color',
    get: c => c.color, set: (c, v) => { c.color = v; }, dot: c => ({ style: { background: c.color } }) }),
  card({ id: 'bg', on: 'card', applies: isGroup, label: 'Zemin', title: 'Arka plan rengi', tip: `Arka plan rengi|Grubun içerik alanını boya. ${MSG_PICK}`, flyout: 'palette', list: 'bg', allowDefault: true,
    defaultGlyph: '↺', defaultTip: 'Varsayılan|Başlık rengini izler.',
    get: c => c.bg || '', set: (c, v) => { c.bg = v || undefined; }, dot: c => ({ style: { background: c.bg || c.color } }) }),
  card({ id: 'tc', on: 'card', applies: notImage, label: 'Yazı', title: 'Yazı rengi', tip: `Yazı rengi|${MSG_PICK}`, flyout: 'palette', list: 'tc', allowDefault: true,
    get: c => c.tc || '', set: (c, v) => { c.tc = v || undefined; },
    dot: c => ({ text: 'A', style: { background: c.tc || 'var(--tx)', color: c.tc ? contrast(c.tc) : 'var(--bg)' } }) }),
  card({ id: 'align', on: 'card', applies: notImage, label: 'Hiza', nb: true, title: 'Yazı hizası', tip: 'Yazı hizası|Tıkla: yatay (sola, ortaya, sağa) ve dikey (yukarı, orta, aşağı) hizala.', flyout: 'choice',
    groups: [
      { id: 'align', label: 'Yatay', options: ALIGNS, icon: k => ALIGN_PATHS[k as HAlign], get: c => c.align || 'left', set: (c, v) => { c.align = v as HAlign; } },
      { id: 'valign', label: 'Dikey', options: VALIGNS, icon: k => VALIGN_PATHS[k as VAlign], get: c => c.valign || 'top', set: (c, v) => { c.valign = v as VAlign; } },
    ],
    dot: c => ({ paths: alignDotPath(c) }) }),
  card({ id: 'fs', on: 'card', applies: notImage, label: 'Boyut', nb: true, title: 'Yazı boyutu', tip: 'Yazı boyutu|Tıkla: boyut seç ya da kendi boyutunu yaz.', flyout: 'number', list: 'fs', editable: true, min: 8, max: 120,
    get: fontSizeOf, set: (c, v) => { c.fs = v; }, dot: c => ({ text: fontSizeOf(c) }) }),
  arrow({ id: 'ac', on: 'arrow', label: 'Renk', title: 'Ok rengi', tip: `Ok rengi|${MSG_PICK}`, flyout: 'palette', list: 'ac',
    get: a => a.col || ARROW_COLOR, set: (a, v) => { a.col = v; }, dot: a => ({ style: { background: a.col || ARROW_COLOR } }) }),
  arrow({ id: 'aw', on: 'arrow', label: 'Kalınlık', nb: true, title: 'Kalınlık', tip: 'Ok kalınlığı|Tıkla: kalınlığı seç ya da kendin yaz.', flyout: 'number', values: [1, 2, 3, 4, 6, 8, 10, 12], min: 1, max: 24,
    get: a => a.w || 2, set: (a, v) => { a.w = v; }, dot: a => ({ text: a.w || 2 }) }),
  arrow({ id: 'ah', on: 'arrow', label: 'Uç', nb: true, title: 'Ok ucu', tip: 'Ok ucu|Tıkla: ok başı sağda, solda ya da iki uçta olsun.', flyout: 'choice',
    groups: [{ id: 'ah', options: HEADS, icon: k => headPaths(k as ArrowHead), get: a => a.head || 'end', set: (a, v) => { a.head = v as ArrowHead; } }],
    dot: a => ({ paths: headPaths(a.head || 'end') }) }),
  arrow({ id: 'al', on: 'arrow', label: 'Etiket', nb: true, title: 'Ok etiketi', tip: 'Etiket|Tıkla: oka bir yazı ekle. Oka çift tıklayarak da yazabilirsin.', flyout: 'text',
    placeholder: 'Etiket yaz…', maxLength: 40, note: 'Okun eğrisini izler, okun renginde ve kalın yazılır. Oka çift tıklayarak da düzenleyebilirsin.',
    get: a => a.label || '', set: (a, v) => { a.label = v; }, dot: a => ({ icon: 'text', has: !!a.label?.trim() }) }),
];

export const PROP: Record<string, AnyProp> = Object.fromEntries(PROPS.map(p => [p.id, p]));
export const titleOf = <O,>(p: PropDef<O>, o: O) => typeof p.title === 'function' ? p.title(o) : p.title;
export const labelOf = <O,>(p: PropDef<O>, o: O) => typeof p.label === 'function' ? p.label(o) : p.label;
