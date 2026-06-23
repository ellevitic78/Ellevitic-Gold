// ── XAU/USD Analyzer — Service Worker v3 ─────────────────────
const CACHE = 'xauapp-v3';
const ASSETS = ['/index.html', '/manifest.json', '/icon-192.png', '/icon-72.png', '/icon-512.png'];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(err => console.warn('[SW] Cache partial fail:', err)))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (serve app from cache) ─────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // API calls: always network
  if (url.includes('twelvedata.com') || url.includes('anthropic.com')) {
    return; // let browser handle normally
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── State ────────────────────────────────────────────────────
let bgInterval = null;
let alertConfig = {};
let tdApiKey = '';
let lastAlertTimes = {}; // tag -> timestamp, evita spam

// ── Message handler ───────────────────────────────────────────
self.addEventListener('message', e => {
  const { type, tdKey, config } = e.data || {};
  console.log('[SW] Message received:', type);

  if (type === 'START_BG') {
    tdApiKey = tdKey || '';
    alertConfig = config || {};
    if (bgInterval) clearInterval(bgInterval);
    // Primo check subito dopo 3 secondi
    setTimeout(() => runCheck(), 3000);
    // Poi ogni 5 minuti
    bgInterval = setInterval(() => runCheck(), 5 * 60 * 1000);
    console.log('[SW] Background monitoring started');
    // Conferma all'app
    notifyClients({ type: 'BG_STARTED', ts: Date.now() });
  }

  if (type === 'STOP_BG') {
    if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
    console.log('[SW] Background monitoring stopped');
    notifyClients({ type: 'BG_STOPPED', ts: Date.now() });
  }

  if (type === 'UPDATE_CONFIG') {
    alertConfig = e.data.config || {};
    if (e.data.tdKey) tdApiKey = e.data.tdKey;
    console.log('[SW] Config updated:', alertConfig);
  }

  if (type === 'PING') {
    notifyClients({ type: 'PONG', ts: Date.now(), bgActive: bgInterval !== null });
  }
});

// ── Notify all open clients ───────────────────────────────────
async function notifyClients(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage(data));
}

