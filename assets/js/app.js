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

let activeDisease='all';
const diseaseIndex=new Map(); /* diseaseKey → Set(countryId) */
const detailLoading=new Map();

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
    return hits.has(nid)?DISEASES[activeDisease].color:MC.dim;
  }
  return MC.has;
}

function hoverColorForId(id){
  const nid=normId(id);
  if(activeDisease && activeDisease!=='all'){
    const hits=diseaseIndex.get(activeDisease);
    return hits?.has(nid)?DISEASES[activeDisease].hover:MC.dim;
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
const cache=new Map();
let curSlug=null;
let curInfo=null;

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
  if(url)return `<a class="pill ${cls}" href="${esc(url)}" target="_blank" rel="noopener">${name}</a>`;
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
  if(cache.has(info.slug))return cache.get(info.slug);
  if(detailLoading.has(info.slug))return detailLoading.get(info.slug);
  const promise=apiFetch(`${APIS}/${encodeURIComponent(info.slug)}`).then(d=>{
    cache.set(info.slug,d);
    detailLoading.delete(info.slug);
    return d;
  }).catch(e=>{
    detailLoading.delete(info.slug);
    console.warn('Detail destinace se nepodařilo načíst:',info.slug,e);
    return null;
  });
  detailLoading.set(info.slug,promise);
  return promise;
}

async function buildDiseaseIndex(key){
  if(diseaseIndex.has(key))return diseaseIndex.get(key);
  const status=document.getElementById('filter-status');
  const loader=document.getElementById('filter-loader');
  if(status)status.textContent=`Načítám filtr: ${DISEASES[key].label}…`;
  if(loader)loader.classList.add('on');

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
      if(status && (done%12===0 || done===countries.length)){
        status.textContent=`Načítám filtr: ${DISEASES[key].label} · ${done}/${countries.length}`;
      }
    }
  }

  await Promise.all(Array.from({length:Math.min(limit,countries.length)},worker));
  diseaseIndex.set(key,hits);
  if(loader)loader.classList.remove('on');
  if(status)status.textContent=`${DISEASES[key].label}: zvýrazněno ${hits.size} destinací.`;
  return hits;
}

function effectiveDiseaseHits(key){
  return diseaseIndex.get(key)||new Set();
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

  const link=cfg?.url?`<a class="fr-link" href="${esc(cfg.url)}" target="_blank" rel="noopener">Detail nemoci ↗</a>`:'';
  const chips=hits.map(({id,info})=>`<button class="fr-chip" type="button" data-fr-country="${esc(id)}">${esc(info.name)}</button>`).join('');

  box.innerHTML=`<div class="fr-head">
    <div>
      <div class="fr-title">${esc(cfg?.label||'Vybraný filtr')} – destinace v aktuálním filtru</div>
      <div class="fr-sub">${hits.length} destinací podle aktuálně načtených dat API. Kliknutím na destinaci otevřete detail v mapě.</div>
    </div>
    <div class="fr-actions">${link}</div>
  </div>
  ${hits.length?`<div class="fr-grid">${chips}</div>`:`<div class="fr-empty">Pro tento filtr se zatím nepodařilo najít žádnou destinaci. Může jít o riziko, které není v API vedené stejně u všech zemí.</div>`}`;

  box.querySelectorAll('[data-fr-country]').forEach(btn=>{
    btn.addEventListener('click',()=>selectCountry(Number(btn.dataset.frCountry)));
  });
}

function repaintMap(){
  if(!gv)return;
  gv.selectAll('path.country')
    .attr('fill',d=>selD&&featureId(d)===featureId(selD)?MC.sel:bf(d))
    .attr('stroke',d=>selD&&featureId(d)===featureId(selD)?MC.selB:MC.brd)
    .attr('stroke-width',d=>selD&&featureId(d)===featureId(selD)?1.55:.45);

  d3.selectAll('circle.dest-marker')
    .attr('r',d=>(selMarkId!==null&&normId(d.id)===normId(selMarkId)?6:4)/(currentZoomK||1))
    .attr('fill',d=>selMarkId!==null&&normId(d.id)===normId(selMarkId)?MC.sel:colorForId(d.id))
    .attr('stroke',d=>selMarkId!==null&&normId(d.id)===normId(selMarkId)?MC.selB:'rgba(255,255,255,0.55)')
    .attr('stroke-width',d=>(selMarkId!==null&&normId(d.id)===normId(selMarkId)?1.7:1)/(currentZoomK||1));
}

