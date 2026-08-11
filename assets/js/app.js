/* ── ISO numeric → anglický název (pro slug) ── */

/* ── ISO numeric → český název (lokální fallback) ── */

/* ── Slug overrides ── */

function toSlug(n){return OV[n]||n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').trim().replace(/\s+/g,'-');}

/* ── Barvy mapy ── */

/* ── Alias tabulka pro případy, kde se český web/API může lišit od anglického ISO názvu ── */

/* ── Globální stav ── */
const FI=new Map(); /* norm ISO numeric → {name, slug, has, www, search, coords?, virtual?} */
const FM=new Map(); /* norm ISO numeric → GeoJSON feature */
const VM=new Map(); /* norm ISO numeric → fallback marker element */
let selEl=null,selD=null,selMark=null,selMarkId=null;
let pg,prj,zb,sv,gv,W,H,currentZoomK=1;
let oceanRect=null,graticulePath=null,bordersPath=null,countryPaths=null,markerSelection=null;
let mapResizeListenersBound=false;

let activeDisease='all';
/* Kombinace filtrů: activeDisease zůstává hlavní nemocí, extraDiseases nese
   ty přidané. Průnik = destinace, které odpovídají všem vybraným najednou.
   Díky tomu zůstávají všechna volání DISEASES[activeDisease] platná. */
let extraDiseases=[];
let combineMode=false;
let combinedHitsCache=null;
let requestedDisease='all';
let activeYellowFeverFacet='all';
let activeDengueFacet='all';
let filterRequestToken=0;
let filterDestinationMismatch=null;
const diseaseIndex=new Map(); /* diseaseKey → Set(countryId) */
const diseaseIndexSource=new Map(); /* diseaseKey → 'detail'|'api-row'|'api-index'|'cache' */
const diseaseIndexMeta=new Map(); /* diseaseKey → {total,loaded,failures,retryAt} */
const diseaseFacets=new Map(); /* diseaseKey → doplňkové množiny, např. risk/entry */
let yellowFeverLoadPromise=null;
const detailLoading=new Map();
const detailCache=new Map(); /* slug -> {status:'ok'|'error', ts:number, data?:object} */
const DETAIL_ERROR_RETRY_MS=90*1000;
const DETAIL_SUCCESS_TTL_MS=6*60*60*1000;
const DETAIL_STORAGE_KEY='avenierCountryDetailCacheV1';
const API_FETCH_TIMEOUT_MS=12*1000;
let detailCachePersistTimer=null;

const ADMIN_MAP_KEY='avenierMapAdminOverridesV1';
function loadAdminOverrides(){
  try{
    const raw=localStorage.getItem(ADMIN_MAP_KEY);
    return raw?JSON.parse(raw):{};
  }catch(e){
    return {};
  }
}
let CUSTOM_DESTINATION_MAP=loadAdminOverrides();

const ADMIN_DISEASE_KEY='avenierMapDiseaseOverridesV1';
function loadDiseaseOverrides(){
  try{
    const raw=localStorage.getItem(ADMIN_DISEASE_KEY);
    return raw?JSON.parse(raw):{};
  }catch(e){
    return {};
  }
}
let CUSTOM_DISEASE_OVERRIDES=loadDiseaseOverrides();

function saveDiseaseOverrides(){
  localStorage.setItem(ADMIN_DISEASE_KEY,JSON.stringify(CUSTOM_DISEASE_OVERRIDES,null,2));
}

function getDiseaseOverride(key){
  if(!CUSTOM_DISEASE_OVERRIDES[key]){
    CUSTOM_DISEASE_OVERRIDES[key]={include:[],exclude:[]};
  }
  return CUSTOM_DISEASE_OVERRIDES[key];
}

function setDiseaseOverride(key,id,mode){
  const nid=String(id);
  const o=getDiseaseOverride(key);
  o.include=(o.include||[]).filter(x=>String(x)!==nid);
  o.exclude=(o.exclude||[]).filter(x=>String(x)!==nid);
  if(mode==='include')o.include.push(nid);
  if(mode==='exclude')o.exclude.push(nid);
  saveDiseaseOverrides();
}

function clearDiseaseOverrides(key=null){
  if(key){
    delete CUSTOM_DISEASE_OVERRIDES[key];
  }else{
    CUSTOM_DISEASE_OVERRIDES={};
  }
  saveDiseaseOverrides();
}

function setToSetValues(arr){
  return new Set((arr||[]).map(x=>{
    const n=Number(x);
    return Number.isFinite(n)?n:x;
  }));
}

function normId(id){
  const n=Number(id);
  return Number.isFinite(n)?n:id;
}

function slugKey(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function unique(arr){return [...new Set(arr.filter(Boolean))];}

/* Názvy z API občas nesou přebytečné mezery („Zanzibar “), které se pak
   vykreslují do rozhraní. */
function cleanName(value){return String(value??'').replace(/\s+/g,' ').trim();}

/* ── České číslovky ──
   Čeština má u čísel tři tvary: 1 (jednotné), 2–4 (množné) a 0 nebo 5+ (2. pád
   množného čísla). Bez toho se v rozhraní objevovalo „0 povinné“ nebo
   „13 doporučené“. */
function pluralForm(count,one,few,many){
  const n=Math.abs(Number(count));
  if(!Number.isFinite(n))return many;
  if(n===1)return one;
  if(n>=2&&n<=4)return few;
  return many;
}

function countWithNoun(count,one,few,many){
  return `${count} ${pluralForm(count,one,few,many)}`;
}

/* Tvary, které se v rozhraní opakují. */
const COUNT_FORMS={
  destination:['destinace','destinace','destinací'],
  required:['povinné očkování','povinná očkování','povinných očkování'],
  basic:['základní očkování','základní očkování','základních očkování'],
  recommended:['další doporučení','další doporučení','dalších doporučení'],
  external:['informace z CDC/WHO','informace z CDC/WHO','informací z CDC/WHO']
};

function countDestinations(count){return countWithNoun(count,...COUNT_FORMS.destination);}
function destinationsWord(count){return pluralForm(count,...COUNT_FORMS.destination);}

function countryKeys(numId,en,cz){
  return unique([
    en,cz,
    toSlug(en),toSlug(cz||en),
    ...(API_ALIAS[numId]||[])
  ].map(slugKey));
}

/* API destinace → ISO numeric. Pomáhá u území a zemí, které se v mapovém datasetu jmenují jinak než v API. */

/* Souřadnice pro API destinace, které některé mapové datasety neobsahují jako samostatný polygon. */

/* API destinace, které nejsou běžný stát v polygonové mapě.
   mapId = nadřazený nebo nejbližší polygon; coords = přesný bod pro region/ostrov. */

function apiRowKeys(row){
  const keys=[row?.id,row?.slug,row?.countryId,row?.name,row?.title];
  if(row?.www)keys.push(String(row.www).split('?')[0].split('#')[0].split('/').filter(Boolean).pop());
  return unique(keys.map(slugKey));
}

function forcedIsoForRow(row){
  for(const k of apiRowKeys(row)){
    if(FORCE_ISO_BY_KEY[k])return FORCE_ISO_BY_KEY[k];
  }
  return null;
}

function apiDestinationMapping(row){
  for(const k of apiRowKeys(row)){
    if(CUSTOM_DESTINATION_MAP[k])return CUSTOM_DESTINATION_MAP[k];
    if(API_DESTINATION_MAP[k])return API_DESTINATION_MAP[k];
  }
  return null;
}

function mappedIdForInfo(id,info){
  return normId(info?.mapId ?? id);
}

function buildApiIndex(list){
  const bySlug=new Map();
  const byName=new Map();
  const rows=Array.isArray(list)?list:[];

  rows.forEach(c=>{
    const entry={...c};
    const idSlug=slugKey(c.id||c.slug||c.countryId||'');
    const nameSlug=slugKey(c.name||c.title||'');

    if(idSlug)bySlug.set(idSlug,entry);
    if(nameSlug)byName.set(nameSlug,entry);

    /* Kdyby API nevracelo id, ale jen www, zkusíme vytáhnout slug z URL. */
    if(c.www){
      const last=String(c.www).split('?')[0].split('#')[0].split('/').filter(Boolean).pop();
      const wwwSlug=slugKey(last);
      if(wwwSlug)bySlug.set(wwwSlug,entry);
    }
  });

  return{rows,bySlug,byName};
}

function findApiEntry(api,numId,en,cz){
  const keys=countryKeys(numId,en,cz);
  for(const k of keys){if(api.bySlug.has(k))return api.bySlug.get(k);}
  for(const k of keys){if(api.byName.has(k))return api.byName.get(k);}
  return null;
}

/* Jediný zdroj pravdy pro velikost bodů. Dříve se hodnoty lišily mezi
   updateMarkerScale, repaintMap a resetSel, takže body při zoomu poskakovaly. */
const MARKER_R={base:3,hover:4,selected:5};
const MARKER_STROKE={base:1,hover:1.2,selected:1.7};

function isSelectedMarker(id){
  return selMarkId!==null && normId(id)===normId(selMarkId);
}

function markerBaseRadius(id){
  return isSelectedMarker(id)?MARKER_R.selected:MARKER_R.base;
}

function markerBaseStroke(id){
  return isSelectedMarker(id)?MARKER_STROKE.selected:MARKER_STROKE.base;
}

function updateMarkerScale(){
  if(!gv)return;
  const k=currentZoomK||1;
  d3.selectAll('circle.dest-marker')
    .attr('r',d=>markerBaseRadius(d.id)/k)
    .attr('stroke-width',d=>markerBaseStroke(d.id)/k);
}

/* Kombinace má vlastní barvu. Barvy jednotlivých nemocí by u průniku nedávaly
   smysl – destinace odpovídá všem vybraným najednou, ne jedné z nich. */
const COMBO_COLOR='#CA005D';
const COMBO_HOVER='#a9004e';

/* ── Trasa přes více destinací ──
   Trasa je vrstva nad filtrem, ne jeho náhrada. Proto se nekreslí výplní
   (tu si drží filtr), ale výrazným obrysem – obojí je pak čitelné zároveň. */
const ROUTE_COLOR='#F2B705';
let routeIds=[];

function isInRoute(id){
  const nid=normId(id);
  return routeIds.some(x=>normId(x)===nid);
}

function strokeForId(id,{hover=false}={}){
  if(isInRoute(id))return ROUTE_COLOR;
  return hover?MC.brdH:MC.brd;
}

function strokeWidthForId(id,{hover=false}={}){
  if(isInRoute(id))return 1.7;
  return hover?.85:.45;
}

function activeDiseaseKeys(){
  if(!activeDisease||activeDisease==='all')return [];
  return unique([activeDisease,...extraDiseases]);
}

function isCombination(){
  return extraDiseases.length>0;
}

/* Průnik napříč vybranými nemocemi. Podfiltry (žlutá zimnice, dengue) se
   v kombinaci neuplatňují – nemoc do průniku vstupuje celá. */
function combinedHits(){
  if(combinedHitsCache)return combinedHitsCache;
  const keys=activeDiseaseKeys();
  if(!keys.length)return new Set();
  let result=null;
  keys.forEach(key=>{
    const hits=effectiveDiseaseHits(key);
    if(result===null){
      result=new Set(hits);
      return;
    }
    result=new Set([...result].filter(id=>hits.has(id)));
  });
  combinedHitsCache=result||new Set();
  return combinedHitsCache;
}

function invalidateCombinedHits(){
  combinedHitsCache=null;
}

/* Jediné místo, kde se rozhoduje, jestli destinace odpovídá aktuálnímu filtru. */
function matchesActiveFilter(id){
  if(!activeDisease||activeDisease==='all')return true;
  if(isCombination())return combinedHits().has(normId(id));
  return diseaseContainsMapId(activeDisease,id);
}

function colorForId(id){
  const nid=normId(id);
  const info=FI.get(nid);
  if(!info?.has)return MC.none;
  if(activeDisease && activeDisease!=='all'){
    if(isCombination())return matchesActiveFilter(nid)?COMBO_COLOR:MC.dim;
    const hits=diseaseIndex.get(activeDisease);
    if(!hits)return MC.dim;
    if(!diseaseContainsMapId(activeDisease,nid))return MC.dim;
    const facet=diseaseFacetForMapId(activeDisease,nid);
    return facet?DISEASES[activeDisease]?.facetColors?.[facet]||DISEASES[activeDisease].color:DISEASES[activeDisease].color;
  }
  return MC.has;
}

function hoverColorForId(id){
  const nid=normId(id);
  if(activeDisease && activeDisease!=='all'){
    if(isCombination())return matchesActiveFilter(nid)?COMBO_HOVER:MC.dim;
    if(!diseaseIndex.has(activeDisease))return MC.dim;
    if(!diseaseContainsMapId(activeDisease,nid))return MC.dim;
    const facet=diseaseFacetForMapId(activeDisease,nid);
    return facet?DISEASES[activeDisease]?.facetHover?.[facet]||DISEASES[activeDisease].hover:DISEASES[activeDisease].hover;
  }
  return MC.hov;
}

function combinationLabel(separator=' + '){
  return activeDiseaseKeys().map(key=>DISEASES[key]?.label||key).join(separator);
}

function bf(d){
  return colorForId(featureId(d));
}

function resetSel(){
  if(selEl){
    d3.select(selEl).attr('fill',bf(selD)).attr('stroke',strokeForId(featureId(selD))).attr('stroke-width',strokeWidthForId(featureId(selD)));
  }
  if(selMark){
    const k=currentZoomK||1;
    d3.select(selMark).attr('r',MARKER_R.base/k).attr('fill',colorForId(selMarkId)).attr('stroke','rgba(255,255,255,0.55)').attr('stroke-width',MARKER_STROKE.base/k);
  }
  selEl=null;selD=null;selMark=null;selMarkId=null;
}

/* ── Přímé načítání Avenier API ── */
const APIS='https://www.ockovacicentrum.cz/api/country';
let curSlug=null;
let curInfo=null;
const defaultDiseaseRowFields=['diseases','diseaseKeys','disease_tags','diseaseTags','risks','riskTags','vaccines','vaccinationTags','tags'];
const diseaseIndexApiUrl=(typeof DISEASE_INDEX_API_URL==='string' && DISEASE_INDEX_API_URL.trim())?DISEASE_INDEX_API_URL.trim():null;
const diseaseIndexRowFields=Array.isArray(typeof DISEASE_INDEX_ROW_FIELDS==='undefined'?null:DISEASE_INDEX_ROW_FIELDS)
  ? DISEASE_INDEX_ROW_FIELDS
  : defaultDiseaseRowFields;
let diseaseIndexApiLoadPromise=null;
let diseaseIndexGeneratedAt=null;

function getCachedDetailState(slug){
  const key=String(slug||'');
  const entry=detailCache.get(key);
  if(!entry)return 'miss';
  if(entry.status==='ok'){
    if(Date.now()-entry.ts<DETAIL_SUCCESS_TTL_MS)return 'ok';
    detailCache.delete(key);
    scheduleDetailCachePersist();
    return 'miss';
  }
  if(Date.now()-entry.ts<DETAIL_ERROR_RETRY_MS)return 'error';
  detailCache.delete(key);
  return 'miss';
}

function getCachedDetail(slug){
  const key=String(slug||'');
  if(getCachedDetailState(key)!=='ok')return null;
  const entry=detailCache.get(key);
  return entry?.data||null;
}

function setCachedDetailSuccess(slug,data){
  detailCache.set(String(slug||''),{status:'ok',data,ts:Date.now()});
  scheduleDetailCachePersist();
}

function setCachedDetailError(slug){
  detailCache.set(String(slug||''),{status:'error',ts:Date.now()});
}

function hydrateDetailCache(){
  try{
    const raw=localStorage.getItem(DETAIL_STORAGE_KEY);
    const saved=raw?JSON.parse(raw):null;
    if(saved?.version!==1||!Array.isArray(saved.entries))return;
    const now=Date.now();
    saved.entries.forEach(entry=>{
      if(!entry?.slug||!entry?.data||!Number.isFinite(entry.ts))return;
      if(now-entry.ts>=DETAIL_SUCCESS_TTL_MS)return;
      detailCache.set(String(entry.slug),{status:'ok',data:entry.data,ts:entry.ts});
    });
  }catch(e){
    /* Cache je pouze optimalizace; poškozený nebo zakázaný localStorage ignorujeme. */
  }
}

function persistDetailCache(){
  try{
    const entries=[];
    const now=Date.now();
    detailCache.forEach((entry,slug)=>{
      if(entry?.status!=='ok'||!entry.data||now-entry.ts>=DETAIL_SUCCESS_TTL_MS)return;
      entries.push({slug,ts:entry.ts,data:entry.data});
    });
    localStorage.setItem(DETAIL_STORAGE_KEY,JSON.stringify({version:1,savedAt:now,entries}));
  }catch(e){
    /* Při nedostupném nebo zaplněném úložišti aplikace pokračuje bez persistence. */
  }
}

function scheduleDetailCachePersist(){
  if(detailCachePersistTimer)clearTimeout(detailCachePersistTimer);
  detailCachePersistTimer=setTimeout(()=>{
    detailCachePersistTimer=null;
    persistDetailCache();
  },350);
}

hydrateDetailCache();

async function apiFetch(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),API_FETCH_TIMEOUT_MS);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!r.ok)return null;
    const d=await r.json();
    return d||null;
  }catch(e){
    return null;
  }finally{
    clearTimeout(timeout);
  }
}

/* ── HTML escape ── */
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function pillHtml(v,cls){
  const name=esc(v?.name||v?.title||v);
  const url=v?.url||v?.www||'';
  if(url)return `<a class="pill ${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>`;
  return `<span class="pill ${cls}">${name}</span>`;
}

function diseaseItems(data){
  return [
    ...(Array.isArray(data?.povinne)?data.povinne:[]),
    ...(Array.isArray(data?.zakladni)?data.zakladni:[]),
    ...(Array.isArray(data?.doporuceni)?data.doporuceni:[])
  ];
}

function diseaseItemText(item){
  if(typeof item==='string')return item;
  return [item?.name,item?.title,item?.url,item?.www].filter(Boolean).join(' ');
}

function dataHasDisease(data,key){
  const cfg=DISEASES[key];
  if(!cfg||!data)return false;
  return diseaseItems(data).some(item=>{
    const txt=slugKey(diseaseItemText(item));
    const excluded=(cfg.excludeAliases||[]).some(a=>txt.includes(slugKey(a)));
    if(excluded)return false;
    return cfg.aliases.some(a=>txt.includes(slugKey(a)));
  });
}

function diseaseItemName(item){
  if(typeof item==='string')return item;
  return item?.name||item?.title||'';
}

function yellowFeverFlags(data){
  const required=(Array.isArray(data?.povinne)?data.povinne:[]).map(item=>slugKey(diseaseItemName(item)));
  const recommended=[
    ...(Array.isArray(data?.zakladni)?data.zakladni:[]),
    ...(Array.isArray(data?.doporuceni)?data.doporuceni:[])
  ].map(item=>slugKey(diseaseItemName(item)));
  const conditionalEntry=required.some(name=>name.includes('zluta-zimnice-pri-priletu-z-endemicke-oblasti'));
  const generalEntry=required.some(name=>name==='zluta-zimnice');
  const apiRecommendation=recommended.some(name=>name==='zluta-zimnice');
  return{
    entry:conditionalEntry||generalEntry,
    riskCandidate:generalEntry||apiRecommendation
  };
}

async function fetchCountryDetail(info){
  if(!info?.has||!info.slug)return null;
  const cacheState=getCachedDetailState(info.slug);
  if(cacheState==='ok')return getCachedDetail(info.slug);
  if(cacheState==='error')return null;
  if(detailLoading.has(info.slug))return detailLoading.get(info.slug);
  const promise=apiFetch(`${APIS}/${encodeURIComponent(info.slug)}`).then(d=>{
    detailLoading.delete(info.slug);
    if(d && typeof d==='object'){
      setCachedDetailSuccess(info.slug,d);
      return d;
    }
    setCachedDetailError(info.slug);
    return null;
  }).catch(e=>{
    detailLoading.delete(info.slug);
    setCachedDetailError(info.slug);
    console.warn('Detail destinace se nepodařilo načíst:',info.slug,e);
    return null;
  });
  detailLoading.set(info.slug,promise);
  return promise;
}

function toDiseaseKey(token){
  const t=slugKey(token);
  if(!t)return null;
  if(DISEASES[t])return t;
  for(const [key,cfg] of Object.entries(DISEASES)){
    if(slugKey(cfg.label)===t)return key;
    if((cfg.aliases||[]).some(a=>slugKey(a)===t))return key;
  }
  return null;
}

function collectDiseaseTokens(value,out){
  if(value===null || value===undefined)return;
  if(Array.isArray(value)){
    value.forEach(v=>collectDiseaseTokens(v,out));
    return;
  }
  if(typeof value==='object'){
    ['key','id','slug','name','title','disease','risk'].forEach(k=>{
      if(value[k]!==undefined)collectDiseaseTokens(value[k],out);
    });
    return;
  }
  if(typeof value==='string' || typeof value==='number'){
    out.push(String(value));
  }
}

function extractDiseaseKeysFromRow(row){
  const tokens=[];
  diseaseIndexRowFields.forEach(field=>collectDiseaseTokens(row?.[field],tokens));
  const keys=new Set();
  tokens.forEach(t=>{
    const key=toDiseaseKey(t);
    if(key)keys.add(key);
  });
  return [...keys];
}

function resolveApiRowDestinationIds(row){
  const mapped=apiDestinationMapping(row);
  if(mapped){
    const rawSlug=row?.id||row?.slug||apiRowKeys(row)[0]||'unknown';
    return [normId(mapped.id ?? `api:${rawSlug}`)];
  }
  const forced=forcedIsoForRow(row);
  if(forced)return [normId(forced)];

  const keys=new Set(apiRowKeys(row));
  if(!keys.size)return [];

  const ids=[];
  FI.forEach((info,id)=>{
    const slug=slugKey(info.slug);
    const name=slugKey(info.name);
    if((slug && keys.has(slug)) || (name && keys.has(name))){
      ids.push(normId(id));
    }
  });
  return unique(ids.map(normId));
}

function upsertDiseaseIndex(key,ids,source){
  const normalizedIds=unique((ids||[]).map(normId).filter(id=>id!==null && id!==undefined));
  if(!normalizedIds.length)return;
  const set=diseaseIndex.get(key)||new Set();
  normalizedIds.forEach(id=>set.add(id));
  diseaseIndex.set(key,set);
  if(!diseaseIndexSource.has(key))diseaseIndexSource.set(key,source);
}

