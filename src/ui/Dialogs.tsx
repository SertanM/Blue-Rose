import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AskRequest } from '../editor/context';
import { useEditorEvent } from './hooks';

function Dialog({ req, done }: { req: AskRequest; done: (ok: boolean, value: string) => void }) {
  const hasInput = req.opts.input !== undefined;
  const [value, setValue] = useState(req.opts.input ?? '');
  const input = useRef<HTMLInputElement>(null), ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { (input.current ?? ok.current)?.focus(); }, []);
  return (
    <div id="dlg" onClick={e => { if (e.target === e.currentTarget) done(false, value); }}
      onKeyDown={e => { if (e.key === 'Enter') done(true, value); if (e.key === 'Escape') done(false, value); }}>
      <div className="dbox">
        <p>{req.msg}</p>
        {hasInput && <input ref={input} type="text" value={value} onChange={e => setValue(e.target.value)} />}
        <div className="dbt">
          <button onClick={() => done(false, value)}>Vazgeç</button>
          <button ref={ok} className="pri" onClick={() => done(true, value)}>{req.opts.ok || 'Tamam'}</button>
        </div>
      </div>
    </div>
  );
}

/** Uygulama içi onay / giriş pencereleri (`ask()` çağrılarını gösterir). */
export function Dialogs() {
  const [queue, setQueue] = useState<AskRequest[]>([]);
  useEditorEvent('ask', req => setQueue(q => [...q, req]));
  const finish = (req: AskRequest, ok: boolean, value: string) => {
    setQueue(q => q.filter(r => r !== req));
    const hasInput = req.opts.input !== undefined;
    req.resolve(ok ? (hasInput ? value : true) : (hasInput ? null : false));
  };
  return createPortal(queue.map((req, i) => <Dialog key={i} req={req} done={(ok, v) => finish(req, ok, v)} />), document.body);
}
