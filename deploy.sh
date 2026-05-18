#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Cleaning old build artifacts..."
rm -rf dist
rm -rf node_modules/.vite

echo "Building frontend (production config — no Replit plugins)..."
npx vite build --config vite.prod.config.ts

echo "Building server..."
npx esbuild server/prodServer.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/prodServer.js

echo "Build complete! Now run: sudo systemctl restart mdcars"
