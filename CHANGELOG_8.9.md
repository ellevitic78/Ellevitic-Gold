# CHANGELOG v8.9 — General Start + Checkpoint + Fast Backtest

## Backtest Generale per data
- Aggiunta **Data inizio backtest generale** nel tab Backtest/Ottimizzazione.
- Il Backtest Generale ora usa tutte le barre normalizzate dalla data scelta in avanti.
- Il vecchio selettore numero barre resta come fallback se la data viene svuotata.
- Aggiunta preparazione dati opzionale prima del Backtest Generale: controllo e integrazione mancanti su XAU/USD 1D, 1H, 5M e 1M.
- Il Generale resta solo backtest: nessuna ottimizzazione viene eseguita in quella sezione.
- Report del Backtest Generale arricchito con periodo e numero barre per scenario/timeframe operativo.

## Capitalizzazione progressiva dei miglioramenti
- Le ottimizzazioni scenario ora salvano checkpoint locali quando trovano un miglioramento affidabile durante la simulazione.
- I checkpoint vengono salvati anche se la simulazione non arriva alla fine.
- Il miglior risultato locale nel hub scenario può essere applicato manualmente ai parametri/pesi live.
- I checkpoint rispettano vincoli minimi: P&L superiore alla baseline, PF almeno 1.05 e campione minimo sufficiente.

## Riduzione tempi senza cambiare la logica del test
- Introdotta cache in memoria per le serie arricchite con RSI/MACD/ATR durante backtest e ottimizzazioni.
- Sostituita la scansione lineare dei contesti multi-timeframe con ricerca binaria per timestamp.
- Aggiunta funzione di tail-slice diretto: durante il loop vengono estratte solo le ultime N barre necessarie, non tutta la serie fino al timestamp.
- Nessuna scorciatoia statistica sui risultati finali: ogni configurazione validata viene ancora backtestata sul periodo richiesto.

## Cache PWA
- Service worker aggiornato a `xauapp-v8-9`.