// ── Background check ─────────────────────────────────────────
async function runCheck() {
  if (!tdApiKey) { console.warn('[SW] No API key'); return; }
  console.log('[SW] Running check at', new Date().toLocaleTimeString());

  try {
    // Fetch XAU/USD 1H (30 candele)
    const xauRes = await fetch(
      `https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=1h&outputsize=30&apikey=${tdApiKey}`,
      { cache: 'no-store' }
    );
    if (!xauRes.ok) throw new Error(`XAU fetch HTTP ${xauRes.status}`);
    const xauData = await xauRes.json();
    if (xauData.status === 'error') throw new Error(xauData.message || 'XAU API error');
    if (!xauData.values?.length) throw new Error('No XAU data');

    const candles = [...xauData.values].reverse();
    const closes  = candles.map(c => parseFloat(c.close));
    const last    = closes[closes.length - 1];
    const prev    = closes[closes.length - 2];

    // Indicatori base
    const rsi    = computeRSI(closes, 14);
    const rsiNow = +rsi[rsi.length - 1].toFixed(1);
    const atr    = computeATR(candles, 14);

    // Pivot points dal penultimo candle
    const pc     = candles[candles.length - 2];
    const pivot  = +((parseFloat(pc.high) + parseFloat(pc.low) + parseFloat(pc.close)) / 3).toFixed(2);
    const r1     = +(2 * pivot - parseFloat(pc.low)).toFixed(2);
    const s1     = +(2 * pivot - parseFloat(pc.high)).toFixed(2);

    // Fetch EUR/USD 1H per lead signal
    let eurSlope = 0;
    try {
      const eurRes  = await fetch(
        `https://api.twelvedata.com/time_series?symbol=EUR%2FUSD&interval=1h&outputsize=6&apikey=${tdApiKey}`,
        { cache: 'no-store' }
      );
      if (eurRes.ok) {
        const eurData = await eurRes.json();
        if (eurData.values?.length >= 4) {
          const ep = [...eurData.values].reverse().map(c => parseFloat(c.close));
          eurSlope = (ep[ep.length-1] - ep[0]) / ep[0] * 100;
        }
      }
    } catch {}

    // Invia aggiornamento all'app
    notifyClients({
      type:   'BG_UPDATE',
      price:  last,
      rsi:    rsiNow,
      pivot, r1, s1, atr,
      eurSlope: +eurSlope.toFixed(4),
      ts:     Date.now()
    });

    // ── Valuta alert ──────────────────────────────────────────
    const cfg     = alertConfig;
    const now     = Date.now();
    const COOL    = 15 * 60 * 1000; // cooldown 15 min per tag

    const sendAlert = async (title, body, tag, vibrate = [200, 100, 200]) => {
      if (lastAlertTimes[tag] && now - lastAlertTimes[tag] < COOL) return;
      lastAlertTimes[tag] = now;
      await self.registration.showNotification(title, {
        body,
        tag,
        icon:               '/icon-192.png',
        badge:              '/icon-72.png',
        vibrate,
        requireInteraction: false,
        silent:             false,
        data:               { url: '/', ts: now }
      });
      console.log('[SW] Notification sent:', tag, title);
      notifyClients({ type: 'ALERT_FIRED', tag, title, body, ts: now });
    };

    // 1. Prezzo vicino Pivot
    if (cfg.pivot !== false && Math.abs(last - pivot) < atr * 0.3)
      await sendAlert('📍 XAU/USD al Pivot', `Prezzo $${last.toFixed(2)} vicino Pivot $${pivot.toFixed(2)}`, 'pivot');

    // 2. Prezzo vicino R1
    if (cfg.r1 !== false && Math.abs(last - r1) < atr * 0.3)
      await sendAlert('🔴 XAU/USD a R1', `Prezzo $${last.toFixed(2)} — resistenza R1 $${r1.toFixed(2)}`, 'r1');

    // 3. Prezzo vicino S1
    if (cfg.s1 !== false && Math.abs(last - s1) < atr * 0.3)
      await sendAlert('🟢 XAU/USD a S1', `Prezzo $${last.toFixed(2)} — supporto S1 $${s1.toFixed(2)}`, 's1');

    // 4. RSI overbought
    if (cfg.rsiOB !== false && rsiNow > (cfg.rsiOBLevel || 70))
      await sendAlert('⚠️ RSI Overbought', `RSI 1H: ${rsiNow} — zona ipercomprato`, 'rsi-ob', [300, 100, 300]);

    // 5. RSI oversold
    if (cfg.rsiOS !== false && rsiNow < (cfg.rsiOSLevel || 30))
      await sendAlert('⚡ RSI Oversold', `RSI 1H: ${rsiNow} — zona ipervenduto`, 'rsi-os', [300, 100, 300]);

    // 6. Spike volatilità
    const candleMove = Math.abs(last - prev);
    if (cfg.spike !== false && candleMove > atr * (cfg.spikeMultiplier || 1.8))
      await sendAlert('⚡ Spike XAU/USD!', `Movimento ${candleMove.toFixed(1)} pts (${(candleMove/atr).toFixed(1)}x ATR)`, 'spike', [400, 100, 400, 100, 400]);

    // 7. Lead signal EUR/USD
    if (cfg.lead !== false && Math.abs(eurSlope) > 0.05) {
      const dir = eurSlope > 0 ? 'sale ↑' : 'scende ↓';
      const xauExp = eurSlope > 0 ? 'rialzo' : 'ribasso';
      await sendAlert('📡 Segnale Anticipatore', `EUR/USD ${dir} — possibile ${xauExp} oro`, 'lead');
    }

    // 8. Alert prezzo personalizzato
    if (cfg.priceAbove && last > cfg.priceAbove)
      await sendAlert(`🔔 XAU sopra $${cfg.priceAbove}`, `Prezzo attuale: $${last.toFixed(2)}`, 'price-above');
    if (cfg.priceBelow && last < cfg.priceBelow)
      await sendAlert(`🔔 XAU sotto $${cfg.priceBelow}`, `Prezzo attuale: $${last.toFixed(2)}`, 'price-below');

    // 9. Confluenza scalping macro (EUR/USD + TNX 5M)
    try {
      const [eurM, tnxM] = await Promise.all([
        fetch(`https://api.twelvedata.com/time_series?symbol=EUR%2FUSD&interval=5min&outputsize=6&apikey=${tdApiKey}`,{cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
        fetch(`https://api.twelvedata.com/time_series?symbol=TNX&interval=5min&outputsize=6&apikey=${tdApiKey}`,{cache:'no-store'}).then(r=>r.json()).catch(()=>({})),
      ]);
      if (eurM.values?.length >= 4 && tnxM.values?.length >= 4) {
        const ep = [...eurM.values].reverse().map(c=>parseFloat(c.close));
        const tp = [...tnxM.values].reverse().map(c=>parseFloat(c.close));
        const es = (ep[ep.length-1]-ep[0])/ep[0]*100;
        const ts2 = (tp[tp.length-1]-tp[0])/tp[0]*100;
        const eBias = es > 0.003 ? 'BUY' : es < -0.003 ? 'SELL' : null;
        const tBias = ts2 > 0.003 ? 'SELL' : ts2 < -0.003 ? 'BUY' : null;
        if (eBias && tBias && eBias === tBias && cfg.scalpMacro !== false) {
          const dir = eBias === 'BUY' ? '🔺 RIALZO' : '🔻 RIBASSO';
          await sendAlert(`⚡ Confluenza Macro Scalping — ${dir}`, `EUR/USD e TNX 5M concordano. Apri la tab Scalp.`, 'scalp-macro', [300,100,300,100,300,100,300]);
        }
      }
    } catch {}

  } catch(err) {
    console.error('[SW] Check failed:', err.message);
    notifyClients({ type: 'BG_ERROR', error: err.message, ts: Date.now() });
  }
}

// ── Tap notifica → apre app ───────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Porta in primo piano se già aperta
      for (const c of clients) {
        if (c.url.includes(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});

// ── Chiude notifica su swipe ──────────────────────────────────
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
  const last = trs.slice(-period);
  return last.reduce((s, v) => s + v, 0) / last.length;
}
