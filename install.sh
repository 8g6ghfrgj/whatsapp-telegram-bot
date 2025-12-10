#!/bin/bash

echo "🚀 Installing WhatsApp Publishing Bot..."

# إنشاء البيئة الافتراضية
python3 -m venv venv

# تفعيل البيئة
source venv/bin/activate

# تثبيت المتطلبات
pip install -r requirements.txt

# إنشاء مجلدات
mkdir -p session database logs

# نسخ ملف .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️ Please edit .env file with your credentials"
fi

# إعطاء صلاحية للملفات
chmod +x main.py
chmod +x install.sh

echo "✅ Installation complete!"
echo "📝 Edit .env file with your Telegram Bot Token"
echo "🚀 Run: python main.py"
