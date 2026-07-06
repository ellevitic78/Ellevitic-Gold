# v8.3 — Coerenza annealing/backtest

Questa versione non aggiunge nuove strategie: corregge il ciclo di ottimizzazione.

## Correzioni principali

- Build visibile aggiornata a `v8.3 COERENZA ANNEALING`.
- Service worker aggiornato a `xauapp-v15-live-scenarios-v8-3-annealing-coherence`.
- Nel progress dell'annealing il "BEST" viene dichiarato esplicitamente come migliore per obiettivo robusto, non solo per P&L.
- Progress annealing più chiaro: mostra candidato accettato/scartato, risultato corrente, best isolato, P&L/PF/DD/trade e obiettivo.
- Annealing globale: condizione di miglioramento corretta da formula ambigua a confronto diretto con la baseline tramite obiettivo robusto.
- Annealing per scenario: dopo il loop vengono calcolate due conferme:
  1. conferma scenario-only senza applicare parametri comuni;
  2. conferma portafoglio completo con parametri comuni.
- Regola auto-apply v8.3:
  - scenario/trailing/pesi vengono applicati solo se confermati sullo scenario;
  - parametri comuni (`minConf`, `beRR`, `trailRR`, `partialPct`) vengono applicati solo se migliorano anche il portafoglio completo;
  - se il best del loop migliora solo isolatamente ma non supera la conferma, non viene applicato.
- I pesi interni scenario vengono salvati e risincronizzati con log dedicato.
- Protezione anti-falso parziale: se `partialPct` o `partialLots` producono una chiusura nulla, il TP1 non genera più `partialClosedAt`/`partialPnl=0` né attiva BE gratis.

## Nota di lettura UI

Durante il loop di annealing il migliore mostrato è il miglior candidato trovato nel percorso stocastico, misurato con l'obiettivo robusto. Il risultato applicato, però, dipende dalla conferma post-loop. Per questo la card finale separa:

- baseline scenario isolato;
- best full trovato nel loop;
- conferma scenario-only;
- portafoglio full candidate.
