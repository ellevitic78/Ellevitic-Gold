# XAU App v8.6 — Scenario Execution Timeframes

## Regola strutturale backtest

La verifica operativa dei trade è ora vincolata al timeframe dello scenario:

- **Scalp**: entry, SL/TP, trailing ed exit verificati su candele **1M**.
- **Swing**: entry, SL/TP, trailing ed exit verificati su candele **5M**.
- **Trend**: entry, SL/TP, trailing ed exit verificati su candele **1H**.
- **Bias**: mantenuto su **1H**.

Lo scoring può continuare a usare il contesto multi-timeframe disponibile, ma il prezzo operativo del trade non viene più preso automaticamente dalla 1H per tutti gli scenari.

## Backtest generale

- Modalità AUTO aggiornata:
  - gamba Trend/Bias su 1H;
  - gamba Swing su 5M;
  - gamba Scalp su 1M.
- I risultati vengono poi unificati in un report unico ordinato cronologicamente.
- Le card risultati mostrano il timeframe operativo per scenario.

## Ottimizzazioni per scenario

- Backtest isolato scenario, ottimizzazione parametri, ottimizzazione pesi e annealing usano ora il timeframe operativo dello scenario:
  - Swing → 5M;
  - Trend/Bias → 1H;
  - Scalp → 1M.

## Setup trade

- Entry, SL strutturale, ATR di ingresso, TP1/TP2 e anti-chase sono calcolati dal timeframe operativo dello scenario.
- Nei trade viene salvato `execTf` per rendere tracciabile il timeframe di verifica.
- Export CSV backtest aggiornato con `execTf` e `verifyRule`.

## PWA

- Cache service worker aggiornata a `xauapp-v8-6`.
