#!/bin/bash
echo "Building frontend..."
npx vite build

echo "Building server..."
./node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Copying to prodServer.js..."
cp dist/index.js dist/prodServer.js

echo "Build complete! Now run: sudo systemctl restart mdcars"
