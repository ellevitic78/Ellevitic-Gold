# XAU/USD Analyzer — v8.4 param-csv

## Correzioni principali

- Il CSV backtest ora esporta anche snapshot dei parametri, pesi interni, versione app, scenario e sorgente del risultato.
- Anche il CSV paper trading salva lo snapshot dei parametri al momento dell'apertura del trade.
- L'hub scenario mostra live vs snapshot del risultato e segnala quando un risultato salvato non è più coerente con i parametri live.
- Aggiunto pulsante per azzerare solo i risultati/riassunti delle ottimizzazioni senza toccare i parametri live.
- I salvataggi di parametri e pesi aggiornano subito localStorage, input UI e hub scenario.
- Le iterazioni dell'annealing per scenario sono ora personalizzabili, non più bloccate a 40/60.
- Aumentato il limite massimo delle iterazioni globali a 1000.
- Estesi i range esplorabili di soglie/trailing/min confidence/parziali.
- Raffreddamento simulated annealing reso più coerente: temperatura geometrica e perturbazioni progressivamente più piccole.
- Fix 1M/Scalp: ATR di ingresso nel backtest usa l'ultima candela 5M disponibile al timestamp storico, non un indice non allineato.
- Backtest complessivo con gamba Scalp usa le barre 1M selezionate invece del limite fisso 60.000.
- Migrazione parametri non distruttiva: un cambio versione non cancella più i parametri ottimizzati già salvati.
- Aggiornato cache name del service worker per forzare refresh della PWA.

## Nota sul CSV caricato

Il file `backtest_2026-07-05 (3).csv` contiene trade, P&L e statistiche operative, ma non contiene colonne con parametri o pesi. Quindi non è possibile ricostruire con certezza i parametri usati in quel backtest. La v8.4 risolve il problema per tutti i prossimi export.
