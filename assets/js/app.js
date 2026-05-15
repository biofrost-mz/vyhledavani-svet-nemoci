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
let requestedDisease='all';
let filterRequestToken=0;
const diseaseIndex=new Map(); /* diseaseKey → Set(countryId) */
const diseaseIndexSource=new Map(); /* diseaseKey → 'detail'|'api-row'|'api-index'|'cache' */
const detailLoading=new Map();
const detailCache=new Map(); /* slug -> {status:'ok'|'error', ts:number, data?:object} */
const DETAIL_ERROR_RETRY_MS=90*1000;

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

function markerBaseRadius(id){
  return selMarkId!==null && normId(id)===normId(selMarkId)?6:4;
}

function markerBaseStroke(id){
  return selMarkId!==null && normId(id)===normId(selMarkId)?1.7:1;
}

function updateMarkerScale(){
  if(!gv)return;
  const k=currentZoomK||1;
  d3.selectAll('circle.dest-marker')
    .attr('r',d=>markerBaseRadius(d.id)/k)
    .attr('stroke-width',d=>markerBaseStroke(d.id)/k);
}

function colorForId(id){
  const nid=normId(id);
  const info=FI.get(nid);
  if(!info?.has)return MC.none;
  if(activeDisease && activeDisease!=='all'){
    const hits=diseaseIndex.get(activeDisease);
    if(!hits)return MC.dim;
    return diseaseContainsMapId(activeDisease,nid)?DISEASES[activeDisease].color:MC.dim;
  }
  return MC.has;
}

function hoverColorForId(id){
  const nid=normId(id);
  if(activeDisease && activeDisease!=='all'){
    if(!diseaseIndex.has(activeDisease))return MC.dim;
    return diseaseContainsMapId(activeDisease,nid)?DISEASES[activeDisease].hover:MC.dim;
  }
  return MC.hov;
}

function bf(d){
  return colorForId(featureId(d));
}

function resetSel(){
  if(selEl){
    d3.select(selEl).attr('fill',bf(selD)).attr('stroke',MC.brd).attr('stroke-width',.45);
  }
  if(selMark){
    d3.select(selMark).attr('r',4/(currentZoomK||1)).attr('fill',colorForId(selMarkId)).attr('stroke','rgba(255,255,255,0.55)').attr('stroke-width',1/(currentZoomK||1));
  }
  selEl=null;selD=null;selMark=null;selMarkId=null;
}

/* ── Fetch s proxy fallbackem ── */
const APIS='https://www.ockovacicentrum.cz/api/country';
const PX=[
  url=>url,
  url=>'https://corsproxy.io/?'+encodeURIComponent(url),
  url=>'https://api.allorigins.win/raw?url='+encodeURIComponent(url)
];
let curSlug=null;
let curInfo=null;
const defaultDiseaseRowFields=['diseases','diseaseKeys','disease_tags','diseaseTags','risks','riskTags','vaccines','vaccinationTags','tags'];
const diseaseIndexApiUrl=(typeof DISEASE_INDEX_API_URL==='string' && DISEASE_INDEX_API_URL.trim())?DISEASE_INDEX_API_URL.trim():null;
const diseaseIndexRowFields=Array.isArray(typeof DISEASE_INDEX_ROW_FIELDS==='undefined'?null:DISEASE_INDEX_ROW_FIELDS)
  ? DISEASE_INDEX_ROW_FIELDS
  : defaultDiseaseRowFields;
let diseaseIndexApiLoadPromise=null;

function getCachedDetailState(slug){
  const key=String(slug||'');
  const entry=detailCache.get(key);
  if(!entry)return 'miss';
  if(entry.status==='ok')return 'ok';
  if(Date.now()-entry.ts<DETAIL_ERROR_RETRY_MS)return 'error';
  detailCache.delete(key);
  return 'miss';
}

function getCachedDetail(slug){
  const key=String(slug||'');
  const entry=detailCache.get(key);
  if(!entry)return null;
  if(entry.status==='ok')return entry.data||null;
  return null;
}

function setCachedDetailSuccess(slug,data){
  detailCache.set(String(slug||''),{status:'ok',data,ts:Date.now()});
}

function setCachedDetailError(slug){
  detailCache.set(String(slug||''),{status:'error',ts:Date.now()});
}

