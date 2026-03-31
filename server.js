const express = require('express');
const app = express();

app.use(require('cors')({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', require('cors')());
app.use(express.json());

// In-memory post store (last 100 posts)
const posts = [];
const MAX_POSTS = 100;

// ─── KEYWORD DEFINITIONS ─────────────────────────────────────────────────────
// Each rule has a label, sentiment (positive/negative), and a list of match
// patterns. A pattern is either a single string (substring match) or an array
// of strings (ALL must appear anywhere in the text — AND logic).

const KEYWORD_RULES = [
  // ── POSITIVE ────────────────────────────────────────────────────────────────
  { label: 'Ceasefire',         sentiment: 'positive', pattern: 'ceasefire' },
  { label: 'War ending',        sentiment: 'positive', pattern: ['war', 'end'] },
  { label: 'War ending',        sentiment: 'positive', pattern: ['war', 'ending'] },
  { label: 'War over',          sentiment: 'positive', pattern: ['war', 'over'] },
  { label: 'Deal reached',      sentiment: 'positive', pattern: ['deal', 'reach'] },
  { label: 'Deal reached',      sentiment: 'positive', pattern: ['deal', 'reached'] },
  { label: 'Tariffs removed',   sentiment: 'positive', pattern: 'removed tariffs' },
  { label: 'Tariffs removed',   sentiment: 'positive', pattern: 'remove tariffs' },
  { label: 'No tariffs',        sentiment: 'positive', pattern: 'no tariffs' },
  { label: 'Tariffs ending',    sentiment: 'positive', pattern: 'end tariffs' },
  { label: 'Hormuz open',       sentiment: 'positive', pattern: 'hormuz is open' },

  // ── NEGATIVE ────────────────────────────────────────────────────────────────
  { label: 'No ceasefire',      sentiment: 'negative', pattern: 'no ceasefire' },
  { label: 'No deal',           sentiment: 'negative', pattern: ['no', 'deal'] },
  { label: 'War continues',     sentiment: 'negative', pattern: ['war', 'will continue'] },
  { label: 'More tariffs',      sentiment: 'negative', pattern: 'more tariffs' },
  { label: 'Tariffs increasing', sentiment: 'negative', pattern: 'increase tariffs' },
  { label: 'Tariffs increased',  sentiment: 'negative', pattern: 'increased tariffs' },
];

function matchesPattern(lower, pattern) {
  if (Array.isArray(pattern)) {
    return pattern.every(term => lower.includes(term.toLowerCase()));
  }
  return lower.includes(pattern.toLowerCase());
}

function parseKeywords(text) {
  const lower = text.toLowerCase();
  const found = [];
  const seenLabels = new Set();

  for (const rule of KEYWORD_RULES) {
    if (matchesPattern(lower, rule.pattern)) {
      // Deduplicate by label+sentiment
      const key = rule.label + rule.sentiment;
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
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

// ─── WEBHOOK ENDPOINT ────────────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const ts = new Date().toISOString();

  console.log('\n' + '-'.repeat(60));
  console.log(`[INCOMING] ${ts}`);
  console.log(`  IP: ${req.ip || req.connection.remoteAddress}`);
  console.log('  Body:');
  console.log(JSON.stringify(req.body, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  console.log('-'.repeat(60));

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Empty body — set Content-Type: application/json' });
  }

  const event = req.body.event;
  const data  = req.body.data;

  if (!data) {
    return res.status(400).json({ error: 'Missing "data" field', receivedKeys: Object.keys(req.body) });
  }
  if (!data.content) {
    return res.status(400).json({ error: 'Missing data.content', receivedDataKeys: Object.keys(data) });
  }

  const content          = data.content;
  const postId           = data.id || String(Date.now());
  const link             = data.link || null;
  const publishedAt      = data.published_at || req.body.timestamp || ts;
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

  posts.unshift(post);
  if (posts.length > MAX_POSTS) posts.pop();

  res.json({ ok: true, id: post.id, keywordsFound: keywords.length, keywords: keywords.map(k => k.label) });
});

// ─── POLLING ENDPOINT ────────────────────────────────────────────────────────
app.get('/posts', (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : null;
  const result = since
    ? posts.filter(p => new Date(p.received_at) > since)
    : posts;
  res.json({ posts: result, count: result.length, total: posts.length });
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', totalPosts: posts.length });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Truth Social Webhook Server`);
  console.log(`  POST   /webhook  — receive posts`);
  console.log(`  GET    /posts    — poll for new posts`);
  console.log(`  GET    /health   — status check`);
  console.log(`  Port   ${PORT}\n`);
});
