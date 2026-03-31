// server.js — Truth Social Post Webhook Receiver
// Run: node server.js
// Requires: npm install express cors

const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// In-memory post store (last 100 posts)
const posts = [];
const MAX_POSTS = 100;

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
app.post('/webhook', (req, res) => {
  const ts = new Date().toISOString();

  console.log('\n' + '-'.repeat(60));
  console.log(`[INCOMING] ${ts}`);
  console.log(`  IP      : ${req.ip || req.connection.remoteAddress}`);
  console.log('  Body (raw):');
  console.log(JSON.stringify(req.body, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  console.log('-'.repeat(60));

  const event = req.body && req.body.event;
  const data  = req.body && req.body.data;

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Empty body — set Content-Type: application/json' });
  }
  if (!data) {
    return res.status(400).json({ error: 'Missing "data" field', receivedKeys: Object.keys(req.body) });
  }
  if (!data.content) {
    return res.status(400).json({ error: 'Missing data.content', receivedDataKeys: Object.keys(data) });
  }

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
    keywords,
    received_at: ts
  };

  console.log(`  [PARSED] keywords: ${keywords.length ? keywords.map(k => k.label).join(', ') : 'none'}`);
  console.log('-'.repeat(60) + '\n');

  // Store post (newest first, cap at MAX_POSTS)
  posts.unshift(post);
  if (posts.length > MAX_POSTS) posts.pop();

  res.json({ ok: true, id: post.id, keywordsFound: keywords.length, keywords: keywords.map(k => k.label) });
});

// ─── POLLING ENDPOINT ────────────────────────────────────────────────────────
// Frontend polls this every 2 seconds
// Pass ?since=ISO_TIMESTAMP to only get new posts
app.get('/posts', (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : null;
  const result = since
    ? posts.filter(p => new Date(p.received_at) > since)
    : posts;
  res.json({ posts: result, count: result.length, total: posts.length });
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', totalPosts: posts.length }));

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Truth Social Webhook Server (polling mode)`);
  console.log(`  POST   /webhook  — receive posts`);
  console.log(`  GET    /posts    — poll for new posts`);
  console.log(`  GET    /health   — health check`);
  console.log(`  Port   ${PORT}\n`);
});