function parseDiseaseIndexIds(raw){
  if(Array.isArray(raw))return raw;
  if(raw && typeof raw==='object'){
    if(Array.isArray(raw.ids))return raw.ids;
    if(Array.isArray(raw.countryIds))return raw.countryIds;
    if(Array.isArray(raw.destinations))return raw.destinations;
    if(Array.isArray(raw.destinationSlugs))return raw.destinationSlugs;
    if(Array.isArray(raw.slugs))return raw.slugs;
  }
  return [];
}

function resolveDiseaseIndexDestinationIds(rawIds){
  const resolved=[];
  (rawIds||[]).forEach(raw=>{
    const direct=normId(raw);
    if(FI.has(direct)){
      resolved.push(direct);
      return;
    }
    const key=slugKey(raw);
    if(!key)return;
    FI.forEach((info,id)=>{
      if(slugKey(info?.slug)===key||slugKey(info?.name)===key)resolved.push(normId(id));
    });
  });
  return unique(resolved);
}

function mergeDiseaseIndexPayload(payload,source='api-index'){
  if(!payload)return 0;
  let merged=0;

  if(Array.isArray(payload)){
    payload.forEach(item=>{
      const key=toDiseaseKey(item?.key||item?.disease||item?.name);
      if(!key)return;
      const ids=resolveDiseaseIndexDestinationIds(parseDiseaseIndexIds(item));
      if(ids.length){
        upsertDiseaseIndex(key,ids,source);
        merged++;
      }
    });
    return merged;
  }

  const root=(payload && typeof payload==='object' && payload.diseases && typeof payload.diseases==='object')
    ? payload.diseases
    : payload;
  if(!root || typeof root!=='object')return 0;

  Object.entries(root).forEach(([rawKey,rawVal])=>{
    const key=toDiseaseKey(rawKey);
    if(!key)return;
    const ids=resolveDiseaseIndexDestinationIds(parseDiseaseIndexIds(rawVal));
    if(ids.length){
      upsertDiseaseIndex(key,ids,source);
      merged++;
    }
    if(key==='dengue'&&rawVal?.facets){
      const endemic=new Set(resolveDiseaseIndexDestinationIds(rawVal.facets.endemicDestinationSlugs||rawVal.facets.endemic||[]));
      const general=new Set(resolveDiseaseIndexDestinationIds(rawVal.facets.generalDestinationSlugs||rawVal.facets.general||[]));
      if(endemic.size||general.size)diseaseFacets.set('dengue',{endemic,general});
    }
  });
  return merged;
}

function seedDiseaseIndexFromApiRows(rows){
  let added=0;
  (rows||[]).forEach(row=>{
    const diseaseKeys=extractDiseaseKeysFromRow(row);
    if(!diseaseKeys.length)return;
    const ids=resolveApiRowDestinationIds(row);
    if(!ids.length)return;
    diseaseKeys.forEach(key=>{
      upsertDiseaseIndex(key,ids,'api-row');
      added++;
    });
  });
  return added;
}

function staticDiseaseConfig(key){
  if(typeof STATIC_DISEASE_INDEX==='undefined' || !STATIC_DISEASE_INDEX)return null;
  return STATIC_DISEASE_INDEX[key]||null;
}

function seedDiseaseIndexFromStaticConfig(rows){
  if(typeof STATIC_DISEASE_INDEX==='undefined' || !STATIC_DISEASE_INDEX)return{added:0,unmatched:[]};
  const rowBySlug=new Map();
  (rows||[]).forEach(row=>apiRowKeys(row).forEach(key=>rowBySlug.set(key,row)));
  let added=0;
  const unmatched=[];

  Object.entries(STATIC_DISEASE_INDEX).forEach(([key,cfg])=>{
    if(cfg?.seed===false)return;
    const ids=[];
    (cfg?.destinationSlugs||[]).forEach(rawSlug=>{
      const slug=slugKey(rawSlug);
      const row=rowBySlug.get(slug);
      if(!row){
        unmatched.push({key,slug});
        return;
      }
      const resolved=resolveApiRowDestinationIds(row);
      if(!resolved.length){
        unmatched.push({key,slug});
        return;
      }
      ids.push(...resolved);
    });
    if(ids.length){
      upsertDiseaseIndex(key,ids,'static-index');
      added+=unique(ids.map(normId)).length;
    }
  });
  return{added,unmatched};
}

async function loadDiseaseIndexFromApiIfConfigured(){
  if(!diseaseIndexApiUrl)return;
  if(diseaseIndexApiLoadPromise)return diseaseIndexApiLoadPromise;
  diseaseIndexApiLoadPromise=apiFetch(diseaseIndexApiUrl).then(payload=>{
    if(payload){
      mergeDiseaseIndexPayload(payload,'api-index');
      diseaseIndexGeneratedAt=payload?.generatedAt||null;
    }
    return payload;
  }).catch(e=>{
    console.warn('Backendový index nemocí se nepodařilo načíst:',e);
    return null;
  });
  return diseaseIndexApiLoadPromise;
}

function indexedYellowFeverFacets(payload){
  const raw=payload?.yellowFever;
  if(!raw)return null;
  const entry=new Set(resolveDiseaseIndexDestinationIds(raw.entryDestinationSlugs||raw.entry||[]));
  const apiRiskCandidates=new Set(resolveDiseaseIndexDestinationIds(raw.riskCandidateDestinationSlugs||raw.riskCandidates||[]));
  if(!entry.size&&!apiRiskCandidates.size)return null;
  return{entry,apiRiskCandidates};
}

async function buildDiseaseIndexFromDetails(key,{token=null}={}){
  const status=document.getElementById('filter-status');
  const loader=document.getElementById('filter-loader');
  const isCurrent=()=>token===null || token===filterRequestToken;
  if(status && isCurrent())status.textContent=`Načítám filtr: ${DISEASES[key].label}…`;
  if(loader && isCurrent())loader.classList.add('on');

  const countries=[...FI.entries()].filter(([,info])=>info.has&&info.slug);
  const hits=new Set();
  const failures=new Set();
  let done=0;
  const limit=8;
  let cursor=0;

  async function worker(){
    while(cursor<countries.length){
      const [id,info]=countries[cursor++];
      const data=await fetchCountryDetail(info);
      if(data){
        if(dataHasDisease(data,key))hits.add(normId(id));
      }else{
        failures.add(normId(id));
      }
      done++;
      if(status && isCurrent() && (done%12===0 || done===countries.length)){
        status.textContent=`Načítám filtr: ${DISEASES[key].label} · ${done}/${countries.length}`;
      }
    }
  }

  await Promise.all(Array.from({length:Math.min(limit,countries.length)},worker));
  diseaseIndex.set(key,hits);
  diseaseIndexSource.set(key,failures.size?'detail-partial':'detail');
  diseaseIndexMeta.set(key,{
    total:countries.length,
    loaded:countries.length-failures.size,
    failures,
    retryAt:failures.size?Date.now()+DETAIL_ERROR_RETRY_MS:null
  });
  if(loader && isCurrent())loader.classList.remove('on');
  if(status && isCurrent())status.textContent=`${DISEASES[key].label}: zvýrazněno ${countDestinations(hits.size)}.`;
  return hits;
}

function configuredStaticIds(key){
  const cfg=staticDiseaseConfig(key);
  const slugs=new Set((cfg?.destinationSlugs||[]).map(slugKey));
  const ids=new Set();
  FI.forEach((info,id)=>{
    if(slugs.has(slugKey(info?.slug)))ids.add(normId(id));
  });
  return ids;
}

/* Některá rozšířená cestovatelská rizika doplňujeme z veřejných odborných
   zdrojů. V detailu je držíme odděleně od doporučení pro destinaci, aby bylo
   vždy zřejmé, odkud informace pochází. Pokud už je nemoc uvedena přímo v
   doporučeních destinace, podruhé ji zde neopakujeme. */
const EXTERNAL_DETAIL_DISEASES=['yellow-fever','malaria','chikungunya','zika','leishmaniasis','chagas'];
const EXTERNAL_DETAIL_SUMMARIES={
  'yellow-fever':'Riziko výskytu nebo vstupní podmínka',
  malaria:'Výskyt alespoň v části území',
  chikungunya:'Aktuální ohnisko nebo zvýšené riziko',
  zika:'Současný nebo dřívější místní přenos',
  leishmaniasis:'Vyšší hlášená zátěž',
  chagas:'Endemický výskyt podle WHO'
};

function externalDiseaseItems(info,data){
  if(!info)return[];
  const id=normId(info.id??info.numId);
  return EXTERNAL_DETAIL_DISEASES.flatMap(key=>{
    const disease=DISEASES[key];
    const source=staticDiseaseConfig(key);
    if(!disease||!source||!configuredStaticIds(key).has(id)||dataHasDisease(data,key))return[];
    return[{key,label:disease.label,summary:EXTERNAL_DETAIL_SUMMARIES[key]||'Doplňující informace pro cestovatele',url:disease.url,sourceLabel:source.sourceLabel,sourceUrl:source.sourceUrl,reviewedLabel:source.reviewedLabel,note:source.note}];
  });
}

function externalDiseaseSectionHtml(info,data){
  const items=externalDiseaseItems(info,data);
  if(!items.length)return'';
  return `<section class="external-diseases" id="vax-section-external" aria-labelledby="external-diseases-title">
    <div class="external-diseases-head">
      <div>
        <p class="external-kicker">Doplňující odborné zdroje</p>
        <h3 id="external-diseases-title">Rizika podle CDC a WHO</h3>
      </div>
      <span class="external-count">${countWithNoun(items.length,...COUNT_FORMS.external)}</span>
    </div>
    <p class="external-intro">Tyto informace doplňují cestovní doporučení výše. Vycházejí z veřejných podkladů CDC nebo WHO a mohou se měnit rychleji.</p>
    <div class="external-grid">${items.map(item=>`<details class="external-card">
      <summary>
        <span class="external-copy"><span class="external-name">${esc(item.label)}</span><span class="external-summary">${esc(item.summary)}</span></span>
        <span class="external-source-chip">${esc(item.sourceLabel.startsWith('WHO')?'WHO':'CDC')}</span>
        <span class="external-toggle" aria-hidden="true">+</span>
      </summary>
      <div class="external-body">
        <p>${esc(item.note)}</p>
        <div class="external-meta">
          <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Více o nemoci na Očkovacím centru ↗</a>
          <a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Zdroj: ${esc(item.sourceLabel)} ↗</a>
          ${item.reviewedLabel?`<span>${esc(item.reviewedLabel)}</span>`:''}
        </div>
      </div>
    </details>`).join('')}</div>
  </section>`;
}

function consultationNoteHtml(){
  return `<aside class="consult-note"><strong>Doporučení přizpůsobené vaší cestě</strong><span>Konkrétní ochrana závisí na trase, délce pobytu, způsobu cestování i zdravotním stavu. Naši specialisté s vámi projdou očkování i další rizika osobně.</span></aside>`;
}

/* Místní riziko žluté zimnice = sjednocení obou zdrojů.
   Doporučení Avenier API má přednost: pokud API destinaci uvádí, zůstane
   zvýrazněná i tehdy, když ji statický snímek CDC nemá. CDC seznam slouží
   jako doplněk, ne jako filtr, který by data klienta přebíjel. */
function combineYellowFeverRisk(apiRiskCandidates,cdcRisk){
  const api=apiRiskCandidates||new Set();
  const cdc=cdcRisk||new Set();
  const risk=new Set([...api,...cdc]);
  const apiOnly=new Set([...api].filter(id=>!cdc.has(id)));
  const cdcOnly=new Set([...cdc].filter(id=>!api.has(id)));
  return{risk,apiOnly,cdcOnly};
}

function destinationNames(ids){
  return [...(ids||[])].map(id=>FI.get(normId(id))?.name||id);
}

function logYellowFeverSourceDiff(apiOnly,cdcOnly){
  if(apiOnly?.size)console.info('Žlutá zimnice – místní riziko pouze podle Avenier API (zahrnuto):',destinationNames(apiOnly));
  if(cdcOnly?.size)console.info('Žlutá zimnice – místní riziko pouze podle CDC (zahrnuto):',destinationNames(cdcOnly));
}

async function buildYellowFeverClassification({token=null}={}){
  const previousMeta=diseaseIndexMeta.get('yellow-fever');
  const retryDue=previousMeta?.failures?.size && Date.now()>=(previousMeta.retryAt||0);
  if(diseaseFacets.has('yellow-fever')&&!retryDue)return diseaseFacets.get('yellow-fever');
  if(yellowFeverLoadPromise)return yellowFeverLoadPromise;

  const status=document.getElementById('filter-status');
  const isCurrent=()=>token===null || token===filterRequestToken;
  const countries=[...FI.entries()].filter(([,info])=>info.has&&info.slug);
  const cdcRisk=configuredStaticIds('yellow-fever');

  yellowFeverLoadPromise=(async()=>{
    const indexed=indexedYellowFeverFacets(await loadDiseaseIndexFromApiIfConfigured());
    if(indexed){
      const {risk,apiOnly,cdcOnly}=combineYellowFeverRisk(indexed.apiRiskCandidates,cdcRisk);
      const facets={risk,entry:indexed.entry,apiRiskCandidates:indexed.apiRiskCandidates,apiOnly,cdcOnly,failures:new Set()};
      diseaseIndex.set('yellow-fever',risk);
      diseaseIndexSource.set('yellow-fever','hybrid-index');
      diseaseIndexMeta.set('yellow-fever',{total:countries.length,loaded:countries.length,failures:new Set(),retryAt:null});
      diseaseFacets.set('yellow-fever',facets);
      logYellowFeverSourceDiff(apiOnly,cdcOnly);
      return facets;
    }

    const entry=new Set();
    const apiRiskCandidates=new Set();
    const failures=new Set();
    let done=0;
    let cursor=0;

    async function worker(){
      while(cursor<countries.length){
        const [id,info]=countries[cursor++];
        const nid=normId(id);
        const data=await fetchCountryDetail(info);
        if(data){
          const flags=yellowFeverFlags(data);
          if(flags.entry)entry.add(nid);
          if(flags.riskCandidate)apiRiskCandidates.add(nid);
        }else{
          failures.add(nid);
        }
        done++;
        if(status && isCurrent() && (done%12===0 || done===countries.length)){
          status.textContent=`Načítám vstupní podmínky žluté zimnice · ${done}/${countries.length}`;
        }
      }
    }

    await Promise.all(Array.from({length:Math.min(8,countries.length)},worker));
    const {risk,apiOnly,cdcOnly}=combineYellowFeverRisk(apiRiskCandidates,cdcRisk);
    const facets={risk,entry,apiRiskCandidates,apiOnly,cdcOnly,failures};
    diseaseIndex.set('yellow-fever',risk);
    diseaseIndexSource.set('yellow-fever',failures.size?'hybrid-partial':'hybrid');
    diseaseIndexMeta.set('yellow-fever',{
      total:countries.length,
      loaded:countries.length-failures.size,
      failures,
      retryAt:failures.size?Date.now()+DETAIL_ERROR_RETRY_MS:null
    });
    diseaseFacets.set('yellow-fever',facets);
    logYellowFeverSourceDiff(apiOnly,cdcOnly);
    return facets;
  })().finally(()=>{yellowFeverLoadPromise=null;});

  return yellowFeverLoadPromise;
}

async function ensureDiseaseIndex(key,{token=null}={}){
  if(key==='yellow-fever'){
    await buildYellowFeverClassification({token});
    return diseaseIndex.get(key)||new Set();
  }
  if(diseaseIndex.has(key)){
    const meta=diseaseIndexMeta.get(key);
    if(meta?.failures?.size && Date.now()>=(meta.retryAt||0)){
      return buildDiseaseIndexFromDetails(key,{token});
    }
    if(!diseaseIndexSource.has(key))diseaseIndexSource.set(key,'cache');
    return diseaseIndex.get(key);
  }
  await loadDiseaseIndexFromApiIfConfigured();
  if(diseaseIndex.has(key))return diseaseIndex.get(key);
  return buildDiseaseIndexFromDetails(key,{token});
}

function effectiveDiseaseHits(key){
  const base=new Set([...(diseaseIndex.get(key)||new Set())]);
  if(key==='yellow-fever'){
    (diseaseFacets.get(key)?.entry||new Set()).forEach(id=>base.add(normId(id)));
  }
  const o=CUSTOM_DISEASE_OVERRIDES[key];
  if(!o)return base;
  const inc=setToSetValues(o.include);
  const exc=setToSetValues(o.exclude);
  inc.forEach(id=>base.add(id));
  exc.forEach(id=>base.delete(id));
  return base;
}

function visibleDiseaseHits(key){
  const hits=effectiveDiseaseHits(key);
  if(key==='yellow-fever'&&activeYellowFeverFacet!=='all'){
    return new Set([...hits].filter(id=>diseaseFacetForId(key,id)===activeYellowFeverFacet));
  }
  if(key==='dengue'&&activeDengueFacet!=='all'){
    return new Set([...hits].filter(id=>diseaseFacetForId(key,id)===activeDengueFacet));
  }
  return hits;
}

function diseaseContainsMapId(key,id){
  /* Samostatný cestovatelský region (např. Zanzibar nebo Bali) nesmí svým
     výsledkem obarvit celý nadřazený stát. Region má vlastní bod v mapě;
     polygon státu se řídí pouze výsledkem daného státu. */
  return visibleDiseaseHits(key).has(normId(id));
}

function diseaseFacetForId(key,id){
  const nid=normId(id);
  if(!effectiveDiseaseHits(key).has(nid))return null;
  if(key==='dengue'){
    const facets=diseaseFacets.get(key);
    if(facets?.endemic?.has(nid))return'endemic';
    if(facets?.general?.has(nid))return'general';
    return null;
  }
  if(key!=='yellow-fever')return null;
  const facets=diseaseFacets.get(key);
  const risk=facets?.risk?.has(nid)||false;
  const entry=facets?.entry?.has(nid)||false;
  if(risk&&entry)return'both';
  if(entry)return'entry';
  return'risk';
}

function diseaseFacetForMapId(key,id){
  if(!diseaseContainsMapId(key,id))return null;
  const nid=normId(id);
  if(key==='dengue'){
    const facets=diseaseFacets.get(key);
    if(facets?.endemic?.has(nid))return'endemic';
    if(facets?.general?.has(nid))return'general';
    return null;
  }
  if(key!=='yellow-fever')return null;
  const facets=diseaseFacets.get(key);
  const risk=facets?.risk?.has(nid)||false;
  const entry=facets?.entry?.has(nid)||false;
  if(risk&&entry)return'both';
  if(entry)return'entry';
  return'risk';
}

function renderFilterResults(){
  const box=document.getElementById('filter-results');
  if(!box)return;

  if(!activeDisease||activeDisease==='all'){
    box.classList.remove('open');
    box.innerHTML='';
    box.hidden=true;
    return;
  }

  const cfg=DISEASES[activeDisease];
  const combo=isCombination();
  const hits=[...(combo?combinedHits():visibleDiseaseHits(activeDisease))]
    .map(id=>({id,info:FI.get(normId(id))}))
    .filter(x=>x.info)
    .sort((a,b)=>a.info.name.localeCompare(b.info.name,'cs'));

  box.hidden=false;
  box.classList.add('open');

  const chipFor=({id,info})=>{
    if(combo)return `<button class="fr-chip combo" type="button" data-fr-country="${esc(id)}">${esc(info.name)}</button>`;
    const facet=diseaseFacetForId(activeDisease,id);
    const facetLabel=facet==='both'?'místní riziko a vstupní podmínka':facet==='entry'?'vstupní podmínka':facet==='risk'?'místní riziko žluté zimnice':facet==='endemic'?'endemický výskyt dengue':facet==='general'?'obecné doporučení k dengue':'';
    const facetClass=activeDisease==='yellow-fever'&&facet?` yf-${facet}`:activeDisease==='dengue'&&facet?` dg-${facet}`:'';
    return `<button class="fr-chip${facetClass}" type="button" data-fr-country="${esc(id)}"${facetLabel?` title="${esc(facetLabel)}"`:''}>${esc(info.name)}</button>`;
  };
  const chips=hits.map(chipFor).join('');
  const isYellowFever=!combo&&activeDisease==='yellow-fever';
  const isDengue=!combo&&activeDisease==='dengue';
  const sourceNote=combo?combinationSourceNote():(isYellowFever||isDengue?'':filterSourceNote(activeDisease,hits.length));
  const facetOverview=isYellowFever?yellowFeverOverview():isDengue?dengueOverview():'';
  const emptyText=combo
    ? 'Žádná destinace neodpovídá všem vybraným nemocem zároveň. Zkuste některou z kombinace odebrat.'
    : 'Pro tento filtr se zatím nepodařilo najít žádnou destinaci. Může jít o riziko, které zatím není u destinací jednotně vedené.';
  const resultsContent=isYellowFever
    ? yellowFeverColumns(hits,chipFor)
    : (hits.length?`<div class="fr-grid">${chips}</div>`:`<div class="fr-empty">${esc(emptyText)}</div>`);
  const mismatch=filterDestinationMismatch?`<aside class="fr-mismatch" role="status">
    <div><strong>${esc(filterDestinationMismatch.name)} neodpovídá aktuálnímu filtru.</strong><span>Proto jsme mapu na tuto destinaci nepřiblížili. Můžete pokračovat ve filtru, nebo jej zrušit a otevřít doporučení pro destinaci.</span></div>
    <button type="button" data-show-mismatch-country="${esc(filterDestinationMismatch.id)}">Zrušit filtr a otevřít destinaci</button>
  </aside>`:'';

  box.innerHTML=`<div class="fr-head">
    <div>
      <div class="fr-title">${combo?`${esc(combinationLabel())} – destinace se všemi vybranými riziky`:`${esc(cfg?.label||'Vybraný filtr')}${isYellowFever&&activeYellowFeverFacet!=='all'?` – ${esc(yellowFeverFacetLabel(activeYellowFeverFacet))}`:isDengue&&activeDengueFacet!=='all'?` – ${esc(dengueFacetLabel(activeDengueFacet))}`:' – destinace v aktuálním filtru'}`}</div>
      <div class="fr-count"><strong>${hits.length}</strong> ${esc(destinationsWord(hits.length))}</div>
      <div class="fr-sub">Kliknutím na destinaci otevřete detail v mapě. Další související nemoci a rizika najdete po otevření detailu destinace.</div>
    </div>
  </div>
  ${mismatch}
  ${facetOverview}
  ${sourceNote}
  ${resultsContent}`;

  box.querySelectorAll('[data-fr-country]').forEach(btn=>{
    btn.addEventListener('click',()=>selectCountry(normId(btn.dataset.frCountry)));
  });
  box.querySelector('[data-show-mismatch-country]')?.addEventListener('click',async event=>{
    const id=normId(event.currentTarget.dataset.showMismatchCountry);
    await setDiseaseFilter('all');
    selectCountry(id);
  });
  bindYellowFeverFacetControls(box);
  bindDengueFacetControls(box);
}

