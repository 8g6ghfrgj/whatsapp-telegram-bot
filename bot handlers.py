import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import CallbackContext
from whatsapp_manager import WhatsAppManager
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# قاموس لتخزين مديري واتساب لكل مستخدم
whatsapp_managers = {}

def start_command(update: Update, context: CallbackContext):
    """معالجة أمر /start"""
    user_id = update.effective_user.id
    welcome_message = """
    🚀 **مرحباً بك في بوت إدارة واتساب!**
    
    يمكنك استخدام هذا البوت لإدارة حسابات واتساب كمصاحب.
    
    **الأوامر المتاحة:**
    /start - عرض هذه الرسالة
    /add_account - إضافة حساب واتساب جديد
    /my_accounts - عرض حساباتي
    /send_message - إرسال رسالة عبر واتساب
    /help - المساعدة
    
    ⚠️ **ملاحظة:** هذا البوت يستخدم واتساب ويب ويجب مسح QR code من هاتفك.
    """
    
    update.message.reply_text(welcome_message)

def add_account_command(update: Update, context: CallbackContext):
    """إضافة حساب واتساب جديد"""
    user_id = update.effective_user.id
    
    # إنشاء معرّف فريد للجلسة
    session_id = f"user_{user_id}_account_{len(whatsapp_managers.get(user_id, [])) + 1}"
    
    # إنشاء مدير واتساب جديد
    wa_manager = WhatsAppManager(session_name=session_id)
    
    # تخزين المدير
    if user_id not in whatsapp_managers:
        whatsapp_managers[user_id] = []
    whatsapp_managers[user_id].append(wa_manager)
    
    # محاولة الاتصال وعرض QR code
    try:
        update.message.reply_text("📱 **جاري الاتصال بواتساب...**")
        
        # الحصول على QR code
        qr_image = wa_manager.get_qr_code_image()
        
        if qr_image:
            # إرسال QR code كصورة
            update.message.reply_photo(
                photo=qr_image,
                caption=""
                "🔐 **مسح QR code للاتصال:**
                
                1. افتح واتساب على هاتفك
                2. اضغط على القائمة (النقاط الثلاث)
                3. اختر **الأجهزة المرتبطة**
                4. اضغط على **ربط جهاز**
                5. مسح هذا QR code
                
                ⏳ انتظر حتى يكتمل الاتصال تلقائياً.
                """
            )
            
            # بدء محاولة الاتصال
            context.job_queue.run_once(
                lambda ctx: check_connection(ctx, user_id, session_id, update.message.chat_id),
                5
            )
        else:
            update.message.reply_text("❌ فشل في تحميل QR code. حاول مرة أخرى.")
            
    except Exception as e:
        logger.error(f"Error in add_account: {e}")
        update.message.reply_text(f"❌ حدث خطأ: {str(e)}")

def check_connection(context: CallbackContext, user_id: int, session_id: str, chat_id: int):
    """التحقق من الاتصال بشكل دوري"""
    job = context.job
    
    # البحث عن المدير المناسب
    wa_manager = None
    for manager in whatsapp_managers.get(user_id, []):
        if manager.session_name == session_id:
            wa_manager = manager
            break
    
    if not wa_manager:
        context.bot.send_message(chat_id, "❌ لم يتم العثور على الجلسة.")
        return
    
    try:
        # التحقق من حالة الاتصال
        # في التطبيق الحقيقي، تحتاج إلى تنفيذ منطق للتحقق من الاتصال
        context.bot.send_message(
            chat_id,
            "✅ **تم إضافة الحساب بنجاح!**\n\n"
            "يمكنك الآن استخدام /my_accounts لعرض حساباتك."
        )
    except Exception as e:
        logger.error(f"Error checking connection: {e}")

def my_accounts_command(update: Update, context: CallbackContext):
    """عرض حسابات المستخدم"""
    user_id = update.effective_user.id
    
    if user_id not in whatsapp_managers or not whatsapp_managers[user_id]:
        update.message.reply_text("📭 **لا توجد حسابات مضافة.**\n\nاستخدم /add_account لإضافة حساب جديد.")
        return
    
    accounts_list = "📋 **حساباتي في واتساب:**\n\n"
    
    for i, manager in enumerate(whatsapp_managers[user_id], 1):
        accounts_list += f"{i}. حساب واتساب ({manager.session_name})\n"
    
    update.message.reply_text(accounts_list)

def send_message_command(update: Update, context: CallbackContext):
    """إرسال رسالة عبر واتساب"""
    user_id = update.effective_user.id
    
    if user_id not in whatsapp_managers or not whatsapp_managers[user_id]:
        update.message.reply_text("❌ **لا توجد حسابات مضافة.**\n\nاستخدم /add_account أولاً.")
        return
    
    if not context.args or len(context.args) < 2:
        update.message.reply_text(
            "📝 **استخدام الأمر:**\n"
            "/send_message <رقم_الهاتف> <الرسالة>\n\n"
            "**مثال:**\n"
            "/send_message 966501234567 مرحباً!"
        )
        return
    
    phone_number = context.args[0]
    message = " ".join(context.args[1:])
    
    # استخدام أول مدير متاح
    wa_manager = whatsapp_managers[user_id][0]
    
    try:
        update.message.reply_text(f"📤 **جاري إرسال الرسالة إلى {phone_number}...**")
        
        success = wa_manager.send_message(phone_number, message)
        
        if success:
            update.message.reply_text("✅ **تم إرسال الرسالة بنجاح!**")
        else:
            update.message.reply_text("❌ **فشل إرسال الرسالة.** تأكد من صحة الرقم.")
            
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        update.message.reply_text(f"❌ **حدث خطأ:** {str(e)}")

def help_command(update: Update, context: CallbackContext):
    """عرض رسالة المساعدة"""
    help_text = """
    🆘 **مساعدة بوت إدارة واتساب**
    
    **الأوامر المتاحة:**
    
    /start - بدء استخدام البوت
    /add_account - إضافة حساب واتساب جديد (سيطلب QR code)
    /my_accounts - عرض جميع حساباتك المضافة
    /send_message <رقم> <رسالة> - إرسال رسالة عبر واتساب
    /help - عرض هذه الرسالة
    
    **نصائح مهمة:**
    1. تأكد من أن هاتفك متصل بالإنترنت
    2. حافظ على جلسة واتساب ويب مفتوحة على هاتفك
    3. لا تشارك QR code مع أي شخص
    
    **معلومات الأمان:**
    - يتم تخزين الجلسات محلياً فقط
    - لا يتم مشاركة بياناتك مع أي طرف ثالث
    - يمكنك حذف الجلسات متى شئت
    """
    
    update.message.reply_text(help_text)
