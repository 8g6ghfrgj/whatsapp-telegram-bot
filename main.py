import os
import logging
import sys
# بدلاً من: from whatsapp_client import WhatsAppClient
from whatsapp_client_selenium import WhatsAppSeleniumClient as WhatsAppClient

# إعداد التسجيل
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# قراءة التوكن من البيئة
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    logger.error("❌ ERROR: BOT_TOKEN is not set!")
    logger.error("💡 Please add BOT_TOKEN in Render Environment Variables")
    sys.exit(1)

# تهيئة
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

# أمر البدء
@dp.message_handler(commands=['start', 'help'])
async def send_welcome(message: types.Message):
    await message.answer(
        "🎉 **بوت واتساب المصاحب يعمل بنجاح!**\n\n"
        f"✅ تم النشر على Render\n"
        f"👤 أنت: {message.from_user.first_name}\n"
        f"🆔 ID: {message.from_user.id}\n\n"
        "🔧 الميزات القادمة:\n"
        "• ربط حساب واتساب\n"
        "• نشر تلقائي\n"
        "• ردود ذكية\n"
        "• جمع الروابط",
        parse_mode="Markdown"
    )

@dp.message_handler(commands=['test'])
async def test_command(message: types.Message):
    await message.answer("✅ البوت يستجيب بشكل صحيح!")

@dp.message_handler(commands=['debug'])
async def debug_info(message: types.Message):
    info = f"""
    📊 **معلومات التصحيح:**
    
    🐍 Python: {sys.version}
    📁 Current dir: {os.getcwd()}
    📝 Files in dir: {', '.join(os.listdir('.'))}
    🔧 BOT_TOKEN exists: {'✅' if BOT_TOKEN else '❌'}
    👤 Your ID: {message.from_user.id}
    
    ⚙️ **Environment:**
    RENDER: {os.getenv('RENDER', 'Not set')}
    PORT: {os.getenv('PORT', 'Not set')}
    """
    await message.answer(info)

# عند البدء
async def on_startup(dp):
    logger.info("="*50)
    logger.info("🚀 WHATSAPP COMPANION BOT STARTED")
    logger.info("="*50)
    logger.info(f"🤖 Bot ID: {dp.bot.id}")
    logger.info(f"🔧 Token present: {'✅' if BOT_TOKEN else '❌'}")
    logger.info(f"🌐 Running on Render: {'✅' if os.getenv('RENDER') else '❌'}")
    
    # تعيين أوامر القائمة
    await dp.bot.set_my_commands([
        types.BotCommand("start", "بدء البوت"),
        types.BotCommand("test", "اختبار البوت"),
        types.BotCommand("debug", "معلومات التصحيح")
    ])

if __name__ == '__main__':
    try:
        logger.info("🎬 Starting bot polling...")
        executor.start_polling(dp, skip_updates=True, on_startup=on_startup)
    except Exception as e:
        logger.error(f"💥 Failed to start: {e}")
        sys.exit(1)
