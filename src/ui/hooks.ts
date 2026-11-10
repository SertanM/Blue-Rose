import { useEffect, useReducer, useRef, useState } from 'react';
import { events, type EditorEvents } from '../editor/context';

type EventName = keyof EditorEvents;

/** Verilen editör olaylarından biri gelince bileşeni yeniden çizer. */
export function useRerenderOn(...names: EventName[]) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const key = names.join(',');
  useEffect(() => {
    const offs = key.split(',').map(n => events.on(n as EventName, () => force()));
    return () => offs.forEach(off => off());
  }, [key]);
}

/** Tek bir editör olayına abone olur. */
export function useEditorEvent<K extends EventName>(name: K, fn: (p: EditorEvents[K]) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => events.on(name, p => ref.current(p)), [name]);
}

/**
 * Giriş kutusu için taslak değer: kullanıcı yazarken dışarıdaki değer kutuyu ezmez,
 * odak dışındayken dışarıdaki değer değişirse kutu onu gösterir.
 */
export function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return {
    value: draft,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onFocus: () => { focused.current = true; },
    onBlur: () => { focused.current = false; setDraft(String(value)); },
  };
}
