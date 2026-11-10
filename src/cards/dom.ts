/**
 * Kart gövdeleri için küçük DOM kurucu. Metinler her zaman `textContent` / `value` ile yazılır,
 * kullanıcı verisi asla HTML olarak yorumlanmaz.
 */
type Props = Record<string, unknown> & { class?: string; text?: string; on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: (Node | null | false | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v as object)) el.addEventListener(ev, fn as EventListener);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.appendChild(c);
  return el;
}

/** Kartta etkileşimli öğe: tıklamak kartı sürüklemez, yalnızca seçer (bkz. editor/bindings.ts). */
export const CTL = 'ctl';
