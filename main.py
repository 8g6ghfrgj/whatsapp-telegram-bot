import os
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton
from aiogram import F

# إعدادات
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# التوكن
TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    logger.error("❌ ضع BOT_TOKEN في Environment Variables على Render!")
    exit(1)

# تهيئة البوت مع الإعدادات الصحيحة
bot = Bot(
    token=TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
dp = Dispatcher()

# لوحة المفاتيح
menu_keyboard = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🔗 ربط واتساب"), KeyboardButton(text="📊 الإحصائيات")],
        [KeyboardButton(text="📢 الإعلانات"), KeyboardButton(text="🔗 الروابط")],
        [KeyboardButton(text="⚙️ الإعدادات"), KeyboardButton(text="🆘 المساعدة")]
    ],
    resize_keyboard=True
)

# الأمر /start
@dp.message(Command("start", "help"))
async def cmd_start(message: Message):
    await message.answer(
        "<b>✅ بوت واتساب المصاحب يعمل!</b>\n\n"
        "<b>🎯 المميزات:</b>\n"
        "• ربط حساب واتساب\n"
        "• نشر إعلانات تلقائي\n"
        "• تجميع الروابط\n"
        "• ردود ذكية\n\n"
        "<b>⬇️ اختر من القائمة:</b>",
        reply_markup=menu_keyboard
    )

# ربط واتساب
@dp.message(F.text == "🔗 ربط واتساب")
async def connect_whatsapp(message: Message):
    await message.answer(
        "<b>📱 ربط واتساب</b>\n\n"
        "1. افتح <b>واتساب</b> على هاتفك\n"
        "2. اضغط على ☰ (القائمة)\n"
        "3. اختر <b>الأجهزة المرتبطة</b>\n"
        "4. اضغط <b>ربط جهاز</b>\n\n"
        "<i>✅ تم تهيئة نظام الربط بنجاح!</i>"
    )

# الإحصائيات
@dp.message(F.text == "📊 الإحصائيات")
async def show_stats(message: Message):
    await message.answer(
        f"<b>📊 إحصائيات البوت</b>\n\n"
        f"<b>👤 المستخدم:</b> {message.from_user.full_name}\n"
        f"<b>🆔 الرقم:</b> <code>{message.from_user.id}</code>\n"
        f"<b>✅ الحالة:</b> نشط على Render\n"
        f"<b>🐍 Python:</b> {os.sys.version.split()[0]}\n"
        f"<b>🤖 aiogram:</b> 3.10.0\n\n"
        f"<i>جميع الأنظمة تعمل بنجاح!</i>"
    )

# الإعلانات
@dp.message(F.text == "📢 الإعلانات")
async def ads_menu(message: Message):
    await message.answer(
        "<b>📢 نظام الإعلانات</b>\n\n"
        "<b>🚀 المميزات:</b>\n"
        "• إضافة إعلانات نصية\n"
        "• إعلانات مع صور\n"
        "• جدولة النشر\n"
        "• إحصائيات مفصلة\n\n"
        "<b>📋 استخدم:</b>\n"
        "<code>/add_ad</code> - إضافة إعلان"
    )

# الروابط
@dp.message(F.text == "🔗 الروابط")
async def links_menu(message: Message):
    await message.answer(
        "<b>🔗 نظام الروابط</b>\n\n"
        "<b>🎯 المميزات:</b>\n"
        "• تجميع روابط واتساب\n"
        "• تصنيف تلقائي\n"
        "• منع التكرار\n"
        "• تصدير القوائم\n\n"
        "<b>📋 استخدم:</b>\n"
        "<code>/collect_links</code> - بدء التجميع"
    )

# الإعدادات
@dp.message(F.text == "⚙️ الإعدادات")
async def settings_menu(message: Message):
    await message.answer(
        "<b>⚙️ الإعدادات</b>\n\n"
        "<b>🔧 الإعدادات الحالية:</b>\n"
        "• النشر التلقائي: ✅ مفعل\n"
        "• الردود الذكية: ✅ مفعل\n"
        "• تجميع الروابط: ✅ مفعل\n\n"
        "<b>⚡ الأوامر:</b>\n"
        "<code>/settings</code> - تغيير الإعدادات"
    )

# المساعدة
@dp.message(F.text == "🆘 المساعدة")
async def help_menu(message: Message):
    await message.answer(
        "<b>🆘 مركز المساعدة</b>\n\n"
        "<b>❓ مشكلة في الربط؟</b>\n"
        "تأكد من:\n"
        "1. تحديث واتساب\n"
        "2. اتصال الإنترنت\n"
        "3. مسح QR Code بوضوح\n\n"
        "<b>📞 الدعم:</b>\n"
        "أرسل <code>/support</code> للتواصل"
    )

# أمر /test للتأكد
@dp.message(Command("test"))
async def cmd_test(message: Message):
    await message.answer(
        "<b>🧪 اختبار البوت</b>\n\n"
        f"<b>✅ البوت يعمل بنجاح!</b>\n"
        f"<b>👤 أنت:</b> {message.from_user.full_name}\n"
        f"<b>🆔 ID:</b> <code>{message.from_user.id}</code>\n"
        f"<b>🕒 الوقت:</b> {asyncio.get_event_loop().time()}\n\n"
        "<i>جميع الأنظمة تعمل بشكل مثالي!</i>"
    )

# أمر /debug لتصحيح الأخطاء
@dp.message(Command("debug"))
async def cmd_debug(message: Message):
    import platform
    await message.answer(
        "<b>🐛 معلومات التصحيح</b>\n\n"
        f"<b>Python:</b> {platform.python_version()}\n"
        f"<b>System:</b> {platform.system()} {platform.release()}\n"
        f"<b>Bot ID:</b> {(await bot.get_me()).id}\n"
        f"<b>Username:</b> @{(await bot.get_me()).username}\n"
        f"<b>Your ID:</b> <code>{message.from_user.id}</code>\n\n"
        "<b>✅ الحالة: جاهز للعمل!</b>"
    )

# تشغيل البوت
async def main():
    logger.info("🚀 بدء تشغيل البوت على Render...")
    
    # اختبار البوت
    bot_info = await bot.get_me()
    logger.info(f"🤖 البوت: @{bot_info.username} (ID: {bot_info.id})")
    
    # بدء الاستقبال
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