async function apiFetch(url){
  for(const makeUrl of PX){
    try{
      const r=await fetch(makeUrl(url));
      if(!r.ok)continue;
      const d=await r.json();
      if(d)return d;
    }catch(e){}
  }
  return null;
}

/* ── HTML escape ── */
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function pillHtml(v,cls){
  const name=esc(v?.name||v?.title||v);
  const url=v?.url||v?.www||'';
  if(url)return `<a class="pill ${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${name}</a>`;
  return `<span class="pill ${cls}">${name}</span>`;
}

function diseaseText(data){
  const rows=[
    ...(Array.isArray(data?.povinne)?data.povinne:[]),
    ...(Array.isArray(data?.zakladni)?data.zakladni:[]),
    ...(Array.isArray(data?.doporuceni)?data.doporuceni:[])
  ];
  return rows.map(v=>{
    if(typeof v==='string')return v;
    return [v?.name,v?.title,v?.url,v?.www].filter(Boolean).join(' ');
  }).join(' ');
}

function dataHasDisease(data,key){
  const cfg=DISEASES[key];
  if(!cfg||!data)return false;
  const txt=slugKey(diseaseText(data));
  return cfg.aliases.some(a=>txt.includes(slugKey(a)));
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
  }
  return [];
}

function mergeDiseaseIndexPayload(payload,source='api-index'){
  if(!payload)return 0;
  let merged=0;

  if(Array.isArray(payload)){
    payload.forEach(item=>{
      const key=toDiseaseKey(item?.key||item?.disease||item?.name);
      if(!key)return;
      const ids=parseDiseaseIndexIds(item);
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
    const ids=parseDiseaseIndexIds(rawVal);
    if(ids.length){
      upsertDiseaseIndex(key,ids,source);
      merged++;
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

async function loadDiseaseIndexFromApiIfConfigured(){
  if(!diseaseIndexApiUrl)return;
  if(diseaseIndexApiLoadPromise)return diseaseIndexApiLoadPromise;
  diseaseIndexApiLoadPromise=apiFetch(diseaseIndexApiUrl).then(payload=>{
    if(payload)mergeDiseaseIndexPayload(payload,'api-index');
    return payload;
  }).catch(e=>{
    console.warn('Backendový index nemocí se nepodařilo načíst:',e);
    return null;
  });
  return diseaseIndexApiLoadPromise;
}

async function buildDiseaseIndexFromDetails(key,{token=null}={}){
  if(diseaseIndex.has(key))return diseaseIndex.get(key);
  const status=document.getElementById('filter-status');
  const loader=document.getElementById('filter-loader');
  const isCurrent=()=>token===null || token===filterRequestToken;
  if(status && isCurrent())status.textContent=`Načítám filtr: ${DISEASES[key].label}…`;
  if(loader && isCurrent())loader.classList.add('on');

  const countries=[...FI.entries()].filter(([,info])=>info.has&&info.slug);
  const hits=new Set();
  let done=0;
  const limit=8;
  let cursor=0;

  async function worker(){
    while(cursor<countries.length){
      const [id,info]=countries[cursor++];
      const data=await fetchCountryDetail(info);
      if(dataHasDisease(data,key))hits.add(normId(id));
      done++;
      if(status && isCurrent() && (done%12===0 || done===countries.length)){
        status.textContent=`Načítám filtr: ${DISEASES[key].label} · ${done}/${countries.length}`;
      }
    }
  }

  await Promise.all(Array.from({length:Math.min(limit,countries.length)},worker));
  diseaseIndex.set(key,hits);
  diseaseIndexSource.set(key,'detail');
  if(loader && isCurrent())loader.classList.remove('on');
  if(status && isCurrent())status.textContent=`${DISEASES[key].label}: zvýrazněno ${hits.size} destinací.`;
  return hits;
}

async function ensureDiseaseIndex(key,{token=null}={}){
  if(diseaseIndex.has(key)){
    if(!diseaseIndexSource.has(key))diseaseIndexSource.set(key,'cache');
    return diseaseIndex.get(key);
  }
  await loadDiseaseIndexFromApiIfConfigured();
  if(diseaseIndex.has(key))return diseaseIndex.get(key);
  return buildDiseaseIndexFromDetails(key,{token});
}

function effectiveDiseaseHits(key){
  const base=new Set([...(diseaseIndex.get(key)||new Set())]);
  const o=CUSTOM_DISEASE_OVERRIDES[key];
  if(!o)return base;
  const inc=setToSetValues(o.include);
  const exc=setToSetValues(o.exclude);
  inc.forEach(id=>base.add(id));
  exc.forEach(id=>base.delete(id));
  return base;
}

function diseaseContainsMapId(key,id){
  const hits=effectiveDiseaseHits(key);
  const nid=normId(id);
  if(hits.has(nid))return true;
  for(const hit of hits){
    const info=FI.get(normId(hit));
    if(info && mappedIdForInfo(hit,info)===nid)return true;
  }
  return false;
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
  const hits=[...effectiveDiseaseHits(activeDisease)]
    .map(id=>({id,info:FI.get(normId(id))}))
    .filter(x=>x.info)
    .sort((a,b)=>a.info.name.localeCompare(b.info.name,'cs'));

  box.hidden=false;
  box.classList.add('open');

  const chips=hits.map(({id,info})=>`<button class="fr-chip" type="button" data-fr-country="${esc(id)}">${esc(info.name)}</button>`).join('');

  box.innerHTML=`<div class="fr-head">
    <div>
      <div class="fr-title">${esc(cfg?.label||'Vybraný filtr')} – destinace v aktuálním filtru</div>
      <div class="fr-count"><strong>${hits.length}</strong> destinací</div>
      <div class="fr-sub">Kliknutím na destinaci otevřete detail v mapě. Další související nemoci a rizika najdete po otevření detailu destinace.</div>
    </div>
  </div>
  ${hits.length?`<div class="fr-grid">${chips}</div>`:`<div class="fr-empty">Pro tento filtr se zatím nepodařilo najít žádnou destinaci. Může jít o riziko, které zatím není u destinací jednotně vedené.</div>`}`;

  box.querySelectorAll('[data-fr-country]').forEach(btn=>{
    btn.addEventListener('click',()=>selectCountry(normId(btn.dataset.frCountry)));
  });
}

function repaintMap(){
  if(!gv)return;
  gv.selectAll('path.country')
    .attr('fill',d=>selD&&featureId(d)===featureId(selD)?MC.sel:bf(d))
    .attr('stroke',d=>selD&&featureId(d)===featureId(selD)?MC.selB:MC.brd)
    .attr('stroke-width',d=>selD&&featureId(d)===featureId(selD)?1.55:.45);

  d3.selectAll('circle.dest-marker')
    .attr('r',d=>(selMarkId!==null&&normId(d.id)===normId(selMarkId)?5:3)/(currentZoomK||1))
    .attr('fill',d=>selMarkId!==null&&normId(d.id)===normId(selMarkId)?MC.sel:colorForId(d.id))
    .attr('stroke',d=>selMarkId!==null&&normId(d.id)===normId(selMarkId)?MC.selB:'rgba(255,255,255,0.55)')
    .attr('stroke-width',d=>(selMarkId!==null&&normId(d.id)===normId(selMarkId)?1.7:1)/(currentZoomK||1));
}

function diseaseSourceLabel(key){
  const src=diseaseIndexSource.get(key);
  if(src==='api-row')return ' (zdroj: přímé API značky)';
  if(src==='api-index')return ' (zdroj: backendový index)';
  if(src==='detail')return ' (zdroj: detail destinací)';
  return '';
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
  resetMapViewport();
  requestedDisease=key||'all';
  if(requestedDisease!=='all' && !DISEASES[requestedDisease]){
    console.warn('Neznámý filtr nemoci:',requestedDisease);
    requestedDisease='all';
  }
  const token=++filterRequestToken;
  scrollMapIntoView();
  document.querySelectorAll('.fbtn[data-disease]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.disease===requestedDisease);
  });

  if(requestedDisease==='all'){
    activeDisease='all';
    const status=document.getElementById('filter-status');
    const loader=document.getElementById('filter-loader');
    if(loader)loader.classList.remove('on');
    if(status)status.textContent='Zobrazeny všechny destinace s dostupným detailem.';
    repaintMap();
    renderFilterResults();
    if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
    return;
  }

  activeDisease=requestedDisease;
  const status=document.getElementById('filter-status');
  const loader=document.getElementById('filter-loader');
  if(loader)loader.classList.add('on');
  if(status)status.textContent=`Načítám filtr: ${DISEASES[requestedDisease].label}…`;

  await ensureDiseaseIndex(requestedDisease,{token});
  if(token!==filterRequestToken)return;

  activeDisease=requestedDisease;
  if(loader)loader.classList.remove('on');
  const effectiveHits=effectiveDiseaseHits(activeDisease);
  if(status)status.textContent=`${DISEASES[activeDisease].label}: zvýrazněno ${effectiveHits.size} destinací${diseaseSourceLabel(activeDisease)}.`;
  repaintMap();
  renderFilterResults();
  if(curInfo)renderMapInfo(curInfo,getCachedDetail(curInfo.slug),false);
}

function setupFilters(){
  document.querySelectorAll('.fbtn[data-disease]').forEach(btn=>{
    btn.addEventListener('click',()=>setDiseaseFilter(btn.dataset.disease));
  });

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
    miniGroupHtml('Doporučená',dop,'d',3)
  ].join('');
  return h?`<div class="mi-vax-groups">${h}</div>`:'';
}

function renderMapInfo(info,data=null,loading=false){
  const box=document.getElementById('map-info');
  if(!box||!info)return;
  const url=info.www||`https://www.ockovacicentrum.cz/cz/${info.slug}`;
  const centerUrl='https://www.ockovacicentrum.cz/cz/kde-ockujeme';
  const {pov,zak,dop}=vaxArrays(data);
  const np=pov.length, nz=zak.length, nd=dop.length;
  const badges=data
    ? `<span class="mi-badge p">${np} povinné</span><span class="mi-badge z">${nz} základní</span><span class="mi-badge d">${nd} doporučené</span>`
    : (info.has?`<span class="mi-badge">Načítám doporučení…</span>`:`<span class="mi-badge">Bez detailních doporučení</span>`);
  box.innerHTML=`<div class="mi-head">
    <div>
      <div class="mi-label">Vybraná destinace</div>
      <div class="mi-title">${esc(info.name)}</div>
    </div>
    <button class="mi-close" data-mi-action="close" type="button" aria-label="Zavřít">×</button>
  </div>
  <div class="mi-badges">${badges}</div>
  ${data?miniVaxList(data):''}
  <div class="mi-text">${data?'Rychlý přehled nejčastějších doporučení a rizik vidíte přímo zde. Nejde vždy o kompletní výčet, další položky najdete v detailu níže.':'Po výběru destinace se detail zobrazí i v panelu pod mapou. Ve fullscreen režimu máte tento rychlý přehled přímo nad mapou.'}</div>
  ${loading?'<div class="mi-loading">Načítám detail destinace…</div>':''}
  <div class="mi-actions">
    <a class="mi-btn" href="${esc(centerUrl)}" target="_blank" rel="noopener noreferrer">Najít očkovací centrum</a>
    <a class="mi-btn secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Otevřít detail země</a>
    <button class="mi-btn ghost" data-mi-action="scroll-detail" type="button">Zobrazit detail níže</button>
  </div>`;
  box.classList.add('open');
  const scrollToPanel=()=>document.getElementById('pnl')?.scrollIntoView({behavior:'smooth',block:'start'});
  box.onclick=e=>{
    const actionEl=e.target.closest('[data-mi-action]');
    if(!actionEl)return;
    const action=actionEl.dataset.miAction;
    if(action==='close'){
      closePanel();
      return;
    }
    if(action==='scroll-detail'){
      scrollToPanel();
    }
  };
}

function clearMapInfo(){
  const box=document.getElementById('map-info');
  if(box){box.classList.remove('open');box.innerHTML='';}
}

/* ── Panel ── */
function renderPanel(info){
  const wrap=document.getElementById('pnl');
  const url=info.www||`https://www.ockovacicentrum.cz/cz/${info.slug}`;
  curSlug=info.slug;
  curInfo=info;
  const cacheState=getCachedDetailState(info.slug);
  renderMapInfo(info,getCachedDetail(info.slug),info.has&&cacheState==='miss');

  wrap.innerHTML=`<div class="card">
    <div class="chd">
      <div>
        <p class="dlbl">Vybraná destinace</p>
        <h2 class="dname">${esc(info.name)}</h2>
        <div class="vcnts" id="vcc"></div>
      </div>
      <div class="hdr">
        <button class="bclose" id="bcl">Zavřít ✕</button>
      </div>
    </div>
    <div class="div"></div>
    <div id="vb"><p class="ml">${info.has?'Načítám vakcinační doporučení…':'Pro tuto destinaci zatím nejsou dostupná detailní doporučení.'}</p></div>
    <div class="cft">
      <div class="actionrow">
        <a class="bmore" href="https://www.ockovacicentrum.cz/cz/kde-ockujeme" target="_blank" rel="noopener noreferrer">
          Najít očkovací centrum
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <a class="bmore secondary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Zjistit více o zemi</a>
      </div>
      <span class="ftnote">ockovacicentrum.cz</span>
    </div>
  </div>`;

  requestAnimationFrame(()=>wrap.classList.add('open'));
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
  if(vc)vc.innerHTML='';
  if(vb)vb.innerHTML=`<p class="cnote">
    Pro destinaci <strong>${esc(info.name)}</strong> zatím nejsou dostupná detailní doporučení.
  </p>`;
}

const VAX_HELP={
  povinne:'Očkování, které je nezbytné a současně musí být platné před vstupem do dané destinace či při tranzitu přes endemickou oblast.',
  zakladni:'Očkování, které odborné autority považují za jednoznačně doporučené pro danou destinaci.',
  doporuceni:'Další nemoci a rizika, se kterými se můžete v dané destinaci setkat, a proti kterým se lze očkovat. Na základě destinace s vámi naši odborníci prokonzultují veškeré podrobnosti a případná rizika.'
};

function sectionTitle(cls,label,key){
  return `<p class="sl ${cls}">${esc(label)} <button class="help-btn" type="button" data-help="${esc(key)}" aria-label="Vysvětlit: ${esc(label)}">?</button></p>
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

  if(vc)vc.innerHTML=
    (np?`<span class="vcb vcbp">${np} povinné</span>`:'')+
    (nz?`<span class="vcb vcbz">${nz} základní</span>`:'')+
    (nd?`<span class="vcb vcbd">${nd} doporučené</span>`:'');

  let h='';
  h+=sectionHtml('p','Povinná očkování','povinne',pov,'Pro tuto destinaci nejsou v API uvedená povinná očkování.');
  h+=sectionHtml('z','Základní očkování','zakladni',zak,'Pro tuto destinaci nejsou v API uvedená základní očkování.');
  h+=sectionHtml('d','Další doporučení a rizika','doporuceni',dop,'Pro tuto destinaci nejsou v API uvedená další doporučení a rizika.');

  vb.innerHTML=h;
  setupHelpButtons(vb);
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
}

/* ── Zoom na feature ── */
function zoomToFeat(d,{animate=true}={}){
  try{
    const [[x0,y0],[x1,y1]]=pg.bounds(d);
    const dx=x1-x0,dy=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2;
    const sc=Math.max(1.2,Math.min(8,.82/Math.max(dx/W,dy/H)));
    const t=d3.zoomIdentity.translate(W/2,H/2).scale(sc).translate(-cx,-cy);
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
  const t=d3.zoomIdentity.translate(W/2,H/2).scale(scale).translate(-x,-y);
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
    d3.select(markerEl).attr('r',5/(currentZoomK||1)).attr('fill',MC.sel).attr('stroke',MC.selB).attr('stroke-width',1.5/(currentZoomK||1));
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
}

/* ── Vyhledávání ── */
let sidx=[],ddAct=-1;

function buildIdx(){
  const a=[];
  FI.forEach((v,k)=>a.push({nid:k,name:v.name,has:v.has,search:v.search||v.name}));
  return a.sort((a,b)=>a.name.localeCompare(b.name,'cs'));
}

function runSearch(q){
  const dd=document.getElementById('av-dd');
  const clr=document.getElementById('av-clr');
  q=q.trim();
  clr.classList.toggle('on',q.length>0);
  if(!q){dd.classList.remove('open');ddAct=-1;return;}
  const ql=slugKey(q);
  const hits=sidx.filter(x=>slugKey(x.search).includes(ql)).slice(0,10);
  if(!hits.length){
    dd.innerHTML='<div class="ddempty">Žádná shoda – zkuste jiný název</div>';
    dd.classList.add('open');ddAct=-1;return;
  }
  dd.innerHTML=hits.map((h,i)=>
    `<div class="ddi" data-nid="${h.nid}" role="option" aria-selected="false">
      <span class="ddot" style="background:${h.has?MC.has:MC.none}"></span>
      <span class="ddn">${esc(h.name)}</span>
      ${h.has?'<span class="ddbadge">Data dostupná</span>':''}
    </div>`
  ).join('');
  dd.classList.add('open');
  ddAct=-1;
  dd.querySelectorAll('.ddi').forEach(el=>{
    el.addEventListener('mousedown',e=>{
      e.preventDefault();
      selectCountry(normId(el.dataset.nid));
    });
  });
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

function featureId(d){
  return normId(d?._numId ?? d?.id);
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

function renderDebugPanel(apiRows,unmatchedApi){
  const panel=document.getElementById('debug-panel');
  if(!panel)return;
  const qs=new URLSearchParams(window.location.search);
  const show=qs.has('debug')||qs.has('diagnostika');
  if(!show)return;
  panel.classList.add('open');
  const items=unmatchedApi.map(x=>`<span class="dbg-chip">${esc(x.name||x.id||'bez názvu')} <code>${esc(x.id||'')}</code></span>`).join('');
  panel.innerHTML=`<strong>Diagnostika párování API</strong><br>
    Spárováno: ${apiRows.length-unmatchedApi.length} / ${apiRows.length}. 
    Nespárované položky jsou často teritoria nebo cestovatelské destinace, které nemají vlastní polygon v mapě.
    <div class="dbg-list">${items||'<span class="dbg-chip">Vše spárováno</span>'}</div>`;
}

/* ── Inicializace mapy ── */
async function initMap(){
  const st=document.getElementById('av-status');
  let wt,al;
  try{
    [wt,al]=await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json').then(r=>r.json()),
      apiFetch(APIS).then(d=>Array.isArray(d)?d:[])
    ]);
  }catch(e){
    st.textContent='Chyba načítání mapy';
    console.error('initMap error:',e);
    return;
  }

  const api=buildApiIndex(al);

  document.getElementById('ln').style.background=MC.none;
  document.getElementById('lh').style.background=MC.has;

  /* SVG setup */
  const mw=document.getElementById('mw');
  W=mw.clientWidth;
  H=mw.clientHeight||540;
  sv=d3.select('#av-map').attr('viewBox',`0 0 ${W} ${H}`);
  prj=d3.geoNaturalEarth1().scale(W/5.9).translate([W/2,H/2]);
  pg=d3.geoPath().projection(prj);

  /* Features */
  const feats=topojson.feature(wt,wt.objects.countries);
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
    const cz=CZ[numId]||en;
    const entry=findApiEntry(api,numId,en,cz);
    const keys=countryKeys(numId,en,cz);
    const slug=entry?.id||entry?.slug||keys[0]||toSlug(en);
    const name=(numId===706?cz:(entry?.name||cz||en));

    FI.set(numId,{
      id:numId,
      numId,
      name,
      slug,
      has:!!entry,
      www:entry?.www||null,
      coords:DEST_COORDS[numId]||null,
      search:unique([name,en,cz,slug,...keys]).join(' ')
    });
  });

  /* Donutit přiřazení destinací, které API má, ale mapa/API používají odlišný název,
     nebo jde o ostrov/region/teritorium bez vlastního polygonu. */
  api.rows.forEach(row=>{
    const mapped=apiDestinationMapping(row);
    if(mapped){
      const rawSlug=row.id||row.slug||apiRowKeys(row)[0];
      const id=normId(mapped.id ?? `api:${rawSlug}`);
      const mapId=normId(mapped.mapId ?? mapped.id);
      const base=FI.get(mapId);
      const name=row.name||mapped.name||base?.name||rawSlug;
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
    const name=(forcedId===706?cz:(row.name||cz||en));

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
  st.textContent=api.rows.length?`${matchedApiRows} z ${api.rows.length} destinací připraveno`:'Data se nepodařilo načíst';
  window.AvenierMapDebug={
    apiRows:api.rows,
    matchedApiRows,
    unmatchedApi,
    unmatchedNames:unmatchedApi.map(x=>x.name||x.id)
  };
  renderDebugPanel(api.rows,unmatchedApi);
  renderAdminPanel(api.rows,unmatchedApi);
  if(unmatchedApi.length){
    console.warn('Nepřiřazené destinace z API:', unmatchedApi.map(x=>({id:x.id,name:x.name,www:x.www})));
  }

  const seededDiseaseRules=seedDiseaseIndexFromApiRows(api.rows);
  if(seededDiseaseRules){
    console.info(`Přednačteno ${seededDiseaseRules} vazeb nemoc→destinace z API seznamu.`);
  }

  sidx=buildIdx();
  setupSearch();
  setupFilters();

  /* Oceán (rect) */
  oceanRect=sv.append('rect')
    .attr('x',0).attr('y',0).attr('width',W).attr('height',H).attr('fill',MC.ocean);

  /* Graticule */
  graticulePath=sv.append('path').datum(d3.geoGraticule()()).attr('d',pg)
    .attr('fill','none').attr('stroke',MC.grat).attr('stroke-width',.5)
    .style('pointer-events','none');

  /* Zoom */
  zb=d3.zoom().scaleExtent([1,8]).extent([[0,0],[W,H]]).on('zoom',e=>{currentZoomK=e.transform.k;gv.attr('transform',e.transform);updateMarkerScale();});
  sv.call(zb);
  gv=sv.append('g');

  const hl=document.getElementById('hlbl');

  /* Render countries */
  countryPaths=gv.selectAll('path.country')
    .data(feats.features)
    .join('path')
    .attr('class','country')
    .attr('d',pg)
    .attr('fill',d=>bf(d))
    .attr('stroke',MC.brd)
    .attr('stroke-width',.45)
    .attr('vector-effect','non-scaling-stroke')
    .attr('data-id',d=>featureId(d))
    .style('cursor','pointer')
    .on('mouseover',function(e,d){
      if(this===selEl)return;
      d3.select(this).attr('fill',hoverColorForId(featureId(d))).attr('stroke',MC.brdH).attr('stroke-width',.85);
      const i=FI.get(featureId(d));
      if(i){hl.textContent=i.name;hl.classList.add('on');}
    })
    .on('mouseout',function(e,d){
      if(this===selEl)return;
      d3.select(this).attr('fill',bf(d)).attr('stroke',MC.brd).attr('stroke-width',.45);
      hl.classList.remove('on');
    })
    .on('click',function(e,d){
      e.stopPropagation();
      selectCountry(featureId(d));
    });

  /* Hranice */
  bordersPath=gv.append('path')
    .datum(topojson.mesh(wt,wt.objects.countries,(a,b)=>a!==b))
    .attr('d',pg).attr('fill','none').attr('stroke','rgba(255,255,255,0.40)').attr('stroke-width',.55).attr('stroke-linejoin','round').attr('vector-effect','non-scaling-stroke')
    .style('pointer-events','none');

  /* Fallback body pro destinace z API, které nejsou v polygonové vrstvě mapy. */
  const virtualDest=[...FI.entries()].filter(([id,info])=>info.has&&info.coords&&(!FM.has(id)||info.virtual||info.mapId));
  const mg=gv.append('g').attr('class','virtual-destinations');
  markerSelection=mg.selectAll('circle.dest-marker')
    .data(virtualDest.map(([id,info])=>({id,info})))
    .join('circle')
    .attr('class','dest-marker')
    .attr('cx',d=>prj(d.info.coords)[0])
    .attr('cy',d=>prj(d.info.coords)[1])
    .attr('r',d=>3/(currentZoomK||1))
    .attr('fill',d=>colorForId(d.id))
    .attr('stroke','rgba(255,255,255,0.55)')
    .attr('stroke-width',1/(currentZoomK||1))
    .style('cursor','pointer')
    .each(function(d){VM.set(d.id,this);})
    .on('mouseover',function(e,d){
      if(this===selMark)return;
      d3.select(this).attr('r',4/(currentZoomK||1)).attr('fill',hoverColorForId(d.id)).attr('stroke',MC.brdH).attr('stroke-width',1.2/(currentZoomK||1));
      hl.textContent=d.info.name;hl.classList.add('on');
    })
    .on('mouseout',function(e,d){
      if(this===selMark)return;
      d3.select(this).attr('r',3/(currentZoomK||1)).attr('fill',colorForId(d.id)).attr('stroke','rgba(255,255,255,0.55)').attr('stroke-width',.9/(currentZoomK||1));
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
}

initMap();
