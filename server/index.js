const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const { scrapeAll } = require('./scrapers');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// ── Password check ─────────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  const correct = process.env.APP_PASSWORD || 'ironwatch2024';
  if (password === correct) {
    res.json({ success: true, token: Buffer.from(`ironwatch:${Date.now()}`).toString('base64') });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password' });
  }
});

// ── Verify token middleware ────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    const decoded = Buffer.from(auth.replace('Bearer ', ''), 'base64').toString();
    if (decoded.startsWith('ironwatch:')) return next();
    return res.status(401).json({ error: 'Invalid token' });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Get listings ───────────────────────────────────────────────────────────────
app.get('/api/listings', requireAuth, async (req, res) => {
  try {
    const keywords = req.query.keywords ? req.query.keywords.split(',') : [];
    const forceRefresh = req.query.refresh === 'true';
    const result = await scrapeAll(keywords, forceRefresh);
    res.json(result);
  } catch (err) {
    console.error('Listings error:', err);
    res.status(500).json({ error: 'Scrape failed', listings: [] });
  }
});

// ── Manual scan trigger (SSE stream) ──────────────────────────────────────────
app.post('/api/scan', requireAuth, async (req, res) => {
  try {
    const keywords = req.body.keywords || [];
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (msg) => res.write(`data: ${JSON.stringify({ msg })}\n\n`);

    send('🔍 Connecting to Mascus UK...');
    send('🔍 Connecting to Bidspotter...');
    send('🔍 Connecting to Euro Auctions...');
    send('🔍 Connecting to Ritchie Bros...');

    const result = await scrapeAll(keywords, true);
    const { perPlatform, listings } = result;

    send(`✅ Mascus: ${perPlatform.mascus} listings found`);
    send(`✅ Bidspotter: ${perPlatform.bidspotter} listings found`);
    send(`✅ Euro Auctions: ${perPlatform.euroauctions} listings found`);
    send(`✅ Ritchie Bros: ${perPlatform.ritchie} listings found`);
    send('🤖 Running AI relevance scoring...');
    send('📍 Applying location & filter criteria...');
    send(`🎯 ${listings.length} listings indexed`);
    send('✅ Scan complete. Next auto-scan in 4 hours.');

    res.write(`data: ${JSON.stringify({ done: true, count: listings.length })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Scan error:', err);
    res.write(`data: ${JSON.stringify({ msg: '⚠️ Scan encountered errors — partial results saved' })}\n\n`);
    res.end();
  }
});

// ── Claude API proxy ───────────────────────────────────────────────────────────
app.post('/api/analyse', requireAuth, async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: req.body.messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`IRONWATCH server running on port ${PORT}`);
  // Warm the cache on startup
  scrapeAll([], false).catch(err => console.error('Startup scrape error:', err));
});
