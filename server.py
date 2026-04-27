"""
RF Sales Call Simulator — Backend Proxy Server
Python / Flask alternative

Use this if your team is more comfortable with Python than Node.js.

SETUP:
  pip install flask requests python-dotenv flask-limiter
  Create .env file with ANTHROPIC_API_KEY=sk-ant-...
  python server.py

DEPLOY:
  - Heroku, Railway, Render all support Python
  - Or: gunicorn server:app --bind 0.0.0.0:3000
"""

import os
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

app     = Flask(__name__, static_folder='public')
API_KEY = os.environ.get('ANTHROPIC_API_KEY')
ACCESS_PASSWORD = os.environ.get('ACCESS_PASSWORD')
PORT    = int(os.environ.get('PORT', 3000))

if not API_KEY:
    raise RuntimeError(
        '\n❌ ANTHROPIC_API_KEY not set.\n'
        'Create a .env file with: ANTHROPIC_API_KEY=sk-ant-...\n'
    )

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=['30 per minute'],
    storage_uri='memory://',
)

def check_password():
    if not ACCESS_PASSWORD:
        return None
    pwd = request.headers.get('X-Access-Password') or request.args.get('password')
    if pwd != ACCESS_PASSWORD:
        return jsonify({'error': 'Invalid access password'}), 401
    return None

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)

@app.route('/api/chat', methods=['POST'])
@limiter.limit('30 per minute')
def chat():
    auth_error = check_password()
    if auth_error:
        return auth_error

    body = request.get_json()
    if not body or not body.get('messages'):
        return jsonify({'error': 'messages array required'}), 400

    max_tokens = body.get('max_tokens', 500)
    if max_tokens > 2000:
        return jsonify({'error': 'max_tokens exceeds limit'}), 400

    payload = {
        'model':      body.get('model', 'claude-sonnet-4-20250514'),
        'max_tokens': max_tokens,
        'messages':   body['messages'],
    }
    if body.get('system'):
        payload['system'] = body['system']

    try:
        resp = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'Content-Type':      'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key':         API_KEY,
            },
            json=payload,
            timeout=60,
        )
        if not resp.ok:
            print(f'Anthropic API error {resp.status_code}: {resp.text[:200]}')
            detail = (
                'Rate limit reached. Try again shortly.'   if resp.status_code == 429 else
                'Invalid API key. Check server config.'    if resp.status_code == 401 else
                'Unexpected API error.'
            )
            return jsonify({'error': f'API error {resp.status_code}', 'detail': detail}), resp.status_code

        return jsonify(resp.json())

    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out', 'detail': 'Anthropic API did not respond in time'}), 504
    except Exception as e:
        print(f'Proxy error: {e}')
        return jsonify({'error': 'Server error', 'detail': str(e)}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'version': '1.0.0'})

if __name__ == '__main__':
    print(f'\n✅ RF Sales Call Simulator running at http://localhost:{PORT}')
    print(f'   API key: {API_KEY[:12]}...{API_KEY[-4:]} (configured)')
    if ACCESS_PASSWORD:
        print(f'   Password protection: enabled')
    print(f'\n   Share this URL with your associates\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
