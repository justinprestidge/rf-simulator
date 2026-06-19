/**
 * RF Sales Call Simulator — Backend Proxy Server
 * Node.js / Express  (no node-fetch dependency — uses built-in https)
 */
 
const express   = require('express');
const https     = require('https');
const path      = require('path');
const rateLimit = require('express-rate-limit');
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
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
 
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── API Proxy using built-in https (no node-fetch needed) ──
app.post('/api/chat', async (req, res) => {
  const { model, max_tokens, messages, system } = req.body;
 
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }
 
  const payload = JSON.stringify({
    model:      model      || 'claude-sonnet-4-6',
    max_tokens: max_tokens || 500,
    messages,
    ...(system ? { system } : {}),
  });
 
  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':        'application/json',
      'Content-Length':      Buffer.byteLength(payload),
      'anthropic-version':   '2023-06-01',
      'x-api-key':           API_KEY,
    },
  };
 
  const apiReq = https.request(options, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      if (apiRes.statusCode !== 200) {
        console.error(`Anthropic error ${apiRes.statusCode}:`, body.slice(0, 200));
        return res.status(apiRes.statusCode).json({
          error:  `API error: ${apiRes.statusCode}`,
          detail: apiRes.statusCode === 429 ? 'Rate limit reached. Try again shortly.' :
                  apiRes.statusCode === 401 ? 'Invalid API key.' :
                  apiRes.statusCode === 404 ? 'Model not found.' :
                  'Unexpected API error.',
        });
      }
      try {
        const data = JSON.parse(body);
        res.json(data);
      } catch (e) {
        console.error('Parse error:', body.slice(0, 200));
        res.status(500).json({ error: 'Server error', detail: 'Unparseable API response' });
      }
    });
  });
 
  apiReq.on('error', (err) => {
    console.error('HTTPS request error:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  });
 
  apiReq.setTimeout(60000, () => {
    apiReq.destroy();
    res.status(504).json({ error: 'Timeout', detail: 'Anthropic API did not respond in time' });
  });
 
  apiReq.write(payload);
  apiReq.end();
});
 
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: 'claude-sonnet-4-6', time: new Date().toISOString() });
});
 
app.listen(PORT, () => {
  console.log(`\n✅ RF Sales Simulator running on port ${PORT}`);
  console.log(`   Model: claude-sonnet-4-6`);
  console.log(`   API key: ${API_KEY.slice(0,12)}...${API_KEY.slice(-4)}\n`);
});
