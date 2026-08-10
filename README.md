# Vakcinační mapa světa – Avenier

Verze v19:
- box „Vybraná destinace“ má decentní zelené podbarvení ve stylu článků,
- odstraněný samostatný kruhový dekorativní objekt.

Verze v20 (technika + funkčnost):
- ochrana proti race conditions při filtrech nemocí,
- odolnější cache detailů destinací (retry TTL, bez cache poisoning),
- detail panel bez ořezu přes max-height,
- resize/orientation přepočet mapy a markerů,
- backend-ready index nemocí (API endpoint / row fields / fallback scraping),
- bezpečnější externí odkazy (`noopener noreferrer`),
- oprava mobilních selektorů zoom ovládání.

Verze v21 (obsah + UX + právní jasnost):
- výrazné právní/orientační upozornění nad mapou,
- mini návod „Jak mapu používat“, vysvětlení kategorií a barev mapy,
- praktická sekce „Po návštěvě“ a stručné FAQ,
- méně zahlcení: dlouhé seznamy chipů se skládají do „Zobrazit dalších X“,
- sjednocená CTA hierarchie: hlavní akce „Najít očkovací centrum“ i v map overlay.

Dokumentace změn:
- [TECHNIKA_A_FUNKCNOST_V20](docs/TECHNIKA_A_FUNKCNOST_V20.md)
- [OBSAH_UX_A_PRAVNI_V21](docs/OBSAH_UX_A_PRAVNI_V21.md)

Verze v22.1 (filtry):
- filtr malárie používá samostatný frontendový index podle CDC Yellow Book 2026,
- u malárie se zobrazuje zdroj, datum kontroly a vysvětlení regionálního/sezónního rizika,
- odstraněno osm duplicitních virtuálních destinací ve vyhledávání a výsledcích filtrů,
- statické assety mají verzovaný cache-buster `v=22.1`.

Verze v22.2 (přesnost filtrů):
- žlutá zimnice používá samostatný index destinací s doporučením očkování podle CDC Yellow Book 2026,
- vstupní podmínka při příletu z endemické oblasti se již nevydává za místní riziko žluté zimnice,
- filtr vztekliny ignoruje položku „Vzteklina se nevyskytuje“,
- všechny filtry vysvětlují zdroj a význam zvýraznění; téměř univerzální doporučení na omezenou vypovídací hodnotu upozorní,
- statické assety mají verzovaný cache-buster `v=22.2`.

Verze v22.3 (API-first žlutá zimnice):
- vstupní podmínky žluté zimnice se načítají z živých detailů Avenier API,
- kandidáti na místní riziko se odvozují z kategorií Avenier a ověřují podpůrným seznamem CDC,
- mapa rozlišuje riziko, pouze vstupní podmínku a souběh obou stavů třemi barvami,
- výsledky filtru zobrazují stejnou barevnou legendu a zdroje,
- vzteklina zůstává vyhodnocovaná výhradně z Avenier API,
- statické assety mají verzovaný cache-buster `v=22.3`.
