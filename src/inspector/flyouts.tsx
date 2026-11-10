import { useEffect, useRef, type ComponentType, type MutableRefObject } from 'react';
import type { PaletteKey } from '../core/types';
import { store } from '../editor/context';
import { ask } from '../editor/services';
import { useDraft } from '../ui/hooks';
import { Icon } from '../ui/Icon';
import { openColorPicker } from './colorPicker';
import { titleOf, type ActionProp, type AnyProp, type ChoiceProp, type NumberProp, type PaletteProp, type TextProp } from './props';
import { useReorder } from './useReorder';

/** Her açılır pencere türüne verilen bağlam. */
export interface FlyoutProps<P extends AnyProp = AnyProp> {
  prop: P;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any;
  editing: boolean;
  toggleEdit(): void;
  /** Seçili nesneyi değiştirir (görünüm + kayıt). */
  apply(change: () => void): void;
  close(): void;
  isOpen: MutableRefObject<boolean>;
  /** Değişince (oka çift tıklama) yazı kutusuna odaklanılır. */
  focusToken: number;
}

const EditHint = () => <div className="fn">Sürükleyerek sırala. Değiştirmek için tıkla, silmek için ✕ işaretine bas.</div>;
function Header({ title, editable, editing, toggleEdit }: { title: string; editable?: boolean; editing?: boolean; toggleEdit?: () => void }) {
  return (
    <div className="fh"><span>{title}</span>
      {editable && <button data-f="edit" className={editing ? 'on' : ''} data-tip="Düzenle|Hazır değerleri değiştir ya da sil." onClick={toggleEdit}>✎</button>}
    </div>
  );
}
/** Hazır değerin silme rozeti (düzenleme modunda görünür). */
const Del = ({ onDel }: { onDel: () => void }) => <i data-f="del" onClick={e => { e.stopPropagation(); onDel(); }}>✕</i>;

const commitList = <T,>(list: T[], next: T[]) => { list.splice(0, list.length, ...next); store.commit(); };

/* ── renk paleti ── */
function PaletteFlyout({ prop: p, obj, editing, toggleEdit, apply }: FlyoutProps<PaletteProp<unknown>>) {
  const list = store.palette(p.list as Exclude<PaletteKey, 'fs'>), cur = p.get(obj), box = useRef<HTMLDivElement>(null);
  const ro = useReorder(list.length, order => { const old = list.slice(); commitList(list, order.map(i => old[i])); });
  const pick = (i: number) => {
    if (ro.justDragged.current) return;
    if (editing && i >= 0) openColorPicker(list[i], v => { list[i] = v; store.commit(); });
    else apply(() => p.set(obj, i < 0 ? '' : list[i]));
  };
  const add = () => openColorPicker(cur || '#ffffff', v => apply(() => p.set(obj, v)), v => { if (!list.includes(v)) { list.push(v); store.commit(); } });
  return <>
    <Header title={titleOf(p, obj)} editable editing={editing} toggleEdit={toggleEdit} />
    <div className="fg" ref={box}>
      {p.allowDefault && <button className={`fs auto${cur ? '' : ' on'}`} data-f="pick" data-i="-1" data-tip={p.defaultTip || 'Varsayılan|Temaya uygun yazı rengi.'} onClick={() => pick(-1)}>{p.defaultGlyph || 'A'}</button>}
      {ro.order.map(i => (
        <button key={i} className={`fs${list[i] === cur ? ' on' : ''}`} data-f="pick" data-i={i} style={{ '--s': list[i], opacity: ro.dragging === i ? .25 : undefined } as React.CSSProperties}
          onClick={() => pick(i)} onPointerDown={e => editing && ro.start(e, i, box.current)}>
          <Del onDel={() => { list.splice(i, 1); store.commit(); }} />
        </button>
      ))}
      <button className="fs add" data-f="add" data-tip="Renk ekle|Kendi rengini seç ve listeye ekle." onClick={add}>+</button>
    </div>
    {editing && <EditHint />}
  </>;
}

