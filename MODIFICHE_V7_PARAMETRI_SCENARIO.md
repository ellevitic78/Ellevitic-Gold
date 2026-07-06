# Modifiche v7 — ottimizzazioni per scenario e snapshot completo parametri

Data: 2026-07-06

## Obiettivo
Le ottimizzazioni per scenario, quando migliorative, non devono più salvare solo il delta del singolo scenario: devono risincronizzare l'intero set parametri usato da live, backtest e service worker.

## Modifiche applicate

- Build aggiornata a `2026-07-06-live-scenarios-v7`.
- Service worker aggiornato a cache `xauapp-v10-live-scenarios-v7`.
- Aggiunto helper `paperParamsSnapshot(overrides)` per creare uno snapshot completo dei parametri.
- Aggiunto helper `applyOptimizedParams(overrides, meta)`:
  - fonde override + parametri esistenti + default;
  - salva tutto in `xauapp_live_params`;
  - aggiorna input UI/backtest;
  - aggiorna il service worker con `UPDATE_CONFIG`;
  - mantiene un piccolo log locale `xauapp_param_apply_log` degli ultimi auto-apply.
- `savePaperParams()` ora salva sempre uno snapshot completo, non un delta parziale.
- Annealing globale: se migliorativo, applica lo snapshot completo live/backtest/SW.
- Annealing per scenario: ora ottimizza anche parametri comuni di gestione:
  - `minConf`
  - `beRR`
  - `trailRR`
  - `partialPct`
  oltre a soglia/trailing dello scenario e pesi interni dello scenario.
- Ottimizzazione per scenario “coordinate descent”: ora valuta anche i parametri comuni sopra, non solo soglia/trailing dello scenario.
- Ottimizzazione pesi: se migliorativa, aggiorna i pesi e riscrive anche lo snapshot completo parametri per riallineare live/backtest/SW.
- Testo UI aggiornato per chiarire che l'auto-apply migliorativo salva l'intero snapshot parametri.

## Scelte intenzionali

- `riskPct` non viene ottimizzato automaticamente: ottimizzarlo spinge quasi sempre solo ad aumentare leva/rischio.
- `spread` e `slippage` non vengono ottimizzati: sono costi/assunzioni di mercato da impostare, non edge da cercare.
- Gli scenari restano isolati per il test, ma i parametri comuni migliorativi vengono propagati globalmente perché incidono sulla gestione live/backtest.

## Controlli eseguiti

- `node --check` sullo script estratto da `index.html`.
- `node --check` su `sw.js`.
- Integrità ZIP verificata con `unzip -t`.
