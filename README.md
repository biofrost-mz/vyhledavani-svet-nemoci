# Vakcinační mapa světa – Avenier

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

Verze v21 (varianty zobrazení):
- přidán přepínač režimu zobrazení (aktuální / krokové),
- krokové zobrazení na desktopu používá 2sloupcový layout (mapa + sticky souhrn),
- volba režimu se ukládá do localStorage.

Dokumentace změn:
- [TECHNIKA_A_FUNKCNOST_V20](docs/TECHNIKA_A_FUNKCNOST_V20.md)
- [LAYOUT_VARIANTY_V2](docs/LAYOUT_VARIANTY_V2.md)
