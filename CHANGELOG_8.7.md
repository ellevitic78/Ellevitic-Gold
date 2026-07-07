# XAU App v8.7 — Optimization start date + auto data sync

## Obiettivo
Rendere le ottimizzazioni ripetibili e coerenti su un dataset normalizzato da una data scelta, evitando che ogni scenario lavori su un numero arbitrario di barre.

## Novità principali

- Aggiunta **Data inizio ottimizzazione** nel tab Backtest/Ottimizzazione.
- Le ottimizzazioni scenario ora usano **tutte le barre disponibili dalla data scelta in avanti**.
- Prima di lanciare Test scenario, Param, Pesi, Intra-SA, Sweep e Sanity Check, l'app può fare auto-sync dati.
- Auto-sync dati pre-ottimizzazione su tutte le serie core:
  - XAU/USD 1D
  - XAU/USD 1H
  - XAU/USD 5M
  - XAU/USD 1M
- Lo scarico automatico integra/deduplica/ordina le candele e salva in locale.
- Se il dataset è già coperto dalla data scelta ed è sufficientemente recente, lo skip viene fatto automaticamente.
- I risultati salvati per scenario registrano anche la data inizio ottimizzazione.

## Regola operativa confermata

- Scalp: verifica trade su 1M.
- Swing: verifica trade su 5M.
- Trend: verifica trade su 1H.
- Bias: verifica su 1H.

Lo scoring può continuare a leggere contesto multi-timeframe, ma entry, exit, SL, TP, trailing e ATR operativo restano legati al timeframe dello scenario.

## Backtest generale

Il Backtest Generale resta solo backtest: non scarica automaticamente dati e non ottimizza. Continua a usare il numero barre selezionato nella UI.

## Cache PWA

Service worker aggiornato a `xauapp-v8-7`.
