#!/bin/bash
echo ""
echo "========================================"
echo "  RF Sales Call Simulator"
echo "========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  ERROR: Node.js is not installed."
    echo ""
    echo "  Please install from: https://nodejs.org"
    echo "  Download the LTS version and install it,"
    echo "  then try again."
    echo ""
    exit 1
fi

# Check API key
if [ ! -f "apikey.txt" ]; then
    echo "  SETUP REQUIRED:"
    echo ""
    echo "  Create a file called 'apikey.txt' in"
    echo "  this folder and paste your Anthropic"
    echo "  API key into it."
    echo ""
    echo "  Get a key at: console.anthropic.com"
    echo ""
    exit 1
fi

echo "  Starting simulator..."
echo "  Your browser will open automatically."
echo ""
echo "  Keep this window open while using the simulator."
echo "  Press Ctrl+C when you are done."
echo ""

node server-standalone.js
