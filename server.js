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
 *
 * DEPLOY TO THE INTERNET (so field associates can reach it):
 *   - Easiest: Railway.app, Render.com, or Fly.io — all free tiers available
 *   - Internal: Any server or VM on your network
 *   - See README.md for step-by-step deployment instructions
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

// Optional: restrict to your company IP range
// Uncomment and set your company IP/CIDR if you want IP-based access control
// const ALLOWED_IPS = process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : null;
// app.use((req, res, next) => {
//   if (ALLOWED_IPS && !ALLOWED_IPS.some(ip => req.ip.startsWith(ip.trim()))) {
//     return res.status(403).json({ error: 'Access denied' });
//   }
//   next();
// });

// Optional: simple password protection
// Set ACCESS_PASSWORD in .env to require a password
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;

// Rate limiting — prevent API abuse
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 30,                // max 30 requests per minute per IP
  message: { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Serve the simulator HTML ──
app.use(express.static(__dirname));

// Password check middleware (if ACCESS_PASSWORD is set)
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

  // Validate request
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
        model:      model      || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 500,
        messages,
        ...(system ? { system } : {}),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Anthropic API error ${response.status}:`, errText.slice(0, 200));
      return res.status(response.status).json({
        error: `API error: ${response.status}`,
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

// ── Usage stats endpoint (optional — shows monthly API cost estimate) ──
let requestCount = 0;
let tokenCount   = 0;
app.use('/api/', (req, res, next) => { requestCount++; next(); });

app.get('/api/stats', (req, res) => {
  res.json({
    requests_this_session: requestCount,
    estimated_cost_usd: (tokenCount * 0.000003).toFixed(4),
    note: 'Rough estimate based on ~1000 tokens/request at Sonnet pricing',
  });
});

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n✅ RF Sales Call Simulator running at http://localhost:${PORT}`);
  console.log(`   API key: ${API_KEY.slice(0, 12)}...${API_KEY.slice(-4)} (configured)`);
  if (ACCESS_PASSWORD) console.log(`   Password protection: enabled`);
  console.log(`\n   Share this URL with your associates (replace localhost with your server IP/domain)\n`);
});
