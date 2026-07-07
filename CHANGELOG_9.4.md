# XAU App v9.4 — AsiaGapNN

## Nuovo scenario neurale

- Aggiunto scenario **AsiaGapNN** nel tab Backtest/Ottimizzazione.
- Scenario event-driven America→Asia: massimo un evento per giorno di mercato.
- Aggiunti due modelli neurali interni:
  - **GapNet**: prevede GAP_UP / FLAT / GAP_DOWN usando solo dati disponibili al close America.
  - **ContinuationNet**: prevede CONTINUATION / FADE / NO_EDGE dopo Asia open, usando anche il gap osservato.
- Addestramento **walk-forward obbligatorio**: per ogni giorno D la rete si allena solo sugli eventi precedenti a D.
- Niente shuffle globale e niente scaler calcolati sul futuro.

## Feature e dati

- Usa XAU/USD 1M come verifica microstrutturale.
- Usa 15M come contesto intermedio storico.
- Usa 1H e 1D come contesto regime/daily.
- Feature incluse: pressione finale America, ritorni 15/30/60/120m, range, compressione, posizione nel range, candle shape, sweep, contesto 15M/1H/1D, giorno settimana/mese.

## Parametri UI

- Data inizio eventi.
- USA close UTC.
- Asia open UTC.
- Orizzonte continuation +15/+30/+60m.
- Train window eventi.
- Soglie probabilistiche Gap e Continuation.
- Soglie minime ATR per gap e movimento.
- Hidden layer 1/2.
- Epochs, learning rate e L2.
- Numero candidati ottimizzazione.

## Ottimizzazione

- Aggiunto pulsante **Ottimizza NN**.
- Random/grid search leggero su iperparametri neurali e soglie operative.
- Ranking robusto basato su expectancy, PF, trade count, coverage e penalità drawdown/overtrade.

## Export

- Aggiunto CSV eventi AsiaGapNN con una riga per evento/giorno.
- CSV include forecast, probabilità, label vere, decisione, PnL simulato, iperparametri, spread e slippage.

## Nota

Questa è una prima versione forecast/backtest, non ancora scenario live automatico. Serve a verificare se esiste edge America→Asia prima di trasformarlo in operatività reale.
