#!/bin/bash
set -e

echo "=== Installing ALL dependencies (devDependencies needed for build) ==="
npm install --include=dev

echo "=== Cleaning old build artifacts ==="
rm -rf dist
rm -rf node_modules/.vite

echo "=== Building frontend (production config — no Replit plugins) ==="
CONFIG=$(ls vite*prod* 2>/dev/null | head -1)
echo "Using config: $CONFIG"
npx vite build --config "$CONFIG"

echo "=== Building server ==="
npx esbuild server/prodServer.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/prodServer.js

echo ""
echo "=== Build complete! Run: sudo systemctl restart mdcars ==="
