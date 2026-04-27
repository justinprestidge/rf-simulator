#!/usr/bin/env node
/**
 * RF Sales Call Simulator — Standalone Server
 * Zero external dependencies — uses Node.js built-ins only.
 * 
 * SETUP (one time):
 *   1. Install Node.js from nodejs.org (LTS version)
 *   2. Put your Anthropic API key in a file called "apikey.txt" 
 *      in the same folder as this file
 *   3. Double-click "start.bat" (Windows) or run "node server-standalone.js"
 *
 * The browser will open automatically.
 */

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const url     = require('url');
const { exec } = require('child_process');

const PORT = 3000;

// ── Read API key from apikey.txt (same folder as this script) ──
const KEY_FILE = path.join(__dirname, 'apikey.txt');
let API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!API_KEY && fs.existsSync(KEY_FILE)) {
  API_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim()
    .replace(/^ANTHROPIC_API_KEY=/, '').trim();
}

if (!API_KEY) {
  console.error('\n========================================');
  console.error('  ERROR: No API key found.');
  console.error('');
  console.error('  Create a file called "apikey.txt" in');
  console.error('  the same folder as this program and');
  console.error('  paste your Anthropic API key in it.');
  console.error('');
  console.error('  Get a key at: console.anthropic.com');
  console.error('========================================\n');
  process.exit(1);
}

// ── Read optional password from password.txt ──
const PWD_FILE = path.join(__dirname, 'password.txt');
const ACCESS_PASSWORD = fs.existsSync(PWD_FILE)
  ? fs.readFileSync(PWD_FILE, 'utf8').trim()
  : '';

// ── MIME types ──
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ── Open browser ──
function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'win32'  ? `start "" "${url}"` :
              platform === 'darwin' ? `open "${url}"` :
                                      `xdg-open "${url}"`;
  exec(cmd, err => { if (err) console.log(`  Open your browser at: ${url}`); });
}

// ── Proxy the Anthropic API ──
function proxyAnthropicAPI(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    // Optional password check
    if (ACCESS_PASSWORD) {
      let pwd = req.headers['x-access-password'] || '';
      try {
        const parsed = JSON.parse(body);
        pwd = parsed._password || pwd;
        delete parsed._password;
        body = JSON.stringify(parsed);
      } catch(e) {}
      if (pwd !== ACCESS_PASSWORD) {
        res.writeHead(401, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Invalid password'}));
        return;
      }
    }

    let reqBody;
    try { reqBody = JSON.parse(body); }
    catch(e) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Invalid JSON'}));
      return;
    }

    // Cap max_tokens for safety
    if (reqBody.max_tokens > 2000) reqBody.max_tokens = 2000;

    const postData = JSON.stringify(reqBody);
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'Content-Length':    Buffer.byteLength(postData),
        'anthropic-version': '2023-06-01',
        'x-api-key':         API_KEY,
      },
    };

    const apiReq = https.request(options, apiRes => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, {'Content-Type':'application/json'});
        res.end(data);
      });
    });

    apiReq.on('error', err => {
      console.error('API request error:', err.message);
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Proxy error', detail: err.message}));
    });

    apiReq.setTimeout(60000, () => {
      apiReq.destroy();
      res.writeHead(504, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Request timeout'}));
    });

    apiReq.write(postData);
    apiReq.end();
  });
}

// ── HTTP Server ──
const server = http.createServer((req, res) => {
  const parsed  = url.parse(req.url);
  const reqPath = parsed.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Password');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API proxy
  if (reqPath === '/api/chat' && req.method === 'POST') {
    proxyAnthropicAPI(req, res);
    return;
  }

  // Health check
  if (reqPath === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok', version:'1.0.0'}));
    return;
  }

  // Serve static files from public/ folder
  const publicDir = path.join(__dirname, 'public');
  let filePath = path.join(publicDir, reqPath === '/' ? 'index.html' : reqPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html as fallback
      fs.readFile(path.join(publicDir, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {'Content-Type':'text/html'});
        res.end(data2);
      });
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n========================================');
  console.log('  RF Sales Call Simulator');
  console.log('  Version 1.0');
  console.log('========================================');
  console.log(`\n  Running at: http://localhost:${PORT}`);
  console.log(`  API key:    ${API_KEY.slice(0,12)}...${API_KEY.slice(-4)}`);
  if (ACCESS_PASSWORD) console.log('  Password:   enabled');
  console.log('\n  Opening browser...');
  console.log('  (Close this window to stop the server)\n');

  setTimeout(() => openBrowser(`http://localhost:${PORT}`), 1000);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  Try opening http://localhost:${PORT} directly,`);
    console.error(`  or close other applications using that port.\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n  Shutting down. Goodbye!');
  process.exit(0);
});
