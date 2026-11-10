import type { Arrow, Card } from '../core/types';
import { arrows } from './arrowLayer';
import { cards } from './cardLayer';
import { selection, store } from './context';

export type Target = { kind: 'card'; obj: Card } | { kind: 'arrow'; obj: Arrow };

/** Seçili tek nesne ve türü (kart/ok); yoksa null. */
export function currentTarget(): Target | null {
  const id = selection.single; if (!id) return null;
  const c = store.card(id); if (c) return { kind: 'card', obj: c };
  const a = store.arrow(id); return a ? { kind: 'arrow', obj: a } : null;
}

/** Hedefte bir değişiklik yapar, görünümünü günceller ve kaydı planlar (özellik panelinin tek yazma noktası). */
export function updateTarget(t: Target, change: () => void) {
  change();
  if (t.kind === 'card') cards.restyle(t.obj); else arrows.update(t.obj);
  store.commit();
}
