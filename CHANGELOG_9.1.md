# XAU App v9.1 — Sound, Costi Esecuzione e Guida H24

## Notifiche sonore
- Aggiunte notifiche sonore locali tramite Web Audio API.
- Configurazione nel pannello notifiche: audio on/off, volume, trade open, trade close, alert, BE/trailing/TP1.
- Pulsante "Test suono" per sbloccare l'audio dopo l'apertura dell'app.
- Suono locale attivato per apertura trade, chiusura trade, aggiornamenti di gestione e alert ricevuti dal service worker.
- Vibrazione mantenuta dove supportata dal dispositivo.

## Spread e slippage
- Spread e slippage sono ora entrambi applicati in modo esplicito e tracciabile.
- Parametri attuali:
  - spread fisso: 0.04 dollari;
  - slippage fisso: 0.02 dollari;
  - costo avverso per lato: spread/2 + slippage = 0.04 dollari.
- Entry BUY: prezzo segnale + costo lato.
- Entry SELL: prezzo segnale - costo lato.
- Exit BUY: prezzo trigger - costo lato.
- Exit SELL: prezzo trigger + costo lato.
- TP1 parziale, TP2, SL, SL_BE e trailing usano lo stesso modello di costo.
- Break-even corretto: lo stop BE viene impostato al livello necessario per compensare anche i costi di uscita.
- Lot size e rischio iniziale del backtest ora usano l'entry esecutiva, non il prezzo segnale grezzo.

## CSV e diagnostica
- CSV backtest ampliato con:
  - entrySignalPrice;
  - entry;
  - entryCost;
  - spread;
  - slippage;
  - exitSignalPrice;
  - exitPrice;
  - exitCost.
- Diagnostica app mostra i costi di esecuzione attivi.

## Background / H24
- Aggiunta guida `GUIDA_H24.md`.
- Cache PWA aggiornata a `xauapp-v9-1`.
