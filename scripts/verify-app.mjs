import {readFile,readdir,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const index=JSON.parse(await readFile(resolve(root,'assets/data/disease-index.json'),'utf8'));
const html=await readFile(resolve(root,'index.html'),'utf8');
const config=await readFile(resolve(root,'assets/js/config.js'),'utf8');
const mapCss=await readFile(resolve(root,'assets/css/map.css'),'utf8');

function assert(condition,message){
  if(!condition)throw new Error(message);
}

function assertUnique(values,label){
  assert(Array.isArray(values),`${label} není pole.`);
  assert(new Set(values).size===values.length,`${label} obsahuje duplicity.`);
}

assert(index.schemaVersion===1,'Nepodporovaná verze indexu.');
assert(index.destinationCount===230,`Neočekávaný počet destinací: ${index.destinationCount}`);
assert(index.detailCount===index.destinationCount,'Index neobsahuje všechny detaily.');
assertUnique(index.destinationSlugs,'destinationSlugs');
assert(index.destinationSlugs.length===index.destinationCount,'Počet slugů neodpovídá počtu destinací.');

const knownDestinations=new Set(index.destinationSlugs);
const requiredDiseases=['typhoid','dengue','rabies','japanese-encephalitis','cholera','hepatitis-a','hepatitis-b','polio','meningococcus','tick-borne-encephalitis','measles','flu'];
requiredDiseases.forEach(key=>{
  const disease=index.diseases?.[key];
  assert(disease,`V indexu chybí nemoc ${key}.`);
  assertUnique(disease.destinationSlugs,`${key}.destinationSlugs`);
  assert(disease.count===disease.destinationSlugs.length,`Nesouhlasí počet pro ${key}.`);
  assert(disease.destinationSlugs.every(slug=>knownDestinations.has(slug)),`${key} obsahuje neznámou destinaci.`);
});

['entryDestinationSlugs','riskCandidateDestinationSlugs'].forEach(key=>{
  const values=index.yellowFever?.[key];
  assertUnique(values,`yellowFever.${key}`);
  assert(values.every(slug=>knownDestinations.has(slug)),`yellowFever.${key} obsahuje neznámou destinaci.`);
});

const versions=[...html.matchAll(/(?:map\.css|config\.js|app\.js)\?v=([^"']+)/g)].map(match=>match[1]);
assert(versions.length===3,'V index.html chybí verzování některého hlavního souboru.');
assert(new Set(versions).size===1,'Hlavní soubory nemají stejné číslo verze.');
assert(config.includes("const DISEASE_INDEX_API_URL='assets/data/disease-index.json';"),'Aplikace nemá nastavený lokální index nemocí.');
const app=await readFile(resolve(root,'assets/js/app.js'),'utf8');
assert(app.includes('data-yf-facet')&&app.includes('setYellowFeverFacet'),'Chybí ovládání podfiltrů žluté zimnice.');

/* Aplikace musí běžet i bez přístupu k veřejným CDN. */
const vendored=[
  ['assets/vendor/d3.min.js',100000],
  ['assets/vendor/topojson.min.js',5000],
  ['assets/vendor/countries-50m.json',300000],
  ['assets/css/fonts.css',500]
];
for(const [file,minBytes] of vendored){
  const info=await stat(resolve(root,file)).catch(()=>null);
  assert(info?.isFile(),`Chybí lokální kopie ${file}.`);
  assert(info.size>=minBytes,`Lokální kopie ${file} je podezřele malá (${info.size} B).`);
}
assert(!/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com/.test(html),'index.html stále načítá knihovny nebo fonty z veřejné CDN.');

/* Lokální fonty musí být opravdu použitelné, ne jen přítomné. */
const fontCss=await readFile(resolve(root,'assets/css/fonts.css'),'utf8');
const faceCount=(fontCss.match(/@font-face/g)||[]).length;
assert(faceCount>=8,`fonts.css obsahuje jen ${faceCount} deklarací @font-face.`);
assert(!fontCss.includes('@font-face@font-face'),'fonts.css je poškozený (zdvojená deklarace @font-face).');
assert(!/https:\/\/fonts\.gstatic\.com/.test(fontCss),'fonts.css stále odkazuje na fonts.gstatic.com.');
const fontFiles=[...new Set([...fontCss.matchAll(/url\(\.\.\/fonts\/([^)]+)\)/g)].map(m=>m[1]))];
assert(fontFiles.length>=4,`fonts.css odkazuje jen na ${fontFiles.length} souborů písma.`);
for(const file of fontFiles){
  const info=await stat(resolve(root,'assets/fonts',file)).catch(()=>null);
  assert(info?.isFile()&&info.size>1000,`Chybí nebo je prázdný soubor písma ${file}.`);
}
assert(!/cdn\.jsdelivr\.net/.test(app),'app.js stále načítá mapový podklad z veřejné CDN.');
assert(app.includes("MAP_TOPOLOGY_URL='assets/vendor/countries-50m.json'"),'Mapový podklad se nenačítá z lokální kopie.');

/* Regrese, které se už jednou projevily v ostrém rozhraní. */
assert(config.includes('const MAP_NAME_CZ='),'Chybí české názvy území bez destinace v API.');
assert(app.includes('MAP_NAME_CZ[rawFeatureName]'),'České názvy území se nepoužívají při stavbě mapy.');
assert(app.includes('function combineYellowFeverRisk'),'Chybí sjednocení zdrojů místního rizika žluté zimnice.');
assert(!app.includes('requestAnimationFrame(()=>wrap.classList.add'),'Detail destinace se opět zobrazuje až přes requestAnimationFrame.');
assert(app.includes('function renderMapLegend'),'Chybí dynamická legenda pod mapou.');
assert(/const MARKER_R=\{base:3,hover:4,selected:5\}/.test(app),'Velikosti bodů v mapě nemají jediný zdroj pravdy.');
assert(!/'bermudy':\{id:'api:/.test(config)&&!/'britske-panenske-ostrovy':\{id:'api:/.test(config),'Bermudy nebo Britské Panenské ostrovy se opět tvoří jako destinace mimo vlastní polygon.');

/* Vysvětlivky kategorií musí existovat pro obě nemoci s podfiltry a nesmí
   mluvit o API – uživateli nabízíme zdroj o nemoci, ne technický endpoint. */
assert(app.includes('const FACET_INFO='),'Chybí vysvětlivky kategorií podfiltrů.');
['yellow-fever','dengue'].forEach(key=>{
  assert(new RegExp(`FACET_INFO(?:\\[|=)[\\s\\S]*['"]?${key}['"]?\\s*:`).test(app),`FACET_INFO nemá kategorie pro ${key}.`);
});
assert(app.includes('function facetTooltip')&&app.includes('function facetGlossaryDetails'),'Chybí bublina nebo rozbalovací vysvětlivka kategorií.');
/* Endpoint v konstantě APIS je v pořádku; hlídáme jen odkazy a texty pro uživatele. */
assert(!app.includes('API Očkovacího centra'),'Rozhraní znovu popisuje zdroj jako API místo stránky o nemoci.');
assert(!/href="[^"]*api\/country/.test(app),'Rozhraní znovu odkazuje uživatele přímo na API.');
assert(!app.includes('zdroj: přímé API značky'),'Rozhraní stále používá technické označení přímého API.');
assert(!app.includes('po 90 sekundách'),'Rozhraní stále zveřejňuje interní dobu opakovaného načtení.');

/* České tvary a jednotné názvosloví v nejviditelnějších počítadlech. */
assert(app.includes("required:['povinné očkování','povinná očkování','povinných očkování']"),'Chybí české tvary počtu povinných očkování.');
assert(app.includes("recommended:['další doporučení','další doporučení','dalších doporučení']"),'Chybí české tvary počtu dalších doporučení.');
assert(!app.includes("meta.count===1?'destinace':'destinací'"),'Export stále rozlišuje jen jednotné a množné číslo.');
assert(html.includes('Hledat destinaci')&&!html.includes('Hledat zemi'),'Vyhledávání nepoužívá jednotný pojem destinace.');
assert(html.includes('Klikněte na i pro vysvětlení')&&!html.includes('Klikni na i'),'Rozhraní stále na jediném místě tyká.');
assert(html.includes('Horečka dengue')&&!html.includes('Horečka Dengue'),'Název horečky dengue nemá český pravopis.');
assert(app.includes("miniGroupHtml('Další doporučení a rizika'")&&app.includes("sectionHtml('d','Další doporučení a rizika'"),'Třetí kategorie doporučení nemá jednotný název.');

/* Externí odborné indexy musí být v detailu viditelně oddělené od doporučení
   pro destinaci a odkazy na destinaci se nesmí skládat naslepo. */
assert(app.includes('const EXTERNAL_DETAIL_DISEASES=')&&app.includes('function externalDiseaseSectionHtml'),'V detailu chybí nemoci z doplňujících odborných zdrojů.');
assert(app.includes('Doplňující odborné zdroje')&&app.includes('Zdroj: ${esc(item.sourceLabel)}'),'Externí nemoci nemají srozumitelné označení a zdroj.');
assert(app.includes("const url=info.www||''")&&!/ockovacicentrum\.cz\/cz\/\$\{[^}]*slug/.test(app),'Odkaz na destinaci se znovu skládá i bez existující cílové stránky.');

/* Informační UX: neslučitelná destinace nesmí přebít filtr ani mapu, aktivní
   rozšířený filtr musí zůstat viditelný a názvy zobrazujeme primárně česky. */
assert(app.includes('filterDestinationMismatch')&&app.includes('destinationMatchesActiveFilter'),'Chybí ochrana proti neslučitelné kombinaci filtru a destinace.');
assert(app.includes('mapa zůstává v přehledu filtru')&&app.includes('Zrušit filtr a otevřít destinaci'),'Neslučitelný sdílený odkaz nemá srozumitelné vysvětlení a řešení.');
assert(app.includes('function syncExpandedDiseaseGroup')&&app.includes('group.open=inside'),'Aktivní nemoc ze skupiny Další nemoci zůstává skrytá.');
assert(app.includes('const name=cleanName(cz||entry?.name||en)')&&app.includes('entry?.name,en,cz'),'Český název není oddělený od anglického vyhledávacího synonyma.');
assert(app.includes('function moreAboutDestinationLabel')&&app.includes('Více informací:'),'Odkazy na destinaci nemají jednotné konkrétní označení.');
assert(html.includes('Mapa očkování a zdravotních rizik')&&html.includes('Očkování, vstupní podmínky a zdravotní rizika podle destinace'),'Název aplikace neodpovídá širšímu informačnímu obsahu.');
assert(/class="quick"[^>]*hidden/.test(html)&&mapCss.includes('.quick[hidden]{display:none!important}'),'Oblíbené destinace nejsou spolehlivě skryté.');
assert(app.includes('<details class="external-card">')&&app.includes('EXTERNAL_DETAIL_SUMMARIES'),'Externí nemoci nejsou ve zkrácených rozbalovacích kartách.');
assert(app.includes("mark:'R+V'")&&app.includes("mark:'✓'")&&app.includes('${esc(it.mark||\'\')}'),'Barevné kategorie nemají doplňkové textové značky.');
assert(app.includes('function detailBadgeHtml')&&app.includes('data-mi-section')&&app.includes('data-detail-section'),'Odznaky kategorií nefungují jako navigace do detailu.');
assert(app.includes('function scrollToDetailSection')&&app.includes('vax-section-${esc(key)}'),'Navigační odznaky nemají cílové sekce detailu.');
assert(app.includes('aria-label="Zavřít detail destinace">×</button>')&&!app.includes('Zavřít ✕'),'Detail destinace stále používá textové tlačítko zavření.');
assert(mapCss.includes('#mw,#av-map{height:500px!important}')&&mapCss.includes('.map-info .mi-btn.center,.map-info .mi-btn.share,.map-info .mi-btn.ghost'),'Mobilní mapa nebo úplná sada akcí v kartě nemá očekávané rozvržení.');
assert(mapCss.includes('border-top-color:var(--oc-blue)!important')&&mapCss.includes('.card>.bclose'),'Karta destinace nemá modrozelené odlišení nebo rohové zavírací tlačítko.');
assert(app.includes('function mapFocusLayout')&&app.includes("matchMedia?.('(max-width: 640px)').matches")&&app.includes('y:availableHeight/2'),'Mobilní zoom neposouvá destinaci do volné horní poloviny mapy.');
assert(app.includes('dy/focus.availableHeight')&&app.includes('translate(focus.x,focus.y)'),'Přizpůsobení polygonu nebo bodové destinace ignoruje mobilní volnou plochu.');

/* Kombinace filtrů: průnik vybraných nemocí. */
assert(app.includes('function combinedHits')&&app.includes('function toggleExtraDisease'),'Chybí logika kombinace filtrů.');
assert(app.includes('function matchesActiveFilter'),'Rozhodování o shodě s filtrem nemá jediné místo.');
assert(html.includes('id="filter-combine"')&&html.includes('id="filter-combo"'),'V rozhraní chybí ovládání kombinace filtrů.');
assert(app.includes('const COMBO_PALETTE=')&&app.includes('function ensureStripePattern'),'Kombinace nemá barvy nemocí ani pruhy pro překryv.');
assert(app.includes('function combinationIndex')&&app.includes('function comboOverlapHits'),'Kombinace neeviduje, které nemoci se destinace týkají.');
assert(app.includes('opts.combo')&&app.includes('combinationLabel()'),'Export nezohledňuje kombinaci filtrů.');

/* Sdílení stavu přes URL. */
assert(/URL_PARAM=\{disease:'filtr',facet:'kategorie',destination:'zeme',route:'trasa'\}/.test(app),'Chybí parametry pro sdílení stavu v URL.');

/* Sdílení: meta tagy, náhledové obrázky a sdílecí stránky filtrů. */
const SHARE_BASE='https://vyhledavani-svet-nemoci.vercel.app';
['og:title','og:description','og:image','og:url','twitter:card','twitter:image'].forEach(tag=>{
  assert(html.includes(`"${tag}"`),`V index.html chybí meta tag ${tag}.`);
});
assert(html.includes('name="description"'),'V index.html chybí meta description.');
assert(html.includes('rel="canonical"')&&html.includes('rel="icon"'),'Chybí canonical nebo favicon.');
assert(html.includes(`${SHARE_BASE}/assets/img/share/default.jpg`),'og:image neukazuje na výchozí náhledový obrázek.');
const defaultShare=await stat(resolve(root,'assets/img/share/default.jpg')).catch(()=>null);
assert(defaultShare?.isFile()&&defaultShare.size>15000,'Chybí použitelný výchozí náhledový obrázek.');
const sharePages=await readdir(resolve(root,'share')).catch(()=>[]);
assert(sharePages.filter(f=>f.endsWith('.html')).length>=6,`Sdílecích stránek filtrů je jen ${sharePages.length}.`);
for(const pageName of sharePages.filter(f=>f.endsWith('.html'))){
  const pageHtml=await readFile(resolve(root,'share',pageName),'utf8');
  const key=pageName.replace(/\.html$/,'');
  assert(pageHtml.includes(`${SHARE_BASE}/assets/img/share/${key}.jpg`),`Sdílecí stránka ${pageName} neodkazuje na svůj obrázek.`);
  assert(pageHtml.includes(`filtr=${encodeURIComponent(key)}`),`Sdílecí stránka ${pageName} nepředá filtr aplikaci.`);
  const image=await stat(resolve(root,'assets/img/share',`${key}.jpg`)).catch(()=>null);
  assert(image?.isFile()&&image.size>15000,`Chybí náhledový obrázek pro ${key}.`);
}


/* Mapa musí jít ovládat z klávesnice. */
assert(app.includes('function setupMapKeyboard')&&app.includes("setAttribute('tabindex','0')"),'Mapa není fokusovatelná z klávesnice.');
assert(app.includes('function moveKeyboardCursor')&&app.includes('function rebuildNavPoints'),'Chybí pohyb kurzoru po mapě.');
assert(html.includes('id="map-live"'),'Chybí oblast pro hlášení čtečce obrazovky.');
assert(mapCss.includes('path.country.kb-focus'),'Kurzor klávesnice není v mapě vidět.');

/* Trasa přes více destinací. */
assert(app.includes('function setRoute')&&app.includes('function toggleRouteDestination')&&app.includes('function renderRoutePanel'),'Chybí logika trasy.');
assert(html.includes('id="route-bar"')&&html.includes('id="route-panel"'),'V rozhraní chybí prvky trasy.');
assert(app.includes("const ROUTE_COLOR=")&&app.includes('function strokeForId'),'Trasa se nekreslí jako obrys nad filtrem.');
assert(app.includes('ROUTE_CATEGORY_ORDER'),'Souhrn trasy neřeší nejsilnější kategorii položky.');
assert(app.includes('const ROUTE_MAX=5;')&&html.includes('Do trasy lze přidat nejvýše 5 destinací')&&html.includes('nejprve jednu z vybraných destinací odeberte'),'Trasa není omezená na pět destinací nebo limit nevysvětluje.');
assert(app.includes('function routeDestinationCardsHtml')&&app.includes('data-route-country'),'Souhrn trasy nevypisuje samostatně všechny destinace.');
assert(app.includes('function routeComparisonHtml')&&app.includes('route-matrix-mark')&&app.includes('${count}/${total}'),'Souhrn trasy nemá kompaktní poměr a srovnání podle destinací.');
assert(app.includes("data-mi-action=\"route-prev\"")&&app.includes("data-mi-action=\"route-next\""),'V detailu chybí pohyb mezi destinacemi trasy.');
assert(html.includes('id="route-item-dialog"')&&app.includes('function setupRouteItemDialog'),'Souhrn trasy nemá detail doporučení podle destinací.');
assert(app.includes("sortMode='category'")&&app.includes('data-route-sort-reset'),'Srovnávací tabulka nemá globální řazení podle souhrnu a reset.');
assert(app.includes('preserveScroll=false')&&app.includes('{preserveScroll:true}')&&app.includes('anchorTop'),'Dolní přepínač trasy nechrání pozici stránky.');
assert(html.includes('Konečné doporučení a rozhodnutí o očkování vždy stanoví ordinující lékař.'),'Hlavní medicínské upozornění není dostatečně jednoznačné.');
assert(app.includes('Konečné doporučení určí lékař')&&app.includes('aktuální situace v destinaci'),'Detail a souhrn trasy nemají kontextové medicínské upozornění.');

/* Vyhledávání musí zvládnout skloňování, překlepy, regiony a názvy nemocí. */
assert(app.includes('function searchStem')&&app.includes('function editDistanceWithin'),'Vyhledávání nemá kmeny ani toleranci překlepů.');
assert(config.includes('const REGION_ALIASES=')&&app.includes('function regionMatch'),'Vyhledávání nezná regiony.');
assert(app.includes('function diseaseMatchForQuery'),'Vyhledávání nenabízí filtr podle názvu nemoci.');

/* Bez filtru nesmí mapa svítit barvou, která jinde znamená „vyhovuje filtru“. */
assert(/has:'#63788d'/.test(config)&&/dim:'#63788d'/.test(config),'Výchozí stav mapy nepoužívá neutrální barvu.');
assert(app.includes('function applyStateFromUrl')&&app.includes('function updateUrlState'),'Chybí obnovení nebo zápis stavu do URL.');
assert(app.includes("data-mi-action=\"share\"")&&app.includes('function copyShareLink'),'Chybí tlačítko pro zkopírování odkazu.');

/* Opakovatelný 4K export aktuálního filtru. */
assert(html.includes('id="map-export-png"'),'V rozhraní chybí tlačítko pro export PNG.');
assert(app.includes('function createMapExportBlob')&&app.includes('function downloadMapPng'),'Chybí vytvoření nebo stažení exportu PNG.');
assert(app.includes('window.AvenierMapExport'),'Export není dostupný pro automatizovaný test.');
assert(html.includes('id="map-export-dialog"')&&html.includes('name="export-layout"'),'Chybí dialog nebo volba rozvržení exportu.');
assert(html.includes('value="map" checked'),'Výchozí export nemá dominantní mapové rozvržení.');
assert(/id="zc"[\s\S]*id="map-export-png"[\s\S]*id="zi"/.test(html),'Ikona exportu není ve svislém ovládání mapy nad přiblížením.');
assert(app.includes("facet:dialog?.querySelector('input[name=\"export-facet\"]:checked')?.value||'all'"),'Výchozí export nezahrnuje všechny kategorie filtru.');
assert(app.includes("height-(fullMapLayout?220:54)")&&app.includes("{type:'Sphere'}"),'Export negarantuje zobrazení celého světa bez ořezu a prostoru pro zdroj.');
assert(app.includes("label:'Ostatní destinace'")&&!/function exportLegendItems[\s\S]{0,2500}Bez dostupného detailu/.test(app),'Legenda exportu používá technické nebo nadbytečné označení.');
assert(app.includes('function drawGlassPanel')&&app.includes('sourceWidth'),'Dominantní export nemá kompaktní skleněné panely.');
assert(app.includes('drawGlassPanel(ctx,128,104,570,500,28)'),'Hlavní informační panel dominantního exportu nemá zkrácenou šířku.');
assert(!app.includes('drawGlassPanel(ctx,3030,104'),'Logo dominantního exportu má stále podkladový panel.');
assert(/map-export-dialog\[open\][^{]*\{[^}]*place-items:center/.test(mapCss),'Dialog exportu není vycentrovaný.');
const exportLogo=await stat(resolve(root,'assets/img/avenier-logo.png')).catch(()=>null);
assert(exportLogo?.isFile()&&exportLogo.size>10000,'Chybí použitelné logo Avenier pro export.');

console.log(`Kontrola v pořádku: ${index.destinationCount} destinací, ${requiredDiseases.length} nemocí, verze ${versions[0]}, ${vendored.length} lokálních závislostí.`);