/* Jedno místo pro vysvětlení kategorií. Používá se ve třech podobách:
   bublina po najetí myší, rozbalovací vysvětlivka v mapě (funguje i na
   dotykovém displeji) a plný přehled nad výsledky. */
const FACET_INFO={
  'yellow-fever':{
    all:{
      label:'Vše',
      text:'Zobrazí všechny destinace v tomto filtru bez ohledu na kategorii.'
    },
    risk:{
      label:'Pouze místní riziko',
      text:'Žlutá zimnice se v destinaci vyskytuje a očkování se doporučuje alespoň pro část území. Země sama potvrzení o očkování při vstupu nevyžaduje.'
    },
    entry:{
      label:'Pouze vstupní podmínka',
      text:'Země žádá potvrzení o očkování, pokud přijíždíte ze státu s výskytem žluté zimnice. V samotné destinaci místní riziko není; při cestě přímo z Česka se vás podmínka zpravidla netýká.'
    },
    both:{
      label:'Místní riziko i vstupní podmínka',
      text:'Platí obojí zároveň: nemoc se v destinaci vyskytuje a při příjezdu z rizikové oblasti se navíc vyžaduje potvrzení o očkování.'
    }
  },
  dengue:{
    all:{
      label:'Vše',
      text:'Zobrazí všechny destinace v tomto filtru bez ohledu na kategorii.'
    },
    endemic:{
      label:'Endemický výskyt',
      text:'Horečka dengue se v destinaci vyskytuje trvale, ne jen výjimečně po zavlečení. Komáři ji přenášejí opakovaně, obvykle s vrcholem v období dešťů.'
    },
    general:{
      label:'Další doporučení',
      text:'Cestovní doporučení pro destinaci horečku dengue zmiňují, ale bez bližšího určení, zda jde o trvalý výskyt. Může jít o sezónní nebo místně omezené riziko.'
    }
  }
};

const FACET_CAVEAT={
  'yellow-fever':'Kategorie se nepřekrývají – každá destinace patří právě do jedné z nich.',
  dengue:'Rozdíl mezi kategoriemi není měřítkem výše rizika. Neříká, kde je riziko vysoké a kde jen ojedinělé.'
};

function facetTooltip(diseaseKey,facetKey){
  const info=FACET_INFO[diseaseKey]?.[facetKey];
  if(!info)return '';
  return `${info.label}: ${info.text}`;
}

function facetGlossaryHtml(diseaseKey,{skipAll=true}={}){
  const group=FACET_INFO[diseaseKey];
  if(!group)return '';
  const rows=Object.entries(group)
    .filter(([key])=>!skipAll||key!=='all')
    .map(([key,info])=>`<div class="facet-def facet-def-${esc(key)}">
      <dt><span class="facet-def-dot" aria-hidden="true"></span>${esc(info.label)}</dt>
      <dd>${esc(info.text)}</dd>
    </div>`).join('');
  const caveat=FACET_CAVEAT[diseaseKey]?`<p class="facet-caveat">${esc(FACET_CAVEAT[diseaseKey])}</p>`:'';
  return `<dl class="facet-defs">${rows}</dl>${caveat}`;
}

/* Bublina po najetí myší na telefonu nefunguje, proto stejné vysvětlení
   nabízíme i jako rozbalovací blok přímo v mapové legendě. */
function facetGlossaryDetails(diseaseKey){
  if(!FACET_INFO[diseaseKey])return '';
  return `<details class="mfl-help">
    <summary>Co znamenají kategorie?</summary>
    <div class="mfl-help-body">${facetGlossaryHtml(diseaseKey)}</div>
  </details>`;
}

/* Kategorie se navzájem vylučují, proto „pouze“. Bez toho čtenář legendy
   četl počet v kategorii „místní riziko“ jako celkový počet rizikových zemí. */
function yellowFeverFacetLabel(facet){
  if(facet==='all')return 'Všechny kategorie';
  return FACET_INFO['yellow-fever'][facet]?.label||'Všechny kategorie';
}

/* Součty napříč kategoriemi – kolik destinací má riziko a kolik podmínku celkem. */
function yellowFeverTotals(){
  const facets=diseaseFacets.get('yellow-fever');
  const hits=effectiveDiseaseHits('yellow-fever');
  let risk=0,entry=0;
  hits.forEach(id=>{
    const nid=normId(id);
    if(facets?.risk?.has(nid))risk++;
    if(facets?.entry?.has(nid))entry++;
  });
  return{risk,entry};
}

function yellowFeverFacetCounts(){
  const counts={all:0,risk:0,entry:0,both:0};
  effectiveDiseaseHits('yellow-fever').forEach(id=>{
    const facet=diseaseFacetForId('yellow-fever',id);
    if(facet){counts[facet]++;counts.all++;}
  });
  return counts;
}

function yellowFeverFacetButtons(className=''){
  const counts=yellowFeverFacetCounts();
  const definitions=[
    {key:'all',label:'Vše',dot:'',mark:''},
    {key:'risk',label:'Pouze místní riziko',dot:'yf-risk',mark:'R'},
    {key:'entry',label:'Pouze vstupní podmínka',dot:'yf-entry',mark:'V'},
    {key:'both',label:'Riziko i podmínka',dot:'yf-both',mark:'R+V'}
  ];
  return definitions.map(def=>`<button class="${className}${activeYellowFeverFacet===def.key?' active':''}" type="button" data-yf-facet="${def.key}" aria-pressed="${activeYellowFeverFacet===def.key}" title="${esc(facetTooltip('yellow-fever',def.key))}">${def.dot?`<i class="${def.dot}" aria-hidden="true">${def.mark}</i>`:''}<span>${def.label}</span><strong>${counts[def.key]}</strong></button>`).join('');
}

function yellowFeverOverview(){
  const cfg=staticDiseaseConfig('yellow-fever');
  const totals=yellowFeverTotals();
  const failures=diseaseFacets.get('yellow-fever')?.failures?.size||0;
  const fallback=failures?` U ${countDestinations(failures)} se nepodařilo načíst vstupní podmínku; aplikace se ji pokusí načíst znovu později.`:'';
  return `<div class="fr-yf-overview">
    <div class="fr-yf-copy">
      <strong>Co ukazují barvy?</strong>
      <span>Rozlišují místní riziko od vstupní podmínky při cestě z rizikové oblasti. Místní riziko neznamená aktuální epidemii, ale doporučení očkování alespoň pro část území.${esc(fallback)}</span>
      <span class="fr-yf-totals">Celkem má <b>${countDestinations(totals.risk)}</b> místní riziko a <b>${countDestinations(totals.entry)}</b> vstupní podmínku.</span>
      ${facetGlossaryHtml('yellow-fever')}
      <span class="fr-yf-links">
        <a href="${esc(DISEASES['yellow-fever']?.url||'#')}" target="_blank" rel="noopener noreferrer">Hlavní zdroj: doporučení Avenier</a>
        <a href="${esc(cfg?.sourceUrl||'#')}" target="_blank" rel="noopener noreferrer">Doplňkový seznam: ${esc(cfg?.sourceLabel||'CDC')}</a>
        ${cfg?.reviewedLabel?`<small>${esc(cfg.reviewedLabel)}</small>`:''}
      </span>
    </div>
    <div class="fr-facet-legend" aria-label="Podfiltry žluté zimnice">
      ${yellowFeverFacetButtons('yf-facet-btn')}
    </div>
  </div>`;
}

function dengueFacetLabel(facet){
  if(facet==='all')return 'Všechny kategorie';
  return FACET_INFO.dengue[facet]?.label||'Všechny kategorie';
}

function dengueFacetCounts(){
  const facets=diseaseFacets.get('dengue');
  return{
    all:effectiveDiseaseHits('dengue').size,
    endemic:facets?.endemic?.size||0,
    general:facets?.general?.size||0
  };
}

function dengueFacetButtons(className=''){
  const counts=dengueFacetCounts();
  const definitions=[
    {key:'all',label:'Vše',dot:'',mark:''},
    {key:'endemic',label:'Endemický výskyt',dot:'dg-endemic',mark:'E'},
    {key:'general',label:'Další doporučení',dot:'dg-general',mark:'D'}
  ];
  return definitions.map(def=>`<button class="${className}${activeDengueFacet===def.key?' active':''}" type="button" data-dengue-facet="${def.key}" aria-pressed="${activeDengueFacet===def.key}" title="${esc(facetTooltip('dengue',def.key))}">${def.dot?`<i class="${def.dot}" aria-hidden="true">${def.mark}</i>`:''}<span>${def.label}</span><strong>${counts[def.key]}</strong></button>`).join('');
}

function dengueOverview(){
  return `<div class="fr-yf-overview">
    <div class="fr-yf-copy">
      <strong>Co znamenají kategorie?</strong>
      <span>Kategorie vycházejí z toho, jak je horečka dengue uvedená v cestovních doporučeních pro danou destinaci.</span>
      ${facetGlossaryHtml('dengue')}
      <span class="fr-yf-links">
        <a href="${esc(DISEASES.dengue?.url||'#')}" target="_blank" rel="noopener noreferrer">Více o horečce dengue</a>
      </span>
    </div>
    <div class="fr-facet-legend" aria-label="Podfiltry horečky dengue">
      ${dengueFacetButtons('yf-facet-btn')}
    </div>
  </div>`;
}

function yellowFeverColumns(hits,chipFor){
  let definitions=[
    {key:'risk',description:'Očkování se doporučuje alespoň pro část území, vstupní podmínka zde není.'},
    {key:'entry',description:'Požadavek souvisí s příjezdem z oblasti s výskytem žluté zimnice, ne s rizikem na místě.'},
    {key:'both',description:'V destinaci se uplatňují obě situace zároveň.'}
  ].map(def=>({...def,title:yellowFeverFacetLabel(def.key)}));
  if(activeYellowFeverFacet!=='all')definitions=definitions.filter(def=>def.key===activeYellowFeverFacet);
  const groups={risk:[],entry:[],both:[]};
  hits.forEach(hit=>{
    const facet=diseaseFacetForId('yellow-fever',hit.id);
    if(facet&&groups[facet])groups[facet].push(hit);
  });
  return `<div class="fr-yf-columns">${definitions.map(def=>{
    const items=groups[def.key];
    return `<section class="fr-yf-column yf-${def.key}" aria-labelledby="yf-column-${def.key}">
      <header class="fr-yf-column-head">
        <span class="fr-yf-dot" aria-hidden="true"></span>
        <div><h3 id="yf-column-${def.key}">${esc(def.title)}</h3><p>${esc(def.description)}</p></div>
        <strong>${items.length}</strong>
      </header>
      <div class="fr-yf-list">${items.length?items.map(chipFor).join(''):'<span class="fr-yf-none">Žádná destinace</span>'}</div>
    </section>`;
  }).join('')}</div>`;
}

/* U kombinace nemá smysl opakovat popis jednoho filtru – uživatel potřebuje
   vědět, že jde o průnik, a odkud pochází data pro každou nemoc zvlášť. */
function combinationSourceNote(){
  const keys=activeDiseaseKeys();
  const sources=keys.map(key=>{
    const cfg=DISEASES[key];
    const staticCfg=staticDiseaseConfig(key);
    const label=staticCfg?.sourceLabel||'cestovní doporučení Avenier';
    const url=staticCfg?.sourceUrl||cfg?.url;
    return `<li><strong>${esc(cfg?.label||key)}</strong> — ${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:esc(label)}</li>`;
  }).join('');
  return `<div class="fr-source-note fr-combo-note">
    <strong>Co na mapě vidíte:</strong> Zvýrazněné jsou pouze destinace, kterých se týkají
    <strong>všechny vybrané nemoci zároveň</strong>. Destinace, kde platí jen některá z nich, zůstávají potlačené.
    U kombinace se nepoužívají podrobnější kategorie žluté zimnice ani horečky dengue — každá nemoc do průniku vstupuje celá.
    <ul class="fr-combo-sources">${sources}</ul>
  </div>`;
}

function filterSourceNote(key,hitCount){
  const staticCfg=staticDiseaseConfig(key);
  if(staticCfg){
    return `<div class="fr-source-note">
      <strong>Co na mapě vidíte:</strong> ${esc(staticCfg.note||'')}
      <a href="${esc(staticCfg.sourceUrl||'#')}" target="_blank" rel="noopener noreferrer">${esc(staticCfg.sourceLabel||'Zdroj')}</a>
      ${staticCfg.reviewedLabel?`<span>· ${esc(staticCfg.reviewedLabel)}</span>`:''}
    </div>`;
  }

  const cfg=DISEASES[key];
  const availableCount=[...FI.values()].filter(info=>info.has).length;
  const broad=availableCount>0 && hitCount/availableCount>=.85;
  const broadNote=broad?' Tato položka je v datech uvedena téměř u všech destinací, takže filtr mapu výrazně nezúží.':'';
  const meta=diseaseIndexMeta.get(key);
  const coverageNote=meta?.failures?.size?` U ${countDestinations(meta.failures.size)} se doporučení nepodařilo načíst, takže výsledek může být neúplný. Aplikace se je pokusí načíst znovu později.`:'';
  return `<div class="fr-source-note">
    <strong>Co na mapě vidíte:</strong> Zvýrazněné jsou destinace, jejichž cestovní doporučení zmiňují tuto nemoc nebo související očkování. Neznamená to automaticky aktuální epidemii ani stejné doporučení pro každého cestovatele; záleží na trase, délce a způsobu cesty.${esc(broadNote)} ${esc(coverageNote)}
    ${cfg?.url?`<a href="${esc(cfg.url)}" target="_blank" rel="noopener noreferrer">Více o nemoci</a>`:''}
  </div>`;
}

function repaintMap(){
  if(!gv)return;
  gv.selectAll('path.country')
    .attr('fill',d=>selD&&featureId(d)===featureId(selD)?MC.sel:bf(d))
    .attr('stroke',d=>selD&&featureId(d)===featureId(selD)?MC.selB:strokeForId(featureId(d)))
    .attr('stroke-width',d=>selD&&featureId(d)===featureId(selD)?1.55:strokeWidthForId(featureId(d)));

  const k=currentZoomK||1;
  d3.selectAll('circle.dest-marker')
    .attr('r',d=>markerBaseRadius(d.id)/k)
    .attr('fill',d=>isSelectedMarker(d.id)?MC.sel:colorForId(d.id))
    .attr('stroke',d=>isSelectedMarker(d.id)?MC.selB:(isInRoute(d.id)?ROUTE_COLOR:'rgba(255,255,255,0.55)'))
    .attr('stroke-width',d=>markerBaseStroke(d.id)/k);
}

/* Legenda pod mapou musí popisovat barvy, které jsou na mapě právě teď.
   Statický popis „bez filtru“ mátl, protože při aktivním filtru znamenají
   stejné odstíny něco jiného. */
function mapLegendItems(){
  const noData={color:MC.none,label:'Bez cestovních doporučení',mark:'–'};
  const selected={color:MC.sel,label:'Aktivní výběr',mark:'●'};
  if(!activeDisease||activeDisease==='all'){
    return [{color:MC.has,label:'Destinace s doporučeními',mark:'✓'},noData,selected];
  }
  const cfg=DISEASES[activeDisease];
  const noMatch={color:MC.dim,label:'Neodpovídá filtru',mark:'×'};

  if(isCombination()){
    return [{color:COMBO_COLOR,label:'Odpovídá všem vybraným nemocem',mark:'✓'},noMatch,noData,selected];
  }

  if(activeDisease==='yellow-fever'){
    const f=cfg.facetColors;
    const items=[
      {color:f.risk,label:'Pouze místní riziko',facet:'risk',mark:'R'},
      {color:f.entry,label:'Pouze vstupní podmínka',facet:'entry',mark:'V'},
      {color:f.both,label:'Místní riziko i vstupní podmínka',facet:'both',mark:'R+V'}
    ].filter(it=>activeYellowFeverFacet==='all'||activeYellowFeverFacet===it.facet);
    return [...items,noMatch,noData,selected];
  }

  if(activeDisease==='dengue'){
    const f=cfg.facetColors;
    const items=[
      {color:f.endemic,label:'Endemický výskyt',facet:'endemic',mark:'E'},
      {color:f.general,label:'Další doporučení',facet:'general',mark:'D'}
    ].filter(it=>activeDengueFacet==='all'||activeDengueFacet===it.facet);
    return [...items,noMatch,noData,selected];
  }

  return [{color:cfg?.color||MC.has,label:`Odpovídá filtru: ${cfg?.label||'vybraná nemoc'}`,mark:'✓'},noMatch,noData,selected];
}

function renderMapLegend(){
  const box=document.getElementById('map-legend');
  if(!box)return;
  const items=mapLegendItems()
    .map(it=>`<div class="li"><span class="ld" style="background:${esc(it.color)}" aria-hidden="true">${esc(it.mark||'')}</span><span>${esc(it.label)}</span></div>`)
    .join('');
  box.innerHTML=`${items}<span class="lh">Táhnutím pohyb · kolečkem zoom</span>`;
}

/* ── Export aktuálního filtru do 4K PNG ──
   Export se kreslí z mapových dat znovu, takže má vždy stejný poměr stran a
   rozlišení bez ohledu na velikost telefonu, zoom nebo právě vybranou zemi. */
const MAP_EXPORT={width:3840,height:2160,mapWidth:3520,mapHeight:1370,logo:'assets/img/avenier-logo.png'};

function normalizedExportOptions(options={}){
  const disease=activeDisease||'all';
  const combo=isCombination();
  /* V kombinaci se podfiltry neuplatňují, export je tedy nenabízí. */
  const supportsFacets=!combo&&(disease==='yellow-fever'||disease==='dengue');
  const allowed=disease==='yellow-fever'?new Set(['all','risk','entry','both']):new Set(['all','endemic','general']);
  const requested=String(options.facet||'all');
  return{
    disease,
    diseases:activeDiseaseKeys(),
    combo,
    facet:supportsFacets&&allowed.has(requested)?requested:'all',
    layout:options.layout==='classic'?'classic':'map'
  };
}

function exportFacetLabel(options={}){
  const opts=normalizedExportOptions(options);
  if(opts.disease==='yellow-fever'&&opts.facet!=='all')return yellowFeverFacetLabel(opts.facet);
  if(opts.disease==='dengue'&&opts.facet!=='all')return dengueFacetLabel(opts.facet);
  return '';
}

function exportDiseaseHits(options={}){
  const opts=normalizedExportOptions(options);
  if(opts.disease==='all')return new Set([...FI.entries()].filter(([,info])=>info.has).map(([id])=>normId(id)));
  if(opts.combo)return combinedHits();
  const hits=effectiveDiseaseHits(opts.disease);
  if(opts.facet==='all')return hits;
  return new Set([...hits].filter(id=>diseaseFacetForId(opts.disease,id)===opts.facet));
}

function exportColorForId(id,options={}){
  const opts=normalizedExportOptions(options);
  const nid=normId(id);
  const info=FI.get(nid);
  if(!info?.has)return MC.none;
  if(opts.disease==='all')return MC.has;
  if(!exportDiseaseHits(opts).has(nid))return MC.dim;
  if(opts.combo)return COMBO_COLOR;
  const facet=diseaseFacetForId(opts.disease,nid);
  return facet?DISEASES[opts.disease]?.facetColors?.[facet]||DISEASES[opts.disease].color:DISEASES[opts.disease].color;
}

function exportLegendItems(options={}){
  const opts=normalizedExportOptions(options);
  if(opts.disease==='all')return[
    {color:MC.has,label:'Destinace s doporučeními',mark:'✓'}
  ];
  const cfg=DISEASES[opts.disease];
  const items=[];
  if(opts.combo){
    items.push({color:COMBO_COLOR,label:'Odpovídá všem vybraným nemocem',mark:'✓'});
    items.push({color:MC.dim,label:'Ostatní destinace',mark:'×'});
    return items;
  }
  if(opts.disease==='yellow-fever'){
    [
      {facet:'risk',color:cfg.facetColors.risk,label:'Pouze místní riziko',mark:'R'},
      {facet:'entry',color:cfg.facetColors.entry,label:'Pouze vstupní podmínka',mark:'V'},
      {facet:'both',color:cfg.facetColors.both,label:'Místní riziko i vstupní podmínka',mark:'R+V'}
    ].filter(item=>opts.facet==='all'||item.facet===opts.facet).forEach(item=>items.push(item));
  }else if(opts.disease==='dengue'){
    [
      {facet:'endemic',color:cfg.facetColors.endemic,label:'Endemický výskyt',mark:'E'},
      {facet:'general',color:cfg.facetColors.general,label:'Další doporučení',mark:'D'}
    ].filter(item=>opts.facet==='all'||item.facet===opts.facet).forEach(item=>items.push(item));
  }else items.push({color:cfg?.color||MC.has,label:`Odpovídá filtru: ${cfg?.label||'vybraná nemoc'}`,mark:'✓'});
  items.push({color:MC.dim,label:'Ostatní destinace',mark:'×'});
  return items;
}

function exportMetadata(options={}){
  const opts=normalizedExportOptions(options);
  const now=new Date();
  const dateFormat=new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'});
  const disease=opts.disease!=='all'?DISEASES[opts.disease]:null;
  const facet=exportFacetLabel(opts);
  const staticCfg=staticDiseaseConfig(opts.disease);
  const count=exportDiseaseHits(opts).size;
  let sourceLabel='Avenier – cestovní doporučení podle destinace';
  let sourceUrl='https://www.ockovacicentrum.cz/';
  let dataDate=diseaseIndexGeneratedAt?`Aktualizace dat: ${dateFormat.format(new Date(diseaseIndexGeneratedAt))}`:`Data načtena: ${dateFormat.format(now)}`;

  if(staticCfg){
    sourceLabel=staticCfg.sourceLabel||sourceLabel;
    sourceUrl=staticCfg.sourceUrl||sourceUrl;
    dataDate=staticCfg.reviewedLabel?`Stav zdroje: ${staticCfg.reviewedLabel}`:dataDate;
  }
  if(opts.disease==='yellow-fever'){
    sourceLabel=`Avenier – cestovní doporučení + ${staticCfg?.sourceLabel||'CDC Yellow Book'}`;
  }
  if(opts.combo){
    const labels=unique(opts.diseases.map(key=>staticDiseaseConfig(key)?.sourceLabel||'cestovní doporučení Avenier'));
    sourceLabel=labels.join(' + ');
    dataDate=diseaseIndexGeneratedAt?`Aktualizace dat: ${dateFormat.format(new Date(diseaseIndexGeneratedAt))}`:`Data načtena: ${dateFormat.format(now)}`;
  }

  return{
    title:opts.combo?combinationLabel():(disease?disease.label:'Všechny destinace s doporučeními'),
    facet,
    count,
    sourceLabel,
    sourceUrl,
    dataDate,
    exportDate:`Obrázek vytvořen: ${dateFormat.format(now)}`,
    fileDate:now.toISOString().slice(0,10),
    options:opts
  };
}

function loadExportImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error(`Nepodařilo se načíst obrázek: ${src}`));
    img.src=src;
  });
}

function canvasBlob(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Prohlížeč nevytvořil PNG.')),'image/png'));
}

function exportLogoCanvas(img){
  const work=document.createElement('canvas');
  work.width=img.naturalWidth||img.width;
  work.height=img.naturalHeight||img.height;
  const ctx=work.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  try{
    const image=ctx.getImageData(0,0,work.width,work.height);
    const data=image.data;
    let minX=work.width,minY=work.height,maxX=0,maxY=0;
    for(let y=0;y<work.height;y+=2){
      for(let x=0;x<work.width;x+=2){
        const i=(y*work.width+x)*4;
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        const nearWhite=r>247&&g>247&&b>247;
        if(a>12&&!nearWhite){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      }
    }
    /* Dodaný soubor má za logem černou výplň. V exportu ji zprůhledníme,
       tmavě šedé písmo přitom zůstane zachované. */
    for(let i=0;i<data.length;i+=4){
      if(data[i]<20&&data[i+1]<20&&data[i+2]<20)data[i+3]=0;
    }
    ctx.putImageData(image,0,0);
    if(minX<=maxX&&minY<=maxY){
      const pad=24;
      work._contentBounds={
        x:Math.max(0,minX-pad),y:Math.max(0,minY-pad),
        width:Math.min(work.width,maxX+pad)-Math.max(0,minX-pad),
        height:Math.min(work.height,maxY+pad)-Math.max(0,minY-pad)
      };
    }
  }catch(e){
    work._contentBounds={x:0,y:0,width:work.width,height:work.height};
  }
  return work;
}

function buildExportMapSvg(width,height,options={}){
  if(!sv?.node()||!gv?.node())throw new Error('Mapa ještě není připravená.');
  const opts=normalizedExportOptions(options);
  const exportHits=exportDiseaseHits(opts);
  const color=id=>{
    const nid=normId(id);
    const info=FI.get(nid);
    if(!info?.has)return MC.none;
    if(opts.disease==='all')return MC.has;
    if(!exportHits.has(nid))return MC.dim;
    const facet=diseaseFacetForId(opts.disease,nid);
    return facet?DISEASES[opts.disease]?.facetColors?.[facet]||DISEASES[opts.disease].color:DISEASES[opts.disease].color;
  };
  const clone=sv.node().cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.setAttribute('width',width);
  clone.setAttribute('height',height);
  clone.setAttribute('viewBox',`0 0 ${width} ${height}`);
  clone.removeAttribute('style');

  /* fitExtent je důležité: celý obrys Země včetně pólů a Antarktidy se vždy
     vejde do exportu bez ohledu na poměr stran mapy na obrazovce. */
  const fullMapLayout=opts.layout==='map';
  const exportProjection=d3.geoNaturalEarth1().fitExtent(
    [[54,fullMapLayout?165:54],[width-54,height-(fullMapLayout?220:54)]],
    {type:'Sphere'}
  );
  const exportPath=d3.geoPath().projection(exportProjection);
  const viewport=clone.querySelector('.map-viewport');
  if(viewport)viewport.removeAttribute('transform');
  const ocean=clone.querySelector('.map-ocean');
  if(ocean){ocean.setAttribute('width',width);ocean.setAttribute('height',height);}
  const graticule=clone.querySelector('.map-graticule');
  if(graticule)graticule.setAttribute('d',exportPath(d3.geoGraticule()()));
  clone.querySelectorAll('path.country').forEach(path=>{
    const id=normId(path.getAttribute('data-id'));
    const feature=FM.get(id);
    if(feature)path.setAttribute('d',exportPath(feature));
    path.setAttribute('fill',color(id));
    path.setAttribute('stroke',MC.brd);
    path.setAttribute('stroke-width','1.15');
    path.removeAttribute('style');
  });
  const borders=clone.querySelector('.map-borders');
  if(borders&&bordersPath?.node()?.__data__){
    borders.setAttribute('d',exportPath(bordersPath.node().__data__));
    borders.setAttribute('stroke-width','1.2');
  }
  clone.querySelectorAll('circle.dest-marker').forEach(marker=>{
    const id=normId(marker.__data__?.id??marker.getAttribute('data-id'));
    const info=FI.get(id);
    if(info?.coords){
      const point=exportProjection(info.coords);
      marker.setAttribute('cx',point[0]);
      marker.setAttribute('cy',point[1]);
    }
    marker.setAttribute('r','7');
    marker.setAttribute('fill',color(id));
    marker.setAttribute('stroke-width','2.2');
    marker.removeAttribute('style');
  });
  return new XMLSerializer().serializeToString(clone);
}

async function drawExportMap(ctx,x,y,width,height,options={},radius=34){
  const svgText=buildExportMapSvg(width,height,options);
  const url=URL.createObjectURL(new Blob([svgText],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const img=await loadExportImage(url);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x,y,width,height,radius);
    ctx.clip();
    ctx.drawImage(img,x,y,width,height);
    ctx.restore();
    ctx.strokeStyle='rgba(0,103,120,.16)';
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.roundRect(x,y,width,height,radius);
    ctx.stroke();
  }finally{
    URL.revokeObjectURL(url);
  }
}

function drawExportLegend(ctx,items,x,y,maxWidth,{fontSize=27,dotSize=13,color='#41534d',lineHeight=50}={}){
  ctx.font=`600 ${fontSize}px 'Saira',sans-serif`;
  let cx=x,cy=y;
  items.filter(item=>item.label!=='Aktivní výběr').forEach(item=>{
    const itemWidth=ctx.measureText(item.label).width+dotSize*2+50;
    if(cx+itemWidth>x+maxWidth){cx=x;cy+=lineHeight;}
    ctx.fillStyle=item.color;
    ctx.beginPath();ctx.arc(cx+dotSize,cy-dotSize*.65,dotSize,0,Math.PI*2);ctx.fill();
    if(item.mark){
      ctx.save();
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font=`700 ${Math.max(9,dotSize*.72)}px 'Saira',sans-serif`;
      ctx.fillText(item.mark,cx+dotSize,cy-dotSize*.65+1);
      ctx.restore();
      ctx.font=`600 ${fontSize}px 'Saira',sans-serif`;
    }
    ctx.fillStyle=color;
    ctx.fillText(item.label,cx+dotSize*2+13,cy);
    cx+=itemWidth;
  });
}

function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=2){
  const words=String(text||'').split(/\s+/);
  let line='',lines=0;
  for(let i=0;i<words.length;i++){
    const test=line?`${line} ${words[i]}`:words[i];
    if(ctx.measureText(test).width>maxWidth&&line){
      ctx.fillText(line,x,y+lines*lineHeight);lines++;line=words[i];
      if(lines>=maxLines)return y+(lines-1)*lineHeight;
    }else line=test;
  }
  if(line&&lines<maxLines){ctx.fillText(line,x,y+lines*lineHeight);lines++;}
  return y+Math.max(0,lines-1)*lineHeight;
}

function drawGlassPanel(ctx,x,y,width,height,radius,{light=false}={}){
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.22)';
  ctx.shadowBlur=34;
  ctx.shadowOffsetY=12;
  const gradient=ctx.createLinearGradient(x,y,x+width,y+height);
  if(light){
    gradient.addColorStop(0,'rgba(255,255,255,.70)');
    gradient.addColorStop(.55,'rgba(255,255,255,.48)');
    gradient.addColorStop(1,'rgba(220,239,238,.34)');
  }else{
    gradient.addColorStop(0,'rgba(6,34,57,.78)');
    gradient.addColorStop(.55,'rgba(8,42,64,.62)');
    gradient.addColorStop(1,'rgba(17,69,78,.50)');
  }
  ctx.fillStyle=gradient;
  ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.fill();
  ctx.shadowColor='transparent';
  ctx.strokeStyle=light?'rgba(255,255,255,.72)':'rgba(255,255,255,.30)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(x,y,width,height,radius);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.22)';
  ctx.beginPath();ctx.moveTo(x+radius,y+3);ctx.lineTo(x+width-radius,y+3);ctx.stroke();
  ctx.restore();
}

function drawExportLogo(ctx,logo,bounds,x,y,width){
  const height=width*(bounds.height/bounds.width);
  ctx.drawImage(logo,bounds.x,bounds.y,bounds.width,bounds.height,x,y,width,height);
  return height;
}

async function drawClassicExport(ctx,meta,logo,bounds){
  ctx.fillStyle='#f4f9f7';ctx.fillRect(0,0,MAP_EXPORT.width,MAP_EXPORT.height);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,MAP_EXPORT.width,305);
  ctx.fillStyle='#006778';ctx.fillRect(0,0,22,305);
  drawExportLogo(ctx,logo,bounds,150,73,470);

  ctx.fillStyle='#006778';ctx.font="700 26px 'Saira',sans-serif";ctx.fillText('OČKOVÁNÍ A ZDRAVOTNÍ RIZIKA',760,77);
  ctx.fillStyle='#173a35';ctx.font="700 66px 'Saira',sans-serif";ctx.fillText(meta.title,760,161);
  ctx.fillStyle='#62736d';ctx.font="500 28px 'Open Sans',sans-serif";
  const summary=[meta.facet||'Všechny kategorie',countDestinations(meta.count)].filter(Boolean).join(' · ');
  ctx.fillText(summary,760,216);

  await drawExportMap(ctx,160,330,3520,1455,meta.options);
  drawExportLegend(ctx,exportLegendItems(meta.options),180,1845,3480);

  ctx.fillStyle='#006778';ctx.font="700 23px 'Saira',sans-serif";ctx.fillText('ZDROJ DAT',180,1953);
  ctx.fillStyle='#334943';ctx.font="600 25px 'Open Sans',sans-serif";ctx.fillText(meta.sourceLabel,180,1992);
  ctx.fillStyle='#65756f';ctx.font="400 21px 'Open Sans',sans-serif";
  wrapCanvasText(ctx,meta.sourceUrl,180,2028,2350,28,2);
  ctx.textAlign='right';ctx.fillText(meta.dataDate,3660,1989);ctx.fillText(meta.exportDate,3660,2024);ctx.textAlign='left';
  ctx.fillStyle='#788680';ctx.font="400 18px 'Open Sans',sans-serif";
  ctx.fillText('Orientační přehled. Doporučení se liší podle konkrétní oblasti, délky a způsobu cesty a zdravotního stavu cestovatele.',180,2110);
}

async function drawMapDominantExport(ctx,meta,logo,bounds){
  ctx.fillStyle='#0d2040';ctx.fillRect(0,0,MAP_EXPORT.width,MAP_EXPORT.height);
  await drawExportMap(ctx,42,42,3756,2076,meta.options,42);

  /* Skleněné plochy jsou menší než dřívější bílé boxy. Legenda je pod sebou,
     aby nezabírala široký pás přes mapu. */
  drawGlassPanel(ctx,128,104,570,500,28);
  ctx.fillStyle='#9bd344';ctx.font="700 21px 'Saira',sans-serif";ctx.fillText('OČKOVÁNÍ A ZDRAVOTNÍ RIZIKA',178,160);
  ctx.fillStyle='#fff';ctx.font="700 56px 'Saira',sans-serif";ctx.fillText(meta.title,178,232);
  ctx.fillStyle='rgba(255,255,255,.78)';ctx.font="500 23px 'Open Sans',sans-serif";
  const summary=[meta.facet||'Všechny kategorie',countDestinations(meta.count)].join(' · ');
  ctx.fillText(summary,178,279);
  let legendY=347;
  ctx.font="600 20px 'Saira',sans-serif";
  exportLegendItems(meta.options).forEach(item=>{
    ctx.fillStyle=item.color;
    ctx.beginPath();ctx.arc(191,legendY-7,13,0,Math.PI*2);ctx.fill();
    if(item.mark){
      ctx.save();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font="700 9px 'Saira',sans-serif";ctx.fillText(item.mark,191,legendY-6);ctx.restore();
      ctx.font="600 20px 'Saira',sans-serif";
    }
    ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillText(item.label,224,legendY);
    legendY+=48;
  });

  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.48)';ctx.shadowBlur=18;ctx.shadowOffsetY=5;
  drawExportLogo(ctx,logo,bounds,3092,143,518);
  ctx.restore();

  const sourceNote='Orientační přehled; doporučení závisí na konkrétní cestě a zdravotním stavu.';
  ctx.font="600 20px 'Open Sans',sans-serif";const sourceLabelWidth=ctx.measureText(meta.sourceLabel).width;
  ctx.font="400 14px 'Open Sans',sans-serif";const sourceUrlWidth=ctx.measureText(meta.sourceUrl).width;
  ctx.font="400 12px 'Open Sans',sans-serif";const sourceNoteWidth=ctx.measureText(sourceNote).width;
  const sourceWidth=Math.min(2350,Math.max(760,sourceLabelWidth,sourceUrlWidth,sourceNoteWidth)+92);
  drawGlassPanel(ctx,128,1880,sourceWidth,166,25);
  ctx.fillStyle='#9bd344';ctx.font="700 17px 'Saira',sans-serif";ctx.fillText('ZDROJ DAT',174,1920);
  ctx.fillStyle='rgba(255,255,255,.94)';ctx.font="600 19px 'Open Sans',sans-serif";ctx.fillText(meta.sourceLabel,174,1953);
  ctx.fillStyle='rgba(255,255,255,.72)';ctx.font="400 14px 'Open Sans',sans-serif";
  wrapCanvasText(ctx,meta.sourceUrl,174,1982,sourceWidth-92,20,1);
  ctx.fillStyle='rgba(255,255,255,.62)';ctx.font="400 12px 'Open Sans',sans-serif";
  ctx.fillText(sourceNote,174,2016);

  ctx.save();
  ctx.textAlign='right';ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.72)';ctx.shadowBlur=8;
  ctx.font="500 16px 'Open Sans',sans-serif";ctx.fillText(meta.dataDate,3670,1985);ctx.fillText(meta.exportDate,3670,2019);
  ctx.restore();
}

async function createMapExportBlob(options={}){
  if(document.fonts?.ready)await document.fonts.ready;
  const opts=normalizedExportOptions(options);
  const meta=exportMetadata(opts);
  const canvas=document.createElement('canvas');
  canvas.width=MAP_EXPORT.width;
  canvas.height=MAP_EXPORT.height;
  const ctx=canvas.getContext('2d');

  const logoImage=await loadExportImage(MAP_EXPORT.logo);
  const logo=exportLogoCanvas(logoImage);
  const bounds=logo._contentBounds||{x:0,y:0,width:logo.width,height:logo.height};
  if(opts.layout==='classic')await drawClassicExport(ctx,meta,logo,bounds);
  else await drawMapDominantExport(ctx,meta,logo,bounds);

  return{blob:await canvasBlob(canvas),meta,width:canvas.width,height:canvas.height};
}

function exportFacetDefinitions(){
  if(activeDisease==='yellow-fever')return[
    {key:'all',label:'Všechny kategorie',description:'Místní riziko, vstupní podmínka i jejich kombinace.'},
    {key:'risk',label:yellowFeverFacetLabel('risk'),description:FACET_INFO['yellow-fever'].risk.text},
    {key:'entry',label:yellowFeverFacetLabel('entry'),description:FACET_INFO['yellow-fever'].entry.text},
    {key:'both',label:yellowFeverFacetLabel('both'),description:FACET_INFO['yellow-fever'].both.text}
  ];
  if(activeDisease==='dengue')return[
    {key:'all',label:'Všechny kategorie',description:'Endemický výskyt i další doporučení v jednom obrázku.'},
    {key:'endemic',label:dengueFacetLabel('endemic'),description:FACET_INFO.dengue.endemic.text},
    {key:'general',label:dengueFacetLabel('general'),description:FACET_INFO.dengue.general.text}
  ];
  return[];
}

function openMapExportDialog(){
  const dialog=document.getElementById('map-export-dialog');
  if(!dialog)return;
  const current=document.getElementById('map-export-current-filter');
  if(current)current.textContent=isCombination()?combinationLabel():(activeDisease==='all'?'Všechny destinace':DISEASES[activeDisease]?.label||activeDisease);
  const fieldset=document.getElementById('map-export-facet-fieldset');
  const optionsBox=document.getElementById('map-export-facet-options');
  const definitions=exportFacetDefinitions();
  if(fieldset&&optionsBox){
    fieldset.hidden=!definitions.length;
    optionsBox.innerHTML=definitions.map((item,index)=>`<label class="map-export-choice"><input type="radio" name="export-facet" value="${esc(item.key)}" ${index===0?'checked':''}><span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span></label>`).join('');
  }
  const defaultLayout=dialog.querySelector('input[name="export-layout"][value="map"]');
  if(defaultLayout)defaultLayout.checked=true;
  dialog.showModal();
}

function readMapExportOptions(){
  const dialog=document.getElementById('map-export-dialog');
  return normalizedExportOptions({
    facet:dialog?.querySelector('input[name="export-facet"]:checked')?.value||'all',
    layout:dialog?.querySelector('input[name="export-layout"]:checked')?.value||'map'
  });
}

async function downloadMapPng(options={},trigger=null){
  const btn=trigger||document.getElementById('map-export-create');
  if(!btn||btn.disabled)return;
  const label=btn.querySelector('span')||btn;
  const original=label.textContent||'Vytvořit a stáhnout PNG';
  btn.disabled=true;btn.setAttribute('aria-busy','true');
  label.textContent='Připravuji PNG…';
  try{
    const opts=normalizedExportOptions(options);
    const result=await createMapExportBlob(opts);
    const namePart=opts.combo
      ? opts.diseases.map(slugKey).join('-a-')
      : slugKey(opts.disease==='all'?'vsechny-destinace':opts.disease);
    const filename=`avenier-mapa-${namePart}${!opts.combo&&opts.facet!=='all'?`-${slugKey(opts.facet)}`:opts.combo?'':'-vsechny-kategorie'}-${result.meta.fileDate}.png`;
    const url=URL.createObjectURL(result.blob);
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    label.textContent='PNG staženo';
    setTimeout(()=>document.getElementById('map-export-dialog')?.close(),450);
  }catch(e){
    console.error('Export mapy selhal:',e);
    label.textContent='Export se nezdařil';
  }finally{
    btn.removeAttribute('aria-busy');
    setTimeout(()=>{btn.disabled=false;label.textContent=original;},1800);
  }
}

function setupMapExport(){
  const btn=document.getElementById('map-export-png');
  const dialog=document.getElementById('map-export-dialog');
  const create=document.getElementById('map-export-create');
  if(!btn||btn.dataset.bound==='1')return;
  btn.dataset.bound='1';
  btn.disabled=false;
  btn.addEventListener('click',openMapExportDialog);
  create?.addEventListener('click',()=>downloadMapPng(readMapExportOptions(),create));
  dialog?.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });
  window.AvenierMapExport={createBlob:createMapExportBlob,download:downloadMapPng,metadata:exportMetadata};
}

function renderMapFilterLegend(){
  const box=document.getElementById('map-filter-legend');
  if(!box)return;
  const sourceCfg=staticDiseaseConfig(activeDisease);

  /* Kombinace má vlastní kartu: podfiltry se v ní neuplatňují. */
  if(isCombination()){
    box.hidden=false;
    box.innerHTML=`<strong>Kombinace filtrů</strong>
      <span class="mfl-note">Zvýrazněné jsou destinace, kterých se týkají všechny vybrané nemoci zároveň.</span>
      <span class="mfl-combo-list">${activeDiseaseKeys().map(key=>`<span class="mfl-combo-item">${esc(DISEASES[key]?.label||key)}</span>`).join('')}</span>
      <span class="mfl-reviewed">${esc(countDestinations(combinedHits().size))} v průniku</span>`;
    return;
  }

  if(activeDisease!=='yellow-fever'&&activeDisease!=='dengue'&&!sourceCfg){
    box.hidden=true;
    box.innerHTML='';
    return;
  }
  box.hidden=false;
  const sourceLink=sourceCfg?.sourceUrl
    ? `<a class="mfl-source" href="${esc(sourceCfg.sourceUrl)}" target="_blank" rel="noopener noreferrer">Zdroj mapy: ${esc(sourceCfg.sourceLabel||'odborný zdroj')} ↗</a>`
    : '';
  if(activeDisease==='yellow-fever'){
    box.innerHTML=`<strong>Žlutá zimnice</strong>
      <span class="mfl-note">Kliknutím zobrazíte jen vybranou kategorii.</span>
      <span class="mfl-items">
        ${yellowFeverFacetButtons('mfl-btn')}
      </span>
      ${facetGlossaryDetails('yellow-fever')}
      ${sourceLink}`;
    bindYellowFeverFacetControls(box);
    return;
  }
  if(activeDisease==='dengue'){
    box.innerHTML=`<strong>Horečka dengue</strong>
      <span class="mfl-note">Kliknutím zobrazíte jen vybranou kategorii.</span>
      <span class="mfl-items">${dengueFacetButtons('mfl-btn')}</span>
      ${facetGlossaryDetails('dengue')}
      <a class="mfl-source" href="${esc(DISEASES.dengue?.url||'#')}" target="_blank" rel="noopener noreferrer">Více o horečce dengue ↗</a>`;
    bindDengueFacetControls(box);
    return;
  }
  box.innerHTML=`<strong>${esc(DISEASES[activeDisease]?.label||'Zdroj filtru')}</strong>
    ${sourceLink}
    ${sourceCfg?.reviewedLabel?`<span class="mfl-reviewed">${esc(sourceCfg.reviewedLabel)}</span>`:''}`;
}

function bindYellowFeverFacetControls(container){
  container?.querySelectorAll('[data-yf-facet]').forEach(btn=>{
    btn.addEventListener('click',()=>setYellowFeverFacet(btn.dataset.yfFacet));
  });
}

function bindDengueFacetControls(container){
  container?.querySelectorAll('[data-dengue-facet]').forEach(btn=>{
    btn.addEventListener('click',()=>setDengueFacet(btn.dataset.dengueFacet));
  });
}

