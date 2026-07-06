// ── XAU/USD Analyzer — Service Worker v8.1 evidente (Live Scenari + Annealing Esplorativo) ─────────
const CACHE = 'xauapp-v13-live-scenarios-v8-1-evidente';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-72.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('twelvedata.com') || url.includes('anthropic.com')) return;

  const isHtml = e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');
  if (isHtml) {
    // NETWORK-FIRST per l'HTML: prendi sempre l'ultima versione dal server;
    // la cache serve solo come fallback offline. Così gli aggiornamenti
    // dell'app appaiono al primo refresh, senza svuotare cache a mano.
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first per asset statici (icone, manifest)
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

// ── Stato SW ─────────────────────────────────────────────────
let bgInterval   = null;
let tradeTimer   = null;
let tdKey        = '';
let alertCfg     = {};
let lastAlertTs  = {};
let paperEnabled = false;
let openTrade    = null;
let openTrades = {};
let paperCapital = 10000;
let paperTrades  = [];
let paperParams  = { spread: 0.04, slippage: 0.02, partialPct: 15, beRR: 0.4, trailRR: 0.4 };
let lastCheckTs  = 0;
let paperCapitalPeak = 10000;

const SPREAD       = 0.04;
const SLIPPAGE     = 0.02;
const RISK_PCT     = 0.01;
const LEVERAGE     = 100;
const MAX_POS_PCT  = 0.05;
const MAX_DD       = 0.10;
const MIN_SCORE    = 62; // conservativo in background    // soglia minima per entry
const COOL_TRADE   = 15 * 60 * 1000; // 15 min in background // 5 min cooldown tra trade
let lastTradeTs    = 0; // legacy
let lastTradeTsByScenario = {};
const COOL_ALERT   = 15 * 60 * 1000;

function swSpread(t=null) {
  const v = Number(t?.spread ?? paperParams?.spread ?? SPREAD);
  return Number.isFinite(v) && v >= 0 ? v : SPREAD;
}
function swSlippage(t=null) {
  const v = Number(t?.slippage ?? paperParams?.slippage ?? SLIPPAGE);
  return Number.isFinite(v) && v >= 0 ? v : SLIPPAGE;
}
function entryFill(rawPrice, dir, spread=swSpread(), slippage=swSlippage()) {
  return dir === 'BUY'
    ? +(rawPrice + spread/2 + slippage).toFixed(2)
    : +(rawPrice - spread/2 - slippage).toFixed(2);
}
function exitFill(rawPrice, dir, spread=swSpread(), slippage=swSlippage()) {
  return dir === 'BUY'
    ? +(rawPrice - spread/2 - slippage).toFixed(2)
    : +(rawPrice + spread/2 + slippage).toFixed(2);
}
function xauMarketOpen(ref=new Date()) {
  const d = ref instanceof Date ? ref : new Date(ref);
  if (Number.isNaN(d.getTime())) return true;
  const day = d.getUTCDay();
  const min = d.getUTCHours()*60 + d.getUTCMinutes();
  if (day === 6) return false;
  if (day === 0 && min < 22*60 + 10) return false;
  if (day === 5 && min >= 21*60 + 55) return false;
  return true;
}
function initialRiskDistance(t) {
  return Math.abs((t.entry ?? 0) - (t.slInitial ?? t.slOrig ?? t.initialSL ?? t.sl ?? 0)) || 1;
}
function syncLegacyOpen() {
  const vals = Object.values(openTrades || {}).filter(Boolean);
  openTrade = vals[0] || null;
}

// ── Message handler ───────────────────────────────────────────
self.addEventListener('message', async e => {
  const d = e.data || {};

  if (d.type === 'START_BG') {
    tdKey      = d.tdKey || '';
    alertCfg   = d.config || {};
    paperEnabled = d.paperEnabled || false;
    paperCapital = d.paperCapital || 10000;
    paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital);
    paperTrades  = d.paperTrades  || [];
    paperParams  = { ...paperParams, ...(d.paperParams || {}) };
    openTrade    = d.openTrade    || null;
    openTrades   = d.openTrades   || (d.openTrade ? {[(d.openTrade.scenario||'swing')]: d.openTrade} : {});
    syncLegacyOpen();
    if (bgInterval) clearInterval(bgInterval);
    if (tradeTimer) clearInterval(tradeTimer);
    setTimeout(() => runAll(), 2000);
    bgInterval = setInterval(() => runAll(), 5 * 60 * 1000);
    tradeTimer = setInterval(() => monitorTrade(), 30 * 1000);
    notifyClients({ type: 'BG_STARTED', ts: Date.now() });
    console.log('[SW] Started. paperEnabled:', paperEnabled, 'openTrade:', !!openTrade);
  }

  if (d.type === 'STOP_BG') {
    if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
    if (tradeTimer) { clearInterval(tradeTimer); tradeTimer = null; }
    notifyClients({ type: 'BG_STOPPED', ts: Date.now() });
  }

  if (d.type === 'UPDATE_CONFIG') {
    alertCfg = d.config || {};
    if (d.tdKey) tdKey = d.tdKey;
    if (d.paperEnabled !== undefined) paperEnabled = d.paperEnabled;
    if (d.openTrade !== undefined)    openTrade    = d.openTrade;
    if (d.openTrades !== undefined)   openTrades   = d.openTrades;
    if (d.paperCapital !== undefined) { paperCapital = d.paperCapital; paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital); }
    if (d.paperParams) paperParams = { ...paperParams, ...d.paperParams };
    syncLegacyOpen();
  }

  if (d.type === 'PAPER_TRADE_OPEN') {
    if (d.openTrades) openTrades = d.openTrades;
    if (d.trade) openTrades[d.trade.scenario || 'swing'] = d.trade;
    syncLegacyOpen();
    if (d.paperParams) paperParams = { ...paperParams, ...d.paperParams };
    paperCapital = d.capital || paperCapital;
    paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital);
    if (d.tdKey) tdKey = d.tdKey;
    if (!tradeTimer) tradeTimer = setInterval(() => monitorTrade(), 30000);
    setTimeout(() => monitorTrade(), 2000);
  }

  if (d.type === 'PAPER_TRADE_CLOSED') {
    if (d.trade?.scenario && openTrades) delete openTrades[d.trade.scenario];
    syncLegacyOpen();
    if (d.capital) { paperCapital = d.capital; paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital); }
    if (d.trades)  paperTrades  = d.trades;
  }

  if (d.type === 'PAPER_STATE_SYNC') {
    paperEnabled = d.paperEnabled ?? paperEnabled;
    paperCapital = d.paperCapital ?? paperCapital;
    paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital);
    paperTrades  = d.paperTrades  ?? paperTrades;
    paperParams  = { ...paperParams, ...(d.paperParams || {}) };
    openTrades   = d.openTrades ?? openTrades;
    openTrade    = d.openTrade    ?? openTrade;
    if (openTrade && !openTrades[openTrade.scenario || 'swing']) openTrades[openTrade.scenario || 'swing'] = openTrade;
    syncLegacyOpen();
  }

  if (d.type === 'PING') {
    notifyClients({ type: 'PONG', ts: Date.now(), bgActive: !!bgInterval, hasTrade: !!openTrade, openSlots:Object.values(openTrades||{}).filter(Boolean).length, paperEnabled });
  }
});

