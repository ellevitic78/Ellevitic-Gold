# XAU App v9.2 — Scalp Presets / rollback parametri

## Perché
L'ottimizzazione Scalp può produrre molti parametri e pesi interni; modificarli a mano dalla UI è scomodo e rischioso. Questa versione aggiunge preset applicabili in un click.

## Novità
- Nuovo pannello **⚡ Preset rapidi Scalp** nel tab Backtest/Ottimizzazione.
- Pulsante **Ripristina Scalp robusto** per applicare il candidato precedente:
  - `thrScalp = 75`
  - `minConf = 31`
  - `riskPct = 5`
  - `beRR = 0.3`
  - `trailRR = 1.8`
  - `trailScalp = 0.9`
  - `partialPct = 20`
  - pesi Scalp: macro 1.5, mtf 1.25, adx 1.75, rsi 1.25, pivot 1.5, pullback 0.5, specific 1.75, sess 1.0.
- Pulsante **Preset base app** per tornare a un set non ottimizzato aggressivamente.
- Backup automatico prima di ogni applicazione preset.
- Pulsante **Annulla ultimo preset** per ripristinare il backup locale precedente.
- Export del preset Scalp attuale in JSON.
- Import JSON di preset Scalp riapplicabile.

## Note operative
Il preset completo modifica anche parametri globali di esecuzione (`minConf`, `riskPct`, `beRR`, `trailRR`, `partialPct`) perché nel motore attuale sono condivisi tra scenari. Per riprodurre il vecchio risultato Scalp non basta cambiare solo `thrScalp` e `trailScalp`.

## Cache
- Service Worker aggiornato a `xauapp-v9-2`.
