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

Verze v21 (obsah + UX + právní jasnost):
- výrazné právní/orientační upozornění nad mapou,
- mini návod „Jak mapu používat“, vysvětlení kategorií a barev mapy,
- praktická sekce „Po návštěvě“ a stručné FAQ,
- méně zahlcení: dlouhé seznamy chipů se skládají do „Zobrazit dalších X“,
- sjednocená CTA hierarchie: hlavní akce „Najít očkovací centrum“ i v map overlay.

Dokumentace změn:
- [TECHNIKA_A_FUNKCNOST_V20](docs/TECHNIKA_A_FUNKCNOST_V20.md)
- [OBSAH_UX_A_PRAVNI_V21](docs/OBSAH_UX_A_PRAVNI_V21.md)
