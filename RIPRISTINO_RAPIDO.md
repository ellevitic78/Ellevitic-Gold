# Ripristino rapido GitHub Pages

Questa versione contiene solo file statici dell'app, senza workflow GitHub Actions.

Uso consigliato:
1. Carica questi file nella root del repository.
2. Cancella/disattiva eventuali file in `.github/workflows/` che fanno deploy Pages.
3. Vai in Settings -> Pages.
4. Imposta Source = Deploy from a branch.
5. Branch = main, Folder = /root.
6. Salva e attendi il deploy.

Build visibile attesa nell'app:
`build 2026-07-06 · live-scenari v7 pages-fix`
