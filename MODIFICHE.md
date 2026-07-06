# Modifiche applicate - XAU Paper Trading App

Data: 2026-07-06

## Regola operativa preservata

La logica voluta resta: **massimo un trade aperto per ogni scenario**. Non è più trattata come anomalia. L'app ora gestisce esplicitamente slot indipendenti per scenario, invece di bloccare tutto il paper trading quando esiste già un singolo trade aperto.

## Migliorie principali

1. **Ledger e capitale più auditabili**
   - Aggiunti `capitalBefore`, `capitalBeforeClose`, `portfolioCapitalAfter`, `standaloneCapitalAfter` e `reconciliationDelta`.
   - Separati `partialPnl`, `finalPnl`, `pnlEur` e `pnlTotal`.
   - Aggiunti `slInitial`, `slFinal`, `tp1Initial`, `tp2Initial`, `tp2Final`, `lotsInitial`.
   - Il CSV ora consente di riconciliare meglio capitale, PnL parziale e PnL finale.

2. **Slot multipli coerenti**
   - `openTrades` viene salvato e ripristinato da localStorage.
   - `openTrade` resta come compatibilità legacy, sincronizzato dal primo slot aperto.
   - I pulsanti/manual entry bloccano solo lo scenario già occupato, non tutti gli scenari.

3. **Spread e slippage configurabili**
   - Aggiunti parametri UI: `Spread $` e `Slippage $`.
   - Entry ed exit usano prezzi peggiorativi tramite `entryFill()` ed `exitFill()`.
   - Le stesse regole sono usate in paper live, backtest e service worker.

4. **Filtro sessione XAU/USD**
   - Aggiunto filtro prudenziale per evitare operatività da venerdì sera a domenica sera UTC.
   - Il backtest salta barre sintetiche/off-market e il paper trading non apre nuove operazioni durante il rischio weekend/pre-gap.

5. **TP1 parziale più coerente**
   - Il parziale usa `partialPct` configurabile.
   - Il log e le notifiche mostrano la percentuale reale invece di un 50% fisso.

6. **Service Worker aggiornato**
   - Cache bump a `xauapp-v8-ledger`.
   - Persistenza e gestione multi-slot anche in background.
   - Monitoraggio di tutti gli slot aperti, non solo del primo trade legacy.
   - Chiusure background con ledger completo e PnL totale.

7. **Export CSV arricchito**
   - Backtest e diario paper esportano più colonne operative e contabili.
   - Gli aggregati usano `pnlTotal` quando disponibile.

## Controlli effettuati

- `node --check` sul JavaScript estratto da `index.html`.
- `node --check` su `sw.js`.
- Test di integrità dello ZIP finale.

## Limiti noti

- Non è stata effettuata compilazione/installazione reale su dispositivo mobile.
- Il filtro orario XAU/USD è prudenziale e approssimato in UTC; per produzione va allineato esattamente agli orari del broker usato.
- Non sono ancora stati aggiunti walk-forward, out-of-sample esteso, simulazione news/slippage variabile o test tick-by-tick.
