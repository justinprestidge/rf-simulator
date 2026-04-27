# RF Sales Call Simulator — Deployment Guide

Associates do NOT need a Claude account. You run one server with your
own API key and everyone connects to it from any browser.

---

## What's in this package

```
deployment/
├── server.js          Node.js server (recommended)
├── server.py          Python/Flask alternative
├── package.json       Node.js dependencies
├── .env.example       Configuration template
└── public/
    └── index.html     The simulator (pre-configured for this server)
```

---

## Option A — Run on your local machine (testing / single location)

Good for: testing, branch manager uses, single-office rollout.

**Step 1 — Install Node.js**
Download from https://nodejs.org (choose LTS version)

**Step 2 — Get an Anthropic API key**
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Click "API Keys" → "Create Key"
4. Copy the key (starts with `sk-ant-`)

**Step 3 — Configure**
```bash
cd deployment
cp .env.example .env
```
Open `.env` in any text editor and paste your key:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

**Step 4 — Install and run**
```bash
npm install
node server.js
```

**Step 5 — Open**
Go to http://localhost:3000 in any browser. Share this link with
anyone on the same network: http://YOUR-COMPUTER-IP:3000

To find your IP on Windows: open Command Prompt → type `ipconfig`
To find your IP on Mac: System Preferences → Network

---

## Option B — Deploy to the internet (full field rollout)

Best free option: **Railway.app** — takes about 10 minutes.

**Step 1 — Create a free Railway account**
Go to https://railway.app and sign up with GitHub

**Step 2 — Deploy**
1. In Railway, click "New Project" → "Deploy from GitHub repo"
   (or "Deploy from local directory" if you don't use GitHub)
2. Upload this `deployment/` folder
3. Railway detects it's a Node.js app automatically

**Step 3 — Set environment variables**
In Railway dashboard → your project → Variables:
```
ANTHROPIC_API_KEY = sk-ant-your-key-here
ACCESS_PASSWORD   = ChooseAPassword123
```

**Step 4 — Get your URL**
Railway gives you a URL like `https://rf-simulator-production.up.railway.app`
Share that URL with all your associates — no account needed, just the URL.

---

## Option C — Deploy to Render.com (also free)

1. Go to https://render.com → "New Web Service"
2. Connect your GitHub or upload files
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add environment variables (same as Railway)
6. Deploy — get your URL

---

## Option D — Internal company server (IT-managed)

If Republic Finance has a server or VM available:

```bash
# On the server:
git clone [your repo] or scp the deployment/ folder
cd deployment
npm install
cp .env.example .env
# Edit .env with your API key

# Run permanently with PM2 (process manager):
npm install -g pm2
pm2 start server.js --name rf-simulator
pm2 startup   # auto-start on reboot
pm2 save

# Access at: http://server-ip:3000
# Or set up nginx to give it a proper domain/HTTPS
```

---

## Security options

**Password protection** (recommended for internet deployment)
Set `ACCESS_PASSWORD=YourPassword` in `.env`
Associates enter the password once — it's remembered in their session.

**IP restriction** (if all associates are on company VPN)
Set `ALLOWED_IPS=10.0.0.,192.168.` in `.env` (your VPN IP ranges)
Only requests from those IPs are accepted.

**Both** — use password + VPN restriction for maximum security.

---

## Cost estimate

Anthropic bills per token (roughly per word processed).
A typical 10-minute practice call with 15 exchanges costs ~$0.05–0.15.
100 practice sessions/month = approximately $5–15/month total.

Monitor usage at: https://console.anthropic.com/usage

---

## Updating the simulator

When a new version of the simulator is ready:
1. Replace `public/index.html` with the new file
2. Restart: `node server.js` (or `pm2 restart rf-simulator`)
No other changes needed.

---

## Troubleshooting

**"ANTHROPIC_API_KEY is not set"**
→ Check your .env file exists and has the key spelled correctly

**"Invalid API key"**
→ Your key may have been revoked. Generate a new one at console.anthropic.com

**"Rate limit reached"**
→ Too many simultaneous users. The free API tier has limits.
   Upgrade to a paid Anthropic tier for higher limits.

**Associates can't reach the URL**
→ Make sure port 3000 is open on your firewall
→ Or use Railway/Render which handle this automatically

**Connection refused on local machine**
→ Make sure `node server.js` is still running
→ Try http://127.0.0.1:3000 instead of localhost

---

## Questions

Contact your system administrator or whoever set up this deployment.
For Anthropic API issues: https://docs.anthropic.com
