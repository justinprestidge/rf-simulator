const express = require('express');
const https   = require('https');
const path    = require('path');
 
const app     = express();
const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
 
app.use(express.json({ limit: '500kb' }));
app.use(express.static(path.join(__dirname, 'public')));
 
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
app.post('/api/chat', (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server error', detail: 'API key not configured' });
  }
 
  const { model, max_tokens, messages, system } = req.body;
 
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
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
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(payload),
      'anthropic-version': '2023-06-01',
      'x-api-key':         API_KEY,
    },
  };
 
  const apiReq = https.request(options, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      if (apiRes.statusCode !== 200) {
        return res.status(apiRes.statusCode).json({
          error:  'API error: ' + apiRes.statusCode,
          detail: 'Unexpected API error.',
        });
      }
      try {
        res.json(JSON.parse(body));
      } catch (e) {
        res.status(500).json({ error: 'Server error', detail: 'Bad API response' });
      }
    });
  });
 
  apiReq.on('error', (err) => {
    res.status(500).json({ error: 'Server error', detail: err.message });
  });
 
  apiReq.setTimeout(60000, () => {
    apiReq.destroy();
    res.status(504).json({ error: 'Timeout' });
  });
 
  apiReq.write(payload);
  apiReq.end();
});
 
app.get('/health', (req, res) => res.json({ status: 'ok' }));
 
app.listen(PORT, () => console.log('Server running on port ' + PORT));
