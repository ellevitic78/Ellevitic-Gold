# XAU App v9.3 — 15M History / AsiaGapNN Data Prep

## Perché
Per lo scenario futuro **AsiaGapNN** serve una serie intermedia più lunga del 5M/1M ma più strutturale dell'1H. Il 15M è il compromesso migliore per modellare il passaggio America→Asia senza saturare lo storage come il minuto.

## Novità
- Aggiunto timeframe **XAU/USD 15M** al download normalizzato.
- La normalizzazione core ora può integrare: **1D, 1H, 15M, 5M, 1M**.
- Aggiunta serie storage `xauusd_15m` in IndexedDB/localStorage fallback.
- Aggiunto pulsante legacy/emergenza **15M lungo** per scaricare molte pagine storiche 15M con `end_date` progressivo.
- Aggiunti tag e conteggi 15M nella lista serie salvate/export storico.
- `histIntervalMs()` ora riconosce `15min`, quindi i gap interni vengono diagnosticati correttamente.

## Uso consigliato
Per AsiaGapNN scarica:
- 15M lungo da almeno 1-2 anni, se Twelve Data lo consente;
- 1H e 1D dallo stesso periodo;
- 5M/1M solo sul periodo più recente necessario alla verifica microstrutturale.

Il 15M non cambia ancora le regole operative di Scalp/Swing/Trend. È preparazione dati per il nuovo scenario di forecast America→Asia.
