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
- mobilní karta destinace je kompaktní a bez vlastního posuvníku,
- nemoci z CDC a WHO jsou v kompaktních rozbalovacích kartách; jejich podrobnosti, datum a odkazy zůstávají dostupné,
- zdroje, legenda a vysvětlovací tlačítka mají větší text i ovládací plochu a barevné kategorie doplňují textové značky,
- mobilní zkratky jsou označené jako „Oblíbené destinace“ a odkazy na destinaci mají jednotný konkrétní název,
- statické assety mají verzovaný cache-buster `v=24.1`.

## v24.2 – mobilní detail destinace

- mobilní mapa je vyšší a karta destinace má plně viditelné dvousloupcové rozvržení všech čtyř akcí,
- karta používá modrozelený akcent odlišený od zeleně zvýrazněných států; název destinace a zavírací tlačítko jsou větší a lépe odsazené,
- odznaky počtů očkování jsou na mobilu i desktopu ovladatelná tlačítka a přenesou uživatele k odpovídající části plného detailu,
- plný detail destinace má pouze křížek bez textu, umístěný v pravém horním rohu,
- statické assety mají verzovaný cache-buster `v=24.2`.

## v24.3 – viditelná destinace nad mobilní kartou

- při výběru destinace na telefonu se mapa přiblíží do volné horní poloviny mapového boxu,
- výpočet přiblížení polygonu respektuje menší dostupnou výšku, takže vybraná země nezůstane schovaná pod kartou,
- desktopové centrování mapy zůstává beze změny,
- statické assety mají verzovaný cache-buster `v=24.3`.

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

## v24.4 – kombinace filtrů

