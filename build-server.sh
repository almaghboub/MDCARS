#!/bin/bash
set -e

echo "=== Building frontend ==="
npx vite build --config vprod.config.ts

echo "=== Building server ==="
npx esbuild server/prodServer.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/prodServer.js

echo "=== Done! Restart with: sudo systemctl restart mdcars ==="
