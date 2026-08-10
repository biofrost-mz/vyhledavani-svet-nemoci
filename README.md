# Mapa očkování a zdravotních rizik – Avenier

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

## v23.1 – klikací podfiltry žluté zimnice

- legenda žluté zimnice v mapě funguje jako podfiltr: vše, místní riziko, pouze vstupní podmínka nebo obojí,
- stejný podfiltr je dostupný také nad výsledky a oba ovládací prvky zůstávají synchronizované,
- mapa, počet destinací i seznam výsledků vždy odpovídají zvolené kategorii,
- při návratu k hlavnímu filtru žluté zimnice se podfiltr bezpečně nastaví zpět na všechny kategorie,
- statické assety mají verzovaný cache-buster `v=23.1`.

## v23.2 – srozumitelnější rozhraní mapy

- přehled 230 destinací se přesunul do modálního okna dostupného z horního stavového tlačítka,
- hlavní stránka už nezobrazuje samostatný pruh s technickými počty mapových území,
- kategorie žluté zimnice používají jednoznačné názvy „Místní riziko“, „Vstupní podmínka“ a „Místní riziko + vstupní podmínka“,
- vysvětlení filtrů používají přístupnější text a odkaz „Více o nemoci“,
- název země při najetí je posunutý nad spodní nápovědu,
- ovládání výchozího pohledu mapy používá čistou vektorovou ikonu domu,
- statické assety mají verzovaný cache-buster `v=23.2`.

## v23.3 – nové cestovatelské nemoci, zdroje a dengue

- přidány filtry Zika a chikungunya podle cestovatelských přehledů CDC,
- přidány filtry leishmaniózy (země s nejvyšší hlášenou zátěží) a Chagasovy nemoci podle WHO,
- každá nemoc s externími daty ukazuje zdroj, datum kontroly a přímý odkaz v mapě i u výsledků,
- zdroj místního rizika žluté zimnice je nově viditelný také přímo v mapové legendě,
- horečka dengue se podle přesných názvů položek v API dělí na „Endemický výskyt“ (94 destinací) a „Další doporučení“ (45 destinací),
- text výslovně upozorňuje, že API nerozlišuje vysoké a sporadické riziko dengue,
- Ebola zůstává záměrně mimo trvalé filtry,
- statické assety mají verzovaný cache-buster `v=23.3`.

## v23.4 – odolnost, srozumitelnost a mobil

Opravy nalezené při systematickém průchodu aplikací.

**Odolnost běhu**
- d3, topojson, mapový podklad i písma jsou uložené lokálně v `assets/vendor` a `assets/fonts`; aplikace už není závislá na dostupnosti cdnjs, jsDelivr ani Google Fonts,
- chyba při startu (chybějící knihovna, nedostupný podklad) končí čitelnou hláškou přímo v mapě místo tiché výjimky v konzoli,
- detail destinace se zobrazí i v nefokusované záložce; dřív čekal na `requestAnimationFrame`, který v takovém případě neproběhne.

**Mapa a mobil**
- na mobilu zabíral překryv vybrané destinace ~95 % plochy mapy a schovával legendu filtru; nově sedí u spodní hrany, legenda zůstává nahoře a mezi nimi je vidět mapa,
- výška mapy na mobilu je 440 px (400 px na velmi úzkých displejích),
- podfiltry v mapové legendě se na úzkých displejích skládají do jedné posuvné řady,
- body destinací mají jednotné velikosti; dřív se lišily mezi zoomem, překreslením a zrušením výběru, takže při zoomu poskakovaly.

**Srozumitelnost**
- legenda pod mapou se mění podle stavu a popisuje barvy, které jsou na mapě právě teď, včetně kategorie „Neodpovídá filtru“,
- odstíny „bez dostupného detailu“ a „neodpovídá filtru“ jsou od sebe barevně rozlišené,
- kategorie žluté zimnice se jmenují „Pouze místní riziko“, „Pouze vstupní podmínka“ a „Místní riziko i vstupní podmínka“; nad výsledky přibyl součet napříč kategoriemi, protože počty v jednotlivých kategoriích se nesčítají intuitivně.

**Data**
- místní riziko žluté zimnice je sjednocením doporučení Avenier API a seznamu CDC; dřív se braly jen destinace potvrzené oběma zdroji, takže se Etiopie tiše vyřazovala navzdory doporučení v API,
- Bermudy a Britské Panenské ostrovy se navazují přímo na svůj polygon; dřív existovaly dvakrát – jako šedé území „bez dat“ a zvlášť jako bod s daty,
- 24 území bez destinace v API má české názvy místo anglických zkratek z mapového podkladu (`Falkland Is.` → `Falklandy`),
- názvy z API se ořezávají od přebytečných mezer (`Zanzibar ` → `Zanzibar`).

- statické assety mají verzovaný cache-buster `v=23.4`.

## v23.5 – vysvětlení kategorií a sdílení odkazu

- kategorie podfiltrů (žlutá zimnice, horečka dengue) mají vysvětlení na jednom místě v `FACET_INFO` a zobrazují se třemi způsoby: bublina po najetí myší, rozbalovací blok „Co znamenají kategorie?“ přímo v mapové legendě (funguje i na dotykovém displeji) a plný přehled nad výsledky,
- text u horečky dengue už nemluví o API; kategorie vysvětluje z pohledu cestovatele a odkazuje na stránku o nemoci, ne na datový endpoint,
- adresa nese vybraný filtr, kategorii a destinaci (`?filtr=dengue&kategorie=endemic&zeme=vietnam`), takže jde poslat odkaz rovnou na konkrétní pohled; ostatní parametry (`admin`, `debug`) zůstávají zachované,
- v kartě vybrané destinace přibylo tlačítko „Zkopírovat odkaz“; bez oprávnění do schránky odkáže uživatele na adresní řádek,
- akce v kartě se na mobilu skládají do jedné posuvné řady, aby se karta neořezávala,
- statické assety mají verzovaný cache-buster `v=23.5`.

