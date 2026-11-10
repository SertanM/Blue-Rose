type Listener = (prev: Set<string>, next: Set<string>) => void;

/** Seçili kart ve ok kimlikleri. Değişince dinleyicilere bildirir. */
export class Selection {
  ids = new Set<string>();
  private listeners: Listener[] = [];
  on(fn: Listener) { this.listeners.push(fn); }
  set(ids: Iterable<string>) { const prev = this.ids; this.ids = new Set(ids); this.listeners.forEach(f => f(prev, this.ids)); }
  toggle(id: string) { const n = new Set(this.ids); if (!n.delete(id)) n.add(id); this.set(n); }
  clear() { if (this.size) this.set([]); }
  has(id: string) { return this.ids.has(id); }
  get size() { return this.ids.size; }
  /** Tek öğe seçiliyse kimliği, değilse null. */
  get single() { return this.ids.size === 1 ? [...this.ids][0] : null; }
  prune(exists: (id: string) => boolean) { const keep = [...this.ids].filter(exists); if (keep.length !== this.size) this.set(keep); }
}
