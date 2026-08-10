import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const API_URL='https://www.ockovacicentrum.cz/api/country';
const CONCURRENCY=10;
const TIMEOUT_MS=15000;
const RETRIES=2;

const scriptDir=dirname(fileURLToPath(import.meta.url));
const outputPath=resolve(scriptDir,'../assets/data/disease-index.json');

function slugKey(value){
  return String(value||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function itemName(item){
  return typeof item==='string'?item:(item?.name||item?.title||'');
}

function allItems(detail){
  return [
    ...(Array.isArray(detail?.povinne)?detail.povinne:[]),
    ...(Array.isArray(detail?.zakladni)?detail.zakladni:[]),
    ...(Array.isArray(detail?.doporuceni)?detail.doporuceni:[])
  ];
}

const matchers={
  typhoid:name=>name==='brisni-tyfus',
  dengue:name=>name==='horecka-dengue'||name.startsWith('horecka-dengue-'),
  rabies:name=>name==='vzteklina',
  'japanese-encephalitis':name=>name==='japonska-encefalitida',
  cholera:name=>name==='cholera',
  'hepatitis-a':name=>name==='zloutenka-typu-a',
  'hepatitis-b':name=>name==='zloutenka-typu-b',
  polio:name=>name==='detska-obrna'||name.startsWith('detska-obrna-'),
  meningococcus:name=>name==='meningokokove-nakazy',
  'tick-borne-encephalitis':name=>name==='klistova-encefalitida',
  measles:name=>name==='spalnicky',
  flu:name=>name==='chripka'
};

async function fetchJson(url){
  let lastError=null;
  for(let attempt=0;attempt<=RETRIES;attempt++){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json','User-Agent':'Avenier-map-index-generator/1.0'}});
      if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    }catch(error){
      lastError=error;
      if(attempt<RETRIES)await new Promise(resolveDelay=>setTimeout(resolveDelay,500*(attempt+1)));
    }finally{
      clearTimeout(timeout);
    }
  }
  throw new Error(`Načtení ${url} selhalo: ${lastError?.message||lastError}`);
}

async function loadDetails(rows){
  const details=new Array(rows.length);
  let cursor=0;
  async function worker(){
    while(cursor<rows.length){
      const index=cursor++;
      const row=rows[index];
      const url=row.api||`${API_URL}/${encodeURIComponent(row.id)}`;
      details[index]=await fetchJson(url);
    }
  }
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,rows.length)},worker));
  return details;
}

function validateCounts(payload){
  const count=payload.destinationCount;
  if(count<220||count>260)throw new Error(`Neočekávaný počet destinací: ${count}`);
  if(payload.detailCount!==count)throw new Error(`Chybí detaily: ${payload.detailCount}/${count}`);

  const ranges={
    typhoid:[140,200],dengue:[110,170],rabies:[90,150],'japanese-encephalitis':[15,40],
    cholera:[20,60],'hepatitis-a':[220,260],'hepatitis-b':[220,260],polio:[25,65],
    meningococcus:[220,260],'tick-borne-encephalitis':[20,55],measles:[220,260],flu:[215,260]
  };
  Object.entries(ranges).forEach(([key,[min,max]])=>{
    const diseaseCount=payload.diseases[key]?.count??-1;
    if(diseaseCount<min||diseaseCount>max)throw new Error(`Podezřelý počet pro ${key}: ${diseaseCount} (očekáváno ${min}–${max})`);
  });
  const entryCount=payload.yellowFever.entryDestinationSlugs.length;
  const candidateCount=payload.yellowFever.riskCandidateDestinationSlugs.length;
  if(entryCount<90||entryCount>150)throw new Error(`Podezřelý počet vstupních podmínek žluté zimnice: ${entryCount}`);
  if(candidateCount<30||candidateCount>60)throw new Error(`Podezřelý počet kandidátů rizika žluté zimnice: ${candidateCount}`);
}

function comparablePayload(payload){
  if(!payload||typeof payload!=='object')return '';
  const copy={...payload};
  delete copy.generatedAt;
  return JSON.stringify(copy);
}

async function main(){
  const rows=await fetchJson(API_URL);
  if(!Array.isArray(rows))throw new Error('Seznam destinací není pole.');
  const ids=rows.map(row=>String(row.id||''));
  if(ids.some(id=>!id))throw new Error('Některá destinace nemá ID.');
  if(new Set(ids).size!==ids.length)throw new Error('Seznam destinací obsahuje duplicitní ID.');

  const details=await loadDetails(rows);
  const diseaseSets=Object.fromEntries(Object.keys(matchers).map(key=>[key,new Set()]));
  const entry=new Set();
  const riskCandidates=new Set();
  const catalog=new Map();

  details.forEach((detail,index)=>{
    const destinationSlug=ids[index];
    const normalizedItems=allItems(detail).map(item=>slugKey(itemName(item))).filter(Boolean);
    Object.entries(matchers).forEach(([key,matcher])=>{
      if(normalizedItems.some(matcher))diseaseSets[key].add(destinationSlug);
    });

    allItems(detail).forEach(item=>{
      const name=itemName(item).trim();
      if(name)catalog.set(name,(catalog.get(name)||0)+1);
    });

    const required=(Array.isArray(detail?.povinne)?detail.povinne:[]).map(item=>slugKey(itemName(item)));
    const recommended=[
      ...(Array.isArray(detail?.zakladni)?detail.zakladni:[]),
      ...(Array.isArray(detail?.doporuceni)?detail.doporuceni:[])
    ].map(item=>slugKey(itemName(item)));
    const conditionalEntry=required.some(name=>name.includes('zluta-zimnice-pri-priletu-z-endemicke-oblasti'));
    const generalEntry=required.some(name=>name==='zluta-zimnice');
    const apiRecommendation=recommended.some(name=>name==='zluta-zimnice');
    if(conditionalEntry||generalEntry)entry.add(destinationSlug);
    if(generalEntry||apiRecommendation)riskCandidates.add(destinationSlug);
  });

  const diseases={};
  Object.entries(diseaseSets).forEach(([key,set])=>{
    const destinationSlugs=[...set].sort();
    diseases[key]={count:destinationSlugs.length,destinationSlugs};
  });
  const payload={
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    source:API_URL,
    destinationCount:rows.length,
    detailCount:details.length,
    destinationSlugs:[...ids].sort(),
    diseases,
    yellowFever:{
      entryDestinationSlugs:[...entry].sort(),
      riskCandidateDestinationSlugs:[...riskCandidates].sort()
    },
    catalog:[...catalog.entries()].sort(([a],[b])=>a.localeCompare(b,'cs')).map(([name,occurrences])=>({name,occurrences}))
  };

  validateCounts(payload);
  await mkdir(dirname(outputPath),{recursive:true});
  try{
    const current=JSON.parse(await readFile(outputPath,'utf8'));
    if(comparablePayload(current)===comparablePayload(payload)){
      console.log(`Index je beze změny: ${rows.length} destinací, ${Object.keys(diseases).length} nemocí.`);
      return;
    }
  }catch(error){
    if(error?.code!=='ENOENT')console.warn(`Původní index nelze porovnat: ${error.message}`);
  }
  await writeFile(outputPath,`${JSON.stringify(payload,null,2)}\n`,'utf8');
  console.log(`Vygenerován index: ${rows.length} destinací, ${Object.keys(diseases).length} nemocí.`);
}

main().catch(error=>{
  console.error(error.stack||error.message||error);
  process.exitCode=1;
});
