// ── XAU/USD Analyzer — Service Worker v4 ─────────────────────
const CACHE = 'xauapp-v4';
const ASSETS = ['index.html', 'manifest.json', 'icon-192.png', 'icon-72.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('twelvedata.com') || url.includes('anthropic.com')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// ── Stato interno SW ─────────────────────────────────────────
let bgInterval   = null;
let tdApiKey     = '';
let alertConfig  = {};
let lastAlertTs  = {};
let openTrade    = null; // Trade paper aperto (ricevuto dall'app)
let lastPrice    = null;

const COOL = 15 * 60 * 1000; // cooldown alert 15 min
const TRADE_CHECK_INTERVAL = 30 * 1000; // controlla trade ogni 30s

// ── Message handler ───────────────────────────────────────────
self.addEventListener('message', async e => {
  const { type } = e.data || {};

  if (type === 'START_BG') {
    tdApiKey = e.data.tdKey || '';
    alertConfig = e.data.config || {};
    if (bgInterval) clearInterval(bgInterval);
    setTimeout(() => runCheck(), 2000);
    bgInterval = setInterval(() => runCheck(), 5 * 60 * 1000);
    // Timer separato per monitoraggio trade (ogni 30s)
    if (!self._tradeTimer) {
      self._tradeTimer = setInterval(() => monitorTrade(), TRADE_CHECK_INTERVAL);
    }
    notifyClients({ type: 'BG_STARTED', ts: Date.now() });
  }

  if (type === 'STOP_BG') {
    if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
    if (self._tradeTimer) { clearInterval(self._tradeTimer); self._tradeTimer = null; }
    notifyClients({ type: 'BG_STOPPED', ts: Date.now() });
  }

  if (type === 'UPDATE_CONFIG') {
    alertConfig = e.data.config || {};
    if (e.data.tdKey) tdApiKey = e.data.tdKey;
  }

  if (type === 'PAPER_TRADE_OPEN') {
    openTrade = e.data.trade;
    if (e.data.tdKey) tdApiKey = e.data.tdKey;
    console.log('[SW] Trade aperto ricevuto:', openTrade?.direction, '@', openTrade?.entry);
    // Avvia monitoraggio se non già attivo
    if (!self._tradeTimer) {
      self._tradeTimer = setInterval(() => monitorTrade(), TRADE_CHECK_INTERVAL);
    }
    setTimeout(() => monitorTrade(), 3000); // check immediato
  }

  if (type === 'PAPER_TRADE_CLOSED') {
    openTrade = null;
    console.log('[SW] Trade chiuso — stop monitoraggio locale');
  }

  if (type === 'PING') {
    notifyClients({ type: 'PONG', ts: Date.now(), bgActive: bgInterval !== null, hasTrade: !!openTrade });
  }
});

// ── Notifica tutti i client aperti ───────────────────────────
async function notifyClients(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage(data));
}

// ── Fetch prezzo XAU live ─────────────────────────────────────
async function fetchXauPrice() {
  if (!tdApiKey) return null;
  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=XAU%2FUSD&apikey=${tdApiKey}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'error') return null;
    const price = parseFloat(data.price);
    return (price > 100 && price < 99999) ? price : null;
  } catch(e) { return null; }
}

