const express = require('express');
const app = express();

app.use(require('cors')({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', require('cors')());
app.use(express.json());

const posts = [];
const MAX_POSTS = 100;

// ─── EXPANDED KEYWORD DEFINITIONS ────────────────────────────────────────────
// category: war | military | economy | tariffs | inflation | rates | housing | energy | sentiment
const KEYWORD_RULES = [
  // War / Conflict — Positive
  { label: 'Ceasefire',           category: 'war',      sentiment: 'positive', pattern: 'ceasefire' },
  { label: 'Peace deal',          category: 'war',      sentiment: 'positive', pattern: 'peace deal' },
  { label: 'War ending',          category: 'war',      sentiment: 'positive', pattern: ['war', 'ending'] },
  { label: 'War over',            category: 'war',      sentiment: 'positive', pattern: ['war', 'over'] },
  { label: 'Troops withdrawn',    category: 'military', sentiment: 'positive', pattern: 'troops withdrawn' },
  { label: 'Troops withdrawn',    category: 'military', sentiment: 'positive', pattern: 'withdraw troops' },
  { label: 'De-escalation',       category: 'war',      sentiment: 'positive', pattern: 'de-escalat' },
  { label: 'Sanctions lifted',    category: 'war',      sentiment: 'positive', pattern: 'sanctions lifted' },
  { label: 'Hormuz open',         category: 'military', sentiment: 'positive', pattern: 'hormuz is open' },
  { label: 'Strait open',         category: 'military', sentiment: 'positive', pattern: ['strait', 'open'] },

  // War / Conflict — Negative
  { label: 'No ceasefire',        category: 'war',      sentiment: 'negative', pattern: 'no ceasefire' },
  { label: 'War escalating',      category: 'war',      sentiment: 'negative', pattern: ['war', 'escalat'] },
  { label: 'War continues',       category: 'war',      sentiment: 'negative', pattern: ['war', 'will continue'] },
  { label: 'War declared',        category: 'war',      sentiment: 'negative', pattern: 'war declared' },
  { label: 'Nuclear threat',      category: 'military', sentiment: 'negative', pattern: 'nuclear' },
  { label: 'Missile strike',      category: 'military', sentiment: 'negative', pattern: 'missile strike' },
  { label: 'Attack launched',     category: 'military', sentiment: 'negative', pattern: 'attack launched' },
  { label: 'Troops deployed',     category: 'military', sentiment: 'negative', pattern: 'troops deployed' },
  { label: 'Sanctions imposed',   category: 'war',      sentiment: 'negative', pattern: 'sanctions' },
  { label: 'Strait blocked',      category: 'military', sentiment: 'negative', pattern: ['strait', 'block'] },
  { label: 'Hormuz blocked',      category: 'military', sentiment: 'negative', pattern: ['hormuz', 'block'] },
  { label: 'Oil embargo',         category: 'energy',   sentiment: 'negative', pattern: 'oil embargo' },

  // Tariffs — Positive
  { label: 'Tariffs removed',     category: 'tariffs',  sentiment: 'positive', pattern: 'removed tariffs' },
  { label: 'Tariffs removed',     category: 'tariffs',  sentiment: 'positive', pattern: 'remove tariffs' },
  { label: 'No tariffs',          category: 'tariffs',  sentiment: 'positive', pattern: 'no tariffs' },
  { label: 'Tariffs ending',      category: 'tariffs',  sentiment: 'positive', pattern: 'end tariffs' },
  { label: 'Tariffs paused',      category: 'tariffs',  sentiment: 'positive', pattern: ['tariff', 'pause'] },
  { label: 'Trade deal',          category: 'tariffs',  sentiment: 'positive', pattern: 'trade deal' },
  { label: 'Deal reached',        category: 'tariffs',  sentiment: 'positive', pattern: ['deal', 'reached'] },
  { label: 'Deal reached',        category: 'tariffs',  sentiment: 'positive', pattern: ['deal', 'reach'] },
  { label: 'Trade agreement',     category: 'tariffs',  sentiment: 'positive', pattern: 'trade agreement' },

  // Tariffs — Negative
  { label: 'More tariffs',        category: 'tariffs',  sentiment: 'negative', pattern: 'more tariffs' },
  { label: 'Tariffs increasing',  category: 'tariffs',  sentiment: 'negative', pattern: 'increase tariffs' },
  { label: 'Tariffs increased',   category: 'tariffs',  sentiment: 'negative', pattern: 'increased tariffs' },
  { label: 'New tariffs',         category: 'tariffs',  sentiment: 'negative', pattern: 'new tariffs' },
  { label: 'Trade war',           category: 'tariffs',  sentiment: 'negative', pattern: 'trade war' },
  { label: 'No deal',             category: 'tariffs',  sentiment: 'negative', pattern: ['no', 'deal'] },
  { label: 'Tariffs on China',    category: 'tariffs',  sentiment: 'negative', pattern: ['tariff', 'china'] },
  { label: 'Import duties',       category: 'tariffs',  sentiment: 'negative', pattern: 'import duty' },
  { label: 'Import duties',       category: 'tariffs',  sentiment: 'negative', pattern: 'import duties' },

  // Economy — Positive
  { label: 'GDP growth',          category: 'economy',  sentiment: 'positive', pattern: ['gdp', 'growth'] },
  { label: 'Jobs added',          category: 'economy',  sentiment: 'positive', pattern: 'jobs added' },
  { label: 'Strong economy',      category: 'economy',  sentiment: 'positive', pattern: 'strong economy' },
  { label: 'Record jobs',         category: 'economy',  sentiment: 'positive', pattern: ['record', 'jobs'] },
  { label: 'Unemployment low',    category: 'economy',  sentiment: 'positive', pattern: ['unemployment', 'low'] },
  { label: 'Consumer confidence', category: 'economy',  sentiment: 'positive', pattern: 'consumer confidence' },
  { label: 'Bull market',         category: 'economy',  sentiment: 'positive', pattern: 'bull market' },

  // Economy — Negative
  { label: 'Recession',           category: 'economy',  sentiment: 'negative', pattern: 'recession' },
  { label: 'GDP decline',         category: 'economy',  sentiment: 'negative', pattern: ['gdp', 'decline'] },
  { label: 'GDP contraction',     category: 'economy',  sentiment: 'negative', pattern: ['gdp', 'contract'] },
  { label: 'Layoffs',             category: 'economy',  sentiment: 'negative', pattern: 'layoff' },
  { label: 'Unemployment rising', category: 'economy',  sentiment: 'negative', pattern: ['unemployment', 'rising'] },
  { label: 'Job losses',          category: 'economy',  sentiment: 'negative', pattern: 'job loss' },
  { label: 'Bear market',         category: 'economy',  sentiment: 'negative', pattern: 'bear market' },
  { label: 'Market crash',        category: 'economy',  sentiment: 'negative', pattern: 'market crash' },
  { label: 'Stock crash',         category: 'economy',  sentiment: 'negative', pattern: ['stock', 'crash'] },
  { label: 'Stagflation',         category: 'economy',  sentiment: 'negative', pattern: 'stagflation' },
  { label: 'Deficit rising',      category: 'economy',  sentiment: 'negative', pattern: ['deficit', 'rising'] },

  // Inflation — Positive
  { label: 'Inflation cooling',   category: 'inflation', sentiment: 'positive', pattern: ['inflation', 'cool'] },
  { label: 'Inflation falling',   category: 'inflation', sentiment: 'positive', pattern: ['inflation', 'fall'] },
  { label: 'CPI down',            category: 'inflation', sentiment: 'positive', pattern: ['cpi', 'down'] },
  { label: 'Prices stabilizing',  category: 'inflation', sentiment: 'positive', pattern: 'prices stabiliz' },

  // Inflation — Negative
  { label: 'Inflation rising',    category: 'inflation', sentiment: 'negative', pattern: ['inflation', 'rising'] },
  { label: 'Inflation surging',   category: 'inflation', sentiment: 'negative', pattern: ['inflation', 'surge'] },
  { label: 'CPI up',              category: 'inflation', sentiment: 'negative', pattern: ['cpi', 'up'] },
  { label: 'Prices rising',       category: 'inflation', sentiment: 'negative', pattern: 'prices rising' },
  { label: 'Cost of living',      category: 'inflation', sentiment: 'negative', pattern: 'cost of living' },

  // Interest Rates — Positive
  { label: 'Rate cut',            category: 'rates',    sentiment: 'positive', pattern: 'rate cut' },
  { label: 'Rates cut',           category: 'rates',    sentiment: 'positive', pattern: 'rates cut' },
  { label: 'Fed cuts',            category: 'rates',    sentiment: 'positive', pattern: ['fed', 'cut'] },
  { label: 'Lower rates',         category: 'rates',    sentiment: 'positive', pattern: 'lower rates' },
  { label: 'Rates falling',       category: 'rates',    sentiment: 'positive', pattern: ['rates', 'falling'] },
  { label: 'Pivot',               category: 'rates',    sentiment: 'positive', pattern: ['fed', 'pivot'] },

  // Interest Rates — Negative
  { label: 'Rate hike',           category: 'rates',    sentiment: 'negative', pattern: 'rate hike' },
  { label: 'Rates raised',        category: 'rates',    sentiment: 'negative', pattern: 'rates raised' },
  { label: 'Fed hikes',           category: 'rates',    sentiment: 'negative', pattern: ['fed', 'hike'] },
  { label: 'Higher rates',        category: 'rates',    sentiment: 'negative', pattern: 'higher rates' },
  { label: 'Rates rising',        category: 'rates',    sentiment: 'negative', pattern: ['rates', 'rising'] },
  { label: 'Yield rising',        category: 'rates',    sentiment: 'negative', pattern: ['yield', 'rising'] },
  { label: 'Inverted yield',      category: 'rates',    sentiment: 'negative', pattern: 'inverted yield' },

  // Housing — Positive
  { label: 'Housing starts up',   category: 'housing',  sentiment: 'positive', pattern: ['housing', 'starts'] },
  { label: 'Home sales up',       category: 'housing',  sentiment: 'positive', pattern: ['home sales', 'up'] },
  { label: 'Mortgage rates down', category: 'housing',  sentiment: 'positive', pattern: ['mortgage', 'down'] },

  // Housing — Negative
  { label: 'Housing crash',       category: 'housing',  sentiment: 'negative', pattern: ['housing', 'crash'] },
  { label: 'Home prices falling', category: 'housing',  sentiment: 'negative', pattern: ['home prices', 'fall'] },
  { label: 'Mortgage rates high', category: 'housing',  sentiment: 'negative', pattern: ['mortgage', 'high'] },
  { label: 'Foreclosures rising', category: 'housing',  sentiment: 'negative', pattern: 'foreclosure' },

  // Energy — Positive
  { label: 'Oil prices falling',  category: 'energy',   sentiment: 'positive', pattern: ['oil', 'falling'] },
  { label: 'Oil prices down',     category: 'energy',   sentiment: 'positive', pattern: ['oil', 'down'] },
  { label: 'Gas prices falling',  category: 'energy',   sentiment: 'positive', pattern: ['gas', 'falling'] },
  { label: 'Energy deal',         category: 'energy',   sentiment: 'positive', pattern: ['energy', 'deal'] },

  // Energy — Negative
  { label: 'Oil prices rising',   category: 'energy',   sentiment: 'negative', pattern: ['oil', 'rising'] },
  { label: 'Oil prices surge',    category: 'energy',   sentiment: 'negative', pattern: ['oil', 'surge'] },
  { label: 'Gas prices rising',   category: 'energy',   sentiment: 'negative', pattern: ['gas prices', 'rising'] },
  { label: 'Supply cut',          category: 'energy',   sentiment: 'negative', pattern: ['opec', 'cut'] },
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
        category: rule.category,
        sentiment: rule.sentiment,
        color: rule.sentiment === 'positive' ? '#3ecf8e' : '#f06060',
        pattern: Array.isArray(rule.pattern) ? rule.pattern.join(' + ') : rule.pattern
      });
    }
  }
  return found;
}

