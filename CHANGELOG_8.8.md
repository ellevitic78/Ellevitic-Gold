# XAU App v8.8 — Wide Annealing Space

## Cambiamento principale
Allargato stabilmente lo spazio di ricerca dell'annealing intrascenario.

## Dettagli
- Iterazioni annealing/scenario: default 160, massimo 3000.
- Range soglie scenario ampliato a 30–95.
- Range trailing ATR ampliati:
  - Swing: 0.2–6.0×ATR
  - Trend: 0.2–7.0×ATR
  - Scalp: 0.1–4.0×ATR
  - Bias: 0.2–5.0×ATR
- Intra-SA ora esplora anche parametri di esecuzione:
  - minConf 25–90
  - beRR 0.0–2.5R
  - trailRR 0.0–3.0R
  - partialPct 0–90%
- Pesi interni annealing ampliati da 0–2× a 0–3× con passi intermedi 0.25/0.5.
- Mutazione più ampia nelle prime fasi: può modificare fino a 6 dimensioni per iterazione.
- Scala di accettazione aumentata per ridurre il rischio di restare bloccati in massimi locali.
- Coordinate descent scenario allineato ai nuovi range larghi.
- Cache PWA aggiornata a xauapp-v8-8.

## Nota
RiskPct resta escluso dall'annealing: ottimizzarlo significherebbe quasi sempre aumentare la leva, non migliorare la strategia.
