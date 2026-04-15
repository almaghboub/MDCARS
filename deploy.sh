#!/bin/bash
echo "Building frontend..."
npx vite build

echo "Building server (CommonJS for production)..."
./node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outfile=dist/prodServer.js

echo "Done! Now restart with: sudo systemctl restart mdcars"
