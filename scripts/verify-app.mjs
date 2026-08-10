import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const index=JSON.parse(await readFile(resolve(root,'assets/data/disease-index.json'),'utf8'));
const html=await readFile(resolve(root,'index.html'),'utf8');
const config=await readFile(resolve(root,'assets/js/config.js'),'utf8');

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

console.log(`Kontrola v pořádku: ${index.destinationCount} destinací, ${requiredDiseases.length} nemocí, verze ${versions[0]}.`);
