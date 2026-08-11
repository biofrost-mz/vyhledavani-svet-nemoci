/* Sdílecí stránky pro jednotlivé filtry.

   Crawlery Facebooku, Slacku nebo LinkedInu nespouštějí JavaScript a query
   string pro ně nic neznamená – `?filtr=malaria` jim vrátí tentýž index.html.
   Aby měl filtr vlastní náhledový obrázek, musí existovat vlastní URL s
   vlastními meta tagy. Tyhle stránky nedělají nic jiného: nesou meta tagy a
   hned předají návštěvníka do aplikace se správným filtrem.

   Obrázky v assets/img/share/ vznikají exportérem přímo v aplikaci
   (tlačítko „Stáhnout mapu jako PNG“ používá stejný kód), zmenšené na
   1200×630. Když se filtry změní, stačí je znovu vyexportovat a spustit
   tento skript.

   Spuštění: node scripts/generate-share-pages.mjs
*/
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://vyhledavani-svet-nemoci.vercel.app';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* config.js je obyčejný skript s konstantami, jde vyhodnotit i mimo prohlížeč. */
const configSource = await readFile(resolve(root, 'assets/js/config.js'), 'utf8');
const {DISEASES, STATIC_DISEASE_INDEX} = new Function(
  `${configSource}\nreturn {DISEASES, STATIC_DISEASE_INDEX};`
)();

const shareDir = resolve(root, 'assets/img/share');
const images = new Set((await readdir(shareDir)).filter(name => name.endsWith('.jpg')));

function description(key, cfg) {
  const source = STATIC_DISEASE_INDEX?.[key]?.sourceLabel;
  const origin = source ? `Zdroj: cestovní doporučení Avenier a ${source}.` : 'Zdroj: cestovní doporučení Avenier.';
  return `Kde je v cestovních doporučeních uvedena ${cfg.label.toLowerCase()}. ${origin} Orientační přehled, nenahrazuje doporučení lékaře.`;
}

function page({title, desc, image, target, heading}) {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(target)}">
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Avenier · Očkovací centrum">
<meta property="og:locale" content="cs_CZ">
<meta property="og:url" content="${esc(target)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(heading)} – mapa destinací">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d2040;color:#fff;
       font-family:'Open Sans',Arial,sans-serif;text-align:center;padding:24px}
  a{color:#9bd344}
</style>
</head>
<body>
  <p>Otevírám mapu očkování a zdravotních rizik…<br>
  <a href="${esc(target)}">${esc(heading)}</a></p>
  <script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>
`;
}

await mkdir(resolve(root, 'share'), {recursive: true});

const generated = [];
for (const [key, cfg] of Object.entries(DISEASES)) {
  const file = `${key}.jpg`;
  if (!images.has(file)) continue;
  const target = `${BASE}/?filtr=${encodeURIComponent(key)}`;
  await writeFile(
    resolve(root, 'share', `${key}.html`),
    page({
      title: `${cfg.label} – mapa destinací · Avenier`,
      desc: description(key, cfg),
      image: `${BASE}/assets/img/share/${file}`,
      target,
      heading: cfg.label
    }),
    'utf8'
  );
  generated.push(key);
}

console.log(`Vygenerováno ${generated.length} sdílecích stránek: ${generated.join(', ')}`);
if (!images.has('default.jpg')) console.warn('Pozor: chybí assets/img/share/default.jpg pro hlavní stránku.');
