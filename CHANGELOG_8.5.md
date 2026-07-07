# XAU/USD Analyzer — v8.5 data-normalizer

## Cambiamenti principali

### 1. Download separato dall’ottimizzazione
- Aggiunto tab dedicato **📥 Download & normalizzazione dati**.
- Il tab Backtest/Ottimizzazione non contiene più funzioni di download storico.
- La schermata è ora divisa logicamente:
  - **📥 Download** = dati, pulizia, export.
  - **🧪 Backtest/Ottimizzazione** = test e ottimizzazioni.

### 2. Normalizzazione dati backtest
- Nuovo flusso “Scarica e integra mancanti”.
- L’utente sceglie una **data di inizio**.
- Da quella data l’app scarica e integra XAU/USD:
  - 1D
  - 1H
  - 5M
  - 1M
- Le candele vengono:
  - unite con quelle già salvate,
  - deduplicate per timestamp,
  - ordinate cronologicamente,
  - filtrate dalla data di inizio,
  - salvate in IndexedDB/localStorage fallback.
- Aggiunto report gap interni anomali e avviso se il limite pagine non basta a raggiungere la data richiesta.

### 3. Generale solo backtest
- La sezione generale ora è **solo backtest**.
- Rimossa dalla UI l’ottimizzazione globale simulated annealing.
- Rimossi dalla UI generale sweep, sanity e ottimizzazioni miste.
- Il backtest generale non modifica parametri né pesi.

### 4. Ottimizzazioni solo per scenario
- Le ottimizzazioni restano solo nello spazio scenario:
  - backtest isolato scenario,
  - ottimizzazione parametri scenario,
  - ottimizzazione pesi interni scoring,
  - annealing intrascenario parametri+pesi.
- L’hub scenario mostra parametri live, ultimo risultato e miglior risultato locale.

### 5. Salvataggio locale oggettivo
- Aggiunto storage locale `xauapp_scenario_opt_state`.
- Per ogni scenario vengono salvati:
  - ultimo risultato,
  - ultimi parametri usati,
  - miglior risultato locale,
  - pesi associati,
  - stato applicato/non applicato.
- Mantenuta compatibilità con `xauapp_opt_results`.

### 6. PWA/cache
- Service worker aggiornato a cache `xauapp-v8-5` per forzare refresh della build.
