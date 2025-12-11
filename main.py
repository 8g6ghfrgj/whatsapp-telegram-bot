import os
import logging
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackQueryHandler
from telegram import ParseMode
from bot_handlers import *
from dotenv import load_dotenv

# تحميل المتغيرات البيئية
load_dotenv()

# إعداد التسجيل
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# الحصول على التوكن من المتغيرات البيئية
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

def main():
    """الدالة الرئيسية لتشغيل البوت"""
    if not TOKEN:
        logger.error("Please set TELEGRAM_BOT_TOKEN in .env file")
        return
    
    # إنشاء Updater
    updater = Updater(TOKEN, use_context=True)
    dispatcher = updater.dispatcher
    
    # إضافة معالجات الأوامر
    dispatcher.add_handler(CommandHandler("start", start_command))
    dispatcher.add_handler(CommandHandler("add_account", add_account_command))
    dispatcher.add_handler(CommandHandler("my_accounts", my_accounts_command))
    dispatcher.add_handler(CommandHandler("send_message", send_message_command))
    dispatcher.add_handler(CommandHandler("help", help_command))
    
    # بدء البوت
    updater.start_polling()
    logger.info("Bot started successfully!")
    
    # تشغيل البوت حتى يتم إيقافه
    updater.idle()

if __name__ == '__main__':
    # إنشاء مجلد الجلسات إذا لم يكن موجوداً
    os.makedirs("sessions", exist_ok=True)
    
    # تشغيل البوت
    main()