- filtry nemocí lze kombinovat: tlačítko **„+ Kombinovat s další nemocí"** přepne panel do režimu, kde klik přidává další nemoc do výběru,
- mapa i výsledky ukazují **průnik** — zvýrazněné jsou pouze destinace, kterých se týkají všechny vybrané nemoci zároveň,
- kombinace má vlastní barvu a legendu („Odpovídá všem vybraným nemocem"); barvy jednotlivých nemocí by u průniku nedávaly smysl,
- podfiltry žluté zimnice a horečky dengue se v kombinaci neuplatňují, každá nemoc do průniku vstupuje celá; text to výslovně uvádí,
- nad výsledky se zobrazí zdroje pro každou vybranou nemoc zvlášť,
- kombinaci nese i sdílený odkaz (`?filtr=malaria,yellow-fever`) a export do PNG včetně názvu a názvu souboru,
- výběr jedné nemoci i tlačítko „Všechny destinace" kombinaci ruší, takže původní chování filtrů zůstává beze změny,
- statické assety mají verzovaný cache-buster `v=24.4`.

## v24.5 – trasa, chytřejší vyhledávání a klidný výchozí stav

**Trasa přes více destinací**
- destinaci lze přidat do trasy tlačítkem v její kartě; trasa se drží v pruhu nad mapou s očíslovanými zastávkami,
- souhrn trasy sloučí doporučení všech zastávek a u každé položky uvádí, kolika destinací se týká (`3/3`),
- co je někde povinné, nespadne mezi doporučená — rozhoduje nejsilnější kategorie napříč zastávkami,
- destinace bez cestovních doporučení se do souhrnu nepočítají a text to říká,
- trasa se v mapě kreslí **obrysem**, ne výplní, takže je čitelná zároveň s aktivním filtrem,
- trasu nese i sdílený odkaz (`?trasa=kena,tanzanie,zanzibar`), maximum je 12 zastávek.

**Vyhledávání**
- zvládá české skloňování („Vietnamu", „do Thajska", „Keni") díky porovnávání zjednodušených kmenů,
- toleruje jeden překlep („Thajko" → Thajsko),
- zná regiony („Karibik", „Jihovýchodní Asie", „Balkán" a další) a nabídne je jako trasu,
- název nemoci nabídne rovnou zapnutí filtru („malárie" → *Zapnout filtr: Malárie*),
- krátká slova jako „do" nebo „na" už netahají do výsledků nesouvisející destinace.

**Výchozí stav mapy**
- bez filtru mapa nesvítí — destinace s doporučeními mají stejný neutrální odstín jako ty, které neodpovídají filtru,
- barva v mapě tak nese jediný význam: *tuhle destinaci filtr vybral*,
- území bez cestovních doporučení zůstávají tmavší, takže je legenda pořád rozliší,
- statické assety mají verzovaný cache-buster `v=24.5`.

## v24.6 – tisk, sdílení a klávesnice

**Tisk a PDF**
- v detailu destinace i v souhrnu trasy je tlačítko „Vytisknout / uložit PDF",
- PDF vytváří prohlížeč (Tisk → Uložit jako PDF) — dá lepší typografii i výběr formátu než knihovna a nepřidává do projektu závislost,
- tiskový výstup vynechá mapu a ovládání aplikace a nechá jen doporučení, hlavičku s datem a zdrojem a právní upozornění.

**Sdílení**
- `index.html` má kompletní meta tagy: `description`, `canonical`, favicon, Open Graph i Twitter Card,
- sdílený odkaz má náhledový obrázek 1200×630 vygenerovaný stejným exportérem jako PNG mapy,
- každý z hlavních filtrů má vlastní sdílecí stránku ve `share/` s vlastním náhledem — crawlery nespouštějí JavaScript a query string pro ně nic neznamená, takže `?filtr=malaria` by jinak vždy ukázal výchozí obrázek,
- sdílecí stránky se generují skriptem `node scripts/generate-share-pages.mjs` z obrázků v `assets/img/share/`.

**Klávesnice**
- mapa je jeden fokusovatelný prvek; šipky přeskakují na nejbližší destinaci daným směrem, Enter otevře detail, Escape mapu opustí, Home skočí na první destinaci abecedně, `+` a `-` přibližují,
- kurzor začíná u vybrané destinace, jinak v Česku,
- vybraná destinace se hlásí čtečce obrazovky včetně toho, jestli odpovídá aktivnímu filtru,
- statické assety mají verzovaný cache-buster `v=24.6`.

## v24.7 – kombinace jako sjednocení

Kombinace filtrů dřív ukazovala jen průnik, tedy destinace se **všemi** vybranými
nemocemi zároveň. Nově ukazuje **sjednocení** — destinace, kterých se týká
kterákoli z vybraných nemocí. Průnik z pohledu nezmizel, je to právě ta
pruhovaná skupina, takže výběr nese víc informace než dřív.

- každá nemoc v kombinaci má vlastní barvu podle pořadí výběru (zelená, magenta, fialová, oranžová),
- destinace, kterých se týká víc vybraných nemocí zároveň, jsou v mapě **pruhované** z jejich barev; pruhy drží stejnou šířku i při přiblížení,
- tlačítka nemocí, čipy v pruhu kombinace i legenda pod mapou nesou stejné barvy jako mapa,
- výsledky jsou rozdělené do skupin podle toho, kterých nemocí se destinace týkají; skupina se všemi vybranými nemocemi je první,
- pod počtem je rozpad („jen Malárie: 12 · jen Žlutá zimnice: 49 · více nemocí zároveň: 74"),
- pruhy se přenášejí i do PNG exportu, kde se přizpůsobí velikosti obrázku,
- kombinace je omezená na čtyři nemoci — nad čtyři barvy přestává být mapa čitelná,
- statické assety mají verzovaný cache-buster `v=24.7`.

## v24.9 – opravy nalezené auditem

Revize celé aplikace proti živým datům. Nejzávažnější nález byl v souhrnu trasy:
destinace, které doporučení mají, ale nepodařilo se je načíst, se kreslily jako
potvrzené „doporučení neuvedeno“ — výpadek sítě se tvářil jako zdravotní údaj.

- **trasa rozlišuje „neuvedeno“ od „bez údajů“**: nenačtená destinace má v matici `?`, v kartě „Doporučení se nepodařilo načíst“ místo „0 povinných očkování“, nepočítá se do poměrů (`2/2` místo zavádějícího `2/3`) a nabízí tlačítko „Zkusit načíst znovu“,
- **vyhledávání řadí relevantně**: jednopísmenné kmeny (spojka „a“ v „Antigua a Barbuda“) už nepřebíjejí skutečnou shodu a `-cko` má vlastní kmen; „v Německu“ vracelo Niue a Severní Mariany před Německem, „v Řecku“ Českou republiku a Rusko před Řeckem,
- **tolerance překlepů zvládá prohození znaků** („Thajkso“ → Thajsko),
- **region nabídne výběr místo tichého ořezu**: „Karibik“ dřív naplnil trasu prvními pěti destinacemi v pořadí mapového podkladu a zbylých 24 zahodil bez upozornění; nově se vypíšou všechny (státy před teritorii, pak abecedně) a uživatel si vybere až pět,
- **první kliknutí na filtr nezamrzne**: párování destinací jde přes předpočítaný rejstřík místo lineárního skenu, 294 ms → 18 ms,
- **export PNG má průběh a chystá podklady dopředu**: první export 13,1 s → 3,5 s, po otevření dialogu ~2 s; tlačítko hlásí fázi místo jedné statické věty,
- **mobilní mapa je vidět**: legenda filtru v mapě zabírala 142 z 500 px a dvě ze čtyř tlačítek kategorií byla mimo obrazovku ve skrytém vodorovném scrollu — na mobilu ji nahradil přehled hned pod mapou; zoom navíc měří skutečné překryvy místo pevné poloviny výšky,
- **odkazy z API projdou whitelistem schémat** (`safeUrl`), aby se z datové položky nemohl stát `javascript:` odkaz,
- **našeptávač je pro čtečku skutečný combobox** (`aria-expanded`, `aria-activedescendant`, procházení dokola šipkami),
- ruční úprava filtru v admin panelu zneplatňuje cache kombinace,
- automatický PR s indexem si sám pouští „Kontrolu aplikace“ — PR z `GITHUB_TOKEN` další workflow nespouští, takže se dřív neověřil vůbec,
- `verify-app.mjs` hlídá počet destinací rozsahem místo natvrdo psaných 230 a navíc kontroluje, že s ním souhlasí meta popisky v `index.html`,
- statické assety mají verzovaný cache-buster `v=24.9`.

### Známá omezení
- aplikaci je potřeba servírovat přes HTTP(S); při otevření přes `file://` selže načtení dat kvůli CORS,
- filtry žloutenky A i B (230/230), meningokoka (229), spalniček (228) a chřipky (226) zvýrazní téměř celou mapu; upozorňuje na to poznámka pod výsledky,
- `map.css` má přes 2 000 řádků ve dvaceti vrstvených „verzích“ se 150+ `!important`; každá další designová změna je dražší.

## v24.10 – mobilní trasa a vysvětlení poměrů

- mobilní „Přehled podle destinací“ používá karty místo široké tabulky se sticky sloupcem, který se v Safari překrýval s výsledky,
- mobilní mapa je nižší a náhled destinace skrývá duplicitní akce, drží odznaky v jedné řadě a zabírá podstatně menší část mapy,
- na desktopu se po najetí nebo zaměření položky s poměrem `2/2` zobrazí náhled rozdělený na zelené „Uvedeno v“ a šedé „Neuvedeno v“; kliknutí dál otevírá úplný dialog,
- lokální testovací server naslouchá pouze na `127.0.0.1`, takže omylem nezpřístupní projekt do sítě,
- statické assety mají verzovaný cache-buster `v=24.10`.

## v24.11 – mobilní srovnávací tabulka

- mobilní přehled je znovu jedna souvislá tabulka podobná desktopu; nemoc, značky destinací a souhrn jsou ve stejném řádku,
- první sloupec s nemocí zůstává viditelný při vodorovném posunu tabulky,
- filtr destinací je na telefonu výrazně označený a samostatně vodorovně posuvný,
- dlouhé názvy nemocí i zemí se zalamují v kompaktních sloupcích,
- statické assety mají verzovaný cache-buster `v=24.11`.
