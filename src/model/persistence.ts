import type { ProjectState } from '../core/types';

/**
 * Projenin nerede saklandığını soyutlar; Store yalnızca bu arayüzü bilir (DIP).
 * Başka bir kayıt yeri (dosya sistemi, sunucu) için bu arayüzü uygulayan bir sınıf yazmak yeterli.
 */
export interface StorageAdapter {
  load(): Promise<ProjectState | null>;
  /**
   * Durumu kaydeder; başarısızsa false döner (örn. kota doldu).
   * Durumun kopyası bu çağrı içinde, eşzamanlı olarak alınmalı: kayıt sürerken durum değişebilir.
   */
  save(state: ProjectState): Promise<boolean>;
}

const isProject = (d: unknown): d is ProjectState => !!d && Array.isArray((d as ProjectState).pages) && (d as ProjectState).pages.length > 0;

/** Eski kayıt yeri (5 MB sınırlı). Artık yalnızca IndexedDB açılamazsa ve eski kayıtları aktarmak için kullanılır. */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private key: string) {}
  async load() {
    try { const d = JSON.parse(localStorage.getItem(this.key) ?? 'null'); return isProject(d) ? d : null; }
    catch { return null; }
  }
  async save(state: ProjectState) {
    try { localStorage.setItem(this.key, JSON.stringify(state)); return true; }
    catch { return false; }
  }
  /** Aktarılan kaydı yedek anahtarına taşır: tekrar aktarılmaz ama bir sorun olursa elle geri alınabilir. */
  archive() {
    try {
      const raw = localStorage.getItem(this.key); if (raw === null) return;
      localStorage.setItem(this.key + '.backup', raw); localStorage.removeItem(this.key);
    } catch { /* yedeklenemezse eski kayıt yerinde kalır; aktarım yine de tamamlanmıştır */ }
  }
}

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/**
 * IndexedDB kaydı: localStorage'ın 5 MB sınırı yoktur, sınır diskteki boş alandır.
 * İlk açılışta localStorage'daki eski proje bir kez buraya aktarılır.
 * IndexedDB kullanılamazsa (örn. bazı tarayıcıların gizli penceresi) sessizce `fallback`e döner.
 */
export class IndexedDbAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private useFallback = false;
  static readonly STORE = 'projects';
  static readonly KEY = 'current';

  constructor(private dbName: string, private fallback: LocalStorageAdapter, private idb: IDBFactory | undefined = globalThis.indexedDB) {}

  /** Kayıt şu an nerede tutuluyor (durum mesajı ve testler için). */
  get backend(): 'indexeddb' | 'localstorage' { return this.useFallback ? 'localstorage' : 'indexeddb'; }

  private open() {
    if (!this.idb) return Promise.reject(new Error('IndexedDB yok'));
    const r = this.idb.open(this.dbName, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(IndexedDbAdapter.STORE)) r.result.createObjectStore(IndexedDbAdapter.STORE); };
    return req(r);
  }

  async load() {
    try { this.db = await this.open(); }
    catch { this.useFallback = true; return this.fallback.load(); }
    const tx = this.db.transaction(IndexedDbAdapter.STORE, 'readonly');
    const d = await req(tx.objectStore(IndexedDbAdapter.STORE).get(IndexedDbAdapter.KEY));
    if (isProject(d)) return d;
    // İlk açılış: eski localStorage kaydını aktar; ancak başarıyla yazıldıysa eskisini yedeğe kaldır.
    const old = await this.fallback.load();
    if (old && await this.save(old)) this.fallback.archive();
    return old;
  }

  save(state: ProjectState): Promise<boolean> {
    if (this.useFallback) return this.fallback.save(state);
    // put() durumu eşzamanlı olarak kopyalar (structured clone); veritabanı henüz açık değilse kopyayı biz alırız.
    if (!this.db) { const copy = structuredClone(state); return this.open().then(db => { this.db = db; return this.save(copy); }, () => false); }
    return new Promise(res => {
      try {
        const tx = this.db!.transaction(IndexedDbAdapter.STORE, 'readwrite');
        tx.objectStore(IndexedDbAdapter.STORE).put(state, IndexedDbAdapter.KEY);
        tx.oncomplete = () => res(true);
        tx.onerror = tx.onabort = () => res(false);   // QuotaExceededError dahil
      } catch { res(false); }
    });
  }
}

/** Testler için bellekte saklayan sürüm. */
export class MemoryAdapter implements StorageAdapter {
  constructor(public data: ProjectState | null = null) {}
  async load() { return this.data ? structuredClone(this.data) : null; }
  async save(state: ProjectState) { this.data = structuredClone(state); return true; }
}