// ─── NDX PROXY ───────────────────────────────────────────────────────────────
async function fetchNDXPrice() {
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
        price = meta.regularMarketPrice;
        prev  = meta.chartPreviousClose || meta.previousClose;
        open  = meta.regularMarketOpen || prev;
        high  = meta.regularMarketDayHigh || price;
        low   = meta.regularMarketDayLow  || price;
        high52 = meta.fiftyTwoWeekHigh;
        low52  = meta.fiftyTwoWeekLow;
        chg   = price - prev;
        chgPct = prev ? (chg / prev) * 100 : 0;
      } else if (d?.quoteResponse?.result?.[0]) {
        const q = d.quoteResponse.result[0];
        price = q.regularMarketPrice; chg = q.regularMarketChange;
        chgPct = q.regularMarketChangePercent; open = q.regularMarketOpen;
        high = q.regularMarketDayHigh; low = q.regularMarketDayLow;
        prev = q.regularMarketPreviousClose;
        high52 = q.fiftyTwoWeekHigh; low52 = q.fiftyTwoWeekLow;
      }
      if (!price) continue;
      return { price, chg, chgPct, open, high, low, prev, high52, low52 };
    } catch(e) { continue; }
  }
  return null;
}

app.get('/ndx', async (req, res) => {
  const data = await fetchNDXPrice();
  if (data) {
    console.log(`[NDX] price=${data.price}`);
    return res.json({ ok: true, ...data });
  }
  res.status(503).json({ ok: false, error: 'All endpoints failed' });
});

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  const ts = new Date().toISOString();
  console.log(`\n[INCOMING] ${ts}`);
  console.log(JSON.stringify(req.body, null, 2).split('\n').map(l => '    ' + l).join('\n'));

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

  // Snapshot NDX price at post arrival time
  const ndxSnapshot = await fetchNDXPrice();
  const priceAtPost = ndxSnapshot ? ndxSnapshot.price : null;

  const post = {
    id: postId,
    event: req.body.event || 'post.created',
    content, link,
    published_at: publishedAt,
    source_categories: sourceCategories,
    keywords,
    received_at: ts,
    price_at_post: priceAtPost,   // NDX price when post arrived
    price_20min: null,            // filled in after 20 min
    price_delta: null,            // price_20min - price_at_post
    impact: 'pending'             // pending | up | down | neutral
  };

  console.log(`  keywords: ${keywords.length ? keywords.map(k => k.label).join(', ') : 'none'}`);
  console.log(`  NDX at post: ${priceAtPost || 'unavailable'}`);

  posts.unshift(post);
  if (posts.length > MAX_POSTS) posts.pop();

  // Schedule 20-min price check
  if (priceAtPost) {
    setTimeout(async () => {
      const later = await fetchNDXPrice();
      if (!later) return;
      const delta = later.price - priceAtPost;
      const found = posts.find(p => p.id === postId);
      if (found) {
        found.price_20min = later.price;
        found.price_delta = delta;
        found.impact = delta >= 100 ? 'up' : delta <= -100 ? 'down' : 'neutral';
        console.log(`[IMPACT] post ${postId} | delta=${delta.toFixed(2)} | impact=${found.impact}`);
      }
    }, 20 * 60 * 1000); // 20 minutes
  }

  res.json({ ok: true, id: post.id, keywordsFound: keywords.length, keywords: keywords.map(k => k.label), price_at_post: priceAtPost });
});

