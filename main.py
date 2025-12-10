#!/usr/bin/env python3
"""
WhatsApp Publishing Bot - Main Entry Point
"""
import asyncio
import sys
import os
from pathlib import Path

# إضافة المسار للوحدات
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from telegram.telegram_bot import TelegramBot
from database.database import init_db
import config

def ensure_directories():
    """إنشاء المجلدات المطلوبة"""
    directories = [
        "session",
        "database",
        "logs",
        "session/user_1",  # مجلد افتراضي
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"✅ Created directory: {directory}")

def check_environment():
    """التحقق من المتغيرات البيئية"""
    required_vars = ["TELEGRAM_TOKEN"]
    
    missing_vars = []
    for var in required_vars:
        if not getattr(config.Config, var, None):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Please set them in .env file or environment variables")
        print("\n.env file example:")
        print("TELEGRAM_TOKEN=your_telegram_bot_token_here")
        print("TELEGRAM_ADMIN_ID=your_admin_id_here")
        print("DEBUG=False")
        return False
    
    return True

def main():
    """الدالة الرئيسية"""
    print("=" * 50)
    print("🚀 WhatsApp Publishing Bot")
    print("=" * 50)
    
    # التحقق من المتغيرات البيئية
    if not check_environment():
        sys.exit(1)
    
    # إنشاء المجلدات
    ensure_directories()
    
    # تهيئة قاعدة البيانات
    init_db()
    
    # تشغيل البوت
    bot = TelegramBot()
    
    try:
        bot.run()
    except KeyboardInterrupt:
        print("\n🛑 Bot stopped by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
