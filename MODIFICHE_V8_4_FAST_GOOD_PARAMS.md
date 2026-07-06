# v8.4 — Fast good params

Base: `xauapp_v8_3_2_parametri_csv.zip`.

## Parametri live iniziali
Caricato come profilo iniziale il set migliore dallo screenshot 13:45 — gamba Scalp 1M inclusa:

- `thrSwing`: 70
- `thrTrend`: 66
- `thrBias`: 69
- `minConf`: 35
- `beRR`: 0.4
- `trailRR`: 1.3
- `trailSwing`: 2
- `trailTrend`: 2
- `partialPct`: 65
- `thrScalp`: 56
- `trailScalp`: 0.4

Pesi interni Scalp 1M iniziali:

- `macro`: ×2
- `mtf`: ×0
- `adx`: ×0
- `rsi`: ×2
- `pivot`: ×1.25

## Velocizzazione backtest / annealing

- Cache in RAM di `histLoad`, per evitare letture ripetute da IndexedDB/localStorage durante le iterazioni.
- Cache runtime delle serie già arricchite (`btEnrich`) e aggregate 5M/1H/4H/Daily, riusate tra iterazioni con stessi dati e stesso `maxBars`.
- Sostituito lo slicing temporale lineare ripetuto con cursori incrementali e binary-search di fallback.
- L'annealing globale ora usa uno snapshot completo dei parametri backtest (`btParamsFromSnapshot`) includendo spread, slippage, fixedRisk e percentuali coerenti.

## Nota
La velocizzazione non cambia intenzionalmente la logica di scoring o di entrata/uscita. Riduce ricalcoli identici che prima venivano ripetuti a ogni iterazione.