async function setDiseaseFilter(key){
  activeDisease=key||'all';
  document.querySelectorAll('.fbtn[data-disease]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.disease===activeDisease);
  });

  if(activeDisease==='all'){
    const status=document.getElementById('filter-status');
    const loader=document.getElementById('filter-loader');
    if(loader)loader.classList.remove('on');
    if(status)status.textContent='Zobrazeny všechny destinace s daty z API.';
    repaintMap();
    renderFilterResults();
    if(curInfo)renderMapInfo(curInfo,cache.get(curInfo.slug)||null,false);
    return;
  }

  await buildDiseaseIndex(activeDisease);
  repaintMap();
  renderFilterResults();
  if(curInfo)renderMapInfo(curInfo,cache.get(curInfo.slug)||null,false);
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

function miniVaxList(data){
  const {pov,zak,dop}=vaxArrays(data);
  const all=[...pov,...zak,...dop].slice(0,6);
  if(!all.length)return '';
  return `<div class="mi-mini">${all.map(v=>`<span class="mi-pill">${vaxName(v)}</span>`).join('')}</div>`;
}

function renderMapInfo(info,data=null,loading=false){
  const box=document.getElementById('map-info');
  if(!box||!info)return;
  const url=info.www||`https://www.ockovacicentrum.cz/cz/${info.slug}`;
  const {pov,zak,dop}=vaxArrays(data);
  const np=pov.length, nz=zak.length, nd=dop.length;
  const filterActive=activeDisease&&activeDisease!=='all';
  const inFilter=filterActive?effectiveDiseaseHits(activeDisease).has(normId(info.id??info.numId??[...FI.entries()].find(([,v])=>v===info)?.[0])):false;
  const filterCfg=filterActive?DISEASES[activeDisease]:null;
  const filterBadge=filterActive?(
    filterCfg?.url
      ? `<a class="mi-badge filter" href="${esc(filterCfg.url)}" target="_blank" rel="noopener">${esc(filterCfg.label)}: ${inFilter?'zahrnuto ve filtru':'mimo filtr'} ↗</a>`
      : `<span class="mi-badge filter">${esc(filterCfg.label)}: ${inFilter?'zahrnuto ve filtru':'mimo filtr'}</span>`
  ):'';
  const badges=data
    ? `<span class="mi-badge p">${np} povinné</span><span class="mi-badge z">${nz} základní</span><span class="mi-badge d">${nd} doporučené</span>${filterBadge}`
    : (info.has?`${filterBadge}<span class="mi-badge">Načítám doporučení…</span>`:`<span class="mi-badge">Bez detailu v API</span>`);
  box.innerHTML=`<div class="mi-head">
    <div>
      <div class="mi-label">Vybraná destinace</div>
      <div class="mi-title">${esc(info.name)}</div>
    </div>
    <button class="mi-close" id="mi-close" type="button" aria-label="Zavřít">×</button>
  </div>
  <div class="mi-badges">${badges}</div>
  ${data?miniVaxList(data):''}
  <div class="mi-text">${data?'Rychlý přehled je dostupný přímo v mapě. Kompletní detail najdete níže nebo na webu Očkovacího centra.':'Po výběru destinace se detail zobrazí i v panelu pod mapou. Ve fullscreen režimu vidíte tento rychlý přehled přímo nad mapou.'}</div>
  ${loading?'<div class="mi-loading">Načítám detail destinace…</div>':''}
  <div class="mi-actions">
    <button class="mi-btn secondary" id="mi-scroll-detail" type="button">Zobrazit detail níže</button>
    <a class="mi-btn" href="${esc(url)}" target="_blank" rel="noopener">Otevřít detail země</a>
  </div>`;
  box.classList.add('open');
  document.getElementById('mi-close')?.addEventListener('click',closePanel);
  document.getElementById('mi-scroll-detail')?.addEventListener('click',()=>{
    document.getElementById('pnl')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
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
  renderMapInfo(info,cache.get(info.slug)||null,info.has&&!cache.has(info.slug));

  wrap.innerHTML=`<div class="card">
    <div class="chd">
      <div><p class="dlbl">Vybraná destinace</p><h2 class="dname">${esc(info.name)}</h2></div>
      <div class="hdr">
        <button class="bclose" id="bcl">Zavřít ✕</button>
        <div class="vcnts" id="vcc"></div>
      </div>
    </div>
    <div class="div"></div>
    <p class="intro">Doporučení se může lišit podle délky pobytu, konkrétní oblasti, stylu cestování a zdravotního stavu cestovatele. Detail země berte jako rychlý rozcestník pro další ověření.</p>
    <div id="vb"><p class="ml">${info.has?'Načítám vakcinační doporučení…':'Pro tuto destinaci zatím nejsou dostupná data v API.'}</p></div>
    <div class="cft">
      <div class="actionrow">
        <a class="bmore" href="${esc(url)}" target="_blank" rel="noopener">
          Zjistit více o zemi
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <a class="bmore secondary" href="https://www.ockovacicentrum.cz" target="_blank" rel="noopener">Najít očkovací centrum</a>
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

  if(cache.has(info.slug)){renderVax(cache.get(info.slug));return;}
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
    Pro destinaci <strong>${esc(info.name)}</strong> se v seznamu API zatím nepodařilo dohledat odpovídající záznam. Zkontrolujte aliasy / mapování názvu země.
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

function sectionHtml(cls,label,key,items,emptyText){
  return sectionTitle(cls,label,key)+(
    items.length
      ? `<div class="pills">${items.map(v=>pillHtml(v,cls)).join('')}</div>`
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
      Vakcinační data se nepodařilo načíst. Pokud soubor spouštíte lokálně přes <code>file://</code>, může přímý request blokovat CORS.<br>
      Pro plnou funkci nahrajte soubor na web / testovací hosting, případně použijte vlastní serverový proxy endpoint.
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
  w.classList.remove('open');
  setTimeout(()=>{if(!w.classList.contains('open'))w.innerHTML='';},350);
  curSlug=null;
  curInfo=null;
  clearMapInfo();
  document.getElementById('hint').classList.remove('h');
  resetSel();
  document.getElementById('av-search').value='';
  document.getElementById('av-clr').classList.remove('on');
}

/* ── Zoom na feature ── */
function zoomToFeat(d){
  try{
    const [[x0,y0],[x1,y1]]=pg.bounds(d);
    const dx=x1-x0,dy=y1-y0,cx=(x0+x1)/2,cy=(y0+y1)/2;
    const sc=Math.max(1.2,Math.min(8,.82/Math.max(dx/W,dy/H)));
    sv.transition().duration(650).call(zb.transform,d3.zoomIdentity.translate(W/2,H/2).scale(sc).translate(-cx,-cy));
  }catch(e){console.warn('Zoom na zemi selhal:',e);}
}

function zoomToCoords(coords,scale=4.2){
  if(!coords||!prj)return;
  const [x,y]=prj(coords);
  sv.transition().duration(650).call(zb.transform,d3.zoomIdentity.translate(W/2,H/2).scale(scale).translate(-x,-y));
}

/* ── Výběr země (ze search i z kliknutí) ── */
function selectCountry(numId){
  const id=normId(numId);
  const feat=FM.get(id);
  const info=FI.get(id);
  if(!info){
    console.warn('Zemi se nepodařilo vybrat:',{id,feat:!!feat,info:!!info});
    return;
  }

  resetSel();

  const pathEl=feat?gv.select(`[data-id="${id}"]`).node():null;
  const markerEl=VM.get(id);

  if(pathEl){
    selEl=pathEl;selD=feat;
    d3.select(pathEl).attr('fill',MC.sel).attr('stroke',MC.selB).attr('stroke-width',1.55);
    zoomToFeat(feat);
  }else if(markerEl){
    selMark=markerEl;selMarkId=id;
    d3.select(markerEl).attr('r',6/(currentZoomK||1)).attr('fill',MC.sel).attr('stroke',MC.selB).attr('stroke-width',1.7/(currentZoomK||1));
    zoomToCoords(info.coords);
  }else if(info.coords){
    zoomToCoords(info.coords);
  }

  document.getElementById('av-search').value=info.name;
  document.getElementById('av-clr').classList.add('on');
  document.getElementById('av-dd').classList.remove('open');

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
      selectCountry(Number(el.dataset.nid));
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
    Nespárované položky jsou často teritoria nebo marketingové destinace, které nemají vlastní polygon ve world-atlas mapě.
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
  prj=d3.geoNaturalEarth1().scale(W/6.4).translate([W/2,H/2]);
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

  /* Donutit přiřazení destinací, které API má, ale mapa/API používají odlišný název nebo jde o teritorium. */
  api.rows.forEach(row=>{
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
    const keys=apiRowKeys(row);
    return !keys.some(k=>k && matchedApiKeys.has(k));
  });
  const matchedApiRows=api.rows.length-unmatchedApi.length;
  st.textContent=api.rows.length?`${matchedApiRows} z ${api.rows.length} destinací spárováno z API`:'Lokální data · API nedostupné';
  window.AvenierMapDebug={
    apiRows:api.rows,
    matchedApiRows,
    unmatchedApi,
    unmatchedNames:unmatchedApi.map(x=>x.name||x.id)
  };
  renderDebugPanel(api.rows,unmatchedApi);
  if(unmatchedApi.length){
    console.warn('Nepřiřazené destinace z API:', unmatchedApi.map(x=>({id:x.id,name:x.name,www:x.www})));
  }

  sidx=buildIdx();
  setupSearch();
  setupFilters();

  /* Oceán (rect) */
  const oceanRect=sv.append('rect')
    .attr('x',0).attr('y',0).attr('width',W).attr('height',H).attr('fill',MC.ocean);

  /* Graticule */
  sv.append('path').datum(d3.geoGraticule()()).attr('d',pg)
    .attr('fill','none').attr('stroke',MC.grat).attr('stroke-width',.5)
    .style('pointer-events','none');

  /* Zoom */
  zb=d3.zoom().scaleExtent([1,8]).extent([[0,0],[W,H]]).on('zoom',e=>{currentZoomK=e.transform.k;gv.attr('transform',e.transform);updateMarkerScale();});
  sv.call(zb);
  gv=sv.append('g');

  const hl=document.getElementById('hlbl');

  /* Render countries */
  gv.selectAll('path.country')
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
  gv.append('path')
    .datum(topojson.mesh(wt,wt.objects.countries,(a,b)=>a!==b))
    .attr('d',pg).attr('fill','none').attr('stroke','rgba(255,255,255,0.40)').attr('stroke-width',.55).attr('stroke-linejoin','round').attr('vector-effect','non-scaling-stroke')
    .style('pointer-events','none');

  /* Fallback body pro destinace z API, které nejsou v polygonové vrstvě mapy. */
  const virtualDest=[...FI.entries()].filter(([id,info])=>info.has&&!FM.has(id)&&info.coords);
  const mg=gv.append('g').attr('class','virtual-destinations');
  mg.selectAll('circle.dest-marker')
    .data(virtualDest.map(([id,info])=>({id,info})))
    .join('circle')
    .attr('class','dest-marker')
    .attr('cx',d=>prj(d.info.coords)[0])
    .attr('cy',d=>prj(d.info.coords)[1])
    .attr('r',d=>4/(currentZoomK||1))
    .attr('fill',d=>colorForId(d.id))
    .attr('stroke','rgba(255,255,255,0.55)')
    .attr('stroke-width',1/(currentZoomK||1))
    .style('cursor','pointer')
    .each(function(d){VM.set(d.id,this);})
    .on('mouseover',function(e,d){
      if(this===selMark)return;
      d3.select(this).attr('r',5/(currentZoomK||1)).attr('fill',hoverColorForId(d.id)).attr('stroke',MC.brdH).attr('stroke-width',1.4/(currentZoomK||1));
      hl.textContent=d.info.name;hl.classList.add('on');
    })
    .on('mouseout',function(e,d){
      if(this===selMark)return;
      d3.select(this).attr('r',4/(currentZoomK||1)).attr('fill',colorForId(d.id)).attr('stroke','rgba(255,255,255,0.55)').attr('stroke-width',1/(currentZoomK||1));
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
}

initMap();
