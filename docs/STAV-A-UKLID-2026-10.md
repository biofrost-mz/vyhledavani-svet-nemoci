# Vyhledávání – svět nemocí (mapa očkování Avenier) – stav a úklid (říjen 2026)

## Shrnutí

| | |
|---|---|
| Účel | Veřejná mapa světa: doporučená/povinná očkování a zdravotní rizika podle destinace, filtry nemocí, trasa |
| Stack | statické HTML, vanilla JS (`app.js` ~4 900 řádků), d3 v7, topojson; žádný build |
| Data | živé Avenier API (`ockovacicentrum.cz/api/country`) + předpočítaný `disease-index.json` |
| Hosting | Vercel – https://vyhledavani-svet-nemoci.vercel.app/ |
| Viditelnost repa | **veřejné** |
| Aktuální verze | v24.11 (srpen 2026); od té doby jen automatické aktualizace indexu |
| CI | denní aktualizace indexu + kontrola aplikace; poslední běhy zelené |
| Fork | `avenier-destination-map` (soukromý, v24.12, předání externím webařům) |

## Architektura

1. Při načtení stránky se stáhne seznam destinací z API; detaily se dotahují líně a cachují v `localStorage`
   (6 h TTL, retry po chybě, timeout 12 s, bez veřejných CORS proxy).
2. Filtry nemocí (žlutá zimnice, malárie, dengue, vzteklina, …) kombinují předpočítaný index
   s podpůrnými seznamy (CDC Yellow Book 2026) z `config.js`; kombinace filtrů = sjednocení.
3. Vybraná destinace / trasa / filtr se propisuje do URL (`?filtr=…`), sdílení přes `share/*.html` s OG obrázky.
4. Export mapy do PNG (canvas), tisk (dočasně skrytý), ovládání klávesnicí.
5. GitHub Action každou noc přegeneruje index; pokud se změní, commitne do `main` a Vercel nasadí.

## Provedený úklid (větev `claude/awesome-ride-6kb6m0`)

- README přepsán na přehled projektu (účel, spuštění, struktura, automatizace).
- 340 řádků changelogu přesunuto z README do [`docs/CHANGELOG.md`](CHANGELOG.md) a sjednoceny nadpisy.
- GitHub Actions sjednoceny s forkem na `actions/checkout@v7` a `actions/setup-node@v7`
  (fork s nimi běží denně bez chyby; staré `@v4` běží na zastaralém Node 20 runtime).

## Zjištěná rizika a dluh

1. **Dvě kopie stejné aplikace** (`vyhledavani-svet-nemoci` a `avenier-destination-map`) se rozcházejí –
   fork má navíc v24.12 (otevření z `file://`). Každá oprava se musí dělat dvakrát.
2. `app.js` má ~4 900 řádků v jednom souboru bez modulů a bez unit testů; kontrola je jen `verify-app.mjs`.
3. Cache-buster `?v=` se v `index.html` zvedá ručně – snadno se zapomene.
4. Denní commit indexu do `main` přímo z Actions (bez PR) – v pořádku pro data, ale je třeba hlídat,
   aby generátor nikdy nezapsal prázdný/poškozený index (verify krok to dnes zajišťuje).
5. Licence/podmínky užití dat Avenier API nejsou v repu zmíněné, přestože repo je veřejné.

## Úkoly pro vlastníka

- [ ] Rozhodnout, která kopie je „zdroj pravdy“. Doporučení: mergnout v24.12 z forku sem a fork
      ponechat jen jako předávací balíček (nebo ho archivovat po předání).
- [ ] Mergnout větev `claude/awesome-ride-6kb6m0` do `main`.
- [ ] Zvážit, zda má být repo veřejné (obsahuje jen veřejná data, ale i interní poznámky v docs/).
