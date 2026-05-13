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

Dokumentace změn:
- [TECHNIKA_A_FUNKCNOST_V20](docs/TECHNIKA_A_FUNKCNOST_V20.md)
