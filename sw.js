// ── XAU/USD Analyzer — Service Worker ────────────────────────
// Gestisce: cache offline, background sync, push notifications

const CACHE = 'xauapp-v1';
const ASSETS = ['/', '/index.html'];

// ── Install: pre-cache shell ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate: pulisce vecchie cache ─────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve da cache, fallback rete ────────────────────
self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.twelvedata.com') ||
      e.request.url.includes('api.anthropic.com')) {
    // Dati live: sempre dalla rete
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});

// ── Background Sync: fetch dati ogni 5 minuti ────────────────
let bgTimer = null;

self.addEventListener('message', e => {
  if (e.data?.type === 'START_BG') {
    const { tdKey, alertConfig } = e.data;
    if (bgTimer) clearInterval(bgTimer);
    bgTimer = setInterval(() => doBackgroundCheck(tdKey, alertConfig), 5 * 60 * 1000);
    // Prima esecuzione immediata
    doBackgroundCheck(tdKey, alertConfig);
  }
  if (e.data?.type === 'STOP_BG') {
    if (bgTimer) clearInterval(bgTimer);
    bgTimer = null;
  }
  if (e.data?.type === 'UPDATE_ALERTS') {
    // Aggiorna config alert senza riavviare il timer
    if (bgTimer) {
      clearInterval(bgTimer);
      const { tdKey, alertConfig } = e.data;
      bgTimer = setInterval(() => doBackgroundCheck(tdKey, alertConfig), 5 * 60 * 1000);
    }
  }
});

