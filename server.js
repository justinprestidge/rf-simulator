/**
 * RF Sales Call Simulator — Backend Proxy Server
 * Node.js / Express
 *
 * This server sits between your associates' browsers and the Anthropic API.
 * It adds your API key server-side so it never appears in the browser.
 *
 * SETUP:
 *   1. Install Node.js (https://nodejs.org) — v18 or higher recommended
 *   2. Run: npm install
 *   3. Create a .env file with your Anthropic API key (see .env.example)
 *   4. Run: node server.js
 *   5. Open http://localhost:3000 in any browser
 */
 
const express    = require('express');
const fetch      = require('node-fetch');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
// ── Validate API key on startup ──
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('\n❌ ERROR: ANTHROPIC_API_KEY is not set.');
  console.error('   Create a .env file with: ANTHROPIC_API_KEY=sk-ant-...\n');
  process.exit(1);
}
 
// ── Middleware ──
app.use(express.json({ limit: '500kb' }));
 
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
 
// Rate limiting — prevent API abuse
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);
 
// ── Serve the simulator HTML ──
app.use(express.static(path.join(__dirname, 'public')));
 
// Password check middleware
function checkPassword(req, res, next) {
  if (!ACCESS_PASSWORD) return next();
  const pwd = req.headers['x-access-password'] || req.query.password;
  if (pwd !== ACCESS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid access password' });
  }
  next();
}
 
// ── API Proxy endpoint ──
app.post('/api/chat', checkPassword, async (req, res) => {
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
        model:      model      || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 500,
        messages,
        ...(system ? { system } : {}),
      }),
    });
 
    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      console.error(`Anthropic API error ${response.status}:`, errText.slice(0, 200));
      return res.status(response.status).json({
        error:  `API error: ${response.status}`,
        detail: response.status === 429 ? 'Rate limit reached. Please try again shortly.' :
                response.status === 401 ? 'Invalid API key. Check server configuration.' :
                'Unexpected API error.',
      });
    }
 
    const data = await response.json();
    res.json(data);
 
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});
 
// ── Stats ──
let requestCount = 0;
app.use('/api/', (req, res, next) => { requestCount++; next(); });
 
app.get('/api/stats', (req, res) => {
  res.json({ requests_this_session: requestCount });
});
 
// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
});
 
// ── Start ──
app.listen(PORT, () => {
  console.log(`\n✅ RF Sales Call Simulator running at http://localhost:${PORT}`);
  console.log(`   API key: ${API_KEY.slice(0, 12)}...${API_KEY.slice(-4)} (configured)\n`);
});
