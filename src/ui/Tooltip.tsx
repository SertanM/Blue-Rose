import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** `data-tip="Başlık|Açıklama"` taşıyan her öğe için ipucu (React ya da tuval tarafından çizilmiş olması fark etmez). */
export function Tooltip() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    let target: HTMLElement | null = null, suppressed = false;
    const place = (m: PointerEvent) => {
      const t = target; if (!t) return;
      if (t.dataset.side === 'r') {
        const r = t.getBoundingClientRect();
        el.style.left = t.closest('.tool[data-t]') ? '92px' : '76px';
        el.style.top = (r.top + r.height / 2 - el.offsetHeight / 2) + 'px'; return;
      }
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = m.clientX + 14, y = m.clientY + 20;
      if (x + w > innerWidth - 8) x = m.clientX - w - 14;
      if (y + h > innerHeight - 8) y = m.clientY - h - 16;
      el.style.left = Math.max(4, x) + 'px'; el.style.top = Math.max(4, y) + 'px';
    };
    const over = (e: PointerEvent) => {
      if (suppressed) return;
      const t = (e.target as Element).closest?.<HTMLElement>('[data-tip]') ?? null;
      if (document.querySelector('#fly.on') && t?.closest('#insp')) { el.classList.remove('on'); target = null; return; }   // pencere açıkken panel ipuçları görünmez
      if (t === target) return;
      target = t;
      if (!t) { el.classList.remove('on'); return; }
      const [title, desc] = t.dataset.tip!.split('|');
      el.textContent = ''; el.appendChild(Object.assign(document.createElement('b'), { textContent: title }));
      if (desc) el.appendChild(Object.assign(document.createElement('span'), { textContent: desc }));
      el.classList.toggle('r', t.dataset.side === 'r');
      place(e); el.classList.add('on');
    };
    const move = (e: PointerEvent) => { if (!suppressed) place(e); };
    const down = () => { suppressed = true; target = null; el.classList.remove('on'); };
    const up = () => { suppressed = false; };
    addEventListener('pointerover', over); addEventListener('pointermove', move);
    addEventListener('pointerdown', down, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    return () => {
      removeEventListener('pointerover', over); removeEventListener('pointermove', move);
      removeEventListener('pointerdown', down, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
    };
  }, []);
  return createPortal(<div id="tip" ref={ref} />, document.body);
}
