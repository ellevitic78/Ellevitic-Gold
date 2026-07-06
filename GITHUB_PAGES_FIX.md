# GitHub Pages fix

Questa versione aggiunge un workflow GitHub Pages statico e corregge i percorsi PWA per repository pubblicati come project page, per esempio:

`https://ellevitic78.github.io/Ellevitic-Gold/`

## Cosa è stato corretto

- Aggiunto `.github/workflows/deploy-pages.yml` con permessi `pages: write` e `id-token: write`.
- Aggiunto `.nojekyll`.
- Manifest e icona Apple passati da path assoluti `/manifest.json` e `/icon-192.png` a path relativi.
- `manifest.json`: `start_url` e `scope` impostati a `./`, compatibili con GitHub Pages project path.
- Service worker cache aggiornata a `xauapp-v11-live-scenarios-v7-pagesfix`.
- Service worker assets resi relativi.
- Build visibile aggiornata a `build 2026-07-06 · live-scenari v7 pages-fix`.

## Istruzioni operative

1. Carica tutti i file di questo ZIP nel repository.
2. Se esiste già un vecchio workflow Pages che fallisce, disattivalo o sostituiscilo con `.github/workflows/deploy-pages.yml`.
3. Vai in `Settings → Pages → Build and deployment → Source` e seleziona `GitHub Actions`.
4. Vai in `Actions`, apri `Deploy static XAU app to GitHub Pages`, poi lancia `Run workflow` oppure fai un commit/push.
5. Dopo deploy verde, apri l'app e verifica in alto: `build 2026-07-06 · live-scenari v7 pages-fix`.

Se vedi ancora la versione vecchia, rimuovi la PWA installata e cancella i dati sito/cache del browser prima di reinstallarla.
