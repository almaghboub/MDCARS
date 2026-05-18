#!/bin/bash
set -e

echo "=== Installing ALL dependencies (including devDependencies for build tools) ==="
npm install --include=dev

echo "=== Building frontend ==="
CONFIG=$(ls vite*prod* 2>/dev/null | head -1)
if [ -z "$CONFIG" ]; then
  echo "ERROR: No vite prod config found (expected vite.prod.config.ts or vprod.config.ts)"
  exit 1
fi
echo "Using config: $CONFIG"
npx vite build --config "$CONFIG"

echo "=== Building server ==="
npx esbuild server/prodServer.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/prodServer.js

echo ""
echo "=== Build complete! ==="
echo "Run: sudo systemctl restart mdcars"
