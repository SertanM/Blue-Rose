import { useEffect, useRef } from 'react';
import { dragFromTool } from '../editor/io';
import { currentTarget } from '../editor/target';
import { Inspector } from '../inspector/Inspector';
import { useRerenderOn } from './hooks';
import { Icon } from './Icon';
import { BUTTON_TOOLS, DROP_TOOLS } from './tools';

/** Sol çubuk: araçlar; bir şey seçiliyken yerini özellik paneline bırakır. */
export function SideBar() {
  useRerenderOn('selection', 'page');
  const open = !!currentTarget(), side = useRef<HTMLDivElement>(null), bead = useRef<HTMLDivElement>(null);

  /** Üzerine gelinen aracın yanında beliren "boncuk" çıkıntısı. */
  const showBead = (btn: Element) => {
    const el = bead.current!, r = btn.getBoundingClientRect(), s = side.current!.getBoundingClientRect(), y = (r.top + r.height / 2 - s.top) + 'px';
    if (!el.classList.contains('on')) { el.style.transition = 'none'; el.style.top = y; void el.offsetWidth; el.style.transition = ''; }
    else el.style.top = y;
    el.classList.add('on');
  };
  const hideBead = () => bead.current?.classList.remove('on');
  useEffect(() => { if (open) hideBead(); }, [open]);

  return (
    <div id="side" ref={side} className={open ? 'open' : ''}>
      <div id="tools"
        onPointerOver={e => { const t = (e.target as Element).closest('.tool[data-t]'); if (t) showBead(t); else hideBead(); }}
        onPointerLeave={hideBead}>
        {DROP_TOOLS.map(t => (
          <button key={t.kind} className="tool" data-t={t.kind} data-tip={t.tip} data-side="r" onPointerDown={e => dragFromTool(e.nativeEvent, t)}>
            <i className="tv"><Icon name={t.icon} /></i>
          </button>
        ))}
        <div className="sp" />
        {BUTTON_TOOLS.map(t => (
          <button key={t.id} className="tool btn" id={t.id} data-tip={t.tip} data-side="r" onClick={t.run}>
            <i className="tv"><Icon name={t.icon} /></i>
          </button>
        ))}
      </div>
      <Inspector />
      <div id="bead" ref={bead}>
        <svg viewBox="0 0 22 72" width="22" height="72">
          <path className="bf" d="M0 0C0 9 18 4 18 36C18 68 0 63 0 72Z" /><path className="bl" d="M0 0C0 9 18 4 18 36C18 68 0 63 0 72" />
        </svg>
      </div>
    </div>
  );
}
