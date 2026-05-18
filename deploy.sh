#!/bin/bash
set -e

echo "Cleaning old build artifacts..."
rm -rf dist node_modules/.vite

echo "Building frontend..."
npx vite build

echo "Building server..."
./node_modules/.bin/esbuild server/prodServer.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/prodServer.js

echo "Build complete! Now run: sudo systemctl restart mdcars"
