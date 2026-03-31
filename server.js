const express = require('express');
const app = express();

app.use(require('cors')({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', require('cors')());
app.use(express.json());

// In-memory post store
const posts = [];
const MAX_POSTS = 100;

// ─── KEYWORD DEFINITIONS ─────────────────────────────────────────────────────
const KEYWORD_RULES = [
  { label: 'Ceasefire',          sentiment: 'positive', pattern: 'ceasefire' },
  { label: 'War ending',         sentiment: 'positive', pattern: ['war', 'end'] },
  { label: 'War ending',         sentiment: 'positive', pattern: ['war', 'ending'] },
  { label: 'War over',           sentiment: 'positive', pattern: ['war', 'over'] },
  { label: 'Deal reached',       sentiment: 'positive', pattern: ['deal', 'reach'] },
  { label: 'Deal reached',       sentiment: 'positive', pattern: ['deal', 'reached'] },
  { label: 'Tariffs removed',    sentiment: 'positive', pattern: 'removed tariffs' },
  { label: 'Tariffs removed',    sentiment: 'positive', pattern: 'remove tariffs' },
  { label: 'No tariffs',         sentiment: 'positive', pattern: 'no tariffs' },
  { label: 'Tariffs ending',     sentiment: 'positive', pattern: 'end tariffs' },
  { label: 'Hormuz open',        sentiment: 'positive', pattern: 'hormuz is open' },
  { label: 'No ceasefire',       sentiment: 'negative', pattern: 'no ceasefire' },
  { label: 'No deal',            sentiment: 'negative', pattern: ['no', 'deal'] },
  { label: 'War continues',      sentiment: 'negative', pattern: ['war', 'will continue'] },
  { label: 'More tariffs',       sentiment: 'negative', pattern: 'more tariffs' },
  { label: 'Tariffs increasing', sentiment: 'negative', pattern: 'increase tariffs' },
  { label: 'Tariffs increased',  sentiment: 'negative', pattern: 'increased tariffs' },
];

function matchesPattern(lower, pattern) {
  if (Array.isArray(pattern)) return pattern.every(t => lower.includes(t.toLowerCase()));
  return lower.includes(pattern.toLowerCase());
}

function parseKeywords(text) {
  const lower = text.toLowerCase();
  const found = [];
  const seen = new Set();
  for (const rule of KEYWORD_RULES) {
    if (matchesPattern(lower, rule.pattern)) {
      const key = rule.label + rule.sentiment;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        label: rule.label,
        sentiment: rule.sentiment,
        color: rule.sentiment === 'positive' ? '#3ecf8e' : '#f06060',
        pattern: Array.isArray(rule.pattern) ? rule.pattern.join(' + ') : rule.pattern
      });
    }
  }
  return found;
}

// ─── NDX PROXY ───────────────────────────────────────────────────────────────
app.get('/ndx', async (req, res) => {
  const urls = [
    'https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?interval=1d&range=1d',
    'https://query2.finance.yahoo.com/v8/finance/chart/%5ENDX?interval=1d&range=1d',
    'https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5ENDX&corsDomain=finance.yahoo.com',
    'https://query2.finance.yahoo.com/v7/finance/quote?symbols=%5ENDX&corsDomain=finance.yahoo.com',
  ];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const d = await r.json();

      let price, chg, chgPct, open, high, low, prev, high52, low52;

      if (d?.chart?.result?.[0]) {
        const meta = d.chart.result[0].meta;
        price  = meta.regularMarketPrice;
        prev   = meta.chartPreviousClose || meta.previousClose;
        open   = meta.regularMarketOpen || prev;
        high   = meta.regularMarketDayHigh || price;
        low    = meta.regularMarketDayLow  || price;
        high52 = meta.fiftyTwoWeekHigh;
        low52  = meta.fiftyTwoWeekLow;
        chg    = price - prev;
        chgPct = prev ? (chg / prev) * 100 : 0;
      } else if (d?.quoteResponse?.result?.[0]) {
        const q = d.quoteResponse.result[0];
        price  = q.regularMarketPrice;
        chg    = q.regularMarketChange;
        chgPct = q.regularMarketChangePercent;
        open   = q.regularMarketOpen;
        high   = q.regularMarketDayHigh;
        low    = q.regularMarketDayLow;
        prev   = q.regularMarketPreviousClose;
        high52 = q.fiftyTwoWeekHigh;
        low52  = q.fiftyTwoWeekLow;
      }

      if (!price) continue;
      console.log(`[NDX] ${price} via ${url}`);
      return res.json({ ok: true, price, chg, chgPct, open, high, low, prev, high52, low52 });
    } catch(e) {
      console.log(`[NDX] failed: ${e.message}`);
    }
  }
  res.status(503).json({ ok: false, error: 'All endpoints failed' });
});

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const ts = new Date().toISOString();
  console.log('\n' + '-'.repeat(60));
  console.log(`[INCOMING] ${ts}`);
  console.log(JSON.stringify(req.body, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  console.log('-'.repeat(60));

  const data = req.body && req.body.data;
  if (!req.body || Object.keys(req.body).length === 0)
    return res.status(400).json({ error: 'Empty body' });
  if (!data)
    return res.status(400).json({ error: 'Missing data field', keys: Object.keys(req.body) });
  if (!data.content)
    return res.status(400).json({ error: 'Missing data.content', dataKeys: Object.keys(data) });

  const content          = data.content;
  const postId           = data.id || String(Date.now());
  const link             = data.link || null;
  const publishedAt      = data.published_at || req.body.timestamp || ts;
  const sourceCategories = (data.categories || []).map(c => c.display_name || c.name);
  const keywords         = parseKeywords(content);

  const post = { id: postId, event: req.body.event || 'post.created', content, link, published_at: publishedAt, source_categories: sourceCategories, keywords, received_at: ts };

  console.log(`  keywords: ${keywords.length ? keywords.map(k => k.label).join(', ') : 'none'}`);
  posts.unshift(post);
  if (posts.length > MAX_POSTS) posts.pop();

  res.json({ ok: true, id: post.id, keywordsFound: keywords.length, keywords: keywords.map(k => k.label) });
});

// ─── POSTS POLLING ───────────────────────────────────────────────────────────
app.get('/posts', (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : null;
  const result = since ? posts.filter(p => new Date(p.received_at) > since) : posts;
  res.json({ posts: result, count: result.length, total: posts.length });
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', totalPosts: posts.length }));

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Truth Social Webhook Server`);
  console.log(`  GET    /ndx      — NDX price proxy`);
  console.log(`  POST   /webhook  — receive posts`);
  console.log(`  GET    /posts    — poll for new posts`);
  console.log(`  GET    /health   — status`);
  console.log(`  Port   ${PORT}\n`);
});
