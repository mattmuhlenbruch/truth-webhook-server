// server.js — Truth Social Post Webhook Receiver
// Run: node server.js
// Requires: npm install express ws cors

const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ─── KEYWORD DEFINITIONS ─────────────────────────────────────────────────────
const KEYWORD_CATEGORIES = {
  tariffs: {
    label: 'Tariffs',
    color: '#f0a040',
    terms: ['tariff', 'tariffs', 'trade war', 'import tax', 'import duty', 'duties', 'customs', 'levy', 'protectionist', 'trade deal', 'trade agreement', 'trade deficit']
  },
  fed: {
    label: 'Federal Reserve',
    color: '#4d9fff',
    terms: ['fed', 'federal reserve', 'powell', 'fomc', 'interest rate', 'rate hike', 'rate cut', 'basis points', 'bps', 'monetary policy', 'quantitative easing', 'qe', 'tightening', 'inflation target']
  },
  rates: {
    label: 'Rates / Bonds',
    color: '#3ecf8e',
    terms: ['interest rate', 'rates', 'yield', 'bond', 'bonds', 'treasury', 'ten year', '10-year', '10 year', '2-year', 'two year', 'spread', 'inversion', 'inverted yield', 'debt ceiling']
  },
  markets: {
    label: 'Markets',
    color: '#bc7aff',
    terms: ['nasdaq', 'ndx', 's&p', 'sp500', 'dow jones', 'dow', 'stocks', 'equity', 'equities', 'rally', 'selloff', 'sell-off', 'crash', 'correction', 'bear market', 'bull market', 'volatility', 'vix']
  },
  economy: {
    label: 'Economy',
    color: '#f06060',
    terms: ['recession', 'gdp', 'inflation', 'cpi', 'pce', 'jobs report', 'unemployment', 'nonfarm', 'payrolls', 'economy', 'economic', 'growth', 'stagflation', 'deficit', 'debt']
  },
  china: {
    label: 'China / Trade',
    color: '#ff8c5a',
    terms: ['china', 'chinese', 'beijing', 'xi jinping', 'xi', 'decoupling', 'supply chain', 'semiconductor', 'chips act', 'taiwan', 'trade war']
  }
};

function parseKeywords(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [key, cat] of Object.entries(KEYWORD_CATEGORIES)) {
    const matchedTerms = cat.terms.filter(term => lower.includes(term));
    if (matchedTerms.length > 0) {
      found.push({
        category: key,
        label: cat.label,
        color: cat.color,
        terms: [...new Set(matchedTerms)]
      });
    }
  }
  return found;
}

// ─── WEBHOOK ENDPOINT ────────────────────────────────────────────────────────
// Expects the Truth Social webhook format:
// {
//   "event": "post.created",
//   "data": {
//     "id": "uuid",
//     "content": "...",
//     "link": "https://truthsocial.com/...",
//     "published_at": "2025-11-20T12:00:00Z",
//     "categories": [{ "name": "economy", "display_name": "Economy" }]
//   },
//   "timestamp": "2025-11-20T12:00:01Z"
// }
app.post('/webhook', (req, res) => {
  const ts = new Date().toISOString();

  // ── Full payload debug log ──────────────────────────────────────────────────
  console.log('\n' + '-'.repeat(60));
  console.log(`[INCOMING] ${ts}`);
  console.log(`  IP      : ${req.ip || req.connection.remoteAddress}`);
  console.log(`  Method  : ${req.method} ${req.path}`);
  console.log('  Headers :');
  ['content-type','user-agent','x-forwarded-for','host'].forEach(h => {
    if (req.headers[h]) console.log(`    ${h}: ${req.headers[h]}`);
  });
  console.log('  Body (raw):');
  console.log(JSON.stringify(req.body, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  console.log('-'.repeat(60));

  const event = req.body && req.body.event;
  const data  = req.body && req.body.data;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!req.body || Object.keys(req.body).length === 0) {
    console.log('  [ERROR] Empty or non-JSON body — missing Content-Type: application/json?');
    return res.status(400).json({ error: 'Empty body — set Content-Type: application/json' });
  }
  if (!data) {
    console.log(`  [ERROR] Missing "data" key. Got: ${Object.keys(req.body).join(', ')}`);
    return res.status(400).json({ error: 'Missing "data" field', receivedKeys: Object.keys(req.body) });
  }
  if (!data.content) {
    console.log(`  [ERROR] Missing data.content. data keys: ${Object.keys(data).join(', ')}`);
    return res.status(400).json({ error: 'Missing data.content', receivedDataKeys: Object.keys(data) });
  }

  // ── Parse ───────────────────────────────────────────────────────────────────
  const content          = data.content;
  const postId           = data.id || String(Date.now());
  const link             = data.link || null;
  const publishedAt      = data.published_at || req.body.timestamp || new Date().toISOString();
  const sourceCategories = (data.categories || []).map(c => c.display_name || c.name);
  const keywords         = parseKeywords(content);

  const post = {
    id: postId,
    event: event || 'post.created',
    content,
    link,
    published_at: publishedAt,
    source_categories: sourceCategories,
    keywords
  };

  // ── Parsed result log ───────────────────────────────────────────────────────
  console.log('  [PARSED]');
  console.log(`    event             : ${post.event}`);
  console.log(`    id                : ${post.id}`);
  console.log(`    published_at      : ${post.published_at}`);
  console.log(`    link              : ${post.link || 'none'}`);
  console.log(`    source_categories : ${sourceCategories.join(', ') || 'none'}`);
  console.log(`    content           : ${content.slice(0,120)}${content.length > 120 ? '...' : ''}`);
  console.log(`    keywords matched  : ${keywords.length ? keywords.map(k => k.label + ' (' + k.terms.join(', ') + ')').join(' | ') : 'none'}`);
  console.log(`    ws clients        : ${clients.size}`);
  console.log('-'.repeat(60) + '\n');

  broadcast({ type: 'post', data: post });
  res.json({ ok: true, id: post.id, keywordsFound: keywords.length, keywords: keywords.map(k => k.label) });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', clients: clients.size }));

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n  Truth Social Webhook Server`);
  console.log(`  POST  http://localhost:${PORT}/webhook`);
  console.log(`  WS    ws://localhost:${PORT}`);
  console.log(`  Health http://localhost:${PORT}/health\n`);
  console.log(`  Example curl:`);
  console.log(`  curl -X POST http://localhost:${PORT}/webhook \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"event":"post.created","data":{"id":"abc123","content":"The Fed must cut rates. Tariffs on China are working!","link":"https://truthsocial.com/post/1","published_at":"2026-03-30T10:00:00Z","categories":[{"name":"economy","display_name":"Economy"}]},"timestamp":"2026-03-30T10:00:01Z"}'\n`);
});
