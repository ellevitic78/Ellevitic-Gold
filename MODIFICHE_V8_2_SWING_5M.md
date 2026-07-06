# Modifiche v8.2 — Swing 5M operativo

Questa versione rende evidente e applica la modifica richiesta: lo scenario Swing può essere backtestato/valutato ogni 5 minuti, senza trasformarlo in scalp.

## Cosa cambia

- Build visibile aggiornata a `v8.2 SWING 5M`.
- Modalità backtest predefinita: `Ibrido — Swing 5M + Trend/Bias 1H`.
- Swing in backtest usa:
  - contesto H1/4H/Daily per tesi e filtri strutturali;
  - prezzo/trigger operativo M5 per ingresso;
  - gestione trade M5 per SL, TP1, TP2, BE e trailing.
- Trend e Bias restano su 1H nel backtest complessivo.
- Scalp resta su 1M opzionale, se lo storico 1M è presente.
- Annealing per scenario `Swing` ora usa `hybrid5m`.
- Ottimizzazione per scenario `Swing` ora usa `hybrid5m`.
- Ottimizzazione pesi interni `Swing` ora usa `hybrid5m`.
- Sanity check e annealing globale includono Swing 5M quando lo storico XAU 5M è disponibile.
- Service worker aggiornato a cache `xauapp-v14-live-scenarios-v8-2-swing-5m`.
- Nel service worker lo scenario Swing usa il prezzo 5M e un piccolo aggiustamento di trigger 5M, mantenendo la tesi basata sui timeframe alti.

## Nota tecnica

Lo Swing non è diventato scalp: la direzione resta filtrata da struttura 1H/4H/Daily, macro, RSI/MACD 1H, pivot e regime; il 5M serve per verificare più spesso se c'è un trigger operativo e per gestire il trade con maggiore precisione.