function setDengueFacet(facet){
  if(activeDisease!=='dengue')return;
  const allowed=new Set(['all','endemic','general']);
  activeDengueFacet=allowed.has(facet)?facet:'all';
  const hits=visibleDiseaseHits('dengue');
  const status=document.getElementById('filter-status');
  if(status)status.textContent=`Horečka dengue: ${dengueFacetLabel(activeDengueFacet)} · ${countDestinations(hits.size)}${diseaseSourceLabel('dengue')}.`;
  renderMapFilterLegend();
  renderMapLegend();
  repaintMap();
  renderFilterResults();
  updateUrlState();
}

function setYellowFeverFacet(facet){
  if(activeDisease!=='yellow-fever')return;
  const allowed=new Set(['all','risk','entry','both']);
  activeYellowFeverFacet=allowed.has(facet)?facet:'all';
  const hits=visibleDiseaseHits('yellow-fever');
  const status=document.getElementById('filter-status');
  if(status)status.textContent=`Žlutá zimnice: ${yellowFeverFacetLabel(activeYellowFeverFacet)} · ${countDestinations(hits.size)}${diseaseSourceLabel('yellow-fever')}.`;
  renderMapFilterLegend();
  renderMapLegend();
  repaintMap();
  renderFilterResults();
  updateUrlState();
}

function diseaseSourceLabel(key){
  const src=diseaseIndexSource.get(key);
  if(src==='hybrid-index')return ' (zdroj: pravidelně aktualizovaná doporučení + CDC)';
  if(src==='hybrid-partial')return ' (zdroj: cestovní doporučení + CDC, neúplná data)';
  if(src==='hybrid')return ' (zdroj: cestovní doporučení + CDC)';
  if(src==='static-index')return ` (zdroj: ${staticDiseaseConfig(key)?.sourceLabel||'odborný index'})`;
  if(src==='api-row')return ' (zdroj: cestovní doporučení pro destinace)';
  if(src==='api-index')return ' (zdroj: pravidelně aktualizovaná cestovní doporučení)';
  if(src==='detail')return ' (zdroj: cestovní doporučení pro destinace)';
  if(src==='detail-partial')return ' (zdroj: cestovní doporučení, neúplná data)';
  return '';
}

function syncExpandedDiseaseGroup(key){
  const group=document.querySelector('.more-diseases');
  if(!group)return;
  const inside=!!group.querySelector(`.fbtn[data-disease="${CSS.escape(key||'')}"]`);
  group.open=inside;
  group.classList.toggle('has-active',inside);
}

function closeFilterInfo(){
  const info=document.querySelector('.finfo[open]');
  if(info)info.removeAttribute('open');
}

function resetMapViewport(){
  if(!sv || !zb)return;
  const base=d3.zoomIdentity;
  sv.transition().duration(420).call(zb.transform,base);
}

function setupFilterInfoDismiss(){
  const info=document.querySelector('.finfo');
  if(!info || info.dataset.bound==='1')return;
  info.dataset.bound='1';

  document.addEventListener('click',e=>{
    if(!info.open)return;
    if(e.target.closest('.finfo')===info)return;
    info.removeAttribute('open');
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && info.open){
      info.removeAttribute('open');
      info.querySelector('summary')?.focus();
    }
  });
}

async function setDiseaseFilter(key){
  closeFilterInfo();
  closePanel();
  resetMapViewport();
  filterDestinationMismatch=null;
  requestedDisease=key||'all';
  if(requestedDisease!=='all' && !DISEASES[requestedDisease]){
    console.warn('Neznámý filtr nemoci:',requestedDisease);
    requestedDisease='all';
  }
  activeYellowFeverFacet='all';
  activeDengueFacet='all';
  /* Výběr jedné nemoci vždy začíná nanovo, kombinace se ruší. */
  extraDiseases=[];
  invalidateCombinedHits();
  const token=++filterRequestToken;
  scrollMapIntoView();
  syncFilterButtons();
  syncExpandedDiseaseGroup(requestedDisease);

  if(requestedDisease==='all'){
    activeDisease='all';
    combineMode=false;
    renderCombineUi();
    renderMapFilterLegend();
    renderMapLegend();
    const status=document.getElementById('filter-status');
    const loader=document.getElementById('filter-loader');
    if(loader)loader.classList.remove('on');
    if(status)status.textContent='Zobrazeny všechny destinace s dostupným detailem.';
    repaintMap();
    renderFilterResults();
    if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
    updateUrlState();
    return;
  }

  activeDisease=requestedDisease;
  renderMapFilterLegend();
  const status=document.getElementById('filter-status');
  const loader=document.getElementById('filter-loader');
  if(loader)loader.classList.add('on');
  if(status)status.textContent=`Načítám filtr: ${DISEASES[requestedDisease].label}…`;

  await ensureDiseaseIndex(requestedDisease,{token});
  if(token!==filterRequestToken)return;

  activeDisease=requestedDisease;
  if(loader)loader.classList.remove('on');
  const effectiveHits=effectiveDiseaseHits(activeDisease);
  if(status)status.textContent=`${DISEASES[activeDisease].label}: zvýrazněno ${countDestinations(effectiveHits.size)}${diseaseSourceLabel(activeDisease)}.`;
  syncFilterButtons();
  renderCombineUi();
  renderMapFilterLegend();
  renderMapLegend();
  repaintMap();
  renderFilterResults();
  if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
  updateUrlState();
}

/* ── Kombinace filtrů ── */

function syncFilterButtons(){
  const selected=new Set(activeDiseaseKeys());
  document.querySelectorAll('.fbtn[data-disease]').forEach(btn=>{
    const key=btn.dataset.disease;
    const isActive=key==='all'?(!activeDisease||activeDisease==='all'):selected.has(key);
    btn.classList.toggle('active',isActive);
    btn.classList.toggle('combo-active',isActive&&key!=='all'&&isCombination());
    if(combineMode&&key!=='all')btn.setAttribute('aria-pressed',String(isActive));
    else btn.removeAttribute('aria-pressed');
  });
}

function renderCombineUi(){
  const toggle=document.getElementById('filter-combine');
  const summary=document.getElementById('filter-combo');
  const hasFilter=activeDisease&&activeDisease!=='all';

  if(toggle){
    toggle.hidden=!hasFilter;
    toggle.classList.toggle('on',combineMode);
    toggle.setAttribute('aria-pressed',String(combineMode));
    toggle.textContent=combineMode?'Hotovo':'+ Kombinovat s další nemocí';
  }

  if(!summary)return;
  if(!hasFilter||(!combineMode&&!isCombination())){
    summary.hidden=true;
    summary.innerHTML='';
    return;
  }
  summary.hidden=false;
  const chips=activeDiseaseKeys().map((key,i)=>`<span class="fcombo-chip">${i?'<i aria-hidden="true">+</i>':''}${esc(DISEASES[key]?.label||key)}${i?`<button type="button" data-remove-disease="${esc(key)}" aria-label="Odebrat ${esc(DISEASES[key]?.label||key)} z kombinace">×</button>`:''}</span>`).join('');
  const hint=combineMode
    ? (isCombination()?'Klikněte na další nemoc v seznamu výše, nebo kombinaci ukončete tlačítkem Hotovo.':'Vyberte v seznamu výše další nemoc, kterou chcete přidat.')
    : '';
  summary.innerHTML=`<div class="fcombo-row">${chips}</div>
    ${isCombination()?`<span class="fcombo-count">${esc(countDestinations(combinedHits().size))} v průniku</span>`:''}
    ${hint?`<span class="fcombo-hint">${esc(hint)}</span>`:''}
    ${isCombination()?`<button class="fcombo-clear" type="button" data-clear-combination>Zrušit kombinaci</button>`:''}`;

  summary.querySelectorAll('[data-remove-disease]').forEach(btn=>{
    btn.addEventListener('click',()=>toggleExtraDisease(btn.dataset.removeDisease));
  });
  summary.querySelector('[data-clear-combination]')?.addEventListener('click',()=>{
    extraDiseases=[];
    invalidateCombinedHits();
    applyCombinationChange();
  });
}

function setCombineMode(on){
  if(!activeDisease||activeDisease==='all')return;
  combineMode=!!on;
  if(!combineMode&&!isCombination())renderCombineUi();
  else renderCombineUi();
  syncFilterButtons();
}

async function toggleExtraDisease(key){
  if(!DISEASES[key]||!activeDisease||activeDisease==='all')return;
  if(key===activeDisease)return;

  if(extraDiseases.includes(key)){
    extraDiseases=extraDiseases.filter(k=>k!==key);
    invalidateCombinedHits();
    applyCombinationChange();
    return;
  }

  const token=++filterRequestToken;
  const status=document.getElementById('filter-status');
  const loader=document.getElementById('filter-loader');
  if(loader)loader.classList.add('on');
  if(status)status.textContent=`Načítám filtr: ${DISEASES[key].label}…`;

  await ensureDiseaseIndex(key,{token});
  if(token!==filterRequestToken)return;
  if(loader)loader.classList.remove('on');

  extraDiseases=unique([...extraDiseases,key]);
  /* Podfiltry v kombinaci neplatí, aby průnik nebyl zavádějící. */
  activeYellowFeverFacet='all';
  activeDengueFacet='all';
  invalidateCombinedHits();
  applyCombinationChange();
}

function applyCombinationChange(){
  invalidateCombinedHits();
  filterDestinationMismatch=null;
  const status=document.getElementById('filter-status');
  if(status){
    status.textContent=isCombination()
      ? `${combinationLabel()}: ${countDestinations(combinedHits().size)} se všemi vybranými riziky zároveň.`
      : `${DISEASES[activeDisease].label}: zvýrazněno ${countDestinations(effectiveDiseaseHits(activeDisease).size)}${diseaseSourceLabel(activeDisease)}.`;
  }
  syncFilterButtons();
  renderCombineUi();
  renderMapFilterLegend();
  renderMapLegend();
  repaintMap();
  renderFilterResults();
  if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
  updateUrlState();
}

function setupFilters(){
  document.querySelectorAll('.fbtn[data-disease]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.disease;
      /* V režimu kombinace přidává klik další nemoc; „Všechny destinace“
         a klik na hlavní nemoc se chovají jako běžný filtr. */
      if(combineMode&&key!=='all'&&key!==activeDisease&&activeDisease!=='all'){
        toggleExtraDisease(key);
        return;
      }
      setDiseaseFilter(key);
    });
  });

  document.getElementById('filter-combine')?.addEventListener('click',()=>setCombineMode(!combineMode));

  document.querySelectorAll('.qchip[data-q]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const q=btn.dataset.q;
      const hit=sidx.find(x=>slugKey(x.search).includes(slugKey(q)));
      if(hit){
        selectCountry(hit.nid);
      }else{
        const inp=document.getElementById('av-search');
        if(inp)inp.value=q;
      }
    });
  });

  setupFilterInfoDismiss();
}

function vaxArrays(data){
  return {
    pov:Array.isArray(data?.povinne)?data.povinne:[],
    zak:Array.isArray(data?.zakladni)?data.zakladni:[],
    dop:Array.isArray(data?.doporuceni)?data.doporuceni:[]
  };
}

function vaxName(v){
  return esc(v?.name||v?.title||v||'');
}

function miniPillHtml(v,cls='d'){
  const name=vaxName(v);
  const url=v?.url||v?.www||'';
  if(url)return `<a class="mi-link-pill ${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>`;
  return `<span class="mi-pill ${cls}">${name}</span>`;
}

function miniGroupHtml(label,items,cls,limit=3){
  if(!items.length)return '';
  const shown=items.slice(0,limit);
  const more=items.length-shown.length;
  return `<div class="mi-vax-row ${cls}">
    <span class="mi-row-label">${esc(label)}</span>
    <div class="mi-row-pills">
      ${shown.map(v=>miniPillHtml(v,cls)).join('')}
      ${more>0?`<button class="mi-more" data-mi-action="scroll-detail" type="button">… a ${more} dalších</button>`:''}
    </div>
  </div>`;
}

function miniVaxList(data){
  const {pov,zak,dop}=vaxArrays(data);
  const h=[
    miniGroupHtml('Povinná',pov,'p',2),
    miniGroupHtml('Základní',zak,'z',3),
    miniGroupHtml('Další doporučení a rizika',dop,'d',3)
  ].join('');
  return h?`<div class="mi-vax-groups">${h}</div>`:'';
}

function moreAboutDestinationLabel(info){
  return `Více informací: ${cleanName(info?.name||'destinace')}`;
}

function detailBadgeHtml(className,label,section,action='detail-section'){
  return `<button class="${className}" type="button" data-${action}="${esc(section)}">${esc(label)}</button>`;
}

function scrollToDetailSection(section=''){
  const panel=document.getElementById('pnl');
  if(!panel)return;
  const target=section?document.getElementById(`vax-section-${section}`):panel;
  (target||panel).scrollIntoView({behavior:'smooth',block:'start'});
  if(target){
    target.setAttribute('tabindex','-1');
    target.focus({preventScroll:true});
  }
}

function destinationMatchesActiveFilter(info){
  if(!info||!activeDisease||activeDisease==='all')return true;
  if(!isCombination()&&!diseaseIndex.has(activeDisease))return true;
  return matchesActiveFilter(info.id);
}

function destinationFilterNoticeHtml(info,{action=false}={}){
  if(destinationMatchesActiveFilter(info))return'';
  const diseaseName=isCombination()?combinationLabel():(DISEASES[activeDisease]?.label||'aktuálnímu filtru');
  return `<div class="destination-filter-notice"><strong>${esc(info.name)} není mezi destinacemi filtru ${esc(diseaseName)}.</strong>${action?`<button type="button" data-mi-action="clear-filter">Zrušit filtr</button>`:''}</div>`;
}

function renderMapInfo(info,data=null,loading=false){
  const box=document.getElementById('map-info');
  if(!box||!info)return;
  /* Odkaz na stránku destinace nabízíme jen tam, kde ji web opravdu má.
     Skládaná adresa u destinací bez doporučení končila na chybové stránce. */
  const url=info.www||'';
  const centerUrl='https://www.ockovacicentrum.cz/cz/kde-ockujeme';
  const {pov,zak,dop}=vaxArrays(data);
  const np=pov.length, nz=zak.length, nd=dop.length;
  const badges=data
    ? detailBadgeHtml('mi-badge p',countWithNoun(np,...COUNT_FORMS.required),'povinne','mi-section')+
      detailBadgeHtml('mi-badge z',countWithNoun(nz,...COUNT_FORMS.basic),'zakladni','mi-section')+
      detailBadgeHtml('mi-badge d',countWithNoun(nd,...COUNT_FORMS.recommended),'doporuceni','mi-section')
    : (info.has?`<span class="mi-badge">Načítám doporučení…</span>`:`<span class="mi-badge">Bez cestovních doporučení</span>`);
  box.innerHTML=`<div class="mi-head">
    <div>
      <div class="mi-label">Vybraná destinace</div>
      <div class="mi-title">${esc(info.name)}</div>
    </div>
    <button class="mi-close" data-mi-action="close" type="button" aria-label="Zavřít">×</button>
  </div>
  <div class="mi-badges">${badges}</div>
  ${destinationFilterNoticeHtml(info,{action:true})}
  ${data?miniVaxList(data):''}
  <div class="mi-text">${data?'Rychlý přehled nejčastějších doporučení a rizik vidíte přímo zde. Nejde vždy o kompletní výčet, další položky najdete v detailu níže.':'Podrobnosti k destinaci najdete v panelu pod mapou. S konkrétním plánem očkování vám poradí naši specialisté v očkovacích centrech Avenier.'}</div>
  ${loading?'<div class="mi-loading">Načítám detail destinace…</div>':''}
  <div class="mi-actions">
    <a class="mi-btn center" href="${esc(centerUrl)}" target="_blank" rel="noopener noreferrer">Najít očkovací centrum</a>
    ${url?`<a class="mi-btn secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(moreAboutDestinationLabel(info))}</a>`:''}
    <button class="mi-btn route${isInRoute(info.id)?' on':''}" data-mi-action="route" type="button">${isInRoute(info.id)?'V trase ✓':'+ Přidat do trasy'}</button>
    <button class="mi-btn share" data-mi-action="share" type="button">Zkopírovat odkaz</button>
    <button class="mi-btn ghost" data-mi-action="scroll-detail" type="button">Zobrazit doporučení</button>
  </div>`;
  box.classList.add('open');
  const scrollToPanel=()=>document.getElementById('pnl')?.scrollIntoView({behavior:'smooth',block:'start'});
  box.onclick=async e=>{
    const sectionEl=e.target.closest('[data-mi-section]');
    if(sectionEl){
      scrollToDetailSection(sectionEl.dataset.miSection);
      return;
    }
    const actionEl=e.target.closest('[data-mi-action]');
    if(!actionEl)return;
    const action=actionEl.dataset.miAction;
    if(action==='close'){
      closePanel();
      return;
    }
    if(action==='share'){
      copyShareLink(actionEl);
      return;
    }
    if(action==='route'){
      toggleRouteDestination(info.id);
      document.getElementById('route-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
      return;
    }
    if(action==='scroll-detail'){
      scrollToPanel();
      return;
    }
    if(action==='clear-filter'){
      const id=info.id;
      await setDiseaseFilter('all');
      selectCountry(id);
    }
  };
}

function clearMapInfo(){
  const box=document.getElementById('map-info');
  if(box){box.classList.remove('open');box.innerHTML='';}
}

/* ── Trasa přes více destinací ──
   Cesta bývá vícezastávková („Keňa + Tanzanie + Zanzibar“). Trasa sjednotí
   doporučení všech zastávek a u každé položky ukáže, kolika destinací se týká. */
const ROUTE_MAX=12;

function routeInfos(){
  return routeIds.map(id=>FI.get(normId(id))).filter(Boolean);
}

function setRoute(ids){
  const seen=new Set();
  routeIds=[];
  (ids||[]).forEach(id=>{
    const nid=normId(id);
    const key=String(nid);
    if(seen.has(key))return;
    if(!FI.get(nid))return;
    if(routeIds.length>=ROUTE_MAX)return;
    seen.add(key);
    routeIds.push(nid);
  });
  onRouteChanged();
}

function toggleRouteDestination(id){
  const nid=normId(id);
  if(isInRoute(nid)){
    routeIds=routeIds.filter(x=>normId(x)!==nid);
  }else{
    if(routeIds.length>=ROUTE_MAX){
      const bar=document.getElementById('route-bar');
      bar?.classList.add('route-bar-limit');
      setTimeout(()=>bar?.classList.remove('route-bar-limit'),1200);
      return;
    }
    routeIds=[...routeIds,nid];
  }
  onRouteChanged();
}

function clearRoute(){
  routeIds=[];
  onRouteChanged();
}

function onRouteChanged(){
  renderRouteBar();
  renderRoutePanel();
  repaintMap();
  if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
  updateUrlState();
}

function renderRouteBar(){
  const bar=document.getElementById('route-bar');
  if(!bar)return;
  if(!routeIds.length){
    bar.hidden=true;
    bar.innerHTML='';
    return;
  }
  bar.hidden=false;
  const chips=routeInfos().map((info,i)=>`<span class="route-chip">
    <b>${i+1}</b>${esc(info.name)}
    <button type="button" data-route-remove="${esc(info.id)}" aria-label="Odebrat ${esc(info.name)} z trasy">×</button>
  </span>`).join('');
  bar.innerHTML=`<span class="route-label">Trasa</span>
    <div class="route-chips">${chips}</div>
    <span class="route-count">${esc(countDestinations(routeIds.length))}</span>
    <button class="route-clear" type="button" data-route-clear>Vymazat trasu</button>`;

  bar.querySelectorAll('[data-route-remove]').forEach(btn=>{
    btn.addEventListener('click',()=>toggleRouteDestination(btn.dataset.routeRemove));
  });
  bar.querySelector('[data-route-clear]')?.addEventListener('click',clearRoute);
}

/* Nejsilnější kategorie rozhoduje: co je někde povinné, nesmí spadnout mezi
   doporučená. */
const ROUTE_CATEGORY_ORDER=['povinne','zakladni','doporuceni'];

function routeItemsFromDetails(entries){
  const items=new Map();
  entries.forEach(({info,data})=>{
    ROUTE_CATEGORY_ORDER.forEach(category=>{
      const list=Array.isArray(data?.[category])?data[category]:[];
      list.forEach(item=>{
        const name=cleanName(diseaseItemName(item));
        if(!name)return;
        const key=slugKey(name);
        const existing=items.get(key);
        const url=item?.url||item?.www||'';
        if(existing){
          if(ROUTE_CATEGORY_ORDER.indexOf(category)<ROUTE_CATEGORY_ORDER.indexOf(existing.category))existing.category=category;
          if(!existing.destinations.includes(info.name))existing.destinations.push(info.name);
          if(!existing.url&&url)existing.url=url;
        }else{
          items.set(key,{name,url,category,destinations:[info.name]});
        }
      });
    });
  });
  return [...items.values()].sort((a,b)=>
    b.destinations.length-a.destinations.length||a.name.localeCompare(b.name,'cs')
  );
}

function routeItemHtml(item,total){
  const cls=item.category==='povinne'?'p':item.category==='zakladni'?'z':'d';
  const title=`${item.name} · ${item.destinations.join(', ')}`;
  const label=`${item.destinations.length}/${total}`;
  const inner=`${esc(item.name)}<span class="route-item-count">${esc(label)}</span>`;
  return item.url
    ? `<a class="pill ${cls} route-item" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" title="${esc(title)}">${inner}</a>`
    : `<span class="pill ${cls} route-item" title="${esc(title)}">${inner}</span>`;
}

let routeRenderToken=0;

