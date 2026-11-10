import { Fragment, useState } from 'react';
import { store } from '../editor/context';
import { chooseProjectFile, exportProject } from '../editor/io';
import { nav } from '../editor/navigation';
import { useEditorEvent, useRerenderOn } from './hooks';

/** Yol çubuğu: Base › Bölüm › Alt bölüm. */
function Breadcrumbs() {
  const chain = store.chain();
  return (
    <div id="bc">
      {chain.map((pg, i) => (
        <Fragment key={pg.id}>
          {i > 0 && <span className="bs">›</span>}
          <button className={i === chain.length - 1 ? 'cur' : ''} onClick={() => void nav.go(pg.id)}>{nav.pageName(pg)}</button>
        </Fragment>
      ))}
    </div>
  );
}

function Status() {
  const [text, setText] = useState('');
  useEditorEvent('status', setText);
  return <span id="st">{text}</span>;
}

function Zoom() {
  useRerenderOn('view', 'page');
  return <span id="zl">{Math.round(store.page.v.z * 100) + '%'}</span>;
}

export function TopBar() {
  useRerenderOn('page', 'doc');
  return (
    <div id="top">
      <input id="nm" data-tip="Proje adı" value={store.state.name} onChange={e => { store.state.name = e.target.value; store.commit(); }} />
      <Breadcrumbs />
      <Status />
      <span className="grow" />
      <button id="xJson" onClick={exportProject}>Dışa aktar (.json)</button><button id="iJson" onClick={chooseProjectFile}>İçe aktar</button>
      <span className="sep" />
      <Zoom />
    </div>
  );
}
