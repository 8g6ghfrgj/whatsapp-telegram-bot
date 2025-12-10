#!/bin/bash
set -e
echo "🚀 Starting simple setup..."
pip install --upgrade pip
pip install -r requirements.txt
mkdir -p sessions qr_codes logs
echo "✅ Setup completed successfully!"
