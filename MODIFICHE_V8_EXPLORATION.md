# Modifiche v8 — spazio di ricerca annealing più ampio

Questa versione nasce per evitare che l'ottimizzazione peschi solo in un set troppo ristretto.

## Cosa è stato verificato

Nella v7 l'annealing era effettivamente limitato da:

- iterazioni bloccate a massimo 300;
- range fissi per soglie, trailing, BE, Trail RR, partial;
- step fissi abbastanza grossi;
- pesi interni limitati ai valori discreti 0, 0.5, 0.75, 1, 1.25, 1.5, 2;
- annealing scenario con mutazione locale a piccoli passi.

## Cosa cambia

Nel tab Ottimizzazione è stato aggiunto il pannello:

`🧭 Spazio di ricerca annealing`

con:

- Profilo: Standard sicuro, Largo, Esplorativo, Estremo;
- Ampiezza ×: moltiplicatore manuale del range;
- Passo: Normale, Fine, Ultra fine, Grosso.

Questi controlli valgono per:

- annealing globale;
- annealing per scenario;
- ottimizzazione per scenario coordinate-descent;
- ottimizzazione pesi interni.

## Range e pesi

I profili Largo/Esplorativo/Estremo allargano i range intorno ai parametri live correnti, rispettando limiti duri ragionevoli:

- soglie/confidence: 0–100;
- partialPct: 0–100;
- RR/trailing: 0.05–8;
- pesi interni: fino a ×2.5, ×3 o ×4 in base al profilo.

## Iterazioni

Il limite massimo degli input iterazioni è stato aumentato da 300 a 2000.

## Nota rischio

I profili ampi possono trovare soluzioni molto diverse, ma aumentano molto il rischio di overfitting. Dopo ogni ottimizzazione ampia è consigliato usare il Sanity Check.
