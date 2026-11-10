export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.();
export const isTyping = (el: Element | null) => /^(TEXTAREA|INPUT|SELECT)$/.test(el?.tagName || '');
/** Kartın içindeki bir yazı alanı mı (notun metni ya da tablo hücresi, madde gibi giriş kutuları). */
export const isCardField = (el: Element | null): el is HTMLTextAreaElement | HTMLInputElement =>
  !!el?.closest('.card') && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox'));
/** Arka plan rengi üzerinde okunur yazı rengi. */
export const contrast = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) > 150 ? '#111' : '#fff';
};
export const SVG_NS = 'http://www.w3.org/2000/svg';

export interface PointerTrack {
  threshold?: number;
  onStart?: (m: PointerEvent) => void;
  onMove?: (dx: number, dy: number, m: PointerEvent) => void;
  onEnd?: (started: boolean, m: PointerEvent) => void;
}

/** Sürükleme düzeneğinin tek kopyası: eşik, hareket ve bırakma tek yerde yönetilir. */
export function trackPointer(ev: { clientX: number; clientY: number }, { threshold = 0, onStart, onMove, onEnd }: PointerTrack) {
  const sx = ev.clientX, sy = ev.clientY;
  let started = false;
  const move = (m: PointerEvent) => {
    const dx = m.clientX - sx, dy = m.clientY - sy;
    if (!started) {
      if (Math.hypot(dx, dy) < threshold) return;
      started = true; onStart?.(m);
    }
    onMove?.(dx, dy, m);
  };
  const up = (m: PointerEvent) => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    onEnd?.(started, m);
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

/** Zamana dayalı animasyon; ilerleme 0..1 arası `ease` ile verilir. */
export function tween(ms: number, fn: (eased: number, linear: number) => void, ease = (t: number) => 1 - (1 - t) ** 3) {
  return new Promise<void>(res => {
    const t0 = performance.now();
    (function frame(now: number) {
      const k = Math.min(1, (now - t0) / ms);
      fn(ease(k), k);
      k < 1 ? requestAnimationFrame(frame) : res();
    })(t0);
  });
}
