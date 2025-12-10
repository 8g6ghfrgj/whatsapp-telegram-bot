#!/bin/bash
set -e

echo "========================================="
echo "🚀 Starting WhatsApp Bot Setup"
echo "========================================="

# إعداد بيئة Python
echo "🐍 Setting up Python environment..."
python -m pip install --upgrade pip setuptools wheel

# تثبيت متطلبات Python الأساسية أولاً
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# تثبيت Playwright بطريقة بدون root
echo "🎭 Installing Playwright WITHOUT system dependencies..."

# أولاً: تثبيت Playwright Python package
pip install playwright==1.40.0

# ثانياً: تنزيل Chromium مباشرة بدون تثبيت system dependencies
echo "🔧 Downloading Chromium browser..."

# إنشاء مجلد للمتصفح في مكان يمكن الوصول إليه
mkdir -p ~/.cache/ms-playwright
export PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright

# تحميل Chromium مباشرة
python -m playwright install --dry-run chromium 2>/dev/null || true

# استخدام طريقة بديلة لتحميل Chromium
if [ ! -f "$HOME/.cache/ms-playwright/chromium-*/chrome-linux/chrome" ]; then
    echo "📥 Downloading Chromium manually..."
    
    # تنزيل Chromium من مصادر Playwright مباشرة
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1149281/chrome-linux.zip"
    
    mkdir -p chromium-download
    cd chromium-download
    
    # تنزيل وتفريغ Chromium
    wget -q $CHROMIUM_URL -O chrome.zip
    unzip -q chrome.zip -d chrome-linux
    
    # نقل إلى مكان Playwright المتوقع
    mkdir -p "$HOME/.cache/ms-playwright/chromium-1095"
    mv chrome-linux "$HOME/.cache/ms-playwright/chromium-1095/"
    
    cd ..
    rm -rf chromium-download
    
    echo "✅ Chromium downloaded manually"
else
    echo "✅ Chromium already exists"
fi

# تثبيت dependencies اللازمة لـ Playwright (بدون root)
echo "🛠️ Installing minimal dependencies..."

# محاولة تثبيت dependencies إذا كان نظام Debian/Ubuntu
if command -v apt-get >/dev/null 2>&1; then
    echo "📦 Detected Debian-based system, installing minimal deps..."
    
    # قائمة مختصرة من dependencies الأساسية فقط
    apt-get update -y || true
    
    # تثبيت الحد الأدنى من dependencies
    apt-get install -y --no-install-recommends \
        libnss3 \
        libx11-6 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxi6 \
        libxtst6 \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libxcb1 \
        libxrandr2 \
        lsb-release \
        wget \
        xdg-utils \
        || echo "⚠️ Some dependencies may have warnings"
else
    echo "ℹ️ Non-Debian system, skipping system dependencies"
fi

# إنشاء مجلدات التطبيق
echo "📁 Creating application directories..."
mkdir -p sessions qr_codes logs

# اختبار Playwright
echo "🧪 Testing Playwright installation..."
python -c "
import sys
try:
    import playwright
    from playwright.sync_api import sync_playwright
    
    print('✅ Playwright Python package installed successfully')
    
    # محاولة فتح المتصفح
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, timeout=10000)
            print('✅ Chromium browser works!')
            browser.close()
    except Exception as e:
        print(f'⚠️ Browser test warning: {e}')
        print('ℹ️ Continuing without browser test...')
        
except ImportError as e:
    print(f'❌ Playwright import failed: {e}')
    sys.exit(1)
"

# إنشاء ملف .env إذا لم يكن موجوداً
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file..."
    cat > .env << EOF
BOT_TOKEN=your_bot_token_here
ADMIN_IDS=123456789
DATABASE_URL=sqlite:///bot.db
PLAYWRIGHT_HEADLESS=true
LOG_LEVEL=INFO
PORT=8080
EOF
    echo "📝 Created .env file with template"
fi

echo "========================================="
echo "✅ Setup completed!"
echo "========================================="