// ── Core background check ────────────────────────────────────
async function doBackgroundCheck(tdKey, alertConfig) {
  if (!tdKey) return;
  try {
    // Fetch XAU 1H (pochi dati per velocità)
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=1h&outputsize=30&apikey=${tdKey}`
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === 'error' || !data.values) return;

    const candles = [...data.values].reverse();
    const closes = candles.map(c => parseFloat(c.close));
    const last = parseFloat(candles[candles.length - 1].close);
    const prev = parseFloat(candles[candles.length - 2].close);

    // RSI veloce
    const rsi = computeRSI(closes, 14);
    const rsiNow = rsi[rsi.length - 1];

    // ATR
    const atrNow = computeLastATR(candles, 14);

    // Pivot (semplice)
    const c2 = candles[candles.length - 2];
    const pivot = (parseFloat(c2.high) + parseFloat(c2.low) + parseFloat(c2.close)) / 3;
    const r1 = 2 * pivot - parseFloat(c2.low);
    const s1 = 2 * pivot - parseFloat(c2.high);

    // Fetch DXY / EUR/USD per lead signal
    let dxySlope = 0;
    try {
      const dxyRes = await fetch(
        `https://api.twelvedata.com/time_series?symbol=EUR%2FUSD&interval=1h&outputsize=6&apikey=${tdKey}`
      );
      const dxyData = await dxyRes.json();
      if (dxyData.values && dxyData.values.length >= 4) {
        const dp = [...dxyData.values].reverse().map(c => parseFloat(c.close));
        dxySlope = dp[dp.length - 1] - dp[dp.length - 4];
      }
    } catch {}

    // ── Valuta alert ─────────────────────────────────────────
    const alerts = [];
    const cfg = alertConfig || {};

    // 1. Prezzo tocca Pivot/R1/S1
    const pivotDist = Math.abs(last - pivot);
    const r1Dist = Math.abs(last - r1);
    const s1Dist = Math.abs(last - s1);
    if (cfg.pivot !== false && pivotDist < (atrNow * 0.3))
      alerts.push({ title: '📍 XAU/USD al Pivot', body: `Prezzo $${last.toFixed(2)} vicino al Pivot $${pivot.toFixed(2)}`, tag: 'pivot' });
    if (cfg.r1 !== false && r1Dist < (atrNow * 0.3))
      alerts.push({ title: '🔴 XAU/USD a R1', body: `Prezzo $${last.toFixed(2)} vicino alla resistenza R1 $${r1.toFixed(2)}`, tag: 'r1' });
    if (cfg.s1 !== false && s1Dist < (atrNow * 0.3))
      alerts.push({ title: '🟢 XAU/USD a S1', body: `Prezzo $${last.toFixed(2)} vicino al supporto S1 $${s1.toFixed(2)}`, tag: 's1' });

    // 2. RSI estremo
    if (cfg.rsiOB !== false && rsiNow > (cfg.rsiOBLevel || 70))
      alerts.push({ title: '⚠️ RSI Overbought', body: `RSI 1H a ${rsiNow.toFixed(1)} — zona di ipercomprato`, tag: 'rsi-ob' });
    if (cfg.rsiOS !== false && rsiNow < (cfg.rsiOSLevel || 30))
      alerts.push({ title: '⚡ RSI Oversold', body: `RSI 1H a ${rsiNow.toFixed(1)} — zona di ipervenduto`, tag: 'rsi-os' });

    // 3. Movimento brusco (> Nx ATR in 1 candela)
    const candleMove = Math.abs(last - prev);
    if (cfg.spike !== false && candleMove > atrNow * (cfg.spikeMultiplier || 1.8))
      alerts.push({ title: '⚡ Spike XAU/USD!', body: `Movimento di ${candleMove.toFixed(1)} pts (${(candleMove/atrNow).toFixed(1)}x ATR) — attenzione`, tag: 'spike' });

    // 4. Lead signal DXY (EUR/USD sale forte = oro potrebbe salire)
    if (cfg.lead !== false && Math.abs(dxySlope) > 0.003) {
      const dxyDir = dxySlope > 0 ? 'sale' : 'scende';
      const oroAtteso = dxySlope > 0 ? 'rialzo' : 'ribasso';
      alerts.push({ title: `📡 Segnale anticipatore`, body: `EUR/USD ${dxyDir} → possibile ${oroAtteso} oro atteso. Verifica l'app.`, tag: 'lead' });
    }

    // 5. Alert prezzo personalizzato
    if (cfg.priceAbove && last > cfg.priceAbove)
      alerts.push({ title: `🔔 XAU/USD sopra $${cfg.priceAbove}`, body: `Prezzo attuale: $${last.toFixed(2)}`, tag: 'price-above' });
    if (cfg.priceBelow && last < cfg.priceBelow)
      alerts.push({ title: `🔔 XAU/USD sotto $${cfg.priceBelow}`, body: `Prezzo attuale: $${last.toFixed(2)}`, tag: 'price-below' });

    // ── Invia notifiche ──────────────────────────────────────
    for (const alert of alerts) {
      await self.registration.showNotification(alert.title, {
        body: alert.body,
        tag: alert.tag,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: '/', timestamp: Date.now() }
      });
    }

    // Aggiorna la pagina se aperta
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'BG_UPDATE',
        price: last,
        rsi: rsiNow,
        pivot, r1, s1,
        alertsFired: alerts.length,
        ts: Date.now()
      });
    });

  } catch(e) {
    console.warn('[SW] Background check error:', e);
  }
}

// ── Tap su notifica → apre app ───────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('/');
    })
  );
});

// ── Mini math per SW (no import) ────────────────────────────
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
    gA = (gA * (period-1) + Math.max(d,0)) / period;
    lA = (lA * (period-1) + Math.max(-d,0)) / period;
    r.push(lA === 0 ? 100 : 100 - 100 / (1 + gA / lA));
  }
  return r;
}

function computeLastATR(candles, period) {
  const trs = candles.map((c, i) => {
    const h = parseFloat(c.high), l = parseFloat(c.low), cl = parseFloat(c.close);
    if (!i) return h - l;
    const pc = parseFloat(candles[i-1].close);
    return Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  });
  const last = trs.slice(-period);
  return last.reduce((s,v) => s+v, 0) / last.length;
}
