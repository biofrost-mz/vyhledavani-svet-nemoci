# Vakcinační mapa světa – technika + funkčnost (v20)

Datum: 2026-05-13  
Rozsah: kompletní implementace 8 technických/funkčních úkolů + prevence budoucích problémů.

## 1) Co bylo cílem

Tento balík změn řeší 8 prioritních oblastí:

1. Race conditions při asynchronním načítání filtrů nemocí.
2. Odolnější cache detailů destinací (bez "poisoning" nulou).
3. Oprava ořezávání detail panelu (max-height hack).
4. Reakce mapy na změnu viewportu/orientace.
5. Oprava duplicitních `id` a robustnější obsluha akcí v map overlay.
6. Oprava chybných mobilních CSS selektorů zoom ovládání.
7. Bezpečnější externí odkazy (`noopener noreferrer`).
8. Backend-ready strategie filtrování nemocí (preferovaná indexace z API, fallback detail scraping).

### 1.1 Stav bodů 3 až 8 (aktuální audit)

3. Detail panel: hotovo (`#pnl` už nepoužívá `max-height` ořez, obsah se neořezává).  
4. Resize/orientation: hotovo (debounced reprojekce + ochrana proti duplicitní registraci listenerů).  
5. Duplicitní `id`: hotovo (přechod na `data-mi-action` + event delegation).  
6. Mobilní zoom selektory: hotovo (`#zc`, `.zbtn`).  
7. Externí odkazy: hotovo (všechny `_blank` mají `rel=\"noopener noreferrer\"`).  
8. Backend-ready filtry nemocí: hotovo (API index / row-seed / fallback detail scraping).

---

## 2) Přehled změn podle souborů

### `assets/js/app.js`

#### 2.1 Race condition ochrana (filtry nemocí)
- Přidáno:
  - `requestedDisease`
  - `filterRequestToken`
- `setDiseaseFilter()` nyní:
  - generuje token pro každou novou volbu filtru,
  - ignoruje výsledky starších requestů (`if(token!==filterRequestToken)return;`),
  - odděluje požadovaný stav od aktivního vykresleného stavu.
- Výsledek: rychlé přepínání filtrů už nepřepisuje UI zastaralými daty.

#### 2.2 Robustní cache detailů destinací
- Původní jednoduchá cache `slug -> data/null` byla nahrazena stavovou cache:
  - `detailCache: Map<slug, {status:'ok'|'error', ts, data?}>`
- Přidáno:
  - `DETAIL_ERROR_RETRY_MS` (aktuálně 90s)
  - `getCachedDetailState()`, `getCachedDetail()`, `setCachedDetailSuccess()`, `setCachedDetailError()`
- `fetchCountryDetail()`:
  - neukládá "ok" hodnotu `null`,
  - při chybě ukládá jen error stav s timestampem,
  - po TTL dovolí retry.
- Výsledek: dočasná chyba API už nepoškodí celý zbytek session.

#### 2.3 Backend-ready index nemocí (hybridní strategie)
- Přidána vícevrstvá strategie získání `disease -> destination ids`:
  1. existující `diseaseIndex` v paměti,
  2. volitelný backend endpoint (`DISEASE_INDEX_API_URL`),
  3. seed z polí v API seznamu destinací (`DISEASE_INDEX_ROW_FIELDS`),
  4. fallback přes detail scraping destinací.
- Přidáno:
  - `toDiseaseKey()`
  - `collectDiseaseTokens()`
  - `extractDiseaseKeysFromRow()`
  - `resolveApiRowDestinationIds()`
  - `upsertDiseaseIndex()`
  - `mergeDiseaseIndexPayload()`
  - `seedDiseaseIndexFromApiRows()`
  - `loadDiseaseIndexFromApiIfConfigured()`
  - `ensureDiseaseIndex()`
- `initMap()` nyní přednačítá vazby z API seznamu (pokud jsou dostupné tagy).
- Výsledek: výkonově i architektonicky připraveno na serverovou indexaci bez nutnosti masivního klientského scrapingu.

#### 2.4 Přepočet mapy při resize/orientation
- Přidáno:
  - `debounce()`
  - `handleMapResize()`
  - `debouncedHandleMapResize`
  - `window.addEventListener('resize', ...)`
  - `window.addEventListener('orientationchange', ...)`
- Přepočet obsahuje:
  - `viewBox`, projekci (`scale + translate`), path `d`, marker pozice,
  - reset zoom extent a transform,
  - obnovu zvýraznění a fokusu na aktuálně vybranou destinaci.
- Výsledek: mapa se nedegraduje při změně viewportu (desktop/mobile rotate).

#### 2.5 Oprava duplicitního `id` + event delegation v map overlay
- Nahrazeno:
  - `id="mi-more-detail"` -> `data-mi-action="scroll-detail"`
  - `id="mi-close"` -> `data-mi-action="close"`
  - `id="mi-scroll-detail"` -> `data-mi-action="scroll-detail"`
