#!/bin/bash

# Configuration
PEM_KEY=~/Downloads/Madchess.pem
SERVER_USER=ubuntu
SERVER_IP=3.35.93.217
PROJECT_DIR=madcamp_2025W_W3_madchess
BRANCH=${1:-feature/hanjin10} # Default to feature/hanjin10 if not provided

echo "🚀 Starting Deployment to $SERVER_IP on branch $BRANCH..."

ssh -i $PEM_KEY $SERVER_USER@$SERVER_IP << EOF
    set -e # Stop on error

    echo "🔹 Loading environment (NVM)..."
    export NVM_DIR="\$HOME/.nvm"
    [ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"

    echo "🔹 Navigating to project directory..."
    cd $PROJECT_DIR

    echo "🔹 Updating Code (Git Pull)..."
    git fetch origin $BRANCH
    git reset --hard origin/$BRANCH

    echo "🔹 1. BACKEND DEPLOYMENT"
    cd backend
    echo "   - Installing dependencies..."
    npm install
    echo "   - Pushing DB Schema..."
    npx prisma db push
    echo "   - Restarting PM2..."
    pm2 restart all || pm2 start 'npx tsx src/server.ts' --name "chess-backend"
    cd ..

    echo "🔹 2. FRONTEND DEPLOYMENT"
    cd frontend
    echo "   - Installing dependencies..."
    npm install
    echo "   - Building React App..."
    npm run build
    echo "   - Copying build to /var/www/chess..."
    sudo rm -rf /var/www/chess/*
    sudo cp -r dist/* /var/www/chess/
    echo "   - Reloading Nginx..."
    sudo systemctl reload nginx

    echo "✅ Deployment Successfully Completed!"
EOF
