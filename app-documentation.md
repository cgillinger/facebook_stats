# Facebook Statistik - Systemdokumentation

## Systemöversikt

Facebook Statistik är en klientsideapplikation som låter användare analysera och visualisera statistik från Facebook-inlägg. Applikationen är helt webbaserad och kör all logik i webbläsaren utan att skicka data till någon server. Den är byggd med React, Vite och TailwindCSS, och använder ShadcnUI-komponenter för användargränssnittet.

### Kärnfunktionalitet

- **Importera Facebook-statistik** från CSV-filer exporterade från Meta Business Suite
- **Visualisera data** i olika perspektiv (per konto, per inlägg, per inläggstyp)
- **Filtrera och sortera** statistikdata
- **Exportera analyser** till CSV eller Excel
- **Anpassa kolumnmappningar** för att hantera ändringar i Meta:s exportformat
- **Minneshantering** för att kontrollera hur mycket data som kan laddas in i webbläsaren

### Teknisk arkitektur

Applikationen är utvecklad som en Single Page Application (SPA) och använder:

- **React 18** som UI-bibliotek
- **Vite** som byggsystem
- **TailwindCSS** för styling
- **ShadcnUI** för komponentbibliotek
- **PapaParse** för CSV-parsning
- **SheetJS (XLSX)** för Excel-export
- **LocalStorage och IndexedDB** för datalagring

Appen är designad för att köras både direkt i webbläsaren och som en desktopapplikation via Electron. För att stödja detta används en Electron API-emulator som ersätter Electron's IPC med webbläsarens API:er när appen körs i en webbkontext.

## Kodstruktur

### Huvudkomponenter

- `src/index.jsx`: Applikationens ingångspunkt
- `src/renderer/App.jsx`: Huvudapplikationskomponent som hanterar initialiseringen
- `src/renderer/components/MainView/MainView.jsx`: Central vy som styr navigering mellan olika datavisningar
- `src/renderer/components/FileUploader/FileUploader.jsx`: Komponent för filuppladdning och databearbetning
- `src/renderer/components/AccountView/AccountView.jsx`: Vy för per konto-statistik
- `src/renderer/components/PostView/PostView.jsx`: Vy för per inlägg-statistik
- `src/renderer/components/PostTypeView/PostTypeView.jsx`: Vy för statistik grupperad efter inläggstyp
- `src/renderer/components/ColumnMappingEditor/ColumnMappingEditor.jsx`: Editor för att anpassa kolumnmappningar
- `src/utils/webDataProcessor.js`: Kärnfunktionalitet för databearbetning
- `src/utils/webStorageService.js`: Hantering av datalagring i webbläsaren
- `src/utils/electronApiEmulator.js`: Emulerar Electron API i webbläsaren

### Datastrategi

- **LocalStorage**: Används för konfiguration och mindre datamängder (kolumnmappningar)
- **IndexedDB**: Används för större datamängder (inläggs- och kontodata)
- **Minnessäkerhet**: Applikationen övervakar minnesanvändning och varnar användare när gränser närmar sig

## Komponentbeskrivningar

### Kärnmoduler

#### `src/utils/electronApiEmulator.js`
Denna modul simulerar Electron IPC API:er i webbläsarkontext. Den exponerar funktioner som `readFile`, `writeFile`, `openExternalLink`, `exportToExcel`, och `exportToCSV`. Möjliggör att samma kod kan användas i både webbläsaren och Electron.

#### `src/utils/webStorageService.js`
Hanterar all datalagring i webbläsaren med både localStorage och IndexedDB. Ansvarar för läsning, skrivning och rensning av data, samt hantering av fil- och statistikmetadata.

#### `src/utils/webDataProcessor.js`
Bearbetar CSV-data som laddats upp av användaren. Hanterar parsing, normalisering, och transformering av data. Innehåller logik för att detektera och filtrera dubletter, mappning av kolumnnamn, och beräkning av sammanfattande statistik.

#### `src/utils/memoryUtils.js`
Tillhandahåller verktyg för att övervaka och hantera minnesanvändning. Definierar tröskelvärden för varningar, uppskattar tillgängligt lagringsutrymme, och beräknar hur mycket data som kan läggas till.

### Användarinterface-komponenter

#### `src/renderer/App.jsx`
Huvudapplikationskomponenten som initierar appen och hanterar övergripande tillstånd. Renser data vid appstart, kontrollerar minnesanvändning, och orkestrerar dataflöde mellan andra komponenter.

#### `src/renderer/components/FileUploader/FileUploader.jsx`
Ansvarar för filuppladdning och första steget av databearbetning. Tillhandahåller drag-and-drop gränssnitt, filvalidering, kolumnvalidering, och minneskontroll innan databearbetning.

#### `src/renderer/components/MainView/MainView.jsx`
Central navigeringskomponent som låter användare växla mellan olika datavisningar (konto/inlägg/inläggstyp), välja vilka värden som ska visas, och hantera datahanteringsaktiviteter som att lägga till eller återställa data.

