#!/bin/bash

# Clean up old build
rm -rf nexent-dist

# Build Next.js application
npm install
NODE_ENV=production npm run build

# Create distribution directory
mkdir -p ./nexent-dist

# Copy the standalone output (using output: 'standalone' config)
cp -r .next/standalone/* ./nexent-dist/

# Copy the entire .next directory
cp -r .next ./nexent-dist/

# Copy public folder
cp -r public ./nexent-dist/

# Create optimized package.json
cat > ./nexent-dist/package.json << EOL
{
  "name": "nexent",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "NODE_ENV=production HOSTNAME=localhost node server.js"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "http-proxy": "^1.18.1",
    "dotenv": "^16.4.7"
  }
}
EOL

# Install dependencies
cd ../nexent-dist
npm install --omit=dev --production

echo "Deployment package created in nexent-dist directory" 