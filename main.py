import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher, types
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from aiogram.utils import executor
import config

# إعداد التسجيل
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f'{config.LOGS_DIR}/bot.log')
    ]
)
logger = logging.getLogger(__name__)

async def on_startup(dp):
    """تنفيذ عند بدء التشغيل"""
    logger.info("Starting bot...")
    
    # تنظيف الجلسات القديمة
    if config.is_render:
        logger.info("Running on Render cloud")
    
    await dp.bot.set_my_commands([
        types.BotCommand("start", "بدء البوت"),
        types.BotCommand("help", "المساعدة"),
        types.BotCommand("stats", "الإحصائيات"),
        types.BotCommand("menu", "القائمة الرئيسية")
    ])

async def on_shutdown(dp):
    """تنفيذ عند إيقاف التشغيل"""
    logger.info("Shutting down bot...")
    # إغلاق اتصالات قاعدة البيانات
    # إغلاق عملاء واتساب
    await dp.storage.close()
    await dp.storage.wait_closed()

if __name__ == '__main__':
    from handlers import dp  # تأكد من استيراد dp من handlers
    
    # تشغيل البوت
    executor.start_polling(
        dp,
        skip_updates=True,
        on_startup=on_startup,
        on_shutdown=on_shutdown,
        timeout=60,
        relax=0.1
    )
