#!/bin/bash
echo "Building frontend..."
npx vite build

echo "Building backend..."
npx esbuild server/prodServer.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist

echo "Done! Start with: NODE_ENV=production node dist/prodServer.js"