// ── Monitoraggio trade in background ─────────────────────────
async function monitorTrade() {
  if (!openTrade) return;

  const price = await fetchXauPrice();
  if (!price) return;
  lastPrice = price;

  const t   = openTrade;
  const dir = t.direction;
  const slDist  = Math.abs(t.entry - t.sl);
  const atr     = t.atrAtEntry || slDist * 0.6 || 15;
  const profPts = dir === 'BUY' ? price - t.entry : t.entry - price;
  const profRR  = slDist > 0 ? profPts / slDist : 0;

  // Aggiorna MFE
  if (!t.maxFavorable) t.maxFavorable = price;
  if (dir === 'BUY')  t.maxFavorable = Math.max(t.maxFavorable, price);
  if (dir === 'SELL') t.maxFavorable = Math.min(t.maxFavorable, price);

  const trailMult  = t.trailMult  || 1.5;
  const warnThresh = t.warnThresh || 6;
  const SPREAD     = 0.04;

  let exitSignal = false, exitReason = '', exitPrice = 0;

  // ── SL colpito ──────────────────────────────────────────
  if (dir === 'BUY'  && price <= t.sl) { exitSignal = true; exitReason = 'SL';  exitPrice = t.sl; }
  if (dir === 'SELL' && price >= t.sl) { exitSignal = true; exitReason = 'SL';  exitPrice = t.sl; }
  if (!exitSignal && dir === 'BUY'  && price >= t.tp2) { exitSignal = true; exitReason = 'TP2'; exitPrice = t.tp2; }
  if (!exitSignal && dir === 'SELL' && price <= t.tp2) { exitSignal = true; exitReason = 'TP2'; exitPrice = t.tp2; }
  if (!exitSignal && dir === 'BUY'  && price >= t.tp1) { exitSignal = true; exitReason = 'TP1'; exitPrice = t.tp1; }
  if (!exitSignal && dir === 'SELL' && price <= t.tp1) { exitSignal = true; exitReason = 'TP1'; exitPrice = t.tp1; }

  if (exitSignal) {
    // Notifica app per chiusura definitiva
    notifyClients({ type: 'BG_EXIT_SIGNAL', price, exitReason, ts: Date.now() });
    const pnlPts = dir === 'BUY' ? exitPrice - SPREAD/2 - t.entry : t.entry - (exitPrice + SPREAD/2);
    const pnlEur = +(pnlPts * (t.lots||0.01) * 100).toFixed(2);
    const emoji  = pnlEur > 0 ? '✅' : exitReason === 'SL' ? '❌' : '➖';
    await self.registration.showNotification(`${emoji} Trade ${exitReason} — ${dir}`, {
      body: `XAU @ $${price.toFixed(2)} · P&L: ${pnlEur > 0 ? '+' : ''}€${pnlEur} · Cap stimato: `,
      icon: '/icon-192.png', tag: 'paper-bg-exit', vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
    });
    openTrade = null;
    return;
  }

  // ── Breakeven in background ──────────────────────────────
  if (!t.breakEvenSet && profRR >= 0.7) {
    const bePad = atr * 0.5;
    const newSL = dir === 'BUY' ? +(t.entry + bePad).toFixed(2) : +(t.entry - bePad).toFixed(2);
    if ((dir === 'BUY' && newSL > t.sl) || (dir === 'SELL' && newSL < t.sl)) {
      t.sl = newSL;
      t.breakEvenSet = true;
      notifyClients({
        type: 'BG_UPDATE_SL', newSL, breakEvenSet: true, trailingActive: t.trailingActive||false,
        action: `BE [SW]: SL → $${newSL.toFixed(2)}`, price, ts: Date.now()
      });
      await self.registration.showNotification('📍 Breakeven impostato', {
        body: `${dir} XAU · SL spostato a $${newSL.toFixed(2)} · Profitto protetto`,
        icon: '/icon-192.png', tag: 'paper-be', vibrate: [200, 100, 200],
      });
    }
  }

  // ── Trailing stop in background ──────────────────────────
  if (profRR >= 1.0) {
    const trailDist = atr * trailMult;
    const trailSL   = dir === 'BUY'
      ? +(t.maxFavorable - trailDist).toFixed(2)
      : +(t.maxFavorable + trailDist).toFixed(2);
    if ((dir === 'BUY' && trailSL > t.sl) || (dir === 'SELL' && trailSL < t.sl)) {
      const old = t.sl;
      t.sl = trailSL;
      t.trailingActive = true;
      notifyClients({
        type: 'BG_UPDATE_SL', newSL: trailSL, breakEvenSet: t.breakEvenSet||false, trailingActive: true,
        action: `Trail [SW] x${trailMult}: SL $${old.toFixed(2)} → $${trailSL.toFixed(2)}`, price, ts: Date.now()
      });
      // Notifica solo se trailing si è spostato significativamente (>0.5 ATR)
      if (Math.abs(trailSL - old) > atr * 0.5) {
        await self.registration.showNotification('📍 Trailing Stop aggiornato', {
          body: `${dir} · SL $${old.toFixed(2)} → $${trailSL.toFixed(2)} · Prezzo: $${price.toFixed(2)}`,
          icon: '/icon-192.png', tag: 'paper-trail', vibrate: [100, 50, 100],
        });
      }
    }
  }

  // Aggiorna trade locale SW
  openTrade = t;

  // Aggiorna header prezzo nell'app
  notifyClients({ type: 'BG_UPDATE', price, ts: Date.now() });
}

