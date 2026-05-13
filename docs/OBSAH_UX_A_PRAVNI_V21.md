# Vakcinační mapa světa – obsah, UX a právní sdělení (v21)

Datum: 2026-05-13  
Rozsah: zlepšení informovanosti klienta, právní srozumitelnosti, čitelnosti obsahu a snížení kognitivní zátěže.

## 1) Cíl změn

Tato sada úprav řeší tři hlavní oblasti:

1. Právní a obsahová jasnost: aplikace je orientační, nenahrazuje lékaře.
2. Uživatelské vedení: rychle pochopit, jak mapu číst a co dělat dál.
3. Čitelnost a přehlednost: lepší kontrast, větší drobné texty, méně zahlcení chipy.

---

## 2) Implementované změny

### 2.1 Nový informační blok nad mapou (`index.html`, `map.css`)

Přidána sekce `info-hub` s 5 praktickými prvky:

1. **Výrazné právní upozornění (`.legal-alert`)**
   - Text explicitně říká:
     - doporučení se liší podle délky pobytu, regionu, stylu cestování a zdravotního stavu,
     - aplikace slouží pouze orientačně,
     - finální doporučení patří lékaři.

2. **Mini návod „Jak mapu používat (3 kroky)”**
   - výběr destinace,
   - kontrola kategorií povinná/základní/doporučená,
   - rezervace konzultace v očkovacím centru.

3. **Stručné vysvětlení kategorií očkování**
   - povinná,
   - základní,
   - doporučená.

4. **Textové vysvětlení barev mapy**
   - aktivní výběr,
   - dostupný detail,
   - bez detailu / mimo filtr.

5. **Praktická sekce „Po návštěvě…” + stručné FAQ**
   - co si připravit na konzultaci,
   - co ověřit před odletem,
   - základní odpovědi na nejčastější dotazy.

Dopad:
- klient má důležité informace ihned při prvním zobrazení,
- výrazně nižší riziko mylného dojmu, že jde o finální individuální plán.

---

### 2.2 Ujasnění „destinační základ, ne finální plán” v detailu

#### Detail panel pod mapou (`renderPanel`)
- Intro text byl upraven tak, aby explicitně říkal:
  - jde o orientační přehled,
  - finální plán musí potvrdit lékař.

#### Overlay přímo v mapě (`renderMapInfo`)
- Rychlý text pod badge nyní říká:
  - přehled je destinační základ,
  - finální doporučení vždy potvrdit při lékařské konzultaci.

Dopad:
- stejná message v obou klíčových místech, menší obsahová nejednoznačnost.

---

### 2.3 Jedna jasná hlavní akce (CTA prioritizace)

#### Detail panel pod mapou
- Primární CTA: **Najít očkovací centrum**
- Sekundární CTA: **Zjistit více o zemi**

#### Mapový overlay
- Primární CTA: **Najít očkovací centrum**
- Sekundární CTA: **Otevřít detail země**
- Terciární akce: **Zobrazit detail níže** (scroll do panelu)

Dopad:
- jasnější cesta k cíli (objednání/konzultace),
- menší rozhodovací únava.

---

### 2.4 Snížení kognitivní zátěže u velkého počtu položek

#### Detail panel (`sectionPillsHtml`)
- U dlouhých seznamů se nově zobrazí jen první sada položek.
- Zbytek je schovaný za `<details>`:
  - „Zobrazit dalších X”.

Dopad:
- uživatel není zahlcen dlouhým blokem chipů,
- rychleji se zorientuje v prioritách.

---

### 2.5 Čitelnost, kontrast a mobilní čtení (`map.css`)

Provedené úpravy:

1. Zvýšení drobných textů (`10–11px` -> `11–12px`) na citlivých místech:
   - `fstatus`, `ftnote`,
   - badge/pill tlačítka v map overlay.
2. Zlepšení kontrastu sekundárních textů:
   - tmavší odstíny šedozelené místo velmi světlých tónů.
3. Mobilní úpravy info bloků:
   - lepší spacing,
   - stabilnější řádkování a čitelnější summary/obsah v `<details>`.

Dopad:
- vyšší čitelnost na telefonu,
- lepší dostupnost pro běžné čtecí podmínky.

---

## 3) Přehled upravených souborů

1. `index.html`
   - přidána sekce `info-hub` (právní upozornění, mini návod, vysvětlivky, FAQ).

2. `assets/css/map.css`
   - styly pro `info-hub` a jeho části,
   - úpravy kontrastu a velikostí drobných textů,
   - styly pro rozbalitelné „dalších X” chipů,
   - styl `.mi-btn.ghost` pro terciární akci v map overlay.

3. `assets/js/app.js`
   - `sectionPillsHtml()` pro redukci zahlcení chipy,
   - `renderPanel()` CTA prioritizace a orientační disclaimer,
   - `renderMapInfo()` sjednocení právní message + CTA hierarchie.

---

## 4) Kontrolní checklist po nasazení

1. Nová info sekce se zobrazuje nad mapou na desktopu i mobilu.
2. Text „nenahrazuje lékaře” je vidět bez nutnosti otevírat detail destinace.
3. V overlay i v detail panelu je hlavní CTA „Najít očkovací centrum”.
4. Dlouhé seznamy očkování/rizik se skládají do „Zobrazit dalších X”.
5. Na mobilu jsou sekundární texty čitelné bez zoomu stránky.
6. FAQ a vysvětlivky nejsou obsahově v rozporu s detail texty v panelu.

---

## 5) Doporučené navazující kroky

1. Přidat „Naposledy aktualizováno” (datum verze dat/API) pro vyšší důvěryhodnost.
2. Otestovat kontrast podle WCAG (AA) u všech sekundárních textů a badge.
3. Vytvořit krátkou právní mikrostránku „Jak tento přehled používat” a odkazovat ji z FAQ.
4. Doplnit analytiku kliků:
   - CTA „Najít očkovací centrum”,
   - otevření FAQ,
   - rozbalení „Zobrazit dalších X”.

