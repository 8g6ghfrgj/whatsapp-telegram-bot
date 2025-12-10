#!/bin/bash
set -o errexit

# تحديث pip
pip install --upgrade pip

# تثبيت المتطلبات
pip install -r requirements.txt

# تثبيت Playwright
playwright install chromium
playwright install-deps

# إنشاء مجلدات ضرورية
mkdir -p sessions qr_codes logs

echo "✅ Setup completed successfully!"
