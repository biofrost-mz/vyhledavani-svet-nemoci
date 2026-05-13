# Vakcinační mapa světa – Avenier

Verze v9:
- přidává seznam destinací podle aktivního filtru nemoci,
- přidává rozbalovací nabídku dalších nemocí a rizik,
- opravuje `effectiveDiseaseHits`,
- sjednocuje mobilní CSS,
- používá `fetchCountryDetail(info)` i v detailu destinace.

## Struktura
- `index.html`
- `assets/css/map.css`
- `assets/js/config.js`
- `assets/js/app.js`

## Poznámka k dalším nemocem
Rozbalovací nabídka obsahuje i položky, které mohou být v API vedené jako riziko, nikoliv jen jako očkování. Typicky malárie nebo rizika spojená s hmyzem. Finální názvosloví je vhodné ještě medicínsky zkontrolovat.
