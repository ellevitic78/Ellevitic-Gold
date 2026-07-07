# Guida H24 — XAU/USD Analyzer

Questa app è una PWA/browser app. Può monitorare e notificare, ma non è un server trading daemon. Per uso H24 affidabile ci sono tre livelli possibili.

## Livello 1 — Telefono Android sempre acceso, app aperta

È il modo più semplice e realistico senza server.

1. Pubblica l'app su HTTPS, per esempio GitHub Pages.
2. Apri l'app con Chrome Android.
3. Installa la PWA: menu Chrome → Aggiungi a schermata Home.
4. Apri l'app installata.
5. Inserisci Twelve Data API key.
6. Apri 🔔 Notifiche.
7. Premi Attiva e consenti le notifiche.
8. Premi Test suono almeno una volta: questo sblocca l'audio locale.
9. Lascia l'app aperta, telefono in carica e schermo acceso.
10. Disattiva risparmio energetico per Chrome/PWA quando possibile.

Nota: il suono custom dell'app funziona quando la pagina è viva e l'audio è stato sbloccato da un tap. Se Android/Chrome sospende la pagina, resta la notifica di sistema con vibrazione/suono gestito dal sistema operativo.

## Livello 2 — Telefono dedicato in postazione

Per un H24 più stabile:

1. Usa un telefono dedicato collegato alla corrente.
2. Tieni l'app installata come PWA e aperta in primo piano.
3. Mantieni connessione Wi-Fi stabile.
4. Disattiva sospensione schermo o usa il wake lock già incluso nell'app.
5. Escludi Chrome/PWA dalle ottimizzazioni batteria del produttore, quando il telefono lo consente.
6. Ogni mattina controlla Diagnostica 🔧: Service Worker, notifiche, API key, ultimo check.

Questo è il miglior compromesso senza backend.

## Livello 3 — Soluzione realmente H24

Per una vera operatività H24 robusta serve spostare il monitoraggio fuori dal telefono:

1. VPS o mini-PC sempre acceso.
2. Processo schedulato ogni 1–5 minuti.
3. Download dati e scoring lato server.
4. Invio notifiche via Telegram/WhatsApp/email/push.
5. Browser/PWA usata solo come dashboard.

È l'unico assetto veramente affidabile se vuoi che il sistema continui a lavorare anche con telefono spento, app chiusa, batteria scarica o browser sospeso.

## Checklist giornaliera

- App aperta e aggiornata.
- 🔔 Background attivo.
- 🔊 Test suono riuscito.
- Diagnostica: Service Worker risponde al PING.
- Ultimo check recente.
- API Twelve Data non in errore.
- Telefono in carica.
- Risparmio energetico non aggressivo.

## Limite importante

Le notifiche browser/PWA non garantiscono suono custom a pagina chiusa. Il suono custom è locale alla pagina; il sistema operativo decide il suono delle notifiche di sistema.
