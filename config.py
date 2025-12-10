import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # تليجرام
    BOT_TOKEN = os.getenv("BOT_TOKEN")
    ADMIN_IDS = list(map(int, os.getenv("ADMIN_IDS", "").split(",")))
    
    # قاعدة البيانات
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///bot.db")
    
    # إعدادات البوت
    AUTO_PUBLISH_INTERVAL = 1  # ثانية بين كل نشر
    MAX_MESSAGE_LENGTH = 4096
    
    # مسارات الملفات
    SESSIONS_DIR = "sessions"
    QR_CODES_DIR = "qr_codes"
    
    # إنشاء المجلدات
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    os.makedirs(QR_CODES_DIR, exist_ok=True)

config = Config()
