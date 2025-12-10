import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Telegram Bot Token
    TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
    TELEGRAM_ADMIN_ID = os.getenv("TELEGRAM_ADMIN_ID", "")
    
    # WhatsApp Settings
    WHATSAPP_SCAN_TIMEOUT = 60
    WHATSAPP_REFRESH_INTERVAL = 5  # seconds
    SESSION_PATH = "session"
    
    # Database
    DATABASE_URL = "sqlite:///database/whatsapp_bot.db"
    
    # Server
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    
    # Logging
    LOG_LEVEL = "INFO"
    LOG_FILE = "logs/whatsapp_bot.log"