#### `src/renderer/components/AccountView/AccountView.jsx`
Visar statistik per Facebook-konto. Hanterar sortering, paginering, och export. Beräknar statistiska sammanfattningar (summa, medelvärde, etc.) för varje konto.

#### `src/renderer/components/PostView/PostView.jsx`
Visar statistik per inlägg med detaljerad information. Stödjer filtrering per konto, sortering på alla kolumner, och paginering för stora datamängder.

#### `src/renderer/components/PostTypeView/PostTypeView.jsx`
Analyserar och visualiserar statistik grupperad efter inläggstyp (bilder, länkar, videor, etc.). Inkluderar diagram och beräknar genomsnitt för olika parametrar per inläggstyp.

#### `src/renderer/components/ColumnMappingEditor/ColumnMappingEditor.jsx`
Tillåter användare att konfigurera hur kolumner i uppladdade CSV-filer ska mappas till interna fältnamn. Detta är viktigt för att hantera ändringar i exportformat från Meta över tid.

#### `src/renderer/components/MemoryIndicator/MemoryIndicator.jsx`
Visar aktuell minnesanvändning och uppskattar hur mycket mer data som kan läggas till innan gränser nås. Inkluderar statusfärger och varningar vid högt minnesutnyttjande.

#### `src/renderer/components/LoadedFilesInfo/LoadedFilesInfo.jsx`
Visar information om redan uppladdade filer och tillåter användare att ta bort enstaka filer eller rensa all data.

### Support-komponenter

#### `src/renderer/components/ColumnMappingEditor/columnMappingService.js`
Tillhandahåller tjänster för att hantera kolumnmappningar, inklusive läsning, skrivning, normalisering, och validering. Innehåller standardmappningar och displaynamn för fält.

#### `src/renderer/components/FileUploader/useColumnMapper.js`
Custom React-hook som hanterar kolumnvalidering vid filuppladdning. Kontrollerar att CSV-filer innehåller nödvändiga kolumner baserat på konfigurerade mappningar.

### UI-komponenter (shadcn/ui)

I `src/renderer/components/ui/` finns flera basgränssnittskomponenter baserade på shadcn/ui-biblioteket, inklusive:
- `alert.jsx`: Visar viktiga meddelanden och notifieringar
- `button.jsx`: Knappar med olika stilar
- `card.jsx`: Kortkomponent för att gruppera innehåll
- `checkbox.jsx`: Kryssrutor
- `input.jsx`: Inmatningsfält
- `label.jsx`: Etiketter för formulärelement
- `select.jsx`: Valkomponenter (dropdowns)
- `switch.jsx`: Toggle-knappar
- `table.jsx`: Tabellkomponenter
- `tabs.jsx`: Flikhantering

## Dataflöde

1. **Dataimport**: CSV-filer laddas upp via `FileUploader`
2. **Datavalidering**: Kolumner valideras mot konfigurerade mappningar
3. **Databearbetning**: `webDataProcessor` analyserar och transformerar data
4. **Datalagring**: `webStorageService` sparar bearbetad data
5. **Visualisering**: Data visas i `AccountView`, `PostView`, eller `PostTypeView`
6. **Interaktion**: Användare filtrerar, sorterar och navigerar genom data
7. **Export**: Analysdata kan exporteras till CSV eller Excel

## Minneshantering

Applikationen har ett robust system för minneshantering:

1. Data lagras i både localStorage (små datamängder) och IndexedDB (större dataset)
2. `MemoryIndicator` övervakar minnesanvändning och visar varningar vid höga nivåer
3. `memoryUtils` gör sannolikhetsbedömningar av hur mycket data som kan läggas till
4. `webStorageService` implementerar fallback-mekanismer och error-hantering
5. Användarvarningar visas när tillgängligt minne närmar sig gränser

## Utökningsstrategier

För att vidareutveckla appen, överväg följande områden:

1. **Utökad dataanalys**: Implementera fler statistiska beräkningar och visualiseringar
2. **Stöd för fler datakällor**: Lägg till support för andra Meta-plattformar (Instagram, WhatsApp)
3. **Förbättrad minneshantering**: Implementera dataregionalisering och selektiv laddning
4. **Offline-synkronisering**: Spara användarinställningar mellan sessioner
5. **Exportanpassning**: Tillåt anpassade exportformat och visualiseringar
6. **API-integration**: Lägg till direkt API-anslutning till Meta:s datakällor
7. **Molnbackup**: Möjlighet att spara data i molnet för senare användning

## Kända begränsningar

1. **Minnesbegränsningar**: Webbläsarlagring har inneboende begränsningar
2. **CSV-format**: Appen är anpassad för Facebook-exportformat som kan ändras
3. **Prestanda**: Stora datamängder kan orsaka prestandaproblem
4. **Inget serverstöd**: Alla beräkningar måste ske på klientsidan
5. **Begränsade visualiseringar**: Diagramtyperna är begränsade till vad som implementerats