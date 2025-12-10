#!/bin/bash
set -e

echo "========================================="
echo "🚀 Starting WhatsApp Bot Setup on Render"
echo "========================================="

# تحديث pip وأدوات النظام
echo "🔄 Updating pip and system tools..."
python -m pip install --upgrade pip setuptools wheel

# تثبيت متطلبات النظام لـ Playwright
echo "🔧 Installing system dependencies for Playwright..."
apt-get update || true
apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    wget \
    gnupg \
    ca-certificates \
    || echo "⚠️ System dependency installation may have warnings"

# تثبيت متطلبات Python
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# تثبيت Playwright ومتصفح Chromium
echo "🎭 Installing Playwright and Chromium..."
python -m playwright install --with-deps chromium
python -m playwright install chromium

# إنشاء المجلدات المطلوبة
echo "📁 Creating necessary directories..."
mkdir -p sessions qr_codes logs
chmod -R 755 sessions qr_codes logs

# إعداد متغيرات البيئة إذا لم تكن موجودة
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo "BOT_TOKEN=your_token_here" > .env
        echo "ADMIN_IDS=123456789" >> .env
        echo "DATABASE_URL=sqlite:///bot.db" >> .env
    fi
fi

echo "========================================="
echo "✅ Setup completed successfully!"
echo "========================================="
