const express = require('express');
const app = express();
 
app.use(require('cors')());
app.use(express.json());
 
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
 
app.post('/webhook', (req, res) => {
  console.log('Received:', JSON.stringify(req.body));
  res.json({ ok: true });
});
 
app.get('/posts', (req, res) => {
  res.json({ posts: [], count: 0 });
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
 
