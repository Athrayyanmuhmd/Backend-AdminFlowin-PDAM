#!/bin/bash

echo "🔄 Restarting AquaLink Backend Server..."

# Kill existing node processes for backend
pkill -f "node.*server.js" || echo "No existing backend process found"

# Wait a moment
sleep 2

# Navigate to backend directory
cd /home/whoami/aqualink/aqualink-backend

# Start the server
echo "🚀 Starting backend server..."
yarn start
