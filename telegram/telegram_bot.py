from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
from whatsapp_manager import WhatsAppManager
from database import SessionLocal, User, Group, Message, init_db
import logging
import os
from datetime import datetime
from config import Config

# إعداد التسجيل
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=getattr(logging, Config.LOG_LEVEL)
)
logger = logging.getLogger(__name__)

class TelegramBot:
    def __init__(self):
        self.application = None
        
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """دالة البداية"""
        user = update.effective_user
        
        # حفظ المستخدم في قاعدة البيانات
        db = SessionLocal()
        try:
            db_user = db.query(User).filter(User.telegram_id == str(user.id)).first()
            if not db_user:
                db_user = User(
                    telegram_id=str(user.id),
                    username=user.username,
                    first_name=user.first_name,
                    last_name=user.last_name
                )
                db.add(db_user)
                db.commit()
                logger.info(f"✅ New user registered: {user.username}")
        finally:
            db.close()
        
        keyboard = [
            [InlineKeyboardButton("🔗 ربط واتساب", callback_data="connect_whatsapp")],
            [InlineKeyboardButton("👥 عرض المجموعات", callback_data="show_groups")],
            [InlineKeyboardButton("🔄 تحديث المجموعات", callback_data="refresh_groups")],
            [InlineKeyboardButton("📢 إرسال رسالة", callback_data="send_message")],
            [InlineKeyboardButton("➕ انضم لمجموعة", callback_data="join_group")],
            [InlineKeyboardButton("📊 الحالة", callback_data="status")],
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_text = f"""
        🚀 **مرحباً {user.first_name}!

        🤖 بوت النشر الاحترافي على واتساب**

        **المميزات:**
        ✅ ربط مباشر مع واتساب ويب
        ✅ إدارة كاملة للمجموعات
        ✅ إرسال رسائل تلقائي
        ✅ انضمام تلقائي للمجموعات
        ✅ جدولة الرسائل
        ✅ عمل 24/7

        **اختر من القائمة:**"""
        
        await update.message.reply_text(welcome_text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def button_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """معالجة الأزرار"""
        query = update.callback_query
        await query.answer()
        
        user_id = str(query.from_user.id)
        data = query.data
        
        if data == "connect_whatsapp":
            await self.connect_whatsapp(query, context, user_id)
        elif data == "show_groups":
            await self.show_groups(query, context, user_id)
        elif data == "refresh_groups":
            await self.refresh_groups(query, context, user_id)
        elif data == "send_message":
            await self.request_message(query, context, user_id)
        elif data == "join_group":
            await self.request_invite_link(query, context, user_id)
        elif data == "status":
            await self.show_status(query, context, user_id)
        elif data.startswith("group_"):
            await self.select_group(query, context, user_id, data)
        elif data.startswith("send_to_"):
            await self.confirm_send_message(query, context, user_id, data)
        elif data == "confirm_send":
            await self.final_send_message(query, context, user_id)
        elif data == "cancel_send":
            await query.edit_message_text("❌ تم إلغاء الإرسال")
    
    async def connect_whatsapp(self, query, context, user_id):
        """ربط حساب واتساب"""
        await query.edit_message_text("🔄 جاري ربط حساب واتساب...")
        
        # بدء مدير واتساب
        manager = WhatsAppManager.get_instance(user_id)
        
        if manager.start():
            # الحصول على QR Code
            qr_image = manager.get_qr_code()
            
            if qr_image:
                # إرسال QR Code كصورة
                with open(f"session/user_{user_id}/qr_code.png", "rb") as f:
                    await context.bot.send_photo(
                        chat_id=query.message.chat_id,
                        photo=f,
                        caption="📱 **مسح QR Code**\n\n1. افتح واتساب على جوالك\n2. اضغط على القائمة (ثلاث نقاط)\n3. اختر أجهزة مرتبطة\n4. اضغط على ربط جهاز جديد\n5. مسح الكود أعلاه\n\n✅ سيتم الإخطار عند الاتصال"
                    )
            else:
                await query.edit_message_text("✅ **واتساب متصل بالفعل!**\n\nيمكنك الآن استخدام المميزات.")
        else:
            await query.edit_message_text("❌ فشل في بدء واتساب. حاول مرة أخرى.")
    
    async def show_groups(self, query, context, user_id):
        """عرض قائمة المجموعات"""
        await query.edit_message_text("🔄 جاري جلب المجموعات...")
        
        db = SessionLocal()
        try:
            groups = db.query(Group).filter(Group.user_id == user_id, Group.is_active == True).all()
            
            if not groups:
                await query.edit_message_text("📭 لم يتم العثور على مجموعات.\n\nاضغط على 'تحديث المجموعات' لجلبها.")
                return
            
            # تقسيم المجموعات إلى صفحات
            groups_text = "👥 **قائمة مجموعاتك:**\n\n"
            keyboard = []
            
            for i, group in enumerate(groups, 1):
                groups_text += f"{i}. {group.name}\n"
                
                # أزرار للاختيار (لكل مجموعة زر)
                keyboard.append([InlineKeyboardButton(
                    f"📨 {group.name[:20]}...",
                    callback_data=f"group_{group.whatsapp_id}"
                )])
            
            # أزرار التنقل
            keyboard.append([
                InlineKeyboardButton("🔄 تحديث", callback_data="refresh_groups"),
                InlineKeyboardButton("🏠 الرئيسية", callback_data="main_menu")
            ])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(groups_text, reply_markup=reply_markup, parse_mode='Markdown')
            
        finally:
            db.close()
    
    async def refresh_groups(self, query, context, user_id):
        """تحديث قائمة المجموعات"""
        await query.edit_message_text("🔄 جاري تحديث قائمة المجموعات...")
        
        manager = WhatsAppManager.get_instance(user_id)
        groups = manager.get_groups(refresh=True)
        
        if groups:
            await query.edit_message_text(f"✅ تم تحديث {len(groups)} مجموعة")
        else:
            await query.edit_message_text("❌ فشل في جلب المجموعات. تأكد من اتصال واتساب.")
    
    async def request_message(self, query, context, user_id):
        """طلب كتابة الرسالة"""
        await query.edit_message_text(
            "💬 **اكتب الرسالة التي تريد إرسالها:**\n\n"
            "يمكنك كتابة رسالة طويلة وسيتم إرسالها كما هي."
        )
        # حفظ الحالة لمعرفة أن المستخدم يريد إرسال رسالة
        context.user_data["waiting_for_message"] = True
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """معالجة الرسائل النصية"""
        user_id = str(update.effective_user.id)
        
        if context.user_data.get("waiting_for_message"):
            # حفظ الرسالة
            message_text = update.message.text
            context.user_data["message_to_send"] = message_text
            context.user_data["waiting_for_message"] = False
            
            # عرض مجموعات للاختيار
            await self.show_groups_for_selection(update.message, context, user_id, message_text)
            
        elif context.user_data.get("waiting_for_invite_link"):
            # معالجة رابط الدعوة
            invite_link = update.message.text
            context.user_data["waiting_for_invite_link"] = False
            
            await update.message.reply_text("🔄 جاري الانضمام للمجموعة...")
            
            manager = WhatsAppManager.get_instance(user_id)
            success = manager.join_group(invite_link)
            
            if success:
                await update.message.reply_text("✅ تم الانضمام للمجموعة بنجاح!")
            else:
                await update.message.reply_text("❌ فشل الانضمام للمجموعة. تحقق من الرابط.")
    
    async def show_groups_for_selection(self, message, context, user_id, message_text):
        """عرض المجموعات لاختيار الوجهة"""
        db = SessionLocal()
        try:
            groups = db.query(Group).filter(Group.user_id == user_id, Group.is_active == True).all()
            
            if not groups:
                await message.reply_text("📭 لا توجد مجموعات. قم بتحديث المجموعات أولاً.")
                return
            
            keyboard = []
            for group in groups:
                keyboard.append([InlineKeyboardButton(
                    f"📨 {group.name[:25]}",
                    callback_data=f"send_to_{group.whatsapp_id}"
                )])
            
            keyboard.append([InlineKeyboardButton("❌ إلغاء", callback_data="cancel_send")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await message.reply_text(
                f"📝 **الرسالة:**\n{message_text[:100]}...\n\n"
                "👥 **اختر المجموعة المستهدفة:**",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
        finally:
            db.close()
    
    async def select_group(self, query, context, user_id, data):
        """اختيار مجموعة"""
        group_id = data.replace("group_", "")
        
        # البحث عن اسم المجموعة
        db = SessionLocal()
        try:
            group = db.query(Group).filter(Group.whatsapp_id == group_id, Group.user_id == user_id).first()
            
            if group:
                keyboard = [[
                    InlineKeyboardButton("📨 إرسال رسالة", callback_data=f"send_to_{group_id}"),
                    InlineKeyboardButton("🏠 الرئيسية", callback_data="main_menu")
                ]]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await query.edit_message_text(
                    f"📌 **المجموعة المحددة:**\n**{group.name}**\n\n"
                    f"🆔: `{group_id}`\n"
                    f"📅: {group.created_at.strftime('%Y-%m-%d')}",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
        finally:
            db.close()
    
    async def confirm_send_message(self, query, context, user_id, data):
        """تأكيد إرسال الرسالة"""
        group_id = data.replace("send_to_", "")
        
        # حفظ ID المجموعة في السياق
        context.user_data["selected_group_id"] = group_id
        
        # البحث عن اسم المجموعة
        db = SessionLocal()
        try:
            group = db.query(Group).filter(Group.whatsapp_id == group_id).first()
            message_text = context.user_data.get("message_to_send", "")
            
            keyboard = [[
                InlineKeyboardButton("✅ تأكيد الإرسال", callback_data="confirm_send"),
                InlineKeyboardButton("❌ إلغاء", callback_data="cancel_send")
            ]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                f"📤 **تأكيد الإرسال**\n\n"
                f"**إلى:** {group.name}\n"
                f"**الرسالة:**\n{message_text[:200]}...\n\n"
                "⚠️ **تأكيد الإرسال؟**",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        finally:
            db.close()
    
    async def final_send_message(self, query, context, user_id):
        """الإرسال النهائي للرسالة"""
        await query.edit_message_text("🔄 جاري إرسال الرسالة...")
        
        group_id = context.user_data.get("selected_group_id")
        message_text = context.user_data.get("message_to_send", "")
        
        if not group_id or not message_text:
            await query.edit_message_text("❌ خطأ في البيانات. حاول مرة أخرى.")
            return
        
        # الإرسال عبر مدير واتساب
        manager = WhatsAppManager.get_instance(user_id)
        success = manager.send_message(group_id, message_text)
        
        if success:
            # حفظ الرسالة في قاعدة البيانات
            db = SessionLocal()
            try:
                group = db.query(Group).filter(Group.whatsapp_id == group_id).first()
                user = db.query(User).filter(User.telegram_id == user_id).first()
                
                if group and user:
                    message_record = Message(
                        content=message_text,
                        status='sent',
                        sent_at=datetime.utcnow(),
                        user_id=user.id,
                        group_id=group.id
                    )
                    db.add(message_record)
                    db.commit()
                    
                    await query.edit_message_text("✅ تم إرسال الرسالة بنجاح!")
            finally:
                db.close()
        else:
            await query.edit_message_text("❌ فشل إرسال الرسالة. تأكد من اتصال واتساب.")
    
    async def request_invite_link(self, query, context, user_id):
        """طلب رابط الدعوة"""
        await query.edit_message_text(
            "🔗 **أرسل رابط الدعوة (Invite Link):**\n\n"
            "يجب أن يكون الرابط بصيغة:\n"
            "https://chat.whatsapp.com/xxxxxxxxxxxx"
        )
        context.user_data["waiting_for_invite_link"] = True
    
    async def show_status(self, query, context, user_id):
        """عرض حالة النظام"""
        manager = WhatsAppManager.get_instance(user_id)
        status = manager.get_status()
        
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.telegram_id == user_id).first()
            groups_count = db.query(Group).filter(Group.user_id == user_id, Group.is_active == True).count()
            messages_count = db.query(Message).filter(Message.user_id == user.id).count()
            
            status_text = f"""
📊 **حالة النظام**

👤 **المستخدم:** {user.first_name}
🆔: `{user_id}`

🔗 **واتساب:**
{'✅ متصل' if status['is_logged_in'] else '❌ غير متصل'}
{'🟢 يعمل' if status['is_running'] else '🔴 متوقف'}

📁 **البيانات:**
👥 مجموعات: {groups_count}
📨 رسائل مرسلة: {messages_count}
📅 عضو منذ: {user.created_at.strftime('%Y-%m-%d')}

🔄 **آخر تحديث:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            """
            
            keyboard = [[
                InlineKeyboardButton("🔄 تحديث الحالة", callback_data="status"),
                InlineKeyboardButton("🏠 الرئيسية", callback_data="main_menu")
            ]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(status_text, reply_markup=reply_markup, parse_mode='Markdown')
            
        finally:
            db.close()
    
    async def main_menu(self, query, context, user_id):
        """العودة للقائمة الرئيسية"""
        await self.start(query.message, context)
    
    def setup_handlers(self):
        """إعداد معالجات الأحداث"""
        self.application.add_handler(CommandHandler("start", self.start))
        self.application.add_handler(CallbackQueryHandler(self.button_handler))
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
    
    def run(self):
        """تشغيل البوت"""
        # تهيئة قاعدة البيانات
        init_db()
        
        # إنشاء التطبيق
        self.application = Application.builder().token(Config.TELEGRAM_TOKEN).build()
        
        # إعداد المعالجات
        self.setup_handlers()
        
        # تشغيل البوت
        print("🤖 Bot is running...")
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)
