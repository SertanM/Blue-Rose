/** Küçük, tipli olay yayıcı. Çekirdek katman arayüzü tanımadan haber verir (DIP). */
export class Emitter<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<(p: never) => void>>();
  on<K extends keyof E>(k: K, fn: (p: E[K]) => void): () => void {
    const set = this.map.get(k) ?? this.map.set(k, new Set()).get(k)!;
    set.add(fn as (p: never) => void);
    return () => { set.delete(fn as (p: never) => void); };
  }
  emit<K extends keyof E>(k: K, ...p: E[K] extends void ? [] : [E[K]]) {
    this.map.get(k)?.forEach(fn => (fn as (p: unknown) => void)(p[0]));
  }
}