- `renderMapInfo()` používá jednotný delegovaný handler `box.onclick`.
- Výsledek: bez kolizí `id`, stabilní klikací chování i při opakovaném renderu.

#### 2.6 Zlepšení konzistence hover logiky filtru
- `hoverColorForId()` nyní používá `diseaseContainsMapId()` (stejná logika jako fill),
  takže fungují i mapované/virtual destinace a ruční include/exclude override.

#### 2.7 Detail panel bez ořezového hacku (JS část)
- `closePanel()` už nepoužívá časovaný `setTimeout` pro mazání obsahu.
- Panel se zavírá deterministicky (`remove class`, `innerHTML=''`).

#### 2.8 Hardening
- `setDiseaseFilter()` ošetřuje neznámý klíč filtru bezpečným fallbackem na `all`.

---

### `assets/css/map.css`

#### 2.9 Panel bez max-height ořezu
- Změna:
  - `#pnl` z `max-height + overflow:hidden` na `display:none/block`.
- Výsledek: detail už neodřezává delší obsah.

#### 2.10 Oprava mobilních zoom selektorů
- Opraveno:
  - `.zc` -> `#zc`
  - `.zb` -> `.zbtn`
- Výsledek: mobilní posunutí/rozměry zoom tlačítek se reálně aplikují.

---

### `index.html`

#### 2.11 Bezpečnější externí odkazy
- Všechny `target="_blank"` mají nyní `rel="noopener noreferrer"`.
- Opraven i odkaz v hlavičce, který `rel` neměl.

---

### `assets/js/config.js`

#### 2.12 Konfigurace pro backendový index nemocí
- Přidáno:
  - `const DISEASE_INDEX_API_URL = null;`
  - `const DISEASE_INDEX_ROW_FIELDS = [...]`
- Výsledek: možnost zapnout serverový index bez zásahu do aplikační logiky.

---

## 3) Jak funguje nová strategie filtrů (zdroje dat)

Při výběru nemoci:

1. Aplikace zkusí použít již hotový index v paměti.
2. Pokud není, zkusí volitelný backend endpoint (`DISEASE_INDEX_API_URL`).
3. Pokud endpoint není nebo nic nevrátí, použije seed z API seznamu destinací (`DISEASE_INDEX_ROW_FIELDS`).
4. Pokud stále není dostupné, provede fallback přes detail scraping destinací.

Tím je zajištěna kompatibilita se stávající API i plynulý přechod na budoucí server-side indexaci.

---

## 4) Provozní poznámky

### 4.1 Cache retry okno
- Pokud detail destinace selže, retry je blokován po dobu `DETAIL_ERROR_RETRY_MS`.
- Aktuálně: `90 000 ms`.
- Doporučení: v produkci dle reálné stability API 30–120 s.

### 4.2 Volitelný backend endpoint
- Pokud budete mít endpoint s indexem nemocí, nastavte v `assets/js/config.js`:

```js
const DISEASE_INDEX_API_URL = 'https://...';
```

- Podporované payload tvary:
  - objekt: `{ "yellow-fever": [818, 404, ...], ... }`
  - objekt s wrapperem: `{ diseases: { "yellow-fever": [...] } }`
  - pole záznamů: `[{ key: 'yellow-fever', ids: [...] }, ...]`

---

## 5) Regression checklist (doporučeno po nasazení)

1. Rychlé přepínání více filtrů za sebou (UI nesmí „skákat zpět“).
2. Simulace pomalé sítě / chyb API detailu (po chybě musí být možný retry po TTL).
3. Dlouhé detailní doporučení (panel nesmí ořezávat).
4. Desktop resize + mobile rotation (mapa/markery/zvýraznění zůstávají konzistentní).
5. Kliknutí na „… a X dalších“ v overlay i při opakovaném renderu.
6. Mobilní zoom tlačítka mají správné umístění a rozměr.
7. Odkazy v nové kartě mají správný `rel`.
8. Filtr funguje i bez backend index endpointu (fallback).

---

## 6) Známá omezení

1. Fallback scraping detailů je stále nákladnější než čistý backendový index.
2. `resize/orientation` listener se registruje při inicializaci mapy (u SPA hot-reload scénářů doporučeno hlídat duplicitní binding).
3. Přesnost seedování z API seznamu závisí na kvalitě polí definovaných v `DISEASE_INDEX_ROW_FIELDS`.

---

## 7) Doporučené další kroky

1. Přidat lehké E2E smoke testy (Playwright) pro filtry, resize a panel.
2. Přesunout finální indexaci nemocí plně na backend (garantovaný dataset + verze).
3. Dodat telemetry pro měření času prvního filtru a hit-rate cache.
4. Postupně refaktorovat CSS vrstvu (v11–v19) do jedné čisté verze bez přebíjení přes `!important`.
