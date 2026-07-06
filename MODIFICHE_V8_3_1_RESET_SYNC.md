# v8.3.1 — Reset ottimizzazioni + profilo CSV ieri + sync oggettivo

Questa build nasce per eliminare le incoerenze viste tra annealing, risultati mostrati, parametri live/backtest e service worker.

## Reset automatico
Al primo avvio della build `2026-07-06-live-scenarios-v8-3-1-reset-sync-csv-ieri` vengono azzerati:

- `xauapp_opt_results`
- `xauapp_param_apply_log`

Il reset non tocca gli storici scaricati (`xauapp_hist_*`) né il paper ledger.

## Profilo parametri CSV ieri
Vengono caricati come baseline i parametri incorporati nella build v8.1 che ha prodotto il CSV di ieri:

- `thrSwing: 54`
- `thrTrend: 74`
- `thrScalp: 62`
- `thrBias: 72`
- `minConf: 60`
- `riskPct: 5.0`
- `beRR: 0.4`
- `trailRR: 0.4`
- `trailSwing: 2.7`
- `trailTrend: 1.4`
- `trailScalp: 0.8`
- `trailBias: 1.0`
- `partialPct: 15`
- `spread: 0.04`
- `slippage: 0.02`

Nota: il CSV contiene trade e ledger, non contiene soglie/trailing/pesi. Dal CSV si ricavano direttamente risk/spread/slippage; le altre soglie sono quindi il profilo v8.1 incorporato, non parametri deducibili dal CSV stesso.

## Sync oggettivo parametri
Nel tab Ottimizzazione appare un pannello `SYNC PARAMETRI` con hash di controllo per:

- live in memoria (`PAPER_PARAMS`)
- `localStorage`
- input UI/backtest
- service worker, quando risponde al PING

Se gli hash coincidono, i livelli stanno usando la stessa configurazione.

## Pulsanti aggiunti
Nel tab Ottimizzazione:

- `Reset risultati + profilo CSV ieri`
- `Salva UI → live/backtest/SW`

## Ledger multi-gamba
Nei backtest combinati viene ricostruito un capitale portfolio unico ordinato per chiusura trade, evitando la confusione tra capitale della gamba 1H/5M/1M e capitale complessivo.

Nuova colonna CSV:

- `legCapitalAfter`

`portfolioCapitalAfter` ora rappresenta il capitale unificato del portafoglio nel CSV combinato.