async function notifyClients(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage(data));
}

// ═══════════════════════════════════════════════════════════════
// FETCH HELPERS
// ═══════════════════════════════════════════════════════════════
async function fetchPrice() {
  try {
    const r = await fetch(`https://api.twelvedata.com/price?symbol=XAU%2FUSD&apikey=${tdKey}`, { cache:'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.status === 'error') return null;
    const p = parseFloat(d.price);
    return (p > 100 && p < 99999) ? p : null;
  } catch(e) { return null; }
}

async function fetchSeries(symbol, interval, outputsize=30) {
  try {
    const r = await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${tdKey}`, { cache:'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.status === 'error' || !d.values?.length) return null;
    return [...d.values].reverse().map(c => ({
      o: parseFloat(c.open), h: parseFloat(c.high),
      l: parseFloat(c.low),  c: parseFloat(c.close),
    }));
  } catch(e) { return null; }
}

// ═══════════════════════════════════════════════════════════════
// MATH HELPERS
// ═══════════════════════════════════════════════════════════════
function calcRSI(closes, period=14) {
  if (closes.length < period+1) return closes.map(()=>50);
  let gA=0, lA=0;
  for (let i=1; i<=period; i++) { const d=closes[i]-closes[i-1]; if(d>=0) gA+=d; else lA-=d; }
  gA/=period; lA/=period;
  const r = [...Array(period).fill(50), lA===0?100:100-100/(1+gA/lA)];
  for (let i=period+1; i<closes.length; i++) {
    const d=closes[i]-closes[i-1];
    gA=(gA*(period-1)+Math.max(d,0))/period;
    lA=(lA*(period-1)+Math.max(-d,0))/period;
    r.push(lA===0?100:100-100/(1+gA/lA));
  }
  return r;
}

function calcEMA(closes, period) {
  const k=2/(period+1); let ema=closes[0];
  return closes.map((v,i)=>{ if(!i) return ema; ema=v*k+ema*(1-k); return +ema.toFixed(3); });
}

function calcATR(candles, period=14) {
  const trs = candles.map((c,i)=>{
    if(!i) return c.h-c.l;
    const pc=candles[i-1].c;
    return Math.max(c.h-c.l, Math.abs(c.h-pc), Math.abs(c.l-pc));
  });
  return trs.slice(-period).reduce((s,v)=>s+v,0)/period;
}

function calcMACD(closes) {
  const ema12=calcEMA(closes,12), ema26=calcEMA(closes,26);
  return closes.map((_,i)=>ema12[i]-ema26[i]);
}

function slope(arr, n=3) {
  if (arr.length < n+1) return 0;
  const sl=arr.slice(-(n+1));
  return (sl[sl.length-1] - sl[0]) / (sl[0]||1) * 100;
}

// ═══════════════════════════════════════════════════════════════
// SCORING ENGINE (semplificato per SW — usa dati freschi)
// ═══════════════════════════════════════════════════════════════
async function computeSwScores() {
  // Fetch dati necessari per scoring
  const [cc1h, cc4h, cc1d, cc5m, eurUsd, tnx] = await Promise.all([
    fetchSeries('XAU/USD', '1h',  40),
    fetchSeries('XAU/USD', '4h',  30),
    fetchSeries('XAU/USD', '1day',35),
    fetchSeries('XAU/USD', '5min',20),
    fetchSeries('EUR/USD', '1h',  10).catch(()=>null),
    fetchSeries('TNX',     '1h',  10).catch(()=>null),
  ]);

  if (!cc1h || cc1h.length < 10) return null;

  const last1h = cc1h[cc1h.length-1];
  const last4h = cc4h?.[cc4h.length-1] || last1h;
  const last1d = cc1d?.[cc1d.length-1] || last1h;
  const price  = last1h.c;
  const atr1h  = calcATR(cc1h, 14);

  // RSI
  const rsi1h = calcRSI(cc1h.map(c=>c.c), 14);
  const rsiNow = rsi1h[rsi1h.length-1];

  // EMA
  const ema20_1h = calcEMA(cc1h.map(c=>c.c), 20);
  const ema50_1h = calcEMA(cc1h.map(c=>c.c), 50);
  const ema20_4h = cc4h ? calcEMA(cc4h.map(c=>c.c), 20) : [];
  const ema50_4h = cc4h ? calcEMA(cc4h.map(c=>c.c), 50) : [];
  const ema200_1d= cc1d && cc1d.length>30 ? calcEMA(cc1d.map(c=>c.c), 200) : [];

  // MACD 1H
  const macd1h = calcMACD(cc1h.map(c=>c.c));
  const macdNow = macd1h[macd1h.length-1];
  const macdPrev= macd1h[macd1h.length-2]||0;

  // Trend per TF
  const tfTrend = (cc) => {
    if (!cc || cc.length < 20) return 'NEUTRAL';
    const ema20 = calcEMA(cc.map(c=>c.c), 20);
    const ema50 = calcEMA(cc.map(c=>c.c), 50);
    const last = cc[cc.length-1].c;
    return last > ema20[ema20.length-1] && ema20[ema20.length-1] > ema50[ema50.length-1] ? 'BUY'
         : last < ema20[ema20.length-1] && ema20[ema20.length-1] < ema50[ema50.length-1] ? 'SELL'
         : 'NEUTRAL';
  };

  const t1h = tfTrend(cc1h);
  const t4h = tfTrend(cc4h);
  const t1d = tfTrend(cc1d);

  // Lead macro EUR/USD + TNX
  let macroDir = 'NEUTRAL', macroStr = 0;
  if (eurUsd && eurUsd.length >= 5) {
    const eurSlope = slope(eurUsd.map(c=>c.c), 4);
    const tnxSlope = tnx ? slope(tnx.map(c=>c.c), 4) : 0;
    const eurBias = eurSlope > 0.03 ? 'BUY' : eurSlope < -0.03 ? 'SELL' : 'NEUTRAL';
    const tnxBias = tnxSlope > 0.03 ? 'SELL' : tnxSlope < -0.03 ? 'BUY' : 'NEUTRAL';
    if (eurBias !== 'NEUTRAL') macroStr++;
    if (tnxBias !== 'NEUTRAL') macroStr++;
    if (eurBias === tnxBias && eurBias !== 'NEUTRAL') { macroDir = eurBias; }
    else if (eurBias !== 'NEUTRAL') macroDir = eurBias;
  }

  // Pivot (calcolato da ultima candela 1H chiusa)
  const pvCandle = cc1h[cc1h.length-2];
  const pivot = pvCandle ? +((pvCandle.h+pvCandle.l+pvCandle.c)/3).toFixed(2) : price;
  const r1 = pvCandle ? +(2*pivot-pvCandle.l).toFixed(2) : price+20;
  const s1 = pvCandle ? +(2*pivot-pvCandle.h).toFixed(2) : price-20;

  // Supertrend 4H (semplificato)
  const stBull = cc4h && cc4h.length >= 15
    ? cc4h[cc4h.length-1].c > (calcEMA(cc4h.map(c=>c.c),10)[calcEMA(cc4h.map(c=>c.c),10).length-1] - calcATR(cc4h,10)*3)
    : null;

  // Funzione score per una direzione
  const scoreDir = (dir) => {
    const isBuy = dir === 'BUY';
    let score = 0;

    // 1. Lead macro (peso 25) — anticipatore principale
    if (macroStr >= 2 && macroDir === dir)               { score += 25; }
    else if (macroStr >= 1 && macroDir === dir)           { score += 14; }
    else if (macroDir !== 'NEUTRAL' && macroDir !== dir)  { score -= 15; }

    // 2. Struttura MTF (peso 20)
    const tfsFor = [t1d,t4h,t1h].filter(t=>t===dir).length;
    const tfsAg  = [t1d,t4h,t1h].filter(t=>t!=='NEUTRAL'&&t!==dir).length;
    if (tfsFor===3)      { score += 20; }
    else if (tfsFor===2) { score += 13; }
    else if (tfsFor===1) { score += 5;  }
    if (tfsAg >= 2)      { score -= 10; }

    // 3. RSI (peso 12)
    if (isBuy) {
      if (rsiNow < 35)       { score += 12; }
      else if (rsiNow < 48)  { score += 8;  }
      else if (rsiNow < 60)  { score += 4;  }
      else if (rsiNow > 70)  { score -= 10; }
    } else {
      if (rsiNow > 65)       { score += 12; }
      else if (rsiNow > 52)  { score += 8;  }
      else if (rsiNow > 40)  { score += 4;  }
      else if (rsiNow < 30)  { score -= 10; }
    }

    // 4. MACD 1H (peso 10)
    const macdOk = isBuy ? (macdNow > macdPrev) : (macdNow < macdPrev);
    const macdWrong = isBuy ? (macdNow < 0 && macdNow < macdPrev) : (macdNow > 0 && macdNow > macdPrev);
    if (macdOk)    { score += 10; }
    if (macdWrong) { score -= 5;  }

    // 5. EMA200 (peso 8)
    if (ema200_1d.length) {
      const abv200 = price > ema200_1d[ema200_1d.length-1];
      if ((isBuy && abv200) || (!isBuy && !abv200)) { score += 8; }
      else { score -= 6; }
    }

    // 6. Supertrend 4H (peso 8)
    if (stBull !== null) {
      if ((isBuy && stBull) || (!isBuy && !stBull)) { score += 8; }
      else { score -= 6; }
    }

    // 7. Pivot spazio (peso 7)
    if (isBuy) {
      if (price > pivot && r1 - price > atr1h * 0.8) { score += 7; }
      else if (r1 - price < atr1h * 0.4) { score -= 5; }
    } else {
      if (price < pivot && price - s1 > atr1h * 0.8) { score += 7; }
      else if (price - s1 < atr1h * 0.4) { score -= 5; }
    }

    // 8. Pullback su EMA (bonus 5)
    const ema20n = ema20_1h[ema20_1h.length-1];
    const ema50n = ema50_1h[ema50_1h.length-1];
    const distEma20 = Math.abs(price - ema20n) / atr1h;
    const distEma50 = Math.abs(price - ema50n) / atr1h;
    if (distEma20 < 0.4) { score += 5; }
    else if (distEma50 < 0.6) { score += 3; }

    // 9. Sessione (peso 5)
    const h = new Date().getUTCHours();
    const sess = h>=7&&h<12?'Londra':h>=12&&h<17?'Overlap':h>=17&&h<22?'NY':'Asia';
    if (sess==='Overlap'||sess==='NY') { score += 5; }
    else if (sess==='Londra')          { score += 3; }
    else                               { score -= 2; }

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const buyScore  = scoreDir('BUY');
  const sellScore = scoreDir('SELL');
  const bestDir   = buyScore >= MIN_SCORE && buyScore >= sellScore ? 'BUY'
                  : sellScore >= MIN_SCORE && sellScore > buyScore ? 'SELL'
                  : 'WAIT';
  const bestScore = Math.max(buyScore, sellScore);

  const h = new Date().getUTCHours() + new Date().getUTCMinutes()/60;
  const c5 = cc5m || [];
  const rsi5 = c5.length > 15 ? calcRSI(c5.map(c=>c.c),14).slice(-1)[0] : rsiNow;
  const slope5 = c5.length >= 4 ? c5[c5.length-1].c - c5[c5.length-4].c : 0;
  const mkSetup = (dir, atrMult, tp1Mult, tp2Mult, entryPrice=price, atr=atr1h) => {
    const entry = entryPrice;
    const sl = dir === 'BUY' ? +(entry - atr*atrMult).toFixed(2) : +(entry + atr*atrMult).toFixed(2);
    const risk = Math.abs(entry - sl) || atr;
    return { direction:dir, entry, sl,
      tp1: dir === 'BUY' ? +(entry + risk*tp1Mult).toFixed(2) : +(entry - risk*tp1Mult).toFixed(2),
      tp2: dir === 'BUY' ? +(entry + risk*tp2Mult).toFixed(2) : +(entry - risk*tp2Mult).toFixed(2),
      risk:+risk.toFixed(2) };
  };
  const makeScenario = (id, label, threshold, bAdj, sAdj, atrMult, tp1Mult, tp2Mult) => {
    const b = Math.max(0, Math.min(100, Math.round(buyScore + bAdj)));
    const sls = Math.max(0, Math.min(100, Math.round(sellScore + sAdj)));
    const dir = b >= threshold && b >= sls ? 'BUY' : sls >= threshold && sls > b ? 'SELL' : 'WAIT';
    const score = Math.max(b, sls);
    return { id, label, threshold, buyScore:b, sellScore:sls, bestDir:dir, bestScore:score,
      setup: dir === 'WAIT' ? null : mkSetup(dir, atrMult, tp1Mult, tp2Mult),
      reasons:[`SW ${label}: BUY ${b} / SELL ${sls}`, `TF ${t1d}/${t4h}/${t1h}`, `Macro ${macroDir} str ${macroStr}`] };
  };
  const trendBuyAdj  = [t1d,t4h,t1h].filter(t=>t==='BUY').length >= 2 ? 8 : -10;
  const trendSellAdj = [t1d,t4h,t1h].filter(t=>t==='SELL').length >= 2 ? 8 : -10;
  const scalpBuyAdj  = (slope5 > 0 ? 8 : -4) + (rsi5 < 65 && rsi5 > 35 ? 4 : 0);
  const scalpSellAdj = (slope5 < 0 ? 8 : -4) + (rsi5 < 65 && rsi5 > 35 ? 4 : 0);
  const biasActive = (h>=2&&h<6) || (h>=9&&h<12) || (h>=13.5&&h<16);
  const biasAdj = biasActive ? 6 : -25;
  const scenarios = [
    makeScenario('swing', 'Swing', Number(paperParams.thrSwing ?? 54), 0, 0, 1.5, 1.5, 3.0),
    makeScenario('trend', 'Trend', Number(paperParams.thrTrend ?? 74), trendBuyAdj, trendSellAdj, 2.0, 2.0, 4.0),
    makeScenario('scalp', 'Scalp', Number(paperParams.thrScalp ?? 62), scalpBuyAdj, scalpSellAdj, 0.8, 1.2, 2.2),
    makeScenario('bias',  'Bias',  Number(paperParams.thrBias  ?? 72), biasAdj, biasAdj, 1.2, 1.5, 2.5),
  ];

  return { buyScore, sellScore, bestDir, bestScore, price, atr1h, rsiNow, macdNow, pivot, r1, s1, macroDir, macroStr, t1h, t4h, t1d, ema20_1h, ema50_1h, scenarios };
}

// ═══════════════════════════════════════════════════════════════
// PAPER TRADE MANAGEMENT IN BACKGROUND
// ═══════════════════════════════════════════════════════════════
function calcLotSize(capital, entry, sl) {
  const riskPct = Number(paperParams?.riskPct ?? (RISK_PCT*100));
  const riskEur = capital * (Number.isFinite(riskPct) ? riskPct/100 : RISK_PCT);
  const slDist    = Math.abs(entry - sl);
  if (!slDist) return 0.01;
  const lotsByRisk   = riskEur / (slDist * 100);
  const marginPer1Lot= (entry / LEVERAGE) * 100;
  const lotsByMargin = (capital * MAX_POS_PCT) / marginPer1Lot;
  return Math.max(0.01, +Math.min(lotsByRisk, lotsByMargin).toFixed(2));
}

async function tryAutoEntry(scoring) {
  // Live background: apre e gestisce slot indipendenti per scenario.
  if (!paperEnabled) return;
  if (Date.now() - lastTradeTs < 5 * 1000) return; // micro anti-doppio click/timer
  if (!xauMarketOpen(new Date())) return;

  const dd = paperCapitalPeak > 0 ? (paperCapitalPeak - paperCapital) / paperCapitalPeak : 0;
  if (dd >= MAX_DD) { paperEnabled = false; return; }

  const candidates = Array.isArray(scoring.scenarios) && scoring.scenarios.length
    ? scoring.scenarios
    : [{ id:'swing', label:'Swing', bestDir:scoring.bestDir, bestScore:scoring.bestScore, threshold:MIN_SCORE,
         setup:null, reasons:[`Legacy score ${scoring.bestScore}`] }];

  for (const sc of candidates) {
    const id = sc.id || 'swing';
    if (openTrades && openTrades[id]) continue; // max 1 trade per scenario
    if (Date.now() - (lastTradeTsByScenario[id] || 0) < COOL_TRADE) continue;

    const bestDir = sc.bestDir || 'WAIT';
    const bestScore = Number(sc.bestScore || 0);
    const threshold = Number(sc.threshold ?? MIN_SCORE);
    if (bestDir === 'WAIT' || bestScore < threshold) continue;

    const setup = sc.setup || (() => {
      const entry0 = scoring.price;
      const atr = scoring.atr1h || 15;
      const sl0 = bestDir === 'BUY' ? +(entry0 - atr*1.5).toFixed(2) : +(entry0 + atr*1.5).toFixed(2);
      const risk0 = Math.abs(entry0 - sl0);
      return { entry:entry0, sl:sl0,
        tp1: bestDir === 'BUY' ? +(entry0 + risk0*1.5).toFixed(2) : +(entry0 - risk0*1.5).toFixed(2),
        tp2: bestDir === 'BUY' ? +(entry0 + risk0*3.0).toFixed(2) : +(entry0 - risk0*3.0).toFixed(2) };
    })();

    const entry = entryFill(setup.entry, bestDir);
    const sl = setup.sl;
    const risk = Math.abs(entry - sl);
    const tp1 = setup.tp1;
    const tp2 = setup.tp2;
    const lots = calcLotSize(paperCapital, entry, sl);
    const riskEur = +(risk * lots * 100).toFixed(2);

    const trade = {
      id: Date.now() + Math.floor(Math.random()*1000), direction: bestDir,
      entry, sl, slInitial: sl, slOrig: sl, tp1, tp1Initial: tp1, tp2, tp2Initial: tp2,
      lots, lotsInitial: lots, riskEur,
      confidence: bestScore, openedAt: new Date().toISOString(),
      capitalAtOpen: paperCapital, capitalBefore: paperCapital,
      spread: swSpread(), slippage: swSlippage(), atrAtEntry: scoring.atr1h || 15,
      scenario: id, pattern: `BG ${sc.label || id} score ${bestScore}`,
      entryReasons: sc.reasons || [],
      scoreSnapshot: {
        scenario:id, label:sc.label || id, totalScore:bestScore, threshold, direction:bestDir,
        reasons:sc.reasons || [],
        marketSnapshot:{ price:setup.entry, rsi1h:scoring.rsiNow, macd1h:scoring.macdNow, atr1h:scoring.atr1h, session:new Date().getUTCHours() },
        allScores: candidates.map(x => ({ id:x.id, label:x.label, score:x.bestScore, dir:x.bestDir, eligible:x.bestDir!=='WAIT', threshold:x.threshold, reasons:x.reasons||[] }))
      },
      managementLog: [], breakEvenSet:false, trailingActive:false,
      maxFavorable: entry, trailMult: Number(paperParams['trail'+id[0].toUpperCase()+id.slice(1)] ?? 1.5), warnThresh: id==='scalp'?3:id==='trend'?8:id==='bias'?5:6,
      partialPnl: 0,
    };

    openTrades[id] = trade;
    syncLegacyOpen();
    lastTradeTs = Date.now();
    lastTradeTsByScenario[id] = Date.now();

    notifyClients({ type:'BG_TRADE_OPENED', trade, openTrades, ts:Date.now() });
    await self.registration.showNotification(`🤖 Paper Trade ${bestDir} [${sc.label || id}]`, {
      body: `${bestDir} XAU @ $${fmtP(entry)} · Score ${bestScore}/100 · SL $${fmtP(sl)} · TP $${fmtP(tp1)}`,
      icon:'/icon-192.png', tag:'paper-bg-open-'+id, vibrate:[200,100,200,100,200], requireInteraction:true,
    });
    console.log('[SW] Trade aperto background:', id, trade.direction, '@', entry);
  }
}
async function hasVisibleClient() {
  const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
  return clients.some(c => c.visibilityState === 'visible');
}

async function monitorTrade() {
  const _slotList = Object.values(openTrades||{}).filter(Boolean); if (openTrade && !_slotList.length) _slotList.push(openTrade); if (!_slotList.length) return;

  const price = await fetchPrice();
  if (!price) return;

  // Aggiorna header
  notifyClients({ type: 'BG_UPDATE', price, ts: Date.now() });

  // Se l'app è visibile, gestisce lei il trade — evita azioni duplicate
  if (await hasVisibleClient()) return;

  for (const t of _slotList) {
  const dir = t.direction;
  const slDist  = Math.abs(t.entry - t.sl);
  const atr     = t.atrAtEntry || 15;
  const profPts = dir==='BUY' ? price-t.entry : t.entry-price;
  const profRR  = slDist > 0 ? profPts/slDist : 0;
  const trailMult  = t.trailMult  || 1.5;
  const warnThresh = t.warnThresh || 6;

  if (!t.maxFavorable) t.maxFavorable = price;
  if (dir==='BUY')  t.maxFavorable = Math.max(t.maxFavorable, price);
  if (dir==='SELL') t.maxFavorable = Math.min(t.maxFavorable, price);

  const logAction = (action) => {
    if (!t.managementLog) t.managementLog = [];
    t.managementLog.push({ ts: Date.now(), action, price: +price.toFixed(2), profRR: +profRR.toFixed(2) });
  };

  let closed = false, exitReason = '', exitPrice = 0;

  // Controlli exit
  if (dir==='BUY'  && price <= t.sl)  { closed=true; exitReason='SL';  exitPrice=t.sl; }
  if (dir==='SELL' && price >= t.sl)  { closed=true; exitReason='SL';  exitPrice=t.sl; }
  if (!closed && dir==='BUY'  && price >= t.tp2) { closed=true; exitReason='TP2'; exitPrice=t.tp2; }
  if (!closed && dir==='SELL' && price <= t.tp2) { closed=true; exitReason='TP2'; exitPrice=t.tp2; }
  if (!closed && !t.partialDone && ((dir==='BUY' && price >= t.tp1) || (dir==='SELL' && price <= t.tp1))) {
    const pct = Math.max(0, Math.min(100, Number(paperParams.partialPct ?? 50))) / 100;
    const halfLots = Math.min(t.lots, +(t.lots*pct).toFixed(2));
    const exitHalf = exitFill(t.tp1, dir, swSpread(t), swSlippage(t));
    const pnlHalf  = +((dir==='BUY'?exitHalf-t.entry:t.entry-exitHalf)*halfLots*100).toFixed(2);
    const capBeforePartial = paperCapital;
    paperCapital = +(paperCapital + pnlHalf).toFixed(2);
    paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital);
    t.lots = +(t.lots - halfLots).toFixed(2);
    t.partialDone = true;
    t.partialClosed = true;
    t.partialClosedAt = new Date().toISOString();
    t.partialLots = halfLots;
    t.partialExitPrice = exitHalf;
    t.partialCapitalBefore = capBeforePartial;
    t.partialCapitalAfter = paperCapital;
    t.partialPnl = pnlHalf;
    const beSL = dir==='BUY' ? +(t.entry+swSpread(t)).toFixed(2) : +(t.entry-swSpread(t)).toFixed(2);
    if ((dir==='BUY'&&beSL>t.sl)||(dir==='SELL'&&beSL<t.sl)) t.sl = beSL;
    t.breakEvenSet = true;
    logAction(`TP1 parziale ${Math.round(pct*100)}%: +€${pnlHalf} · SL→BE`);
    notifyClients({ type:'BG_TRADE_UPDATE', trade:t, price, profRR, ts:Date.now() });
    await self.registration.showNotification(`🎯 TP1 — ${Math.round(pct*100)}% incassato [BG]`, {
      body:`+€${pnlHalf} · Resto corre a TP2 $${t.tp2.toFixed(2)}`,
      icon:'/icon-192.png', tag:'paper-partial', vibrate:[200,100,200],
    });
  }

  if (!closed) {
    // Breakeven
    if (!t.breakEvenSet && profRR >= Number(paperParams.beRR ?? 0.7)) {
      const newSL = dir==='BUY' ? +(t.entry + atr*0.5).toFixed(2) : +(t.entry - atr*0.5).toFixed(2);
      if ((dir==='BUY'&&newSL>t.sl)||(dir==='SELL'&&newSL<t.sl)) {
        const old=t.sl; t.sl=newSL; t.breakEvenSet=true;
        logAction(`BE: SL $${old.toFixed(2)} → $${newSL.toFixed(2)}`);
        notifyClients({ type:'BG_UPDATE_SL', newSL, breakEvenSet:true, trailingActive:false, action:t.managementLog.slice(-1)[0]?.action, price, scenario:t.scenario, tradeId:t.id, ts:Date.now() });
        await self.registration.showNotification('📍 Breakeven impostato', {
          body: `${dir} · SL → $${newSL.toFixed(2)} · Profitto: +${profRR.toFixed(2)}R`,
          icon:'/icon-192.png', tag:'paper-be', vibrate:[200,100,200],
        });
      }
    }

    // Trailing
    if (profRR >= Number(paperParams.trailRR ?? 1.0)) {
      t.trailingActive = true;
      const trailDist = atr * trailMult;
      const trailSL   = dir==='BUY' ? +(t.maxFavorable-trailDist).toFixed(2) : +(t.maxFavorable+trailDist).toFixed(2);
      if ((dir==='BUY'&&trailSL>t.sl)||(dir==='SELL'&&trailSL<t.sl)) {
        const old=t.sl, moved=Math.abs(trailSL-old);
        t.sl=trailSL;
        logAction(`Trail x${trailMult}: SL $${old.toFixed(2)} → $${trailSL.toFixed(2)}`);
        notifyClients({ type:'BG_UPDATE_SL', newSL:trailSL, breakEvenSet:t.breakEvenSet, trailingActive:true, action:t.managementLog.slice(-1)[0]?.action, price, scenario:t.scenario, tradeId:t.id, ts:Date.now() });
        if (moved > atr*0.5) {
          await self.registration.showNotification('📍 Trailing aggiornato', {
            body: `${dir} · SL $${old.toFixed(2)} → $${trailSL.toFixed(2)} · ${profRR.toFixed(1)}R`,
            icon:'/icon-192.png', tag:'paper-trail', vibrate:[100,50,100],
          });
        }
      }
    }

    openTrades[t.scenario || 'swing'] = t;
    syncLegacyOpen();
    notifyClients({ type:'BG_TRADE_UPDATE', trade:t, price, profRR, ts:Date.now() });
    continue;
  }

  // ── Chiudi trade ──────────────────────────────────────────
  const exitSpread = exitFill(exitPrice, dir, swSpread(t), swSlippage(t));
  const pnlPts = dir==='BUY' ? exitSpread-t.entry : t.entry-exitSpread;
  const pnlEur = +(pnlPts*t.lots*100).toFixed(2);
  const pnlTotal = +(pnlEur + (t.partialPnl || 0)).toFixed(2);
  const isWin  = pnlTotal > 0;
  const capitalBeforeClose = paperCapital;

  paperCapital = +(paperCapital + pnlEur).toFixed(2);

  paperCapitalPeak = Math.max(paperCapitalPeak, paperCapital);

  const riskInitial = initialRiskDistance(t);
  const riskEurInitial = t.riskEur || +(riskInitial * (t.lotsInitial ?? t.lots) * 100).toFixed(2);
  const standaloneAfter = +((t.capitalBefore ?? t.capitalAtOpen ?? 0) + pnlTotal).toFixed(2);
  const closedTrade = {
    ...t,
    exitPrice:exitSpread,
    exitReason: (exitReason === 'SL' && t.breakEvenSet) ? 'SL_BE' : exitReason,
    pnlEur,
    finalPnl: pnlEur,
    pnlTotal,
    isWin,
    closedAt: new Date().toISOString(),
    capitalBeforeClose,
    capitalAfter: paperCapital,
    portfolioCapitalAfter: paperCapital,
    standaloneCapitalAfter: standaloneAfter,
    reconciliationDelta: +(paperCapital - standaloneAfter).toFixed(2),
    slFinal: t.sl,
    tp2Final: t.tp2,
    rrFinal: +(pnlPts/riskInitial).toFixed(2),
    rr: +(pnlTotal/(riskEurInitial || 1)).toFixed(2),
  };
  paperTrades.unshift(closedTrade);
  if (paperTrades.length > 100) paperTrades.pop();
  if (openTrades) delete openTrades[(closedTrade.scenario) || 'swing'];
  syncLegacyOpen();
  lastTradeTs = Date.now();

  notifyClients({ type:'BG_TRADE_CLOSED', trade:closedTrade, capital:paperCapital, trades:paperTrades, ts:Date.now() });

  const emoji = isWin?'✅':exitReason==='SL'?'❌':'➖';
  await self.registration.showNotification(`${emoji} Trade ${exitReason} — ${dir}`, {
    body: `${pnlTotal>=0?'+':''}€${pnlTotal.toFixed(2)} · Capitale: €${paperCapital.toFixed(0)} · ${profRR.toFixed(2)}R`,
    icon:'/icon-192.png', tag:'paper-bg-exit', vibrate:[300,100,300,100,300], requireInteraction:true,
  });
  console.log('[SW] Trade chiuso:', exitReason, pnlEur);
}
}
async function runAll() {
  if (!tdKey) return;
  console.log('[SW] runAll at', new Date().toLocaleTimeString());
  try {
    const scoring = await computeSwScores();
    if (!scoring) { console.warn('[SW] scoring failed'); return; }

    const { price, rsiNow } = scoring;
    lastCheckTs = Date.now();

    // Aggiorna prezzo in app
    notifyClients({ type:'BG_UPDATE', price, rsi:rsiNow, ts:Date.now() });

    // Paper trading: rivalutazione multi-slot + nuove entry per scenario libero
    syncLegacyOpen();
    for (const t of Object.values(openTrades || {}).filter(Boolean)) {
      const tradeDir = t.direction;
      const oppScore = tradeDir==='BUY' ? scoring.sellScore : scoring.buyScore;
      const ownScore = tradeDir==='BUY' ? scoring.buyScore  : scoring.sellScore;
      if (oppScore >= 72 && oppScore > ownScore + 20) {
        notifyClients({ type:'BG_EXIT_SIGNAL', price, exitReason:'CONSENSUS_REV', scenario:t.scenario, tradeId:t.id, ts:Date.now() });
        await self.registration.showNotification('⚠️ Segnale inversione consenso', {
          body: `[${t.scenario||'slot'}] ${tradeDir} in corso ma score ${tradeDir==='BUY'?'SELL':'BUY'} = ${oppScore}/100.`,
          icon:'/icon-192.png', tag:'paper-consensus-'+(t.scenario||'slot'), vibrate:[300,100,300], requireInteraction:true,
        });
      }
    }
    if (paperEnabled && !(await hasVisibleClient())) {
      await tryAutoEntry(scoring);
    }

    // Alert generali
    await runAlerts(scoring);

  } catch(e) { console.error('[SW] runAll error:', e.message); }
}

// ═══════════════════════════════════════════════════════════════
// ALERT GENERALI
// ═══════════════════════════════════════════════════════════════
async function runAlerts(s) {
  const now = Date.now();
  const cfg = alertCfg;
  const { price, rsiNow, pivot, r1, s1, atr1h } = s;

  const send = async (title, body, tag, vibrate=[200,100,200]) => {
    if (lastAlertTs[tag] && now-lastAlertTs[tag] < COOL_ALERT) return;
    lastAlertTs[tag] = now;
    await self.registration.showNotification(title, {
      body, tag, icon:'/icon-192.png', badge:'/icon-72.png', vibrate,
      requireInteraction: false,
    });
    notifyClients({ type:'ALERT_FIRED', tag, title, ts:now });
  };

  if (cfg.pivot!==false && Math.abs(price-pivot) < atr1h*0.3)
    await send('📍 XAU al Pivot', `$${price.toFixed(2)} vicino Pivot $${pivot.toFixed(2)}`, 'pivot');
  if (cfg.r1!==false && Math.abs(price-r1) < atr1h*0.3)
    await send('🔴 XAU a R1', `$${price.toFixed(2)} — R1 $${r1.toFixed(2)}`, 'r1');
  if (cfg.s1!==false && Math.abs(price-s1) < atr1h*0.3)
    await send('🟢 XAU a S1', `$${price.toFixed(2)} — S1 $${s1.toFixed(2)}`, 's1');
  if (cfg.rsiOB!==false && rsiNow > (cfg.rsiOBLevel||70))
    await send('⚠️ RSI OB', `RSI 1H: ${rsiNow.toFixed(1)}`, 'rsi-ob', [300,100,300]);
  if (cfg.rsiOS!==false && rsiNow < (cfg.rsiOSLevel||30))
    await send('⚡ RSI OS', `RSI 1H: ${rsiNow.toFixed(1)}`, 'rsi-os', [300,100,300]);
  if (cfg.lead!==false && s.macroStr>=2)
    await send(`📡 Lead Macro ${s.macroDir}`, `EUR/USD e TNX → ${s.macroDir} XAU · Str ${s.macroStr}`, 'lead');
  if (cfg.priceAbove && price > cfg.priceAbove)
    await send(`🔔 XAU sopra $${cfg.priceAbove}`, `Prezzo: $${price.toFixed(2)}`, 'price-above');
  if (cfg.priceBelow && price < cfg.priceBelow)
    await send(`🔔 XAU sotto $${cfg.priceBelow}`, `Prezzo: $${price.toFixed(2)}`, 'price-below');
}

// ── Tap notifica ──────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});

function fmtP(v) { return v != null ? (+v).toFixed(2) : '–'; }
