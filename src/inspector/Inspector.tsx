import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { blurActive } from '../core/utils';
import { selection } from '../editor/context';
import { currentTarget, updateTarget } from '../editor/target';
import { useEditorEvent, useRerenderOn } from '../ui/hooks';
import { Icon } from '../ui/Icon';
import { ColorPickerHost, setColorPickerTop } from './colorPicker';
import { FLYOUTS } from './flyouts';
import { labelOf, PROP, PROPS, type AnyProp, type DotView } from './props';

function Dot({ view, nb }: { view: DotView; nb?: boolean }) {
  return (
    <span className={`dot${nb ? ' nb' : ''}${view.has ? ' has' : ''}`} style={view.style}>
      {view.icon ? <Icon name={view.icon} /> : view.paths ? <Icon d={view.paths} /> : view.text}
    </span>
  );
}

interface OpenState { id: string; btn: HTMLElement }

/** Seçili kartın / okun özellik paneli: kayıt defterindeki özelliklerden kurulur. */
export function Inspector() {
  useRerenderOn('selection', 'page', 'doc');
  const t = currentTarget(), key = t?.obj.id ?? null;
  const [open, setOpen] = useState<OpenState | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const btns = useRef(new Map<string, HTMLElement>());
  const fly = useRef<HTMLDivElement>(null);
  const isOpen = useRef(false);
  const [shown, setShown] = useState<string | null>(null);   // kapanırken içerik solarak kaybolsun diye son açılan özellik
  isOpen.current = !!open;

  const close = () => setOpen(null);
  const openProp = (id: string, focus = false) => {
    const btn = btns.current.get(id); if (!btn) return;
    setOpen({ id, btn }); setShown(id); setEditing(false); setFocusToken(n => focus ? n + 1 : 0);
  };
  const toggle = (id: string) => (open?.id === id ? close() : openProp(id));

  useEffect(() => { close(); }, [key]);   // hedef değişti: panel yeniden kurulur, pencere kapanır
  useEditorEvent('openProp', id => setPending(id));
  useEffect(() => {   // oka çift tıklama: panel çizildikten sonra pencereyi aç ve yazı kutusuna odaklan
    if (!pending || !btns.current.has(pending)) return;
    if (open?.id !== pending) openProp(pending, true); else setFocusToken(n => n + 1);
    setPending(null);
  }, [pending, key]);
  useEffect(() => {
    if (!open) return;
    const down = (ev: PointerEvent) => { if (!(ev.target as Element).closest('#fly,#insp,#dlg')) close(); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    addEventListener('pointerdown', down, true); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', down, true); removeEventListener('keydown', esc); };
  }, [open]);
  useLayoutEffect(() => {   // pencereyi açan düğmenin hizasına, ekran içinde kalacak şekilde yerleştir
    if (!open || !fly.current) return;
    const r = open.btn.getBoundingClientRect(), h = fly.current.offsetHeight;
    const top = Math.max(56, Math.min(r.top + r.height / 2 - h / 2, innerHeight - h - 8)) + 'px';
    fly.current.style.top = top; setColorPickerTop(top);
  });

  const props = t ? PROPS.filter(p => p.on === t.kind && (p.applies?.(t.obj) ?? true)) : [];
  const shownProp: AnyProp | undefined = shown ? PROP[shown] : undefined;
  const Kind = shownProp && t && props.includes(shownProp) ? FLYOUTS[shownProp.flyout] : null;

  // Düğmeler sırayla kayarak gelir; kaç düğme olursa olsun dizi aynı sürede (260 ms) tamamlanır.
  const step = Math.min(65, 260 / Math.max(1, props.length));
  const delay = (i: number) => ({ animationDelay: `${i * step}ms` });

  return <>
    <div id="insp" onMouseDown={e => e.preventDefault()}>
      {t && <button key={key + ':close'} className="ix" data-side="r" data-tip="Kapat|Araçlara geri dön." onClick={() => { blurActive(); selection.clear(); }}>✕</button>}
      {t && props.map((p, i) => (
        <button key={key + ':' + p.id} style={delay(i + 1)} ref={el => { if (el) btns.current.set(p.id, el); else btns.current.delete(p.id); }}
          className={`ib${open?.id === p.id ? ' open' : ''}`} data-k={p.id} data-side="r" data-tip={p.tip} onClick={() => toggle(p.id)}>
          <Dot view={p.dot(t.obj)} nb={p.nb} /><small>{labelOf(p, t.obj)}</small>
        </button>
      ))}
    </div>
    {createPortal(
      <div id="fly" ref={fly} className={`${open ? 'on' : ''}${editing ? ' edit' : ''}`}
        onMouseDown={e => { if ((e.target as Element).tagName !== 'INPUT') e.preventDefault(); }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.target as Element).tagName === 'INPUT') { (e.target as HTMLElement).blur(); close(); } }}>
        {Kind && t && <Kind key={shown + ':' + key} prop={shownProp!} obj={t.obj} editing={editing} toggleEdit={() => setEditing(v => !v)} close={close} isOpen={isOpen}
          focusToken={focusToken} apply={change => updateTarget(t, change)} />}
      </div>,
      document.body,
    )}
    <ColorPickerHost />
  </>;
}