## v23.6 – export aktuální mapy do PNG

- nad mapou je tlačítko „Stáhnout mapu jako PNG“, které bez serverové služby vytvoří obraz v rozlišení 3840 × 2160 px,
- export vždy zachová právě zvolenou nemoc a podkategorii, ale používá čistý výchozí pohled na svět bez náhodného zoomu, najetí myší nebo vybrané země,
- obrázek obsahuje název filtru, počet destinací, barevnou legendu, zdroj a adresu zdroje, stav či datum dat, datum vytvoření, upozornění a logo Avenier,
- zdrojové údaje se přebírají ze stejné konfigurace jako legenda v aplikaci; u běžných filtrů se uvádějí cestovní doporučení Avenier, u externích filtrů CDC nebo WHO,
- soubor se pojmenuje podle filtru, podkategorie a data vytvoření,
- statické assety mají verzovaný cache-buster `v=23.6`.

## v23.7 – celý svět a volby exportu

- tlačítko exportu nově otevře nastavení obrázku; u žluté zimnice a horečky dengue lze zvolit všechny kategorie nebo jednu konkrétní,
- výchozí je vždy export všech kategorií bez ohledu na podfiltr právě zvolený v interaktivní mapě,
- výchozí rozvržení používá mapu téměř přes celý obraz a vkládá menší název, logo, legendu, zdroj a data do průsvitných panelů uvnitř mapy,
- původní varianta s informační hlavičkou zůstává dostupná jako druhá volba,
- exportní projekce se přizpůsobuje dostupnému prostoru podle celého obrysu Země, takže není závislá na zoomu ani rozměru mapy na obrazovce a neořezává severní či jižní okraj,
- statické assety mají verzovaný cache-buster `v=23.7`.

## v23.8 – kompaktní ovládání a skleněný export

- export už nezabírá samostatný řádek nad mapou; ikona stažení je ve svislém ovládání mapy přímo nad tlačítkem přiblížení,
- exportní legendy používají přístupnější označení „Ostatní destinace“ a neuvádějí technickou kategorii „Bez dostupného detailu“,
- dominantní rozvržení skládá kategorie pod sebe do užšího panelu místo širokého řádku přes mapu,
- logo a zdroj jsou na lehce průhledných skleněných panelech; blok zdroje se přizpůsobuje nejdelšímu obsaženému textu,
- stav zdroje a datum vytvoření jsou samostatně bílým písmem v pravém dolním rohu bez podkladového panelu,
- dialog nastavení exportu je vždy vycentrovaný doprostřed obrazovky,
- statické assety mají verzovaný cache-buster `v=23.8`.

## v24.1 – informační hierarchie a mobilní ovládání

- neslučitelný sdílený odkaz filtru a destinace už mapu nepřiblíží na nesouvisející místo; vysvětlí situaci a nabídne zrušení filtru,
- rozšířená skupina nemocí se automaticky otevře, pokud obsahuje právě aktivní filtr,
- název aplikace nově zahrnuje očkování i zdravotní rizika a názvy destinací se zobrazují primárně česky,
- mobilní karta destinace je kratší, bez vlastního posuvníku a obsahuje jen dvě hlavní akce,
- nemoci z CDC a WHO jsou v kompaktních rozbalovacích kartách; jejich podrobnosti, datum a odkazy zůstávají dostupné,
- zdroje, legenda a vysvětlovací tlačítka mají větší text i ovládací plochu a barevné kategorie doplňují textové značky,
- mobilní zkratky jsou označené jako „Oblíbené destinace“ a odkazy na destinaci mají jednotný konkrétní název,
- statické assety mají verzovaný cache-buster `v=24.1`.

## v24.0 – srozumitelnější detail, správná čeština a zdroje

- počítadla používají správné české tvary pro 1, 2–4 a 0 či 5+; nulové hodnoty se v detailu už neskrývají,
- odkazy na detail destinace se zobrazují jen tehdy, když zdrojová data obsahují skutečnou adresu stránky,
- texty používají jednotně pojem destinace, vykání a název „Další doporučení a rizika“ bez technických zmínek o API,
- nemoci doplněné z CDC a WHO se zobrazují v samostatném bloku detailu se zdrojem, datem ověření a odkazem na stránku Očkovacího centra,
- rozbalení dalších nemocí je výraznější a export pro všechny filtry používá kompaktní panel i samostatné logo bez podkladu,
- statické assety mají verzovaný cache-buster `v=24.0`.

## v23.9 – užší informační panel a samostatné logo

- levý informační panel dominantního exportu má přibližně poloviční šířku oproti předchozí variantě,
- pod logem Avenier není žádný bílý, barevný ani průhledný panel; logo se kreslí samostatně nad mapou,
- statické assety mají verzovaný cache-buster `v=23.9`.

### Známá omezení
- aplikaci je potřeba servírovat přes HTTP(S); při otevření přes `file://` selže načtení dat kvůli CORS,
- filtry žloutenky A i B (230/230), meningokoka (229), spalniček (228) a chřipky (226) zvýrazní téměř celou mapu; upozorňuje na to poznámka pod výsledky,
- aktivní filtr vybraný ze skupiny „Další nemoci a rizika“ není v zavřené skupině vidět, stav sděluje jen text pod filtry a legenda,
- mapa není ovladatelná z klávesnice, alternativou zůstává vyhledávání,
- popisek „Klikni na i pro vysvětlení“ a drobné texty v mapové legendě nesplňují kontrast WCAG AA.