async function renderRoutePanel(){
  const panel=document.getElementById('route-panel');
  if(!panel)return;
  if(!routeIds.length){
    panel.hidden=true;
    panel.innerHTML='';
    return;
  }

  const token=++routeRenderToken;
  const infos=routeInfos();
  const withData=infos.filter(info=>info.has);
  panel.hidden=false;
  panel.innerHTML=`<div class="route-head">
    <div>
      <p class="route-kicker">Souhrn trasy</p>
      <h2>${esc(infos.map(i=>i.name).join(' → '))}</h2>
    </div>
    <span class="route-badge">${esc(countDestinations(infos.length))}</span>
  </div>
  <p class="route-loading">Načítám doporučení pro celou trasu…</p>`;

  const entries=[];
  for(const info of withData){
    const data=await fetchCountryDetail(info);
    if(token!==routeRenderToken)return;
    if(data)entries.push({info,data});
  }
  if(token!==routeRenderToken)return;

  const items=routeItemsFromDetails(entries);
  const total=entries.length;
  const missing=infos.filter(info=>!info.has);
  const groups=[
    {key:'povinne',label:'Povinná očkování',cls:'p'},
    {key:'zakladni',label:'Základní očkování',cls:'z'},
    {key:'doporuceni',label:'Další doporučení a rizika',cls:'d'}
  ];

  const sections=groups.map(group=>{
    const list=items.filter(item=>item.category===group.key);
    if(!list.length)return '';
    return `<section class="route-group">
      <p class="sl ${group.cls}">${esc(group.label)}</p>
      <div class="pills">${list.map(item=>routeItemHtml(item,total)).join('')}</div>
    </section>`;
  }).join('');

  const missingNote=missing.length
    ? `<p class="route-missing">Pro ${esc(missing.map(i=>i.name).join(', '))} zatím nemáme cestovní doporučení, do souhrnu se proto nepočítají.</p>`
    : '';

  panel.innerHTML=`<div class="route-head">
    <div>
      <p class="route-kicker">Souhrn trasy</p>
      <h2>${esc(infos.map(i=>i.name).join(' → '))}</h2>
    </div>
    <span class="route-badge">${esc(countDestinations(infos.length))}</span>
  </div>
  <p class="route-intro">Sloučená doporučení pro všechny zastávky. Číslo u položky říká, kolika destinací z trasy se týká — co platí jen pro jednu zastávku, je stejně potřeba řešit před cestou.</p>
  ${missingNote}
  ${sections||'<p class="route-missing">Pro zastávky v trase se zatím nepodařilo načíst žádná doporučení.</p>'}
  <div class="route-actions">
    <a class="bmore" href="https://www.ockovacicentrum.cz/cz/kde-ockujeme" target="_blank" rel="noopener noreferrer">Najít očkovací centrum</a>
    <button class="bmore secondary" type="button" data-print-view>Vytisknout / uložit PDF</button>
    <button class="bmore secondary" type="button" data-route-clear>Vymazat trasu</button>
  </div>
  ${consultationNoteHtml()}`;

  panel.querySelector('[data-route-clear]')?.addEventListener('click',clearRoute);
}

/* ── Tisk a PDF ──
   Uložení do PDF necháváme na prohlížeči: „Tisk → Uložit jako PDF“ dá lepší
   typografii i výběr formátu než jakákoli knihovna a nepřidává závislost.
   Naším úkolem je připravit stránku tak, aby na papíře dávala smysl. */
function printContextLabel(){
  if(routeIds.length)return routeInfos().map(i=>i.name).join(' → ');
  if(curInfo)return curInfo.name;
  if(isCombination())return combinationLabel();
  if(activeDisease&&activeDisease!=='all')return DISEASES[activeDisease]?.label||'';
  return 'Přehled destinací';
}

function buildPrintHeader(){
  const box=document.getElementById('print-header');
  if(!box)return;
  const date=new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'}).format(new Date());
  const parts=[`Vytištěno ${date}`,'Zdroj: cestovní doporučení Avenier, ockovacicentrum.cz'];
  /* Dvojtečka drží 1. pád – „Trasa o 3 destinace“ by bylo špatně. */
  if(routeIds.length)parts.push(`Trasa: ${countDestinations(routeIds.length)}`);
  box.innerHTML=`<div class="print-brand">Avenier · Očkovací centrum</div>
    <div class="print-title">${esc(printContextLabel())}</div>
    <div class="print-meta">${parts.map(esc).join(' · ')}</div>
    <div class="print-note"><strong>Orientační přehled.</strong> Doporučení se liší podle délky pobytu, konkrétní oblasti, stylu cestování a zdravotního stavu. Tento výpis nenahrazuje vyšetření ani doporučení lékaře.</div>`;
}

function printCurrentView(){
  buildPrintHeader();
  window.print();
}

/* ── Ovládání mapy z klávesnice ──
   Mapa byla dostupná jen myší. Tabovat přes 240 zemí by bylo nepoužitelné,
   proto je mapa jeden fokusovatelný prvek a šipky v ní přeskakují na nejbližší
   destinaci daným směrem. */
let keyboardCursorId=null;
let navPoints=[];

function rebuildNavPoints(){
  navPoints=[];
  if(!prj||!pg)return;
  FI.forEach((info,id)=>{
    if(!info.has)return;
    let point=null;
    if(info.coords)point=prj(info.coords);
    else{
      const feat=FM.get(mappedIdForInfo(id,info));
      if(feat){try{point=pg.centroid(feat);}catch(e){point=null;}}
    }
    if(!point||!Number.isFinite(point[0])||!Number.isFinite(point[1]))return;
    navPoints.push({id:normId(id),name:info.name,x:point[0],y:point[1]});
  });
}

function announceMap(message){
  const box=document.getElementById('map-live');
  if(box)box.textContent=message;
}

function setKeyboardCursor(id,{announce=true}={}){
  keyboardCursorId=id===null||id===undefined?null:normId(id);
  gv?.selectAll('path.country').classed('kb-focus',d=>keyboardCursorId!==null&&featureId(d)===keyboardCursorId);
  d3.selectAll('circle.dest-marker').classed('kb-focus',d=>keyboardCursorId!==null&&normId(d.id)===keyboardCursorId);
  if(keyboardCursorId===null)return;
  const info=FI.get(keyboardCursorId);
  if(!info)return;
  const hl=document.getElementById('hlbl');
  if(hl){hl.textContent=info.name;hl.classList.add('on');}
  if(announce){
    const state=activeDisease==='all'
      ? (info.has?'má cestovní doporučení':'bez cestovních doporučení')
      : (matchesActiveFilter(keyboardCursorId)?'odpovídá filtru':'neodpovídá filtru');
    announceMap(`${info.name}, ${state}. Enter otevře detail.`);
  }
}

function moveKeyboardCursor(dx,dy){
  if(!navPoints.length)rebuildNavPoints();
  if(!navPoints.length)return;
  const current=navPoints.find(p=>p.id===keyboardCursorId);
  if(!current){
    const start=navPoints.slice().sort((a,b)=>a.x-b.x||a.y-b.y)[0];
    setKeyboardCursor(start.id);
    return;
  }
  /* Vybíráme nejbližší bod ve zvoleném směru; pohyb napříč směrem se penalizuje,
     aby šipka doleva nepřeskakovala nahoru přes půl mapy. */
  let best=null,bestScore=Infinity;
  navPoints.forEach(p=>{
    if(p.id===current.id)return;
    const ox=(p.x-current.x)*dx+(p.y-current.y)*dy;
    if(ox<=0.5)return;
    const cross=Math.abs((p.x-current.x)*dy-(p.y-current.y)*dx);
    const score=ox+cross*2.5;
    if(score<bestScore){bestScore=score;best=p;}
  });
  if(best)setKeyboardCursor(best.id);
}

function setupMapKeyboard(){
  const svg=document.getElementById('av-map');
  if(!svg||svg.dataset.kbBound==='1')return;
  svg.dataset.kbBound='1';
  svg.setAttribute('tabindex','0');
  svg.setAttribute('role','application');
  svg.setAttribute('aria-label','Mapa destinací. Šipkami se pohybujete mezi destinacemi, Enter otevře detail, Escape mapu opustí.');

  svg.addEventListener('focus',()=>{
    rebuildNavPoints();
    if(keyboardCursorId===null){
      /* Začínáme u vybrané destinace, jinak doma – z Česka se cestovatel
         orientuje líp než z prvního bodu na okraji projekce. */
      const selected=curInfo?normId(curInfo.id):null;
      const home=navPoints.some(p=>p.id===203)?203:null;
      if(selected!==null&&navPoints.some(p=>p.id===selected))setKeyboardCursor(selected);
      else if(home!==null)setKeyboardCursor(home);
      else moveKeyboardCursor(1,0);
    }else setKeyboardCursor(keyboardCursorId);
    announceMap('Mapa je aktivní. Šipkami vyberte destinaci, Enter otevře detail.');
  });

  svg.addEventListener('blur',()=>{
    setKeyboardCursor(null,{announce:false});
    document.getElementById('hlbl')?.classList.remove('on');
  });

  svg.addEventListener('keydown',e=>{
    const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(moves[e.key]){
      e.preventDefault();
      moveKeyboardCursor(...moves[e.key]);
      return;
    }
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(keyboardCursorId!==null)selectCountry(keyboardCursorId);
      return;
    }
    if(e.key==='Escape'){
      setKeyboardCursor(null,{announce:false});
      svg.blur();
      return;
    }
    if(e.key==='Home'){
      e.preventDefault();
      rebuildNavPoints();
      const first=navPoints.slice().sort((a,b)=>a.name.localeCompare(b.name,'cs'))[0];
      if(first)setKeyboardCursor(first.id);
      return;
    }
    if(e.key==='+'||e.key==='='){e.preventDefault();sv.transition().call(zb.scaleBy,1.5);return;}
    if(e.key==='-'){e.preventDefault();sv.transition().call(zb.scaleBy,.67);}
  });
}

