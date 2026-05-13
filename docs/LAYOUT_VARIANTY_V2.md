# Režimy zobrazení mapy (varianta 1 + varianta 2)

Datum: 2026-05-13

## Co přibylo

Aplikace má nyní 2 režimy zobrazení:

1. `Aktuální zobrazení` (původní)
- mapa + overlay v mapě,
- detailní panel pod mapou.

2. `Krokové zobrazení` (nová varianta)
- na desktopu (>=1100 px): 2 sloupce,
  - vlevo mapa,
  - vpravo sticky stručný 3krokový souhrn.
- na menší šířce zůstává aktivní původní rozložení (s informační poznámkou).

## Ovládání

- Přepínač je nad mapou v bloku `Režim zobrazení`.
- Volba se ukládá do `localStorage` pod klíčem:
  - `avenierMapLayoutModeV1`

## Technická implementace

### HTML
- přidán přepínač:
  - `#layout-toggle`
  - `#layout-note`
- přidán kontejner pro sticky souhrn:
  - `#flow-side`

### CSS
- nový grid režim pro desktop:
  - `.main.main-guided`
- sticky pravý panel:
  - `.main.main-guided #flow-side`
- fallback pod 1100 px:
  - `.main.main-guided` se vrací na blokové rozložení

### JS
- režim:
  - `layoutMode = 'classic' | 'guided'`
- klíč persistence:
  - `LAYOUT_MODE_KEY = 'avenierMapLayoutModeV1'`
- hlavní funkce:
  - `setupLayoutToggle()`
  - `setLayoutMode()`
  - `applyLayoutMode()`
  - `renderFlowSide()`
  - `clearFlowSide()`

## UX rozdíl proti původní variantě

Původní varianta:
- uživatel často střídá mapu a obsah pod mapou,
- více vertikálního pohybu na desktopu.

Kroková varianta:
- souhrn „co udělat teď“ je stále vedle mapy,
- CTA (`Najít očkovací centrum`) je trvale na očích,
- menší kognitivní zátěž, protože flow je explicitní:
  - `Vyber destinaci` -> `Zkontroluj očkování` -> `Pokračuj na centrum/detail`.

## Kontrolní scénáře

1. Desktop >=1100 px:
- přepnout na krokový režim,
- vybrat destinaci,
- ověřit sticky panel vpravo + scroll detailu tlačítkem.

2. Mobil / tablet <1100 px:
- přepnout na krokový režim,
- ověřit, že se ukáže poznámka o desktop režimu,
- layout zůstane stabilní.

3. Persistence:
- změnit režim,
- obnovit stránku,
- režim zůstane zachovaný.
