const express    = require('express');
const fetch      = require('node-fetch');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('\n❌ ERROR: ANTHROPIC_API_KEY is not set.\n');
  process.exit(1);
}
 
app.use(express.json({ limit: '500kb' }));
 
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
 
app.use(express.static(path.join(__dirname, 'public')));
 
app.post('/api/chat', async (req, res) => {
  const { model, max_tokens, messages, system } = req.body;
 
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }
  if (max_tokens && max_tokens > 2000) {
    return res.status(400).json({ error: 'max_tokens exceeds allowed limit' });
  }
 
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key':         API_KEY,
      },
      body: JSON.stringify({
        model:      model      || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 500,
        messages,
        ...(system ? { system } : {}),
      }),
    });
 
    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      console.error('Anthropic API error ' + response.status + ':', errText.slice(0, 200));
      return res.status(response.status).json({
        error:  'API error: ' + response.status,
        detail: 'Unexpected API error.',
      });
    }
 
    const data = await response.json();
    res.json(data);
 
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});
 
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
 
app.listen(PORT, () => {
  console.log('\n✅ RF Sales Call Simulator running on port ' + PORT + '\n');
});
