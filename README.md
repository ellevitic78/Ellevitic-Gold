# 🥇 XAU/USD Analyzer — PWA

App standalone per Android con dati live, analisi MTF, scalping e notifiche in background.

## Setup in 5 minuti (GitHub Pages — gratis)

### 1. Crea repository GitHub
1. Vai su [github.com](https://github.com) → **Sign up** (gratuito)
2. Clicca **"New repository"**
3. Nome: `xau-analyzer`
4. Seleziona **Public**
5. Clicca **"Create repository"**

### 2. Carica i file
1. Clicca **"uploading an existing file"**
2. Trascina **tutti i file** di questa cartella:
   - `index.html`
   - `sw.js`
   - `manifest.json`
   - `icon-72.png`
   - `icon-192.png`
   - `icon-512.png`
3. Clicca **"Commit changes"**

### 3. Attiva GitHub Pages
1. Vai su **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → **/ (root)**
4. Clicca **Save**
5. Dopo ~1 minuto l'URL sarà: `https://TUONOME.github.io/xau-analyzer/`

### 4. Installa come app sul telefono
1. Apri Chrome sul telefono
2. Vai all'URL `https://TUONOME.github.io/xau-analyzer/`
3. Tocca i **3 puntini** → **"Aggiungi a schermata Home"**
4. Conferma → l'app appare come icona dorata sul desktop!

### 5. Attiva notifiche background
1. Apri l'app
2. Inserisci le tue API key (Twelve Data + opzionale Anthropic)
3. Tocca **🔔** in alto a destra
4. Tocca **"Attiva"**
5. Consenti le notifiche quando richiesto
6. ✅ Riceverai alert anche con il telefono in tasca!

## Versione inclusa

Questa build è la **v8.9 general-start-checkpoint-fast**. Vedi `CHANGELOG_8.9.md` per data inizio Backtest Generale, checkpoint progressivi delle ottimizzazioni e accelerazioni del motore backtest senza scorciatoie sul risultato finale.

## Alert disponibili
- 📍 Prezzo vicino a Pivot / R1 / S1
- ⚠️ RSI overbought (>70) o oversold (<30)
- ⚡ Spike di volatilità (>1.8x ATR)
- 📡 Segnale anticipatore DXY/EUR/USD
- 🔔 Alert prezzo personalizzato (sopra/sotto $X)

## Note
- Il monitoraggio gira ogni **5 minuti** (rispetta il rate limit Twelve Data free: 800 req/giorno)
- Su Android Chrome le notifiche funzionano anche con lo schermo spento
- Su iOS Safari le PWA non supportano push notification (limitazione Apple)

## v8.6 — Timeframe operativo per scenario

Nel backtest la verifica trade è ora strutturata per scenario:

- Scalp: verifica su 1M.
- Swing: verifica su 5M.
- Trend: verifica su 1H.
- Bias: verifica su 1H.

Le altre candele restano disponibili come contesto di scoring, ma entry, SL/TP, trailing ed exit vengono simulati sul timeframe operativo dello scenario. Il CSV backtest include `execTf` e `verifyRule` per rendere tracciabile la regola usata.



## v8.7 — Data inizio ottimizzazione e auto-sync mancanti

Nel tab Backtest/Ottimizzazione è stata aggiunta una data di inizio dedicata alle ottimizzazioni. Test scenario, ottimizzazione parametri, ottimizzazione pesi, Intra-SA, Sweep e Sanity Check usano tutte le barre disponibili dalla data scelta in avanti.

Se l'opzione di preparazione automatica è attiva, prima del run l'app controlla e integra le serie core XAU/USD 1D, 1H, 5M e 1M, con merge, deduplica e ordinamento cronologico. Il Backtest Generale rimane solo test e continua a non fare download automatici.

## v8.8 — Wide Annealing Space

L'annealing intrascenario ha ora uno spazio di ricerca stabilmente più ampio: soglie 30–95, trailing ATR più largo, pesi fino a 3× e ottimizzazione anche di minConf, BE trigger, trail trigger e parziale TP1. Il rischio percentuale resta escluso perché altererebbe il risultato principalmente tramite leva.


## v8.9 — Backtest Generale per data, checkpoint e motore più veloce

Il Backtest Generale ora può partire da una data dedicata e usa tutte le barre normalizzate disponibili da quella data in avanti, con dettaglio del periodo e delle barre realmente usate per Trend/Bias 1H, Swing 5M e Scalp 1M.

Le ottimizzazioni scenario salvano checkpoint locali appena trovano un miglioramento affidabile, così un risultato utile non viene perso se il run non si completa. Dal hub scenario il miglior risultato locale può essere applicato manualmente.

Per ridurre i tempi sono state aggiunte cache indicatori e ricerca binaria sui timestamp: non viene ridotto il rigore del backtest finale, ma vengono eliminati ricalcoli e scansioni inutili.

## v9.0 — Nota su Backtest Generale

Il Backtest Generale ora distingue chiaramente tra:

- scenari indipendenti: ogni scenario viene testato con capitale proprio;
- portfolio derivato parallelo: i trade generati vengono ordinati cronologicamente e ricapitalizzati come vista derivata;
- portfolio derivato max 1 trade: i trade sovrapposti vengono esclusi dalla vista portfolio.

Questa correzione evita l'errore della versione precedente: sommare trade generati con capitali scenario separati e presentarli come una sola equity curve compounding. Il CSV esporta sia capitale scenario sia capitale portfolio derivato, oltre a initial/final stop, rischio iniziale, parametri, pesi e metadati.

Il Generale ha anche l'opzione di allineare i risultati all'intersezione comune dei periodi scenario. Serve quando, per esempio, 1H parte più tardi di 5M/1M: in quel caso i trade fuori periodo comune vengono rimossi dalla vista Generale per rendere i risultati confrontabili.

Il backtest applica anche filtro mercato XAU e anti-duplicazione tra scenari. Le ottimizzazioni usano un ranking più robusto: P&L, PF, drawdown, trade minimi, stabilità mensile, equilibrio BUY/SELL e penalità overtrade.
