# Modifiche live-scenari v6 — 2026-07-06

## Live / paper automatico per scenario
- Aggiunta build visibile in header: `2026-07-06-live-scenarios-v6`.
- L'auto-entry live viene valutata quando il paper è ON anche fuori dal tab Score/Recap.
- Confermata e rinforzata la regola: massimo 1 trade aperto per scenario (`swing`, `trend`, `scalp`, `bias`).
- Cooldown indipendente per scenario con `lastSignalTsByScenario`, così uno slot non blocca gli altri.
- Ogni trade salva uno snapshot dei punteggi di tutti gli scenari in `scoreSnapshot.allScores`.
- Export paper più utile per audit dei segnali per scenario.

## Service worker / background
- Service worker aggiornato a `xauapp-v9-live-scenarios` per forzare refresh cache.
- In background il SW non usa più un solo slot `auto-bg`: apre slot reali per scenario.
- Gestione background multi-slot: monitoraggio, trailing, BE, TP1 parziale, TP2/SL per ogni scenario aperto.
- Il SW apre nuovi trade solo su scenari liberi e non duplica l'app quando la finestra è visibile.
- Risk sizing del SW ora legge `paperParams.riskPct`, non più solo il fallback fisso.

## Ottimizzazione
- Nel tab Storico/Ottimizzazione i parametri live comuni sono ora visibili nel pannello hub.
- Le card scenario mostrano soglia score, trailing ATR e pesi interni.
- Aggiunto input `Iterazioni annealing scenario` per scegliere quante iterazioni usare nell'annealing per singolo scenario.
- Se l'annealing globale o per scenario è migliorativo, `savePaperParams()` aggiorna parametri live, input backtest e service worker.
- Aggiunto parametro visibile `Trail Bias ×ATR` nei parametri backtest/live.

## Note operative
- Dopo installazione, controlla in alto la build `live-scenari v6`.
- Se non compare, il telefono sta ancora usando cache/PWA vecchia: rimuovere PWA, svuotare dati sito, reinstallare.
- Per usare il live automatico: attiva Paper Trading e, se vuoi gestione anche a schermo spento/background, attiva anche il monitoraggio background.
