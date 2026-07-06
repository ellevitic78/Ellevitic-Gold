# v8.3.2 — Parametri salvati nel CSV

Modifica richiesta: ogni export CSV deve contenere anche i parametri e i pesi usati per generare i trade/backtest.

## Cosa è stato aggiunto

- Build visibile aggiornata a `v8.3.2 PARAMETRI NEL CSV`.
- `APP_BUILD` aggiornato a `2026-07-06-live-scenarios-v8-3-2-parametri-csv`.
- Service worker aggiornato con cache nuova `xauapp-v17-live-scenarios-v8-3-2-parametri-csv`.
- Manifest aggiornato a `XAU/USD Analyzer v8.3.2 parametri nel CSV`.

## Export CSV backtest

Il CSV del backtest ora aggiunge, in fondo a ogni riga trade:

- `paramBuild`
- `paramProfile`
- `paramHash`
- `paramSource`
- tutti i parametri comuni/scenario:
  - `param_thrSwing`
  - `param_thrTrend`
  - `param_thrScalp`
  - `param_thrBias`
  - `param_minConf`
  - `param_riskPct`
  - `param_beRR`
  - `param_trailRR`
  - `param_trailSwing`
  - `param_trailTrend`
  - `param_trailScalp`
  - `param_trailBias`
  - `param_partialPct`
  - `param_spread`
  - `param_slippage`
- pesi interni per `swing`, `trend`, `scalp`:
  - `macro`, `mtf`, `adx`, `rsi`, `pivot`, `pullback`, `specific`, `sess`
- `paramsJSON`
- `weightsJSON`

Il backtest usa uno snapshot unico dei parametri preso all'avvio della run, così se la UI cambia dopo il test non cambia il CSV esportato.

## Export CSV paper/live

Anche il CSV del paper log ora salva i parametri. Per i nuovi trade viene salvato lo snapshot al momento dell'apertura del trade. Per trade vecchi senza snapshot, l'export usa i parametri correnti come fallback e lo segnala con `paramSource = paper_export_current`.

## Hash di controllo

`paramHash` permette di verificare se due backtest/trade sono stati generati con lo stesso set parametri + pesi. Se cambia anche un solo parametro o peso, cambia l'hash.
