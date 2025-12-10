import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # تليجرام
    BOT_TOKEN = os.getenv("BOT_TOKEN")
    ADMIN_IDS = list(map(int, os.getenv("ADMIN_IDS", "").split(","))) if os.getenv("ADMIN_IDS") else []
    
    # قاعدة البيانات
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        # استخدام SQLite محليًا أو PostgreSQL على Render
        DATABASE_URL = "sqlite:///bot.db"
    
    # إعدادات البوت
    AUTO_PUBLISH_INTERVAL = int(os.getenv("AUTO_PUBLISH_INTERVAL", 1))
    MAX_MESSAGE_LENGTH = int(os.getenv("MAX_MESSAGE_LENGTH", 4096))
    
    # مسارات الملفات
    SESSIONS_DIR = os.getenv("SESSIONS_DIR", "sessions")
    QR_CODES_DIR = os.getenv("QR_CODES_DIR", "qr_codes")
    LOGS_DIR = os.getenv("LOGS_DIR", "logs")
    
    # إعدادات Playwright
    PLAYWRIGHT_HEADLESS = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
    PLAYWRIGHT_SLOW_MO = int(os.getenv("PLAYWRIGHT_SLOW_MO", 0))
    
    # إنشاء المجلدات
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    os.makedirs(QR_CODES_DIR, exist_ok=True)
    os.makedirs(LOGS_DIR, exist_ok=True)
    
    @property
    def is_render(self):
        """التحقق إذا كان التشغيل على Render"""
        return 'RENDER' in os.environ

config = Config()
