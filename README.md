# Mapa očkování a zdravotních rizik – Avenier

Interaktivní mapa světa s cestovními doporučeními k očkování a zdravotním rizikům pro ~230 destinací.
Čistě statický web (HTML + vanilla JS + d3/topojson) nad veřejným Avenier API
`https://www.ockovacicentrum.cz/api/country`. Produkce: **https://vyhledavani-svet-nemoci.vercel.app/**

- Historie verzí (v19 → v24.11): [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Stav projektu, architektura, rizika a úkoly: [`docs/STAV-A-UKLID-2026-10.md`](docs/STAV-A-UKLID-2026-10.md)
- Starší technické poznámky: [`docs/TECHNIKA_A_FUNKCNOST_V20.md`](docs/TECHNIKA_A_FUNKCNOST_V20.md),
  [`docs/OBSAH_UX_A_PRAVNI_V21.md`](docs/OBSAH_UX_A_PRAVNI_V21.md), [`docs/LAYOUT_VARIANTY_V2.md`](docs/LAYOUT_VARIANTY_V2.md)

## Spuštění

Bez instalace závislostí (stačí Node.js 20+):

```sh
node scripts/serve.mjs          # http://127.0.0.1:8777/
node scripts/verify-app.mjs     # statická kontrola aplikace a dat (běží i v CI)
```

Přes `file://` tato verze nefunguje (fetch JSON dat); verzi otevíratelnou z disku má fork
[`avenier-destination-map`](https://github.com/biofrost-mz/avenier-destination-map).

## Struktura

| Cesta | Obsah |
|---|---|
| `index.html` | stránka mapy, SEO/OG metadata, cache-buster `?v=` u assetů |
| `assets/js/config.js` | konfigurace nemocí, filtrů, zdrojů (CDC Yellow Book, WHO…) a textů |
| `assets/js/app.js` | celá logika: načítání API, cache detailů, filtry, trasa, export PNG, tisk, sdílení |
| `assets/data/disease-index.json` | předpočítaný index nemocí × destinací (generuje GitHub Action) |
| `assets/vendor/` | d3, topojson, `countries-50m.json` (mapový podklad) |
| `share/*.html` + `assets/img/share/` | statické stránky s OG náhledy pro sdílení jednotlivých filtrů |
| `scripts/generate-disease-index.mjs` | stáhne všech 230 detailů z API a sestaví index |
| `scripts/generate-share-pages.mjs` | vygeneruje `share/*.html` |
| `scripts/verify-app.mjs` | kontrola konzistence (destinace, nemoci, verze, lokální závislosti) |

## Automatizace (GitHub Actions)

- **Aktualizace indexu nemocí** (`update-disease-index.yml`) – denně 03:17 UTC: vygeneruje index,
  ověří aplikaci a pokud se data změnila, commitne je do `main` (Vercel pak nasadí).
- **Kontrola aplikace** (`verify.yml`) – na každý push do `main` a PR.