// ── Background check principale (alert generali) ──────────────
async function runCheck() {
  if (!tdApiKey) return;
  console.log('[SW] Background check at', new Date().toLocaleTimeString());
  try {
    const xauRes = await fetch(
      `https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=1h&outputsize=30&apikey=${tdApiKey}`,
      { cache: 'no-store' }
    );
    if (!xauRes.ok) return;
    const xauData = await xauRes.json();
    if (xauData.status === 'error' || !xauData.values?.length) return;

    const candles = [...xauData.values].reverse();
    const closes  = candles.map(c => parseFloat(c.close));
    const last    = closes[closes.length - 1];
    const prev    = closes[closes.length - 2];
    const rsi     = computeRSI(closes, 14);
    const rsiNow  = +rsi[rsi.length - 1].toFixed(1);
    const atr     = computeATR(candles, 14);
    const pc      = candles[candles.length - 2];
    const pivot   = +((parseFloat(pc.high) + parseFloat(pc.low) + parseFloat(pc.close)) / 3).toFixed(2);
    const r1      = +(2 * pivot - parseFloat(pc.low)).toFixed(2);
    const s1      = +(2 * pivot - parseFloat(pc.high)).toFixed(2);

    notifyClients({ type: 'BG_UPDATE', price: last, rsi: rsiNow, pivot, r1, s1, atr, ts: Date.now() });
    lastPrice = last;

    const now = Date.now();
    const sendAlert = async (title, body, tag, vibrate = [200, 100, 200]) => {
      if (lastAlertTs[tag] && now - lastAlertTs[tag] < COOL) return;
      lastAlertTs[tag] = now;
      await self.registration.showNotification(title, {
        body, tag, icon: '/icon-192.png', badge: '/icon-72.png',
        vibrate, requireInteraction: false, silent: false,
      });
      notifyClients({ type: 'ALERT_FIRED', tag, title, ts: now });
    };

    const cfg = alertConfig;
    if (cfg.pivot !== false && Math.abs(last - pivot) < atr * 0.3)
      await sendAlert('📍 XAU al Pivot', `$${last.toFixed(2)} vicino Pivot $${pivot.toFixed(2)}`, 'pivot');
    if (cfg.r1 !== false && Math.abs(last - r1) < atr * 0.3)
      await sendAlert('🔴 XAU a R1', `$${last.toFixed(2)} — R1 $${r1.toFixed(2)}`, 'r1');
    if (cfg.s1 !== false && Math.abs(last - s1) < atr * 0.3)
      await sendAlert('🟢 XAU a S1', `$${last.toFixed(2)} — S1 $${s1.toFixed(2)}`, 's1');
    if (cfg.rsiOB !== false && rsiNow > (cfg.rsiOBLevel || 70))
      await sendAlert('⚠️ RSI Overbought', `RSI 1H: ${rsiNow}`, 'rsi-ob', [300, 100, 300]);
    if (cfg.rsiOS !== false && rsiNow < (cfg.rsiOSLevel || 30))
      await sendAlert('⚡ RSI Oversold', `RSI 1H: ${rsiNow}`, 'rsi-os', [300, 100, 300]);
    if (cfg.spike !== false && Math.abs(last - prev) > atr * (cfg.spikeMultiplier || 1.8))
      await sendAlert('⚡ Spike XAU!', `Movimento ${Math.abs(last-prev).toFixed(1)} pts (${(Math.abs(last-prev)/atr).toFixed(1)}x ATR)`, 'spike', [400, 100, 400, 100, 400]);
    if (cfg.priceAbove && last > cfg.priceAbove)
      await sendAlert(`🔔 XAU sopra $${cfg.priceAbove}`, `Prezzo: $${last.toFixed(2)}`, 'price-above');
    if (cfg.priceBelow && last < cfg.priceBelow)
      await sendAlert(`🔔 XAU sotto $${cfg.priceBelow}`, `Prezzo: $${last.toFixed(2)}`, 'price-below');

    // Confluenza macro scalp
    try {
      const [eurM, tnxM] = await Promise.all([
        fetch(`https://api.twelvedata.com/time_series?symbol=EUR%2FUSD&interval=5min&outputsize=6&apikey=${tdApiKey}`,{cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
        fetch(`https://api.twelvedata.com/time_series?symbol=TNX&interval=5min&outputsize=6&apikey=${tdApiKey}`,{cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
      ]);
      if (eurM.values?.length >= 4 && tnxM.values?.length >= 4) {
        const ep = [...eurM.values].reverse().map(c=>parseFloat(c.close));
        const tp = [...tnxM.values].reverse().map(c=>parseFloat(c.close));
        const es = (ep[ep.length-1]-ep[0])/ep[0]*100;
        const ts = (tp[tp.length-1]-tp[0])/tp[0]*100;
        const eBias = es > 0.003 ? 'BUY' : es < -0.003 ? 'SELL' : null;
        const tBias = ts > 0.003 ? 'SELL' : ts < -0.003 ? 'BUY' : null;
        if (eBias && tBias && eBias === tBias && cfg.scalpMacro !== false) {
          const dir = eBias === 'BUY' ? '🔺 RIALZO' : '🔻 RIBASSO';
          await sendAlert(`⚡ Confluenza Macro — ${dir}`, `EUR/USD e TNX 5M concordano.`, 'scalp-macro', [300,100,300,100,300]);
        }
      }
    } catch(e) {}

  } catch(err) {
    console.error('[SW] Check failed:', err.message);
    notifyClients({ type: 'BG_ERROR', error: err.message, ts: Date.now() });
  }
}

// ── Tap notifica ──────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});

self.addEventListener('notificationclose', e => {
  console.log('[SW] Notification closed:', e.notification.tag);
});

// ── Math helpers ──────────────────────────────────────────────
function computeRSI(closes, period) {
  if (closes.length < period + 1) return closes.map(() => 50);
  const r = Array(period).fill(50);
  let gA = 0, lA = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i-1];
    if (d >= 0) gA += d; else lA -= d;
  }
  gA /= period; lA /= period;
  r.push(lA === 0 ? 100 : 100 - 100 / (1 + gA / lA));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    gA = (gA * (period-1) + Math.max(d, 0)) / period;
    lA = (lA * (period-1) + Math.max(-d, 0)) / period;
    r.push(lA === 0 ? 100 : 100 - 100 / (1 + gA / lA));
  }
  return r;
}

function computeATR(candles, period) {
  const trs = candles.map((c, i) => {
    const h = parseFloat(c.high), l = parseFloat(c.low), cl = parseFloat(c.close);
    if (!i) return h - l;
    const pc = parseFloat(candles[i-1].close);
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  return trs.slice(-period).reduce((s, v) => s + v, 0) / period;
}
