import { memo, useLayoutEffect, useRef } from 'react';
import { startEditor } from '../editor';
import { Dialogs } from './Dialogs';
import { SideBar } from './SideBar';
import { Tooltip } from './Tooltip';
import { TopBar } from './TopBar';

/** Tuvalin iskeleti. React yalnızca bir kez çizer; içini tuval motoru yönetir (bu yüzden asla yeniden çizilmez). */
const Canvas = memo(function Canvas() {
  const canvas = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), links = useRef<SVGGElement>(null);
  useLayoutEffect(() => { startEditor({ canvas: canvas.current!, world: world.current!, svgRoot: svg.current!, linkLayer: links.current! }); }, []);
  return (
    <div id="canvas" ref={canvas}>
      <div id="world" ref={world}>
        <svg id="ls" ref={svg}>
          <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8e95a3" /></marker></defs>
          <g id="lg" ref={links} />
        </svg>
      </div>
    </div>
  );
}, () => true);

export function App() {
  return <>
    <TopBar />
    <SideBar />
    <Canvas />
    <Dialogs />
    <Tooltip />
  </>;
}