// ─── POSTS POLLING ───────────────────────────────────────────────────────────
app.get('/posts', (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : null;
  const result = since ? posts.filter(p => new Date(p.received_at) > since) : posts;
  res.json({ posts: result, count: result.length, total: posts.length });
});

// ─── KEYWORD LEADERBOARD ─────────────────────────────────────────────────────
// Returns keywords ranked by how many times they appeared in impactful posts
app.get('/leaderboard', (req, res) => {
  const scores = {};
  for (const post of posts) {
    if (post.impact === 'up' || post.impact === 'down') {
      for (const kw of post.keywords) {
        const key = kw.label;
        if (!scores[key]) scores[key] = { label: kw.label, category: kw.category, sentiment: kw.sentiment, color: kw.color, up: 0, down: 0, total: 0 };
        if (post.impact === 'up')   scores[key].up++;
        if (post.impact === 'down') scores[key].down++;
        scores[key].total++;
      }
    }
  }
  const ranked = Object.values(scores).sort((a, b) => b.total - a.total);
  res.json({ leaderboard: ranked });
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', totalPosts: posts.length }));

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Truth Social Webhook Server`);
  console.log(`  GET    /ndx          — NDX price proxy`);
  console.log(`  POST   /webhook      — receive posts`);
  console.log(`  GET    /posts        — poll for new posts`);
  console.log(`  GET    /leaderboard  — keyword impact leaderboard`);
  console.log(`  GET    /health       — status`);
  console.log(`  Port   ${PORT}\n`);
});
