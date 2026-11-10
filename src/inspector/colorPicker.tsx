import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let input: HTMLInputElement | null = null;

/** Tarayıcının renk seçicisini açar. Kullanıcı hareketinin (tıklama) içinde çağrılmalı. */
export function openColorPicker(value: string, onInput: (v: string) => void, onChange?: (v: string) => void) {
  if (!input) return;
  const i = input;
  i.value = value;
  i.oninput = () => onInput(i.value);
  i.onchange = onChange ? () => onChange(i.value) : null;
  i.click();
}
export const setColorPickerTop = (top: string) => { if (input) input.style.top = top; };

/** Gizli renk girişi (seçicinin açılacağı yer için flyout'un yanında durur). */
export function ColorPickerHost() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { input = ref.current; return () => { input = null; }; }, []);
  return createPortal(<input ref={ref} type="color" id="cpick" />, document.body);
}