/* ── sayı (yazı boyutu, ok kalınlığı) ── */
function NumberFlyout({ prop: p, obj, editing, toggleEdit, apply, isOpen }: FlyoutProps<NumberProp<unknown>>) {
  const list = p.list ? store.palette(p.list) : p.values ?? [], cur = p.get(obj), ed = !!p.editable, box = useRef<HTMLDivElement>(null);
  const draft = useDraft(cur);
  const valid = (n: number) => n >= p.min && n <= p.max;
  const ro = useReorder(list.length, order => { const old = list.slice(); commitList(list, order.map(i => old[i])); });
  const pick = (i: number) => {
    if (ro.justDragged.current) return;
    if (editing && ed) {
      void ask(`Yeni değer (${p.min}-${p.max}):`, { input: String(list[i]), ok: 'Kaydet' }).then(r => {
        const n = Number(r); if (r !== null && valid(n) && isOpen.current) { list[i] = n; store.commit(); }
      });
    } else apply(() => p.set(obj, list[i]));
  };
  const add = () => { const n = Number(draft.value); if (valid(n) && !list.includes(n)) { list.push(n); store.commit(); } };
  return <>
    <Header title={titleOf(p, obj)} editable={ed} editing={editing} toggleEdit={toggleEdit} />
    <div className="fg4" ref={box}>
      {ro.order.map(i => (
        <button key={i} className={`ch${list[i] === cur ? ' on' : ''}`} data-f="pick" data-i={ed ? i : undefined} data-v={list[i]} style={ro.dragging === i ? { opacity: .25 } : undefined}
          onClick={() => pick(i)} onPointerDown={e => ed && editing && ro.start(e, i, box.current)}>
          {list[i]}{ed && <Del onDel={() => { list.splice(i, 1); store.commit(); }} />}
        </button>
      ))}
    </div>
    <div className="fr">
      <input className="ni" type="number" min={p.min} max={p.max} {...draft}
        onChange={e => { draft.onChange(e); const n = Number(e.target.value); if (valid(n)) apply(() => p.set(obj, n)); }} />
      {ed && <button className="ch" data-f="add" data-tip="Ekle|Bu boyutu listeye ekle." onClick={add}>+</button>}
    </div>
    {ed && editing && <EditHint />}
  </>;
}

/* ── seçenekler (hiza, ok ucu): her grup kendi başlığı altında ── */
function ChoiceFlyout({ prop: p, obj, apply }: FlyoutProps<ChoiceProp<unknown>>) {
  return <>
    <Header title={titleOf(p, obj)} />
    {p.groups.map(g => [
      g.label && <div className="fl" key={g.id + ':label'}>{g.label}</div>,
      ...Object.entries(g.options).map(([k, label]) => (
        <button key={g.id + ':' + k} className={`ar${g.get(obj) === k ? ' on' : ''}`} data-f="pick" onClick={() => apply(() => g.set(obj, k))}>
          <Icon d={g.icon(k)} />{label}
        </button>
      )),
    ])}
  </>;
}

/* ── tek eylem (görseli değiştir) ── */
function ActionFlyout({ prop: p, obj, close }: FlyoutProps<ActionProp<unknown>>) {
  return <>
    <Header title={titleOf(p, obj)} />
    <button className="ar" data-f="pick" onClick={() => { close(); p.run(obj); }}><Icon name={p.icon} />{p.actionLabel}</button>
    <div className="fn">{p.note}</div>
  </>;
}

/* ── metin (ok etiketi) ── */
function TextFlyout({ prop: p, obj, apply, focusToken }: FlyoutProps<TextProp<unknown>>) {
  const draft = useDraft(p.get(obj)), ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusToken) { ref.current?.focus(); ref.current?.select(); } }, [focusToken]);
  return <>
    <Header title={titleOf(p, obj)} />
    <input ref={ref} className="ni" type="text" maxLength={p.maxLength} placeholder={p.placeholder} {...draft}
      onChange={e => { draft.onChange(e); apply(() => p.set(obj, e.target.value)); }} />
    <div className="fn">{p.note}</div>
  </>;
}

/** Açılır pencere türleri: yeni bir tür = yeni bir bileşen + buraya bir satır. */
export const FLYOUTS: Record<AnyProp['flyout'], ComponentType<FlyoutProps>> = {
  palette: PaletteFlyout as ComponentType<FlyoutProps>,
  number: NumberFlyout as ComponentType<FlyoutProps>,
  choice: ChoiceFlyout as ComponentType<FlyoutProps>,
  action: ActionFlyout as ComponentType<FlyoutProps>,
  text: TextFlyout as ComponentType<FlyoutProps>,
};
