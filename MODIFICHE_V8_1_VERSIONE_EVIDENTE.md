# v8.1 — Versione evidente / anti-cache

Questa build serve a rendere immediatamente visibile che il deploy è cambiato.

Cosa cambia:
- banner verde/oro sempre visibile in alto: `VERSIONE NUOVA CARICATA — v8.1 EVIDENTE`;
- badge build più grande nella schermata principale;
- badge anche nella schermata setup, prima dell’inserimento API key;
- titolo pagina aggiornato;
- manifest aggiornato a `XAU/USD Analyzer v8.1 evidente`;
- service worker con cache nuova `xauapp-v13-live-scenarios-v8-1-evidente`;
- registrazione SW con query di cache-busting basata su `APP_BUILD`.

Se dopo il deploy non vedi il banner, il sito/PWA sta ancora servendo una versione vecchia dalla cache o GitHub Pages non ha pubblicato i file caricati.