/* ── Panel ── */
function renderPanel(info){
  const wrap=document.getElementById('pnl');
  /* Viz renderMapInfo – odkaz jen tam, kde stránka destinace existuje. */
  const url=info.www||'';
  curSlug=info.slug;
  curInfo=info;
  const cacheState=getCachedDetailState(info.slug);
  renderMapInfo(info,getCachedDetail(info.slug),info.has&&cacheState==='miss');

  wrap.innerHTML=`<div class="card">
    <button class="bclose" id="bcl" type="button" aria-label="Zavřít detail destinace">×</button>
    <div class="chd">
      <div>
        <p class="dlbl">Vybraná destinace</p>
        <h2 class="dname">${esc(info.name)}</h2>
        <div class="vcnts" id="vcc"></div>
      </div>
    </div>
    <div class="div"></div>
    <div id="vb"><p class="ml">${info.has?'Načítám vakcinační doporučení…':'Pro tuto destinaci zatím nemáme cestovní doporučení.'}</p></div>
    <div class="cft">
      <div class="actionrow">
        <a class="bmore" href="https://www.ockovacicentrum.cz/cz/kde-ockujeme" target="_blank" rel="noopener noreferrer">
          Najít očkovací centrum
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        ${url?`<a class="bmore secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(moreAboutDestinationLabel(info))}</a>`:''}
        <button class="bmore secondary" type="button" data-print-view>Vytisknout / uložit PDF</button>
      </div>
      <span class="ftnote">ockovacicentrum.cz</span>
    </div>
  </div>`;

  /* Panel se zobrazuje hned. Dřívější odklad přes requestAnimationFrame
     způsoboval, že v nefokusované záložce zůstal panel skrytý. */
  wrap.classList.add('open');
  document.getElementById('hint').classList.add('h');
  document.getElementById('bcl').addEventListener('click',closePanel);

  if(!info.has){
    renderNoApiData(info);
    return;
  }

  if(cacheState==='ok'){
    renderVax(getCachedDetail(info.slug));
    return;
  }
  const t=info.slug;
  fetchCountryDetail(info).then(d=>{
    if(curSlug!==t)return;
    renderVax(d);
  });
}

function renderNoApiData(info){
  renderMapInfo(info,null,false);
  const vc=document.getElementById('vcc');
  const vb=document.getElementById('vb');
  const external=externalDiseaseItems(info,null);
  if(vc)vc.innerHTML=external.length?detailBadgeHtml('vcb vcbx',countWithNoun(external.length,...COUNT_FORMS.external),'external'):'';
  /* Bez obecné poznámky o konzultaci – odstavec níže už na situaci reaguje
     konkrétněji a dvě nabídky konzultace za sebou působily jako výplň. */
  if(vb)vb.innerHTML=`${destinationFilterNoticeHtml(info)}<p class="cnote">
    Pro destinaci <strong>${esc(info.name)}</strong> zatím nemáme cestovní doporučení.
    Očkování a ochranu před nemocemi s vámi rádi projdeme osobně — naši specialisté
    v očkovacích centrech Avenier poradí i s destinacemi, které v mapě nenajdete.
  </p>${externalDiseaseSectionHtml(info,null)}`;
  setupDetailBadgeButtons(vc);
}

const VAX_HELP={
  povinne:'Očkování, které je nezbytné a současně musí být platné před vstupem do dané destinace či při tranzitu přes endemickou oblast.',
  zakladni:'Očkování, které odborné autority považují za jednoznačně doporučené pro danou destinaci.',
  doporuceni:'Další nemoci a zdravotní rizika, se kterými se můžete v destinaci setkat. Některým lze předcházet očkováním, u jiných je důležitá ochrana před hmyzem, bezpečné jídlo a voda nebo vhodné chování během cesty.'
};

function sectionTitle(cls,label,key){
  return `<p class="sl ${cls}" id="vax-section-${esc(key)}">${esc(label)} <button class="help-btn" type="button" data-help="${esc(key)}" aria-label="Vysvětlit: ${esc(label)}">?</button></p>
  <div class="help-note ${cls}" data-help-note="${esc(key)}">${esc(VAX_HELP[key])}</div>`;
}

function sectionPillsHtml(items,cls){
  return `<div class="pills">${items.map(v=>pillHtml(v,cls)).join('')}</div>`;
}

function sectionHtml(cls,label,key,items,emptyText){
  return sectionTitle(cls,label,key)+(
    items.length
      ? sectionPillsHtml(items,cls)
      : `<p class="mt">${esc(emptyText)}</p>`
  );
}

function setupHelpButtons(root=document){
  root.querySelectorAll('.help-btn[data-help]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.help;
      const note=btn.closest('#vb')?.querySelector(`[data-help-note="${CSS.escape(key)}"]`) || document.querySelector(`[data-help-note="${CSS.escape(key)}"]`);
      if(note)note.classList.toggle('open');
    });
  });
}

function setupDetailBadgeButtons(root=document){
  root?.querySelectorAll('[data-detail-section]').forEach(btn=>{
    btn.addEventListener('click',()=>scrollToDetailSection(btn.dataset.detailSection));
  });
}

function renderVax(data){
  if(curInfo)renderMapInfo(curInfo,data,false);
  const vc=document.getElementById('vcc');
  const vb=document.getElementById('vb');
  if(!vb)return;

  if(!data){
    if(curInfo)renderMapInfo(curInfo,null,false);
    if(vc)vc.innerHTML='';
    vb.innerHTML=`<p class="cnote">
      Doporučení se momentálně nepodařilo načíst. Zkuste výběr destinace opakovat za chvíli.
    </p>`;
    return;
  }

  const {pov,zak,dop}=vaxArrays(data);
  const np=pov.length;
  const nz=zak.length;
  const nd=dop.length;
  const external=externalDiseaseItems(curInfo,data);

  if(vc)vc.innerHTML=
    detailBadgeHtml('vcb vcbp',countWithNoun(np,...COUNT_FORMS.required),'povinne')+
    detailBadgeHtml('vcb vcbz',countWithNoun(nz,...COUNT_FORMS.basic),'zakladni')+
    detailBadgeHtml('vcb vcbd',countWithNoun(nd,...COUNT_FORMS.recommended),'doporuceni')+
    (external.length?detailBadgeHtml('vcb vcbx',countWithNoun(external.length,...COUNT_FORMS.external),'external'):'');

  let h=destinationFilterNoticeHtml(curInfo);
  h+=sectionHtml('p','Povinná očkování','povinne',pov,'Pro tuto destinaci nejsou uvedená žádná povinná očkování.');
  h+=sectionHtml('z','Základní očkování','zakladni',zak,'Pro tuto destinaci nejsou uvedená žádná základní očkování.');
  h+=sectionHtml('d','Další doporučení a rizika','doporuceni',dop,'Pro tuto destinaci nejsou uvedená žádná další doporučení ani rizika.');
  h+=externalDiseaseSectionHtml(curInfo,data);
  h+=consultationNoteHtml();

  vb.innerHTML=h;
  setupHelpButtons(vb);
  setupDetailBadgeButtons(vc);
}

function closePanel(){
  const w=document.getElementById('pnl');
  if(!w)return;
  w.classList.remove('open');
  w.innerHTML='';
  curSlug=null;
  curInfo=null;
  clearMapInfo();
  document.getElementById('hint')?.classList.remove('h');
  resetSel();
  const searchEl=document.getElementById('av-search');
  if(searchEl)searchEl.value='';
  document.getElementById('av-clr')?.classList.remove('on');
  setActiveQuick(null);
  updateUrlState();
}

/* ── Zoom na feature ── */
function mapFocusLayout(){
  const mobile=typeof window!=='undefined'&&window.matchMedia?.('(max-width: 640px)').matches;
  if(!mobile)return{x:W/2,y:H/2,availableHeight:H};
  /* Mobilní karta zabírá spodní část mapy. Vybranou destinaci proto skládáme
     do středu volné horní plochy, ne pod překryv detailu. */
  const availableHeight=H*.50;
  return{x:W/2,y:availableHeight/2,availableHeight};
}

function zoomToFeat(d,{animate=true}={}){
  try{
    const [[x0,y0],[x1,y1]]=pg.bounds(d);
    const dx=x1-x0,dy=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2;
    const focus=mapFocusLayout();
    const sc=Math.max(1.2,Math.min(8,.82/Math.max(dx/W,dy/focus.availableHeight)));
    const t=d3.zoomIdentity.translate(focus.x,focus.y).scale(sc).translate(-cx,-cy);
    if(animate){
      sv.transition().duration(650).call(zb.transform,t);
    }else{
      sv.call(zb.transform,t);
    }
  }catch(e){console.warn('Zoom na zemi selhal:',e);}
}

function zoomToCoords(coords,scale=4.2,{animate=true}={}){
  if(!coords||!prj)return;
  const [x,y]=prj(coords);
  const focus=mapFocusLayout();
  const t=d3.zoomIdentity.translate(focus.x,focus.y).scale(scale).translate(-x,-y);
  if(animate){
    sv.transition().duration(650).call(zb.transform,t);
  }else{
    sv.call(zb.transform,t);
  }
}

function scrollMapIntoView(){
  const mw=document.getElementById('mw');
  if(!mw)return;
  const rect=mw.getBoundingClientRect();
  const vh=window.innerHeight||document.documentElement.clientHeight;
  if(rect.top<vh*.18 || rect.bottom>vh*.86){
    mw.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function debounce(fn,wait=180){
  let t=null;
  return(...args)=>{
    if(t)clearTimeout(t);
    t=setTimeout(()=>fn(...args),wait);
  };
}

function handleMapResize(){
  if(!sv||!pg||!prj||!zb)return;
  const mw=document.getElementById('mw');
  if(!mw)return;
  const nextW=mw.clientWidth;
  const nextH=mw.clientHeight||H||540;
  if(!nextW||!nextH)return;
  if(nextW===W && nextH===H)return;

  W=nextW;
  H=nextH;

  sv.attr('viewBox',`0 0 ${W} ${H}`);
  prj.scale(W/5.9).translate([W/2,H/2]);
  pg.projection(prj);

  if(oceanRect)oceanRect.attr('width',W).attr('height',H);
  if(graticulePath)graticulePath.attr('d',pg);
  if(countryPaths)countryPaths.attr('d',pg);
  if(bordersPath)bordersPath.attr('d',pg);
  if(markerSelection){
    markerSelection
      .attr('cx',d=>{
        const projected=prj(d.info.coords);
        return projected?projected[0]:null;
      })
      .attr('cy',d=>{
        const projected=prj(d.info.coords);
        return projected?projected[1]:null;
      })
      .attr('display',d=>prj(d.info.coords)?null:'none');
  }

  rebuildNavPoints();
  zb.extent([[0,0],[W,H]]);
  sv.call(zb.transform,d3.zoomIdentity);
  currentZoomK=1;
  updateMarkerScale();
  repaintMap();

  if(curInfo){
    const current=FI.get(normId(curInfo.id))||curInfo;
    const mapId=mappedIdForInfo(current.id,current);
    const feat=FM.get(mapId);
    if(current.coords){
      zoomToCoords(current.coords,4.2,{animate:false});
    }else if(feat){
      zoomToFeat(feat,{animate:false});
    }
  }
}

const debouncedHandleMapResize=debounce(handleMapResize,180);

function setActiveQuick(info=null){
  document.querySelectorAll('.qchip[data-q]').forEach(btn=>{
    if(!info){btn.classList.remove('active');return;}
    const q=slugKey(btn.dataset.q||btn.textContent||'');
    const hay=slugKey([info.name,info.slug,info.search].filter(Boolean).join(' '));
    btn.classList.toggle('active',!!q && hay.includes(q));
  });
}

/* ── Výběr země (ze search i z kliknutí) ── */
function selectCountry(numId){
  const id=normId(numId);
  const info=FI.get(id);
  if(!info){
    console.warn('Zemi se nepodařilo vybrat:',{id,info:!!info});
    return;
  }

  const mapId=mappedIdForInfo(id,info);
  const feat=FM.get(mapId);
  resetSel();

  const markerEl=VM.get(id);
  const pathEl=feat?gv.select(`[data-id="${mapId}"]`).node():null;

  if(markerEl){
    selMark=markerEl;selMarkId=id;
    const k=currentZoomK||1;
    d3.select(markerEl).attr('r',MARKER_R.selected/k).attr('fill',MC.sel).attr('stroke',MC.selB).attr('stroke-width',MARKER_STROKE.selected/k);
    zoomToCoords(info.coords);
  }else if(pathEl){
    selEl=pathEl;selD=feat;
    d3.select(pathEl).attr('fill',MC.sel).attr('stroke',MC.selB).attr('stroke-width',1.55);
    zoomToFeat(feat);
  }else if(info.coords){
    zoomToCoords(info.coords);
  }

  document.getElementById('av-search').value=info.name;
  document.getElementById('av-clr').classList.add('on');
  document.getElementById('av-dd').classList.remove('open');

  setActiveQuick(info);
  scrollMapIntoView();
  renderPanel(info);
  updateUrlState();
}

/* ── Vyhledávání ── */
let sidx=[],ddAct=-1;

/* ── Vyhledávání ──
   Čeština se skloňuje, takže „do Thajska“, „v Keni“ nebo „Vietnamu“ jsou
   běžnější vstup než základní tvar. Porovnáváme proto zjednodušené kmeny
   a tolerujeme jeden překlep. */
function searchStem(value){
  let t=slugKey(value);
  if(t.length<4)return t;
  t=t.replace(/(ovia|ovi|ove|ami|ach|ich|ych|em|em)$/,'');
  t=t.replace(/(sko|ska|sku|ske|ski|cku|cku)$/,'sk');
  t=t.replace(/(ie|ii|ii)$/,'i');
  t=t.replace(/[aeiouy]+$/,'');
  return t||slugKey(value);
}

/* Levenshteinova vzdálenost s předčasným ukončením – hledáme jen ≤ max. */
function editDistanceWithin(a,b,max=1){
  if(Math.abs(a.length-b.length)>max)return max+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i];
    let best=i;
    for(let j=1;j<=b.length;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
      if(cur[j]<best)best=cur[j];
    }
    if(best>max)return max+1;
    prev=cur;
  }
  return prev[b.length];
}

function searchTokens(value){
  return slugKey(value).split('-').filter(Boolean);
}

function buildIdx(){
  const a=[];
  FI.forEach((v,k)=>{
    const haystack=v.search||v.name;
    a.push({
      nid:k,
      name:v.name,
      has:v.has,
      search:slugKey(haystack),
      tokens:unique(searchTokens(haystack)),
      stems:unique(searchTokens(haystack).map(searchStem)),
      nameStem:searchStem(v.name)
    });
  });
  return a.sort((a,b)=>a.name.localeCompare(b.name,'cs'));
}

/* Skóre: čím nižší, tím lepší shoda. null = neshoda. */
function searchScore(entry,queryKey,queryStems){
  if(entry.search.startsWith(queryKey))return 0;
  if(entry.search.includes(queryKey))return 1;

  /* Krátká slova („do“, „na“, „a“) by jinak vytáhla půlku seznamu. */
  let best=null;
  queryStems.forEach(qs=>{
    if(qs.length<3)return;
    entry.stems.forEach(stem=>{
      if(stem===qs){best=Math.min(best??9,2);return;}
      if(qs.length>=4&&(stem.startsWith(qs)||qs.startsWith(stem))){best=Math.min(best??9,3);return;}
      if(qs.length>=4&&editDistanceWithin(stem,qs,1)<=1)best=Math.min(best??9,4);
    });
  });
  return best;
}

function regionLabel(key){
  if(typeof REGION_LABELS!=='undefined'&&REGION_LABELS[key])return REGION_LABELS[key];
  return String(key||'').replace(/-/g,' ');
}

function regionMatch(queryKey){
  if(typeof REGION_ALIASES==='undefined')return null;
  const direct=REGION_ALIASES[queryKey]?queryKey:null;
  const viaSynonym=(typeof REGION_SYNONYMS!=='undefined'&&REGION_SYNONYMS[queryKey])||null;
  let key=direct||viaSynonym;
  if(!key){
    const stem=searchStem(queryKey);
    key=Object.keys(REGION_ALIASES).find(k=>searchStem(k)===stem)||null;
  }
  if(!key)return null;
  const slugs=new Set((REGION_ALIASES[key]||[]).map(slugKey));
  const ids=[];
  FI.forEach((info,id)=>{
    if(slugs.has(slugKey(info.slug))||slugs.has(slugKey(info.name)))ids.push(normId(id));
  });
  return ids.length?{key,ids}:null;
}

function diseaseMatchForQuery(queryKey){
  const direct=toDiseaseKey(queryKey);
  if(direct)return direct;
  const stem=searchStem(queryKey);
  if(stem.length<4)return null;
  return Object.keys(DISEASES).find(key=>{
    const cfg=DISEASES[key];
    const candidates=[cfg.label,...(cfg.aliases||[])].map(searchStem);
    return candidates.some(c=>c===stem||c.startsWith(stem)&&stem.length>=5);
  })||null;
}

function runSearch(q){
  const dd=document.getElementById('av-dd');
  const clr=document.getElementById('av-clr');
  q=q.trim();
  clr.classList.toggle('on',q.length>0);
  if(!q){dd.classList.remove('open');ddAct=-1;return;}

  const ql=slugKey(q);
  const queryStems=unique(searchTokens(q).map(searchStem));

  const hits=sidx
    .map(entry=>({entry,score:searchScore(entry,ql,queryStems)}))
    .filter(x=>x.score!==null&&x.score!==undefined)
    .sort((a,b)=>a.score-b.score||(b.entry.has-a.entry.has)||a.entry.name.localeCompare(b.entry.name,'cs'))
    .slice(0,10)
    .map(x=>x.entry);

  /* Zkratky: název nemoci zapne filtr, název regionu vybere jeho destinace. */
  const diseaseKey=diseaseMatchForQuery(ql);
  const region=regionMatch(ql);
  const shortcuts=[];
  if(diseaseKey){
    shortcuts.push(`<div class="ddi ddi-action" data-action-disease="${esc(diseaseKey)}" role="option" aria-selected="false">
      <span class="ddot ddot-action" aria-hidden="true">⌖</span>
      <span class="ddn">Zapnout filtr: ${esc(DISEASES[diseaseKey].label)}</span>
      <span class="ddbadge">Filtr nemoci</span>
    </div>`);
  }
  if(region){
    shortcuts.push(`<div class="ddi ddi-action" data-action-region="${esc(region.key)}" role="option" aria-selected="false">
      <span class="ddot ddot-action" aria-hidden="true">◎</span>
      <span class="ddn">Zobrazit region: ${esc(regionLabel(region.key))}</span>
      <span class="ddbadge">${esc(countDestinations(region.ids.length))}</span>
    </div>`);
  }

  if(!hits.length&&!shortcuts.length){
    dd.innerHTML='<div class="ddempty">Žádná shoda – zkuste jiný název, třeba „Vietnam“, „Karibik“ nebo „malárie“.</div>';
    dd.classList.add('open');ddAct=-1;return;
  }

  dd.innerHTML=shortcuts.join('')+hits.map(h=>
    `<div class="ddi" data-nid="${h.nid}" role="option" aria-selected="false">
      <span class="ddot" style="background:${h.has?MC.has:MC.none}"></span>
      <span class="ddn">${esc(h.name)}</span>
      ${h.has?'<span class="ddbadge">Máme doporučení</span>':''}
    </div>`
  ).join('');
  dd.classList.add('open');
  ddAct=-1;
  dd.querySelectorAll('.ddi').forEach(el=>{
    el.addEventListener('mousedown',e=>{
      e.preventDefault();
      if(el.dataset.actionDisease){
        document.getElementById('av-search').value='';
        clr.classList.remove('on');
        dd.classList.remove('open');
        setDiseaseFilter(el.dataset.actionDisease);
        return;
      }
      if(el.dataset.actionRegion){
        dd.classList.remove('open');
        showRegion(el.dataset.actionRegion);
        return;
      }
      selectCountry(normId(el.dataset.nid));
    });
  });
}

/* Region není destinace – jeho výběrem naplníme trasu, která už umí
   zobrazit souhrn doporučení přes více destinací. */
function showRegion(key){
  const region=regionMatch(slugKey(key));
  if(!region)return;
  const input=document.getElementById('av-search');
  if(input)input.value='';
  document.getElementById('av-clr')?.classList.remove('on');
  setRoute(region.ids.filter(id=>FI.get(normId(id))?.has));
}

function setupSearch(){
  const inp=document.getElementById('av-search');
  const dd=document.getElementById('av-dd');
  const clr=document.getElementById('av-clr');

  inp.addEventListener('input',e=>runSearch(e.target.value));
  inp.addEventListener('focus',e=>{if(e.target.value.trim())runSearch(e.target.value);});

  clr.addEventListener('click',()=>{
    inp.value='';clr.classList.remove('on');
    dd.classList.remove('open');inp.focus();
  });

  inp.addEventListener('keydown',e=>{
    const its=[...dd.querySelectorAll('.ddi')];
    if(e.key==='ArrowDown'){
      e.preventDefault();ddAct=Math.min(ddAct+1,its.length-1);
      its.forEach((el,i)=>el.classList.toggle('act',i===ddAct));
    }else if(e.key==='ArrowUp'){
      e.preventDefault();ddAct=Math.max(ddAct-1,0);
      its.forEach((el,i)=>el.classList.toggle('act',i===ddAct));
    }else if(e.key==='Enter'&&ddAct>=0){
      its[ddAct]?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
    }else if(e.key==='Escape'){
      dd.classList.remove('open');
    }
  });

  document.addEventListener('click',e=>{
    if(!e.target.closest('.sw'))dd.classList.remove('open');
  });
}

function canonicalFeatureId(f){
  const raw=normId(f?.id);
  const nm=slugKey(f?.properties?.name||'');
  let lon=null,lat=null;
  try{[lon,lat]=d3.geoCentroid(f);}catch(e){}

  if(nm==='kosovo')return 383;
  if(nm==='western-sahara'||nm==='zapadni-sahara')return 732;
  if(nm==='somalia'||nm==='somaliland')return 706;

  /* Sporné/nesprávně pojmenované polygony nepoužíváme jako samostatné destinace.
     Rozhodujeme podle polohy a přiřazujeme je k cílové zemi. */
  if(nm.includes('siachen') || raw===-99){
    if(lon!==null && lon>18 && lon<23.8 && lat>40 && lat<44.8)return 383; /* Kosovo */
    if(lon!==null && lon>34 && lon<56 && lat>-13 && lat<18)return 706;   /* Somálsko */
    if(lon!==null && lon>-18 && lon<-8 && lat>20 && lat<28)return 732;   /* Západní Sahara */
    if(nm.includes('siachen'))return 356;
  }

  return raw;
}

function mergeSomaliaMapFeatures(topology,featureCollection){
  const geometries=topology?.objects?.countries?.geometries||[];
  const somaliaParts=geometries.filter(g=>{
    const name=slugKey(g?.properties?.name||'');
    return name==='somalia'||name==='somaliland';
  });
  if(somaliaParts.length<2)return featureCollection;
  const mergedGeometry=topojson.merge(topology,somaliaParts);
  featureCollection.features=featureCollection.features.filter(f=>{
    const name=slugKey(f?.properties?.name||'');
    return name!=='somalia'&&name!=='somaliland';
  });
  featureCollection.features.push({
    type:'Feature',
    id:'706',
    properties:{name:'Somalia'},
    geometry:mergedGeometry
  });
  return featureCollection;
}

function isSomaliaInternalBoundary(a,b){
  const nameA=slugKey(a?.properties?.name||'');
  const nameB=slugKey(b?.properties?.name||'');
  const somaliaNames=new Set(['somalia','somaliland']);
  return somaliaNames.has(nameA)&&somaliaNames.has(nameB);
}

function featureId(d){
  return normId(d?._numId ?? d?.id);
}

/* ── Sdílení stavu přes URL ──
   Adresa nese vybraný filtr, kategorii a destinaci, takže jde poslat odkaz
   rovnou na konkrétní pohled. Ostatní parametry (admin, debug) zůstávají. */
const URL_PARAM={disease:'filtr',facet:'kategorie',destination:'zeme',route:'trasa'};
let urlStateReady=false;

function destinationShareKey(info){
  const slug=slugKey(info?.slug);
  return slug||slugKey(String(info?.id??''));
}

function findDestinationByShareKey(rawKey){
  const key=slugKey(rawKey);
  if(!key)return null;
  let bySlug=null,byId=null,byName=null;
  FI.forEach((info,id)=>{
    if(slugKey(info?.slug)===key)bySlug=bySlug??id;
    if(slugKey(String(id))===key)byId=byId??id;
    if(slugKey(info?.name)===key)byName=byName??id;
  });
  return bySlug??byId??byName??null;
}

function activeFacetForShare(){
  if(activeDisease==='yellow-fever'&&activeYellowFeverFacet!=='all')return activeYellowFeverFacet;
  if(activeDisease==='dengue'&&activeDengueFacet!=='all')return activeDengueFacet;
  return null;
}

function updateUrlState(){
  if(!urlStateReady)return;
  try{
    const url=new URL(window.location.href);
    const params=url.searchParams;

    const keys=activeDiseaseKeys();
    if(keys.length)params.set(URL_PARAM.disease,keys.join(','));
    else params.delete(URL_PARAM.disease);

    const facet=activeFacetForShare();
    if(facet)params.set(URL_PARAM.facet,facet);
    else params.delete(URL_PARAM.facet);

    const destination=curInfo?destinationShareKey(curInfo):'';
    if(destination)params.set(URL_PARAM.destination,destination);
    else params.delete(URL_PARAM.destination);

    if(routeIds.length){
      params.set(URL_PARAM.route,routeInfos().map(destinationShareKey).join(','));
    }else params.delete(URL_PARAM.route);

    history.replaceState(null,'',url.toString());
  }catch(e){
    /* Sdílení odkazu je doplněk, nesmí shodit zbytek aplikace. */
  }
}

async function applyStateFromUrl(){
  const params=new URLSearchParams(window.location.search);
  const disease=params.get(URL_PARAM.disease);
  const facet=params.get(URL_PARAM.facet);
  const destination=params.get(URL_PARAM.destination);
  const route=params.get(URL_PARAM.route);

  /* Parametr filtr může nést i kombinaci: ?filtr=malaria,yellow-fever */
  const diseaseKeys=String(disease||'').split(',').map(k=>k.trim()).filter(k=>DISEASES[k]);
  const primaryDisease=diseaseKeys[0]||null;

  try{
    if(primaryDisease){
      await setDiseaseFilter(primaryDisease);
      for(const extra of diseaseKeys.slice(1)){
        await toggleExtraDisease(extra);
      }
      /* U odkazu s kombinací rovnou zapneme režim přidávání, aby klik na další
         nemoc kombinaci rozšířil místo toho, aby ji nečekaně zrušil. */
      if(diseaseKeys.length>1)setCombineMode(true);
      if(facet&&diseaseKeys.length===1){
        if(primaryDisease==='yellow-fever')setYellowFeverFacet(facet);
        else if(primaryDisease==='dengue')setDengueFacet(facet);
      }
    }
    if(route){
      const ids=route.split(',').map(k=>findDestinationByShareKey(k)).filter(id=>id!==null&&id!==undefined);
      if(ids.length)setRoute(ids);
    }
    if(destination){
      const id=findDestinationByShareKey(destination);
      if(id!==null&&id!==undefined){
        const info=FI.get(normId(id));
        const matches=!primaryDisease||activeDisease==='all'||matchesActiveFilter(id);
        if(matches){
          selectCountry(id);
        }else if(info){
          filterDestinationMismatch=info;
          renderFilterResults();
          const status=document.getElementById('filter-status');
          if(status)status.textContent=`${info.name} neodpovídá filtru ${isCombination()?combinationLabel():DISEASES[activeDisease].label}; mapa zůstává v přehledu filtru.`;
        }
      }else console.warn('Destinace z odkazu se nepodařilo najít:',destination);
    }
  }catch(e){
    console.warn('Stav z odkazu se nepodařilo obnovit:',e);
  }

  urlStateReady=true;
  updateUrlState();
}

async function copyShareLink(btn){
  const original=btn.dataset.label||btn.textContent;
  btn.dataset.label=original;
  let message='Odkaz zkopírován';
  try{
    await navigator.clipboard.writeText(window.location.href);
  }catch(e){
    message='Odkaz najdete v adresním řádku';
  }
  btn.textContent=message;
  clearTimeout(btn._shareTimer);
  btn._shareTimer=setTimeout(()=>{btn.textContent=original;},2400);
}

function isAdminMode(){
  const qs=new URLSearchParams(window.location.search);
  return qs.has('admin')||qs.get('mode')==='admin';
}

function normalizeAdminOverride(raw){
  const slug=slugKey(raw.slug||'');
  if(!slug)return null;
  const mapIdRaw=String(raw.mapId||'').trim();
  const mapId=mapIdRaw?(Number.isFinite(Number(mapIdRaw))?Number(mapIdRaw):mapIdRaw):undefined;
  const lon=String(raw.lon||'').trim();
  const lat=String(raw.lat||'').trim();
  const obj={
    id:raw.customId?.trim()||`api:${slug}`,
    mapId:mapId,
    name:raw.name?.trim()||slug,
    note:raw.note?.trim()||''
  };
  if(lon!==''&&lat!==''&&Number.isFinite(Number(lon))&&Number.isFinite(Number(lat))){
    obj.coords=[Number(lon),Number(lat)];
  }
  Object.keys(obj).forEach(k=>{
    if(obj[k]===undefined||obj[k]==='')delete obj[k];
  });
  return [slug,obj];
}

function saveAdminOverride(raw){
  const pair=normalizeAdminOverride(raw);
  if(!pair)return false;
  const [slug,obj]=pair;
  CUSTOM_DESTINATION_MAP={...CUSTOM_DESTINATION_MAP,[slug]:obj};
  localStorage.setItem(ADMIN_MAP_KEY,JSON.stringify(CUSTOM_DESTINATION_MAP,null,2));
  return true;
}

function clearAdminOverrides(){
  CUSTOM_DESTINATION_MAP={};
  localStorage.removeItem(ADMIN_MAP_KEY);
}

function renderAdminPanel(apiRows,unmatchedApi){
  const panel=document.getElementById('admin-panel');
  if(!panel||!isAdminMode())return;

  panel.hidden=false;
  panel.classList.add('open');

  const rows=[...apiRows].sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id),'cs'));
  const unmatchedKeys=new Set(unmatchedApi.map(r=>slugKey(r.id||r.slug||r.name)));
  const customCount=Object.keys(CUSTOM_DESTINATION_MAP||{}).length;
  const diseaseCustomCount=Object.values(CUSTOM_DISEASE_OVERRIDES||{}).reduce((sum,o)=>sum+(o.include?.length||0)+(o.exclude?.length||0),0);

  panel.innerHTML=`<div class="adm-head">
    <div>
      <div class="adm-kicker">Admin / ladění mapování</div>
      <h2 class="adm-title">Ruční úpravy destinací</h2>
      <p class="adm-note">Tento panel slouží jen pro testování. Úpravy se ukládají do localStorage tohoto prohlížeče. Po ověření použijte export a hodnoty přeneste do <code>API_DESTINATION_MAP</code> nebo do pravidel filtrů v <code>assets/js/config.js</code>.</p>
    </div>
    <span class="adm-badge">${customCount} mapování · ${diseaseCustomCount} filtrů</span>
  </div>
  <div class="adm-grid">
    <div class="adm-card">
      <h3>Destinace</h3>
      <input class="adm-search" id="adm-search" type="search" placeholder="Hledat destinaci / slug">
      <div class="adm-list" id="adm-list"></div>
    </div>
    <div class="adm-card">
      <h3>Mapovací pravidlo</h3>
      <div class="adm-form">
        <div class="adm-field full"><label>API slug</label><input id="adm-slug" placeholder="např. bali"></div>
        <div class="adm-field"><label>Název</label><input id="adm-name" placeholder="např. Bali"></div>
        <div class="adm-field"><label>Custom ID</label><input id="adm-custom-id" placeholder="např. api:bali"></div>
        <div class="adm-field"><label>Map ID / nadřazený polygon</label><input id="adm-mapid" placeholder="např. 360"></div>
        <div class="adm-field"><label>Longitude</label><input id="adm-lon" placeholder="např. 115.19"></div>
        <div class="adm-field"><label>Latitude</label><input id="adm-lat" placeholder="např. -8.41"></div>
        <div class="adm-field full"><label>Poznámka</label><input id="adm-note" placeholder="např. region pod Indonésií"></div>
      </div>
      <div class="adm-actions">
        <button class="adm-btn primary" id="adm-save" type="button">Uložit lokálně</button>
        <button class="adm-btn" id="adm-use-current" type="button">Použít aktuální výběr jako mapId</button>
        <button class="adm-btn" id="adm-export-btn" type="button">Exportovat JSON</button>
        <button class="adm-btn danger" id="adm-clear" type="button">Smazat lokální úpravy</button>
      </div>
      <div class="adm-help" id="adm-help">Postup: vyberte destinaci vlevo, doplňte mapId nebo souřadnice, uložte lokálně a obnovte stránku. Pro trvalé nasazení exportujte JSON a přeneste ho do config.js.</div>
      <div class="adm-export"><textarea id="adm-export" readonly placeholder="Zde se zobrazí export pro config.js"></textarea></div>
    </div>
  </div>
  <div class="adm-card adm-disease-card">
    <div class="adm-disease-head">
      <div>
        <h3>Úpravy filtrů nemocí</h3>
        <p class="adm-mini-note">Vyberte nemoc a určete, které destinace se mají ručně přidat nebo skrýt ve výsledcích pod mapou. Režim <strong>Auto</strong> nechává rozhodnutí na datech z doporučení.</p>
      </div>
      <div class="adm-field adm-disease-select"><label>Nemoc / riziko</label><select id="adm-disease-select"></select></div>
    </div>
    <input class="adm-search" id="adm-disease-search" type="search" placeholder="Hledat destinaci ve filtru">
    <div class="adm-disease-list" id="adm-disease-list"></div>
    <div class="adm-actions">
      <button class="adm-btn" id="adm-disease-export-btn" type="button">Exportovat úpravy filtrů</button>
      <button class="adm-btn danger" id="adm-disease-clear" type="button">Vyčistit filtr</button>
    </div>
    <div class="adm-export"><textarea id="adm-disease-export" readonly placeholder="Zde se zobrazí export úprav filtrů"></textarea></div>
  </div>`;

  const list=document.getElementById('adm-list');
  const search=document.getElementById('adm-search');

  function rowKey(row){return slugKey(row.id||row.slug||row.name||'');}
  function fill(row){
    const slug=rowKey(row);
    const current=CUSTOM_DESTINATION_MAP[slug]||API_DESTINATION_MAP[slug]||{};
    document.getElementById('adm-slug').value=slug;
    document.getElementById('adm-name').value=row.name||current.name||slug;
    document.getElementById('adm-custom-id').value=current.id||`api:${slug}`;
    document.getElementById('adm-mapid').value=current.mapId??'';
    document.getElementById('adm-lon').value=Array.isArray(current.coords)?current.coords[0]:'';
    document.getElementById('adm-lat').value=Array.isArray(current.coords)?current.coords[1]:'';
    document.getElementById('adm-note').value=current.note||'';
    list.querySelectorAll('.adm-item').forEach(b=>b.classList.toggle('active',b.dataset.slug===slug));
  }

  function renderList(){
    const q=slugKey(search.value);
    const filtered=rows.filter(row=>{
      const hay=slugKey([row.id,row.name,row.www].filter(Boolean).join(' '));
      return !q||hay.includes(q);
    });
    list.innerHTML=filtered.map(row=>{
      const slug=rowKey(row);
      const flag=CUSTOM_DESTINATION_MAP[slug]?' · lokální úprava':(unmatchedKeys.has(slug)?' · nespárované':'');
      return `<button class="adm-item" type="button" data-slug="${esc(slug)}">
        <strong>${esc(row.name||slug)}${esc(flag)}</strong>
        <code>${esc(slug)}</code>
      </button>`;
    }).join('')||'<div class="adm-empty">Nic nenalezeno.</div>';

    list.querySelectorAll('.adm-item[data-slug]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const row=rows.find(r=>rowKey(r)===btn.dataset.slug);
        if(row)fill(row);
      });
    });
  }

  search.addEventListener('input',renderList);
  renderList();
  if(unmatchedApi[0]){
    fill(unmatchedApi[0]);
  }else if(rows[0]){
    fill(rows[0]);
  }

  document.getElementById('adm-save').addEventListener('click',()=>{
    const ok=saveAdminOverride({
      slug:document.getElementById('adm-slug').value,
      name:document.getElementById('adm-name').value,
      customId:document.getElementById('adm-custom-id').value,
      mapId:document.getElementById('adm-mapid').value,
      lon:document.getElementById('adm-lon').value,
      lat:document.getElementById('adm-lat').value,
      note:document.getElementById('adm-note').value
    });
    document.getElementById('adm-help').textContent=ok?'Uloženo lokálně. Obnovte stránku a ověřte chování mapy.':'Nelze uložit: chybí API slug.';
    renderAdminPanel(apiRows,unmatchedApi);
  });

  document.getElementById('adm-use-current').addEventListener('click',()=>{
    if(!curInfo){
      document.getElementById('adm-help').textContent='Nejprve vyberte zemi nebo destinaci v mapě.';
      return;
    }
    document.getElementById('adm-mapid').value=mappedIdForInfo(curInfo.id,curInfo);
    if(curInfo.coords){
      document.getElementById('adm-lon').value=curInfo.coords[0];
      document.getElementById('adm-lat').value=curInfo.coords[1];
    }
  });

  document.getElementById('adm-export-btn').addEventListener('click',()=>{
    const out=document.getElementById('adm-export');
    out.value=`/* Lokální admin export – vložte do API_DESTINATION_MAP */\n${JSON.stringify(CUSTOM_DESTINATION_MAP,null,2)}`;
    out.focus();
    out.select();
  });

  document.getElementById('adm-clear').addEventListener('click',()=>{
    if(confirm('Smazat všechny lokální admin úpravy v tomto prohlížeči?')){
      clearAdminOverrides();
      document.getElementById('adm-help').textContent='Lokální úpravy smazány. Obnovte stránku.';
      renderAdminPanel(apiRows,unmatchedApi);
    }
  });

  setupAdminDiseaseEditor(apiRows,unmatchedApi);
}

function setupAdminDiseaseEditor(apiRows,unmatchedApi){
  const select=document.getElementById('adm-disease-select');
  const search=document.getElementById('adm-disease-search');
  const list=document.getElementById('adm-disease-list');
  if(!select||!search||!list)return;

  const destinationRows=[...FI.entries()]
    .filter(([,info])=>info.has)
    .map(([id,info])=>({id,info}))
    .sort((a,b)=>a.info.name.localeCompare(b.info.name,'cs'));

  select.innerHTML=Object.entries(DISEASES).map(([key,cfg])=>`<option value="${esc(key)}">${esc(cfg.label)}</option>`).join('');
  if(activeDisease&&activeDisease!=='all'&&DISEASES[activeDisease])select.value=activeDisease;

  function modeFor(key,id){
    const o=getDiseaseOverride(key);
    const sid=String(id);
    if((o.include||[]).map(String).includes(sid))return 'include';
    if((o.exclude||[]).map(String).includes(sid))return 'exclude';
    return 'auto';
  }

  function renderDiseaseList(){
    const key=select.value;
    const q=slugKey(search.value);
    const base=effectiveDiseaseHits(key);
    const rows=destinationRows.filter(({id,info})=>{
      const hay=slugKey([info.name,info.slug,info.search].filter(Boolean).join(' '));
      return !q||hay.includes(q);
    });

    list.innerHTML=rows.map(({id,info})=>{
      const mode=modeFor(key,id);
      const autoBase=(diseaseIndex.get(key)||new Set()).has(id);
      const visible=base.has(id);
      return `<div class="adm-disease-row" data-id="${esc(id)}">
        <div>
          <strong>${esc(info.name)}</strong>
          <code>${esc(info.slug||id)}</code>
          <span class="adm-disease-state ${visible?'on':'off'}">${visible?'zobrazuje se':'skryto'}${autoBase?' · auto':''}</span>
        </div>
        <div class="adm-toggle">
          <button type="button" class="${mode==='auto'?'active':''}" data-mode="auto">Auto</button>
          <button type="button" class="${mode==='include'?'active':''}" data-mode="include">Zobrazit</button>
          <button type="button" class="${mode==='exclude'?'active':''}" data-mode="exclude">Skrýt</button>
        </div>
      </div>`;
    }).join('')||'<div class="adm-empty">Nic nenalezeno.</div>';

    list.querySelectorAll('.adm-disease-row').forEach(row=>{
      const id=normId(row.dataset.id);
      row.querySelectorAll('[data-mode]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          setDiseaseOverride(select.value,id,btn.dataset.mode);
          if(activeDisease===select.value){
            repaintMap();
            renderFilterResults();
            if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
          }
          renderDiseaseList();
        });
      });
    });
  }

  select.addEventListener('change',renderDiseaseList);
  search.addEventListener('input',renderDiseaseList);
  renderDiseaseList();

  document.getElementById('adm-disease-export-btn')?.addEventListener('click',()=>{
    const out=document.getElementById('adm-disease-export');
    out.value=`/* Lokální admin export – úpravy filtrů nemocí */\n${JSON.stringify(CUSTOM_DISEASE_OVERRIDES,null,2)}`;
    out.focus();
    out.select();
  });

  document.getElementById('adm-disease-clear')?.addEventListener('click',()=>{
    if(confirm('Vyčistit ruční úpravy pro aktuálně vybraný filtr?')){
      clearDiseaseOverrides(select.value);
      if(activeDisease===select.value){
        repaintMap();
        renderFilterResults();
        if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
      }
      renderDiseaseList();
    }
  });
}

function renderDebugPanel(apiRows,unmatchedApi,baseMapDestinationCount=null){
  const panel=document.getElementById('debug-panel');
  if(!panel)return;
  const qs=new URLSearchParams(window.location.search);
  const show=qs.has('debug')||qs.has('diagnostika');
  if(!show)return;
  panel.classList.add('open');
  const items=unmatchedApi.map(x=>`<span class="dbg-chip">${esc(x.name||x.id||'bez názvu')} <code>${esc(x.id||'')}</code></span>`).join('');
  const withoutApi=[...FI.values()].filter(x=>!x.has);
  const withoutApiItems=withoutApi.map(x=>`<span class="dbg-chip">${esc(x.name||x.id||'bez názvu')} <code>${esc(x.id||'')}</code></span>`).join('');
  panel.innerHTML=`<strong>Diagnostika párování API</strong><br>
    Spárováno: ${apiRows.length-unmatchedApi.length} / ${apiRows.length}. 
    Základních položek polygonové mapy: ${baseMapDestinationCount??'—'}; finálních mapových položek: ${FI.size}; s detailem API: ${[...FI.values()].filter(x=>x.has).length}; bez detailu: ${withoutApi.length}.<br>
    Nespárované položky jsou často teritoria nebo cestovatelské destinace, které nemají vlastní polygon v mapě.
    <div class="dbg-list">${items||'<span class="dbg-chip">Všechny API destinace jsou spárované</span>'}</div>
    <div class="dbg-list">${withoutApiItems||'<span class="dbg-chip">Všechny mapové položky mají detail</span>'}</div>`;
}

function setupCoverageDialog(){
  const trigger=document.getElementById('av-status');
  const dialog=document.getElementById('coverage-dialog');
  if(!trigger||!dialog||trigger.dataset.bound==='1')return;
  trigger.dataset.bound='1';
  const close=()=>dialog.close();
  trigger.addEventListener('click',()=>{
    if(!trigger.disabled)dialog.showModal();
  });
  dialog.querySelector('.coverage-close')?.addEventListener('click',close);
  dialog.querySelector('.coverage-confirm')?.addEventListener('click',close);
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)close();
  });
}

/* ── Inicializace mapy ── */
const MAP_TOPOLOGY_URL='assets/vendor/countries-50m.json';

/* Mapa se nesmí rozbít potichu. Jakákoli chyba při startu (chybějící knihovna,
   nedostupný podklad, nedostupné API) musí skončit čitelnou hláškou v mapě. */
function renderStartupError(message,detail){
  const st=document.getElementById('av-status');
  if(st){
    st.textContent='Mapu se nepodařilo načíst';
    st.disabled=true;
  }
  const loader=document.getElementById('filter-loader');
  if(loader)loader.classList.remove('on');
  const box=document.getElementById('map-info');
  if(box){
    box.innerHTML=`<div class="mi-head"><div>
      <div class="mi-label">Chyba načítání</div>
      <div class="mi-title">Mapa není k dispozici</div>
    </div></div>
    <div class="mi-text">${esc(message)}</div>
    <div class="mi-actions">
      <button class="mi-btn" type="button" onclick="location.reload()">Zkusit znovu</button>
      <a class="mi-btn secondary" href="https://www.ockovacicentrum.cz/cz/kde-ockujeme" target="_blank" rel="noopener noreferrer">Najít očkovací centrum</a>
    </div>`;
    box.classList.add('open');
  }
  const hint=document.getElementById('hint');
  if(hint)hint.textContent='Mapu se nepodařilo načíst';
  console.error('Start aplikace selhal:',detail||message);
}

async function initMap(){
  try{
    await initMapInternal();
  }catch(e){
    renderStartupError('Nepodařilo se sestavit mapový podklad. Zkontrolujte připojení a načtěte stránku znovu.',e);
  }
}

async function initMapInternal(){
  const st=document.getElementById('av-status');
  setupCoverageDialog();

  if(typeof d3==='undefined' || typeof topojson==='undefined'){
    renderStartupError('Nepodařilo se načíst knihovny pro vykreslení mapy (d3 / topojson). Zkuste stránku načíst znovu.','d3 nebo topojson není k dispozici');
    return;
  }

  let wt,al;
  try{
    [wt,al]=await Promise.all([
      fetch(MAP_TOPOLOGY_URL).then(r=>{
        if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      }),
      apiFetch(APIS).then(d=>Array.isArray(d)?d:[])
    ]);
  }catch(e){
    renderStartupError('Nepodařilo se načíst mapový podklad. Zkontrolujte připojení a načtěte stránku znovu.',e);
    return;
  }

  const api=buildApiIndex(al);

  renderMapLegend();

  /* SVG setup */
  const mw=document.getElementById('mw');
  W=mw.clientWidth;
  H=mw.clientHeight||540;
  sv=d3.select('#av-map').attr('viewBox',`0 0 ${W} ${H}`);
  prj=d3.geoNaturalEarth1().scale(W/5.9).translate([W/2,H/2]);
  pg=d3.geoPath().projection(prj);

  /* Features */
  const feats=mergeSomaliaMapFeatures(wt,topojson.feature(wt,wt.objects.countries));
  feats.features.forEach(f=>{
    const id=canonicalFeatureId(f);
    f._numId=id;
    if(!FM.has(id))FM.set(id,f);
  });

  /* Sestavit FI podle skutečných feature v mapě, ne jen podle ruční CN tabulky. */
  feats.features.forEach(f=>{
    const numId=featureId(f);
    const rawFeatureName=slugKey(f.properties?.name||'');
    const en=CN[numId]||(rawFeatureName.includes('siachen')?'Somalia':f.properties?.name)||`Země ${numId}`;
    const cz=CZ[numId]||MAP_NAME_CZ[rawFeatureName]||en;
    const entry=findApiEntry(api,numId,en,cz);
    const keys=countryKeys(numId,en,cz);
    const slug=entry?.id||entry?.slug||keys[0]||toSlug(en);
    const name=cleanName(cz||entry?.name||en);

    FI.set(numId,{
      id:numId,
      numId,
      name,
      slug,
      has:!!entry,
      www:entry?.www||null,
      coords:DEST_COORDS[numId]||null,
      search:unique([name,entry?.name,en,cz,slug,...keys]).join(' ')
    });
  });

  const baseMapDestinationCount=FI.size;

  /* Donutit přiřazení destinací, které API má, ale mapa/API používají odlišný název,
     nebo jde o ostrov/region/teritorium bez vlastního polygonu. */
  api.rows.forEach(row=>{
    const mapped=apiDestinationMapping(row);
    if(mapped){
      const rawSlug=row.id||row.slug||apiRowKeys(row)[0];
      const id=normId(mapped.id ?? `api:${rawSlug}`);
      const mapId=normId(mapped.mapId ?? mapped.id);
      const base=FI.get(mapId);
      const name=cleanName(row.name||mapped.name||base?.name||rawSlug);
      const slug=row.id||row.slug||rawSlug;
      FI.set(id,{
        id,
        numId:id,
        mapId,
        name,
        slug,
        has:true,
        www:row.www||null,
        coords:mapped.coords||DEST_COORDS[id]||DEST_COORDS[mapId]||null,
        virtual:!FM.has(id),
        parentName:base?.name||null,
        search:unique([name,slug,row.id,row.name,base?.name,...apiRowKeys(row)]).join(' ')
      });
      return;
    }

    const forcedId=forcedIsoForRow(row);
    if(!forcedId)return;

    const existing=FI.get(forcedId);
    const en=CN[forcedId]||row.name||row.id;
    const cz=CZ[forcedId]||row.name||en;
    const keys=unique([...apiRowKeys(row),...countryKeys(forcedId,en,cz)]);
    const slug=row.id||row.slug||keys[0]||toSlug(en);
    const name=cleanName(cz||row.name||en);

    if(existing){
      FI.set(forcedId,{
        ...existing,
        id:forcedId,
        numId:forcedId,
        name,
        slug,
        has:true,
        www:row.www||existing.www||null,
        coords:existing.coords||DEST_COORDS[forcedId]||null,
        search:unique([existing.search,name,en,cz,slug,...keys]).join(' ')
      });
    }else{
      FI.set(forcedId,{
        id:forcedId,
        numId:forcedId,
        name,
        slug,
        has:true,
        www:row.www||null,
        coords:DEST_COORDS[forcedId]||null,
        virtual:true,
        search:unique([name,en,cz,slug,...keys]).join(' ')
      });
    }
  });

  const matchedEntries=[...FI.values()].filter(x=>x.has);
  const matchedApiKeys=new Set(matchedEntries.flatMap(x=>[slugKey(x.slug),slugKey(x.name),slugKey(x.www?.split('/').filter(Boolean).pop()||'')]));
  const unmatchedApi=api.rows.filter(row=>{
    if(apiDestinationMapping(row))return false;
    const forced=forcedIsoForRow(row);
    if(forced && FI.has(forced))return false;
    const keys=apiRowKeys(row);
    return !keys.some(k=>k && matchedApiKeys.has(k));
  });
  const matchedApiRows=api.rows.length-unmatchedApi.length;
  const regionalSlugs=new Set(REGIONAL_DESTINATION_SLUGS.map(slugKey));
  const regionalCount=api.rows.filter(row=>regionalSlugs.has(slugKey(row.id||row.slug||''))).length;
  const stateLikeCount=Math.max(0,api.rows.length-regionalCount);
  st.textContent=api.rows.length?countDestinations(api.rows.length):'Data se nepodařilo načíst';
  st.disabled=!api.rows.length;
  const coverageContent=document.getElementById('coverage-content');
  if(coverageContent&&api.rows.length){
    coverageContent.innerHTML=`<strong class="coverage-total">${countDestinations(api.rows.length)} s doporučeními</strong>
      <p class="coverage-breakdown"><b>${stateLikeCount}</b> států nebo samostatně vedených zemí <span>+</span> <b>${regionalCount}</b> teritorií a regionů</p>
      <p class="coverage-note">Mapa zobrazuje také některá menší území bez samostatných cestovních doporučení. Nejde o další státy a do počtu ${countDestinations(api.rows.length)} je nezahrnujeme.</p>`;
  }
  window.AvenierMapDebug={
    apiRows:api.rows,
    matchedApiRows,
    unmatchedApi,
    unmatchedNames:unmatchedApi.map(x=>x.name||x.id),
    baseMapDestinationCount,
    mapDestinationCount:FI.size,
    destinationsWithApi:matchedEntries.length,
    destinationsWithoutApi:[...FI.values()].filter(x=>!x.has).map(x=>({id:x.id,name:x.name,slug:x.slug}))
  };
  renderDebugPanel(api.rows,unmatchedApi,baseMapDestinationCount);
  renderAdminPanel(api.rows,unmatchedApi);
  if(unmatchedApi.length){
    console.warn('Nepřiřazené destinace z API:', unmatchedApi.map(x=>({id:x.id,name:x.name,www:x.www})));
  }

  const staticSeed=seedDiseaseIndexFromStaticConfig(api.rows);
  if(staticSeed.unmatched.length){
    console.warn('Nespárované položky statického indexu nemocí:',staticSeed.unmatched);
  }
  if(staticSeed.added){
    console.info(`Přednačteno ${staticSeed.added} vazeb ze statického odborného indexu.`);
  }

  const seededDiseaseRules=seedDiseaseIndexFromApiRows(api.rows);
  if(seededDiseaseRules){
    console.info(`Přednačteno ${seededDiseaseRules} vazeb nemoc→destinace z API seznamu.`);
  }

  sidx=buildIdx();
  setupSearch();
  setupFilters();

  /* Oceán (rect) */
  oceanRect=sv.append('rect').attr('class','map-ocean')
    .attr('x',0).attr('y',0).attr('width',W).attr('height',H).attr('fill',MC.ocean);

  /* Graticule */
  graticulePath=sv.append('path').attr('class','map-graticule').datum(d3.geoGraticule()()).attr('d',pg)
    .attr('fill','none').attr('stroke',MC.grat).attr('stroke-width',.5)
    .style('pointer-events','none');

  /* Zoom */
  zb=d3.zoom().scaleExtent([1,8]).extent([[0,0],[W,H]]).on('zoom',e=>{currentZoomK=e.transform.k;gv.attr('transform',e.transform);updateMarkerScale();});
  sv.call(zb);
  gv=sv.append('g').attr('class','map-viewport');

  const hl=document.getElementById('hlbl');

  /* Render countries */
  countryPaths=gv.selectAll('path.country')
    .data(feats.features)
    .join('path')
    .attr('class','country')
    .attr('d',pg)
    .attr('fill',d=>bf(d))
    .attr('stroke',d=>strokeForId(featureId(d)))
    .attr('stroke-width',d=>strokeWidthForId(featureId(d)))
    .attr('vector-effect','non-scaling-stroke')
    .attr('data-id',d=>featureId(d))
    .style('cursor','pointer')
    .on('mouseover',function(e,d){
      if(this===selEl)return;
      d3.select(this).attr('fill',hoverColorForId(featureId(d))).attr('stroke',strokeForId(featureId(d),{hover:true})).attr('stroke-width',strokeWidthForId(featureId(d),{hover:true}));
      const i=FI.get(featureId(d));
      if(i){hl.textContent=i.name;hl.classList.add('on');}
    })
    .on('mouseout',function(e,d){
      if(this===selEl)return;
      d3.select(this).attr('fill',bf(d)).attr('stroke',strokeForId(featureId(d))).attr('stroke-width',strokeWidthForId(featureId(d)));
      hl.classList.remove('on');
    })
    .on('click',function(e,d){
      e.stopPropagation();
      selectCountry(featureId(d));
    });

  /* Hranice */
  bordersPath=gv.append('path').attr('class','map-borders')
    .datum(topojson.mesh(wt,wt.objects.countries,(a,b)=>a!==b&&!isSomaliaInternalBoundary(a,b)))
    .attr('d',pg).attr('fill','none').attr('stroke','rgba(255,255,255,0.40)').attr('stroke-width',.55).attr('stroke-linejoin','round').attr('vector-effect','non-scaling-stroke')
    .style('pointer-events','none');

  /* Fallback body pro destinace z API, které nejsou v polygonové vrstvě mapy. */
  const virtualDest=[...FI.entries()].filter(([id,info])=>info.has&&info.coords&&(!FM.has(id)||info.virtual||info.mapId));
  const mg=gv.append('g').attr('class','virtual-destinations');
  markerSelection=mg.selectAll('circle.dest-marker')
    .data(virtualDest.map(([id,info])=>({id,info})))
    .join('circle')
    .attr('class','dest-marker')
    .attr('data-id',d=>d.id)
    .attr('cx',d=>prj(d.info.coords)[0])
    .attr('cy',d=>prj(d.info.coords)[1])
    .attr('r',MARKER_R.base/(currentZoomK||1))
    .attr('fill',d=>colorForId(d.id))
    .attr('stroke','rgba(255,255,255,0.55)')
    .attr('stroke-width',MARKER_STROKE.base/(currentZoomK||1))
    .style('cursor','pointer')
    .each(function(d){VM.set(d.id,this);})
    .on('mouseover',function(e,d){
      if(this===selMark)return;
      const k=currentZoomK||1;
      d3.select(this).attr('r',MARKER_R.hover/k).attr('fill',hoverColorForId(d.id)).attr('stroke',MC.brdH).attr('stroke-width',MARKER_STROKE.hover/k);
      hl.textContent=d.info.name;hl.classList.add('on');
    })
    .on('mouseout',function(e,d){
      if(this===selMark)return;
      const k=currentZoomK||1;
      d3.select(this).attr('r',MARKER_R.base/k).attr('fill',colorForId(d.id)).attr('stroke','rgba(255,255,255,0.55)').attr('stroke-width',MARKER_STROKE.base/k);
      hl.classList.remove('on');
    })
    .on('click',function(e,d){
      e.stopPropagation();
      selectCountry(d.id);
    });

  updateMarkerScale();

  /* Klik do oceánu / prázdného SVG zavře panel, klik na stát nikoliv. */
  sv.on('click',function(e){
    if(e.target===this || e.target===oceanRect.node())closePanel();
  });

  /* Zoom buttony */
  document.getElementById('zi').onclick=()=>sv.transition().call(zb.scaleBy,1.5);
  document.getElementById('zo').onclick=()=>sv.transition().call(zb.scaleBy,.67);
  document.getElementById('zr').onclick=()=>{
    sv.transition().duration(500).call(zb.transform,d3.zoomIdentity);
    closePanel();
  };

  if(!mapResizeListenersBound){
    window.addEventListener('resize',debouncedHandleMapResize);
    window.addEventListener('orientationchange',debouncedHandleMapResize);
    mapResizeListenersBound=true;
  }

  setupMapKeyboard();
  rebuildNavPoints();

  /* Až po sestavení mapy – obnovení stavu vybírá destinaci i v mapové vrstvě. */
  await applyStateFromUrl();
  setupMapExport();
}

document.addEventListener('click',e=>{
  if(e.target.closest('[data-print-view]'))printCurrentView();
});
window.addEventListener('beforeprint',buildPrintHeader);

initMap();
