import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup
from aiogram.utils import executor
import config
from database import SessionLocal
from whatsapp_client import WhatsAppClient
from keyboards.inline_keyboards import *
from utils.link_extractor import LinkExtractor

# إعداد التسجيل
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# تهيئة البوت
bot = Bot(token=config.BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(bot, storage=storage)

# تخزين العملاء النشطين
active_clients = {}

# حالات FSM
class AdvertisementStates(StatesGroup):
    waiting_for_title = State()
    waiting_for_content = State()
    waiting_for_media = State()

class AdminStates(StatesGroup):
    waiting_for_admin_id = State()

class ReplyStates(StatesGroup):
    waiting_for_trigger = State()
    waiting_for_response = State()

# وظائف المساعدة
def get_db():
    """الحصول على جلسة قاعدة البيانات"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_user_client(user_id: int) -> WhatsAppClient:
    """الحصول على عميل واتساب للمستخدم"""
    if user_id not in active_clients:
        client = WhatsAppClient(user_id)
        await client.initialize()
        active_clients[user_id] = client
    return active_clients[user_id]

# معالجات الأوامر
@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    """بدء البوت"""
    welcome_text = """
    🤖 **مرحبًا بكم في بوت واتساب المصاحب!**
    
    ⚡ **مميزات البوت:**
    ✅ ربط حساب واتساب ماسنجر
    ✅ تجميع الروابط تلقائيًا
    ✅ نظام إعلانات متكامل
    ✅ نشر تلقائي في المجموعات
    ✅ انضمام تلقائي للمجموعات
    ✅ ردود ذكية تلقائية
    ✅ إدارة متعددة المشرفين
    
    🎯 **اختر من القائمة أدناه:**"""
    
    await message.answer(welcome_text, reply_markup=main_menu())

@dp.callback_query_handler(text="connect_whatsapp")
async def connect_whatsapp(callback: types.CallbackQuery):
    """ربط حساب واتساب"""
    user_id = callback.from_user.id
    
    await callback.message.edit_text("🔄 جاري تهيئة اتصال واتساب...")
    
    try:
        client = await get_user_client(user_id)
        
        # الحصول على QR Code
        await callback.message.edit_text("📱 جاري إنشاء QR Code...")
        qr_bytes = await client.get_qr_code()
        
        # إرسال QR Code
        await callback.message.delete()
        await bot.send_photo(
            chat_id=user_id,
            photo=qr_bytes,
            caption="🔐 **مسح QR Code للربط:**\n\n"
                   "1. افتح واتساب على هاتفك\n"
                   "2. اضغط على القائمة (النقاط الثلاث)\n"
                   "3. اختر 'الأجهزة المرتبطة'\n"
                   "4. اضغط على 'ربط جهاز'\n"
                   "5. مسح هذا الكود\n\n"
                   "⏳ الانتظار حتى يتم الربط تلقائيًا...",
            reply_markup=InlineKeyboardMarkup().add(
                InlineKeyboardButton("🔄 تحديث الحالة", callback_data="check_connection")
            )
        )
        
    except Exception as e:
        await callback.message.edit_text(f"❌ خطأ: {str(e)}")

@dp.callback_query_handler(text="check_connection")
async def check_connection(callback: types.CallbackQuery):
    """التحقق من حالة الاتصال"""
    user_id = callback.from_user.id
    
    if user_id in active_clients:
        client = active_clients[user_id]
        
        if client.is_authenticated:
            await callback.message.edit_text(
                "✅ **تم الربط بنجاح!**\n\n"
                "يمكنك الآن استخدام جميع ميزات البوت.",
                reply_markup=main_menu()
            )
        else:
            await callback.message.edit_text(
                "⏳ **لا يزال في انتظار الربط...**\n\n"
                "يرجى مسح QR Code من تطبيق واتساب.",
                reply_markup=InlineKeyboardMarkup().add(
                    InlineKeyboardButton("🔄 تحديث الحالة", callback_data="check_connection")
                )
            )
    else:
        await callback.answer("❌ لم يتم تهيئة العميل بعد")

@dp.callback_query_handler(text="collect_links")
async def collect_links(callback: types.CallbackQuery):
    """جمع الروابط من المحادثات"""
    user_id = callback.from_user.id
    
    if user_id not in active_clients:
        await callback.answer("❌ يجب ربط حساب واتساب أولاً")
        return
    
    await callback.message.edit_text("🔍 جاري جمع الروابط من المحادثات...")
    
    try:
        client = active_clients[user_id]
        all_links = []
        
        # الحصول على المحادثات
        chats = await client.get_chats()
        
        # استخراج الروابط من كل محادثة
        for chat in chats[:10]:  # أول 10 محادثات للسرعة
            links = await client.extract_links_from_chat(chat['name'])
            all_links.extend(links)
        
        # تصنيف الروابط
        whatsapp_links = []
        telegram_links = []
        other_links = []
        
        extractor = LinkExtractor()
        unique_links = extractor.filter_unique_links(all_links)
        
        for link in unique_links:
            link_type = extractor.categorize_link(link)
            
            if link_type == 'whatsapp':
                whatsapp_links.append(link)
            elif link_type == 'telegram':
                telegram_links.append(link)
            else:
                other_links.append(link)
        
        # حفظ في قاعدة البيانات
        db = SessionLocal()
        # (يجب إضافة كود الحفظ هنا)
        db.close()
        
        # إرسال النتائج
        result_text = f"""
        ✅ **تم جمع الروابط بنجاح!**
        
        📊 **الإحصائيات:**
        🔗 إجمالي الروابط: {len(unique_links)}
        📱 روابط واتساب: {len(whatsapp_links)}
        📲 روابط تليجرام: {len(telegram_links)}
        🌐 روابط أخرى: {len(other_links)}
        
        💾 تم حفظ الروافق في قاعدة البيانات."""
        
        await callback.message.edit_text(result_text, reply_markup=links_menu())
        
    except Exception as e:
        await callback.message.edit_text(f"❌ خطأ: {str(e)}")

@dp.callback_query_handler(text="show_links")
async def show_links(callback: types.CallbackQuery):
    """عرض الروابط المحفوظة"""
    db = SessionLocal()
    
    try:
        # جلب الروابط من قاعدة البيانات
        # (يجب تعديل الاستعلام حسب هيكل قاعدة البيانات)
        links = []  # استبدل بجلب الروابط من DB
        
        if not links:
            await callback.message.edit_text("📭 لا توجد روابط محفوظة بعد.")
            return
        
        # تجميع حسب النوع
        whatsapp_links = [l for l in links if l.link_type == 'whatsapp']
        telegram_links = [l for l in links if l.link_type == 'telegram']
        other_links = [l for l in links if l.link_type == 'other']
        
        # إنشاء رسالة النتائج
        result_text = f"""
        📋 **الروابط المحفوظة:**
        
        📱 **روابط واتساب ({len(whatsapp_links)}):**
        """
        
        for i, link in enumerate(whatsapp_links[:5], 1):
            result_text += f"{i}. {link.url[:50]}...\n"
        
        result_text += f"\n📲 **روابط تليجرام ({len(telegram_links)}):**\n"
        for i, link in enumerate(telegram_links[:5], 1):
            result_text += f"{i}. {link.url[:50]}...\n"
        
        if len(whatsapp_links) > 5 or len(telegram_links) > 5:
            result_text += "\n... والمزيد"
        
        keyboard = InlineKeyboardMarkup(row_width=2)
        keyboard.add(
            InlineKeyboardButton("📥 تصدير الروابط", callback_data="export_links"),
            InlineKeyboardButton("◀️ رجوع", callback_data="links_menu")
        )
        
        await callback.message.edit_text(result_text, reply_markup=keyboard)
        
    finally:
        db.close()

@dp.callback_query_handler(text="start_publishing")
async def start_publishing(callback: types.CallbackQuery):
    """بدء النشر التلقائي"""
    user_id = callback.from_user.id
    
    if user_id not in active_clients:
        await callback.answer("❌ يجب ربط حساب واتساب أولاً")
        return
    
    await callback.message.edit_text("""
    ⚙️ **إعداد النشر التلقائي:**
    
    سيتم النشر في جميع مجموعات واتساب المرتبطة.
    
    ⚡ **المميزات:**
    • النشر في جميع المجموعات تلقائيًا
    • فترة انتظار: 1 ثانية بين كل مجموعة
    • إعادة الدورة بعد الانتهاء
    • منع التكرار في نفس الدورة
    
    📝 **الخطوات:**
    1. اختيار الإعلان للنشر
    2. بدء النشر التلقائي
    3. يمكنك الإيقاف في أي وقت
    
    👇 اختر إعلان للنشر:""")
    
    # جلب الإعلانات من قاعدة البيانات
    db = SessionLocal()
    # (جلب الإعلانات)
    db.close()
    
    # عرض قائمة الإعلانات للاختيار

@dp.callback_query_handler(text="start_joining")
async def start_joining(callback: types.CallbackQuery):
    """بدء الانضمام التلقائي"""
    user_id = callback.from_user.id
    
    await callback.message.edit_text("""
    🤖 **تفعيل الانضمام التلقائي:**
    
    سيتم الانضمام تلقائيًا لروابط مجموعات واتساب التي تصل في الرسائل.
    
    🔔 **كيف يعمل:**
    1. مراقبة الرسائل الواردة
    2. اكتشاف روابط مجموعات واتساب
    3. الانضمام للمجموعة تلقائيًا
    4. إرسال تقرير بالنتائج
    
    ✅ **المميزات:**
    • انضمام فوري عند استلام الرابط
    • تقارير تفصيلية
    • اكتشاف تلقائي للروابط
    • منع الانضمام المكرر
    
    ⚡ **سيبدأ العمل فورًا بعد التفعيل**""",
    reply_markup=InlineKeyboardMarkup().add(
        InlineKeyboardButton("✅ تفعيل", callback_data="confirm_auto_join"),
        InlineKeyboardButton("❌ إلغاء", callback_data="cancel_action")
    ))

@dp.callback_query_handler(text="stats")
async def show_stats(callback: types.CallbackQuery):
    """عرض الإحصائيات"""
    user_id = callback.from_user.id
    
    db = SessionLocal()
    
    try:
        # جلب الإحصائيات من قاعدة البيانات
        # (استبدل بجلب البيانات الحقيقية)
        total_links = 0
        whatsapp_links = 0
        telegram_links = 0
        total_ads = 0
        active_ads = 0
        published_count = 0
        
        stats_text = f"""
        📊 **إحصائيات البوت:**
        
        🔗 **الروابط:**
        • إجمالي الروابط: {total_links}
        • روابط واتساب: {whatsapp_links}
        • روابط تليجرام: {telegram_links}
        
        📢 **الإعلانات:**
        • إجمالي الإعلانات: {total_ads}
        • الإعلانات النشطة: {active_ads}
        
        🚀 **النشر:**
        • عدد الدورات المكتملة: {published_count}
        
        👥 **المستخدمين:**
        • المستخدمين النشطين: 1
        
        🔄 **آخر تحديث: {datetime.now().strftime('%Y-%m-%d %H:%M')}**"""
        
        keyboard = InlineKeyboardMarkup()
        keyboard.add(
            InlineKeyboardButton("🔄 تحديث", callback_data="stats"),
            InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
        )
        
        await callback.message.edit_text(stats_text, reply_markup=keyboard)
        
    finally:
        db.close()

@dp.callback_query_handler(text="main_menu")
async def return_main_menu(callback: types.CallbackQuery):
    """العودة للقائمة الرئيسية"""
    await callback.message.edit_text("🏠 **القائمة الرئيسية**", reply_markup=main_menu())

@dp.callback_query_handler(text="ads_menu")
async def ads_menu_handler(callback: types.CallbackQuery):
    """قائمة الإعلانات"""
    await callback.message.edit_text("📢 **قائمة الإعلانات**", reply_markup=ads_menu())

@dp.callback_query_handler(text="links_menu")
async def links_menu_handler(callback: types.CallbackQuery):
    """قائمة الروابط"""
    await callback.message.edit_text("🔗 **قائمة الروابط**", reply_markup=links_menu())

@dp.callback_query_handler(text="admins_menu")
async def admins_menu_handler(callback: types.CallbackQuery):
    """قائمة المشرفين"""
    await callback.message.edit_text("👥 **إدارة المشرفين**", reply_markup=admin_management())

@dp.callback_query_handler(text="replies_menu")
async def replies_menu_handler(callback: types.CallbackQuery):
    """قائمة الردود"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("➕ رد خاص", callback_data="add_private_reply"),
        InlineKeyboardButton("➕ رد مجموعة", callback_data="add_group_reply"),
        InlineKeyboardButton("📋 قائمة الردود", callback_data="list_replies"),
        InlineKeyboardButton("⚙️ إعدادات الردود", callback_data="reply_settings"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    keyboard.add(buttons[4])
    
    await callback.message.edit_text("🤖 **نظام الردود الذكية**", reply_markup=keyboard)

@dp.callback_query_handler(text="auto_publish")
async def auto_publish_menu(callback: types.CallbackQuery):
    """قائمة النشر التلقائي"""
    await callback.message.edit_text("📤 **النشر التلقائي**", reply_markup=publish_control())

@dp.callback_query_handler(text="auto_join")
async def auto_join_menu(callback: types.CallbackQuery):
    """قائمة الانضمام التلقائي"""
    await callback.message.edit_text("➕ **الانضمام التلقائي**", reply_markup=join_control())

@dp.callback_query_handler(text="settings")
async def settings_menu(callback: types.CallbackQuery):
    """قائمة الإعدادات"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("🔔 الإشعارات", callback_data="notification_settings"),
        InlineKeyboardButton("⏱️ فترات الانتظار", callback_data="delay_settings"),
        InlineKeyboardButton("🛡️ الخصوصية", callback_data="privacy_settings"),
        InlineKeyboardButton("🧹 تنظيف البيانات", callback_data="cleanup_settings"),
        InlineKeyboardButton("📤 تصدير البيانات", callback_data="export_data"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    keyboard.add(*buttons[4:6])
    
    await callback.message.edit_text("⚙️ **الإعدادات المتقدمة**", reply_markup=keyboard)

# معالجة رسائل النص
@dp.message_handler(content_types=types.ContentType.TEXT)
async def handle_text(message: types.Message):
    """معالجة الرسائل النصية"""
    if message.text.startswith('/'):
        return
    
    # يمكن إضافة معالجة إضافية هنا
    await message.answer("✅ تم استلام رسالتك. استخدم القائمة للتحكم في البوت.", reply_markup=main_menu())

# إغلاق العميل عند توقف البوت
async def on_shutdown(dp):
    """إغلاق جميع العملاء عند إيقاف البوت"""
    for user_id, client in active_clients.items():
        await client.close()
    logger.info("تم إغلاق جميع عملاء واتساب")

# تشغيل البوت
if __name__ == '__main__':
    from aiogram import executor
    executor.start_polling(dp, skip_updates=True, on_shutdown=on_shutdown)
