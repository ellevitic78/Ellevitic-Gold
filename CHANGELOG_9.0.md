# XAU App v9.0 — Portfolio Rigore

## Correzione errore Backtest Generale
- Il Backtest Generale non viene più presentato come una singola equity curve quando unisce scenari testati separatamente.
- Aggiunta distinzione esplicita tra capitale scenario e capitale portfolio derivato.
- CSV con colonne separate: capitalBeforeTrade, scenarioCapitalAfter, portfolioCapitalBefore, portfolioCapitalAfter, initialSl, finalSl, initialRisk, initialRiskEur, riskPct, runMode, portfolioMode.

## Periodo comune tra timeframe
- Aggiunto allineamento opzionale, attivo di default, all'intersezione comune dei periodi scenario.
- Se 1H parte più tardi di 5M/1M, il Generale può eliminare i trade fuori dal periodo comune per rendere Trend/Swing/Scalp confrontabili.
- La diagnostica mostra quanti trade sono stati rimossi perché fuori dall'intersezione comune.

## Modalità contabilità risultato
- Aggiunto selettore Contabilità risultato:
  - Scenari indipendenti;
  - Portfolio derivato parallelo;
  - Portfolio derivato max 1 trade.
- La modalità max 1 trade elimina gli overlap ex-post in modo tracciabile senza riscrivere i trade.

## Rigore dati e duplicati
- Aggiunto filtro mercato XAU per escludere barre fuori orario indicativo di mercato: sabato, domenica pre-riapertura, venerdì post-chiusura.
- Aggiunto anti-duplicazione trade tra scenari quando open/close/direzione/entry/exit/PnL coincidono.
- La UI mostra trade grezzi, trade conteggiati, trade fuori intersezione, duplicati rimossi, overlap rimossi e barre fuori mercato filtrate.

## Ranking ottimizzazione più robusto
- Ranking non più solo su profitto netto.
- Aggiunti nel punteggio: profit factor, drawdown, numero minimo trade, mesi positivi, bilanciamento BUY/SELL e penalità overtrade.
- Checkpoint e scelta migliorativa usano il punteggio robusto, mantenendo vincoli minimi su P&L e PF.

## Export
- CSV backtest più diagnostico e ricostruibile.
- Mantiene parametri, pesi, versione app, timeframe esecuzione e regola di verifica.

## Cache
- Service worker aggiornato a xauapp-v9-0.
