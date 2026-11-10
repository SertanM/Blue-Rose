# Blue Rose

Oyun ekipleri için çevrimdışı çalışan GDD (oyun tasarım dokümanı) tahtası. TypeScript + React + Vite.

## Çalıştırma

```bash
npm install        # ilk seferde
npm run dev        # geliştirme: http://localhost:5173
npm run build      # dist/index.html → tek dosya, çift tıklayınca çevrimdışı açılır
npm test           # birim testleri (Vitest)
npm run typecheck  # yalnızca tip denetimi
```

## Kayıt

Proje tarayıcının IndexedDB veritabanında (`blue-rose`) tutulur; sınır diskteki boş alandır (eski localStorage'ın 5 MB sınırı yok).
Eski sürümden kalan localStorage kaydı ilk açılışta bir kez aktarılır, eskisi `gdd-board.backup` anahtarında yedek olarak kalır.
IndexedDB açılamazsa uygulama localStorage ile çalışmaya devam eder ve durum çubuğunda bunu söyler.

> Geliştirme sunucusu (`localhost`) ile çift tıklanan dosya (`file://`) tarayıcıda ayrı kayıt alanları kullanır.
> Birinden diğerine geçerken çalışmanı **Dışa aktar / İçe aktar** ile taşı.

## Klasörler

```
src/
  core/        Saf kod: tipler, sabitler, geometri, yardımcılar, olay yayıcı (DOM'suz, test edilebilir)
  model/       Veri: Store, kayıt adaptörü (StorageAdapter), migration, seçim, geri al/ileri al
  cards/       Kart türleri kayıt defteri
  editor/      Tuval motoru: kart/ok katmanları, sürükleme, komutlar, gezinti, kısayollar, olay bağlama
  inspector/   Özellik paneli (React): özellik kayıt defteri + açılır pencere türleri
  ui/          Arayüz (React): üst çubuk, araç çubuğu, diyaloglar, ipucu, simgeler
  styles/      CSS
tests/         Birim testleri
```

Bağımlılık yönü: `core` → `model` → `editor` → `inspector` / `ui`. Çekirdek arayüzü tanımaz;
`editor/context.ts` içindeki `events` üzerinden haber verir, React bileşenleri bu olaylara abone olur.

Tuval (kartlar ve oklar) bilerek React dışında tutulur: sürükleme ve yakınlaştırma her karede çalışır,
doğrudan DOM güncellemesi burada hem daha hızlı hem daha basittir. Paneller, çubuklar ve pencereler React'tir.

## Yeni bir şey eklemek

| Ne | Nereye |
|---|---|
| Kart türü | `src/cards/registry.ts` → `CARD_TYPES`'a bir kayıt (boyut, renk, bayraklar, isteğe bağlı hook'lar) |
| Etkileşimli kart (liste, tablo gibi) | `src/cards/` altında `renderBody` yazan bir dosya (örnek: `todo.ts`, `table.ts`); tıklanınca kartı sürüklememesi gereken öğelere `ctl` sınıfı |
| Araç çubuğu düğmesi | `src/ui/tools.ts` → `DROP_TOOLS` (sürükle-bırak) ya da `BUTTON_TOOLS` (tıkla) |
| Panel özelliği | `src/inspector/props.ts` → `PROPS`'a bir kayıt (mevcut pencere türlerinden birini seçerek) |
| Yeni pencere türü | `src/inspector/flyouts.tsx` → bileşen + `FLYOUTS`'a bir satır, `props.ts`'e tipi |
| Klavye kısayolu | `src/editor/shortcuts.ts` → `SHORTCUTS`'a bir satır |
| Başka bir kayıt yeri (dosya sistemi, sunucu) | `src/model/persistence.ts` → `StorageAdapter`'ı uygulayan bir sınıf, `editor/context.ts`'te değiştir |
| Kayıt biçimi değişikliği | `src/core/types.ts` + eski dosyalar için `src/model/migrate.ts` |
