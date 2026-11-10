import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/topbar.css';
import './styles/canvas.css';
import './styles/arrows.css';
import './styles/cards.css';
import './styles/rich.css';
import './styles/sidebar.css';
import './styles/inspector.css';
import './styles/ui.css';
import { store } from './editor/context';
import { App } from './ui/App';
import icon64 from './assets/icon-64.png';
import icon180 from './assets/icon-180.png';

// Site simgesi: Blue Rose logosu. Derlemede dosyanın içine gömülür, çevrimdışı da görünür.
for (const [rel, sizes, href] of [['icon', '64x64', icon64], ['apple-touch-icon', '180x180', icon180]])
  document.head.appendChild(Object.assign(document.createElement('link'), { rel, sizes, href, type: 'image/png' }));

// Kayıtlı proje (IndexedDB) yüklendikten sonra arayüz çizilir.
// StrictMode kullanılmıyor: tuval motoru DOM'u doğrudan yönetir ve efektlerin iki kez çalışmasını istemeyiz.
void store.init().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
  // Tarayıcıdan, disk dolarken bu sitenin verisini silmemesini iste (Chrome sessizce karar verir, Firefox sorabilir).
  void navigator.storage?.persist?.();
});
