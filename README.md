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

Verze v22.4 (odolnost datové vrstvy):
- odstraněny veřejné CORS proxy; Avenier API podporuje přímé CORS požadavky,
- API požadavky mají časový limit 12 sekund,
- neúplně načtený filtr se již nevydává za kompletní výsledek,
- počet chybějících detailů se zobrazí uživateli a po 90 sekundách se při dalším použití automaticky zkusí doplnit,
- stejné chování platí také pro vstupní podmínky žluté zimnice,
- statické assety mají verzovaný cache-buster `v=22.4`.

## v22.5.1 – chování detailu a Tanzanie/Zanzibar

- aktivace filtru nemocí zavře otevřený detail destinace a zruší její zvýraznění,
- Tanzanie a Zanzibar už se v datovém mapování vzájemně nepřepisují; zůstávají dvěma destinacemi nad společným státem na mapě,
- statické assety mají verzovaný cache-buster `v=22.5.1`.

## v22.6 – přehlednější žlutá zimnice

- vysvětlení tří barev a odkazy na zdroje jsou umístěné přímo nad výsledky,
- destinace jsou rozdělené do samostatných sloupců: místní riziko, pouze vstupní podmínka a obojí,
- na užších obrazovkách se sloupce skládají pod sebe,
- statické assety mají verzovaný cache-buster `v=22.6`.

## v22.7 – pokrytí destinací a mapa

- horní souhrn transparentně rozděluje 230 destinací na 195 států či samostatně vedených zemí a 35 teritorií či regionů,
- Somálsko a Somaliland jsou v mapovém podkladu vizuálně sloučené do jednoho prvku bez vnitřního švu,
- při aktivní žluté zimnici se význam zelené, žluté a růžové zobrazuje přímo v mapě,
- statické assety mají verzovaný cache-buster `v=22.7`.

## v22.8 – šetrnější opakované načítání API

- úspěšně načtené detaily destinací se ukládají na šest hodin do lokální cache prohlížeče,
- opakované otevření aplikace během této doby nemusí znovu stahovat až 230 detailů,
- při nedostupném nebo zaplněném úložišti aplikace automaticky pokračuje bez této optimalizace,
- statické assety mají verzovaný cache-buster `v=22.8`.

## v22.9 – hero a vyhledávání

- hero banner má stejnou vnější šířku jako samotný vyhledávací box,
- původní obecný symbol ve vyhledávání nahrazuje srozumitelná ikona lupy,
- interní diagnostika rozlišuje počet mapových položek, destinací s API a území bez detailu,
- eviduje také původních 237 položek polygonového mapového podkladu před přidáním samostatných cestovatelských regionů,
- horní souhrn doplňuje počet mapových území, pro která Avenier API nemá detailní doporučení,
- statické assety mají verzovaný cache-buster `v=22.9`.

## v23.0 – pravidelný index a přesnější regiony

- filtry dvanácti nemocí načítají předem ověřený index vytvořený z detailů všech 230 destinací Avenier API,
- vzteklina používá pouze přesnou položku „Vzteklina“ a nezahrnuje sdělení „Vzteklina se nevyskytuje“,
- žlutá zimnice kombinuje vstupní podmínky z Avenier API s podpůrným seznamem místního rizika CDC,
- samostatné cestovatelské regiony obarvují svůj bod v mapě, nikoli automaticky celý nadřazený stát,
- při chybějícím indexu aplikace zachová dosavadní bezpečný fallback přes jednotlivé detaily API,
- GitHub Actions jednou denně index přepočítá, ověří a při skutečné změně připraví návrh ke kontrole; produkci nemění bez schválení,
- každý návrh i změna hlavní větve prochází kontrolou syntaxe a vnitřní konzistence indexu,
- statické assety mají verzovaný cache-buster `v=23.0`.
