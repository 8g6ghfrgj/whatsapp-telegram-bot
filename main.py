#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import asyncio
import logging
import sys
import signal
import base64
from io import BytesIO

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes,
    ConversationHandler,
)

from config import Config
from database import WhatsAppDatabase
from telegram_client import TelegramCollector
from scheduler import JoinScheduler

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
    handlers=[
        logging.FileHandler('bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# حالات المحادثة
(
    MAIN_MENU,
    COLLECT_LINKS,
    VIEW_LINKS,
    JOIN_GROUPS,
    MANAGE_QUEUE,
    SETTINGS
) = range(6)

class WhatsAppBot:
    def __init__(self):
        self.config = Config()
        self.db = WhatsAppDatabase()
        
        # تهيئة Telegram Collector
        self.telegram_collector = TelegramCollector(
            api_id=self.config.API_ID,
            api_hash=self.config.API_HASH,
            phone_number=self.config.PHONE_NUMBER,
            session_file=self.config.SESSION_FILE
        )
        
        # الجدولة
        self.scheduler = JoinScheduler(
            database=self.db,
            telegram_collector=self.telegram_collector,
            max_per_batch=self.config.MAX_JOIN_PER_BATCH,
            delay_seconds=self.config.JOIN_DELAY_SECONDS
        )
        
        self.application = None
        self.running = False
        self.telegram_connected = False
        
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)
        
        logger.info("🤖 تم تهيئة بوت WhatsApp")
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """بدء البوت"""
        keyboard = [
            [InlineKeyboardButton("🔗 تجميع الروابط", callback_data="collect_links")],
            [InlineKeyboardButton("👥 الانضمام للمجموعات", callback_data="join_groups")],
            [InlineKeyboardButton("📊 حالة القائمة", callback_data="queue_status")],
            [InlineKeyboardButton("⚙️ الإعدادات", callback_data="settings")],
            [InlineKeyboardButton("📞 الاتصال بـ Telegram", callback_data="connect_telegram")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_msg = (
            "🤖 *مرحباً بك في بوت جمع الروابط*\n\n"
            "🎯 *المميزات المتوفرة:*\n"
            "• تجميع روابط WhatsApp و Telegram من المجموعات\n"
            "• الانضمام الذكي للمجموعات (5 روابط كل 5 دقائق)\n"
            "• إدارة قائمة انتظار الانضمام\n"
            "• إحصائيات مفصلة\n\n"
            f"📶 حالة Telegram: {'🟢 متصل' if self.telegram_connected else '🔴 غير متصل'}\n\n"
            "اختر الإجراء المناسب:"
        )
        
        await update.message.reply_text(
            welcome_msg,
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        
        return MAIN_MENU
    
    async def connect_telegram(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """الاتصال بـ Telegram"""
        query = update.callback_query
        await query.answer()
        
        await query.edit_message_text("⏳ جاري الاتصال بـ Telegram...")
        
        try:
            success = await self.telegram_collector.connect()
            if success:
                self.telegram_connected = True
                
                # بدء الجدولة
                if not self.scheduler.running:
                    self.scheduler.start()
                
                await query.edit_message_text(
                    "✅ *تم الاتصال بـ Telegram بنجاح!*\n\n"
                    "يمكنك الآن:\n"
                    "1. تجميع الروابط من المجموعات\n"
                    "2. الانضمام للمجموعات الجديدة\n"
                    "3. متابعة حالة القائمة",
                    parse_mode='Markdown'
                )
            else:
                await query.edit_message_text(
                    "❌ *فشل الاتصال بـ Telegram*\n\n"
                    "تأكد من:\n"
                    "1. صحة API_ID و API_HASH\n"
                    "2. صحة رقم الهاتف\n"
                    "3. اتصال الإنترنت",
                    parse_mode='Markdown'
                )
        
        except Exception as e:
            logger.error(f"❌ خطأ في الاتصال: {e}")
            await query.edit_message_text(f"❌ خطأ في الاتصال: {str(e)}")
        
        return MAIN_MENU
    
    async def collect_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """تجميع الروابط"""
        query = update.callback_query
        await query.answer()
        
        if not self.telegram_connected:
            await query.edit_message_text(
                "❌ *يجب الاتصال بـ Telegram أولاً!*",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        await query.edit_message_text(
            "⏳ *جاري تجميع الروابط من المجموعات...*\n\n"
            "هذه العملية قد تستغرق بضع دقائق.",
            parse_mode='Markdown'
        )
        
        try:
            # تجميع الروابط
            links_data = await self.telegram_collector.collect_links_from_groups(max_groups=50)
            
            if not links_data['total_checked']:
                await query.edit_message_text(
                    "❌ لم يتم العثور على أي مجموعات أو لم يتم جمع أي روابط.",
                    parse_mode='Markdown'
                )
                return MAIN_MENU
            
            # حفظ الروابط في قاعدة البيانات
            whatsapp_count = 0
            for link in links_data['whatsapp']:
                if self.db.add_collected_link(link, 'whatsapp', 'auto-collected'):
                    whatsapp_count += 1
            
            telegram_count = 0
            for link in links_data['telegram']:
                if self.db.add_collected_link(link, 'telegram', 'auto-collected'):
                    telegram_count += 1
            
            # تحديث الإحصائيات
            total_links = whatsapp_count + telegram_count
            self.db.update_statistics('links_collected', total_links)
            
            # عرض النتائج
            result_msg = (
                f"✅ *تم تجميع الروابط بنجاح*\n\n"
                f"📊 *الإحصائيات:*\n"
                f"• المجموعات المفحوصة: `{links_data['total_checked']}`\n"
                f"• روابط WhatsApp: `{whatsapp_count}`\n"
                f"• روابط Telegram: `{telegram_count}`\n"
                f"• الإجمالي: `{total_links}`\n\n"
                f"اختر نوع الروابط لعرضها:"
            )
            
            keyboard = [
                [InlineKeyboardButton("📱 روابط WhatsApp", callback_data="view_links_whatsapp")],
                [InlineKeyboardButton("📨 روابط Telegram", callback_data="view_links_telegram")],
                [InlineKeyboardButton("📋 جميع الروابط", callback_data="view_links_all")],
                [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
            ]
            
            await query.edit_message_text(
                result_msg,
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='Markdown'
            )
            
            return VIEW_LINKS
            
        except Exception as e:
            logger.error(f"❌ خطأ في تجميع الروابط: {e}")
            await query.edit_message_text(
                f"❌ خطأ في تجميع الروابط: {str(e)}",
                parse_mode='Markdown'
            )
            return MAIN_MENU
    
    async def view_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض الروابط المجمعة"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        link_type = data.replace("view_links_", "")
        
        # الحصول على الروابط
        if link_type == 'all':
            links = self.db.get_collected_links(limit=50)
            title = "جميع الروابط المجمعة"
        else:
            links = self.db.get_collected_links(link_type=link_type, limit=50)
            title = "روابط WhatsApp" if link_type == 'whatsapp' else "روابط Telegram"
        
        if not links:
            await query.edit_message_text(
                f"📭 لا توجد {title}",
                parse_mode='Markdown'
            )
            return VIEW_LINKS
        
        # تنسيق الرسالة
        message = f"📋 *{title}* ({len(links)} رابط):\n\n"
        
        for i, link in enumerate(links, 1):
            link_url = link['link']
            source = link['source_group'] or "غير معروف"
            status = link['status']
            message += f"{i}. `{link_url}`\n   📍 المصدر: {source[:30]}\n   📊 الحالة: {status}\n\n"
        
        # لوحة المفاتيح
        keyboard = [
            [InlineKeyboardButton("📱 روابط WhatsApp", callback_data="view_links_whatsapp")],
            [InlineKeyboardButton("📨 روابط Telegram", callback_data="view_links_telegram")],
            [InlineKeyboardButton("📋 جميع الروابط", callback_data="view_links_all")],
            [InlineKeyboardButton("🔗 أضف للانضمام", callback_data="add_to_join_queue")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        
        # تقسيم الرسالة إذا كانت طويلة
        if len(message) > 4000:
            parts = self.split_message(message)
            await query.edit_message_text(
                parts[0],
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='Markdown'
            )
            for part in parts[1:]:
                await query.message.reply_text(
                    part,
                    parse_mode='Markdown'
                )
        else:
            await query.edit_message_text(
                message,
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='Markdown'
            )
        
        return VIEW_LINKS
    
    async def join_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """الانضمام للمجموعات"""
        query = update.callback_query
        await query.answer()
        
        await query.edit_message_text(
            "🔗 *إرسال روابط المجموعات للانضمام*\n\n"
            "يمكنك إرسال:\n"
            "• رابط واحد\n"
            "• عدة روابط (سطر لكل رابط)\n"
            "• نص يحتوي على روابط\n\n"
            "⚠️ *ملاحظة:* سيتم الانضمام لـ 5 روابط كل 5 دقائق\n\n"
            "أنواع الروابط المدعومة:\n"
            "• https://t.me/username\n"
            "• https://t.me/joinchat/xxx\n"
            "• https://t.me/+xxx\n"
            "• https://chat.whatsapp.com/xxx\n"
            "• https://wa.me/xxx",
            parse_mode='Markdown'
        )
        
        return JOIN_GROUPS
    
    async def process_join_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """معالجة روابط الانضمام"""
        text = update.message.text
        
        if not self.telegram_connected:
            await update.message.reply_text(
                "❌ يجب الاتصال بـ Telegram أولاً!",
                parse_mode='Markdown'
            )
            return JOIN_GROUPS
        
        # استخراج جميع الروابط
        import re
        url_pattern = r'https?://[^\s]+'
        links = re.findall(url_pattern, text)
        
        if not links:
            await update.message.reply_text(
                "❌ لم يتم العثور على أي روابط!",
                parse_mode='Markdown'
            )
            return JOIN_GROUPS
        
        # إضافة الروابط لقائمة الانتظار
        result = self.scheduler.add_links_to_queue(links)
        
        # رسالة النتيجة
        result_msg = (
            f"📥 *تمت إضافة الروابط لقائمة الانتظار*\n\n"
            f"📊 *النتائج:*\n"
            f"• الإجمالي المقدم: `{result['total']}`\n"
            f"• المضاف: `{result['added']}`\n"
            f"• المكرر: `{result['duplicates']}`\n"
            f"• الأخطاء: `{result['errors']}`\n\n"
            f"⏰ سيتم الانضمام لـ {self.config.MAX_JOIN_PER_BATCH} رابط كل "
            f"{self.format_time(self.config.JOIN_DELAY_SECONDS)}"
        )
        
        await update.message.reply_text(
            result_msg,
            parse_mode='Markdown'
        )
        
        return JOIN_GROUPS
    
    async def queue_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض حالة قائمة الانتظار"""
        query = update.callback_query
        await query.answer()
        
        queue_stats = self.scheduler.get_queue_status()
        links_count = self.db.get_links_count()
        whatsapp_count = self.db.get_links_count('whatsapp')
        telegram_count = self.db.get_links_count('telegram')
        
        status_msg = (
            f"📊 *حالة البوت*\n\n"
            f"📶 *حالة الاتصال:* {'🟢 متصل' if self.telegram_connected else '🔴 غير متصل'}\n\n"
            f"📋 *قائمة انتظار الانضمام:*\n"
            f"• المعلقة: `{queue_stats.get('pending', 0)}`\n"
            f"• قيد المعالجة: `{queue_stats.get('processing', 0)}`\n"
            f"• المكتملة: `{queue_stats.get('completed', 0)}`\n"
            f"• الفاشلة: `{queue_stats.get('failed', 0)}`\n"
            f"• الإجمالي: `{queue_stats.get('total', 0)}`\n\n"
            f"🔗 *الروابط المجمعة:*\n"
            f"• روابط WhatsApp: `{whatsapp_count}`\n"
            f"• روابط Telegram: `{telegram_count}`\n"
            f"• الإجمالي: `{links_count}`\n\n"
            f"⚙️ *إعدادات الجدولة:*\n"
            f"• الحد الأقصى للدفعة: `{self.config.MAX_JOIN_PER_BATCH}`\n"
            f"• التاخير بين الدفعات: `{self.format_time(self.config.JOIN_DELAY_SECONDS)}`"
        )
        
        keyboard = [
            [InlineKeyboardButton("🔄 تحديث", callback_data="queue_status")],
            [InlineKeyboardButton("🗑️ مسح المكتملة", callback_data="clear_completed")],
            [InlineKeyboardButton("🗑️ مسح الفاشلة", callback_data="clear_failed")],
            [InlineKeyboardButton("🔗 الانضمام للمجموعات", callback_data="join_groups")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        
        await query.edit_message_text(
            status_msg,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return MANAGE_QUEUE
    
    async def clear_queue(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """مسح قائمة الانتظار"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        status = data.replace("clear_", "")
        
        if self.scheduler.clear_queue(status):
            await query.edit_message_text(
                f"✅ تم مسح المهام {status} من قائمة الانتظار",
                parse_mode='Markdown'
            )
        else:
            await query.edit_message_text(
                "❌ فشل في مسح قائمة الانتظار",
                parse_mode='Markdown'
            )
        
        return await self.queue_status(update, context)
    
    async def back_to_main(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """العودة للقائمة الرئيسية"""
        query = update.callback_query
        await query.answer()
        
        keyboard = [
            [InlineKeyboardButton("🔗 تجميع الروابط", callback_data="collect_links")],
            [InlineKeyboardButton("👥 الانضمام للمجموعات", callback_data="join_groups")],
            [InlineKeyboardButton("📊 حالة القائمة", callback_data="queue_status")],
            [InlineKeyboardButton("⚙️ الإعدادات", callback_data="settings")],
            [InlineKeyboardButton("📞 الاتصال بـ Telegram", callback_data="connect_telegram")]
        ]
        
        welcome_msg = (
            "🏠 *القائمة الرئيسية*\n\n"
            f"📶 حالة Telegram: {'🟢 متصل' if self.telegram_connected else '🔴 غير متصل'}\n\n"
            "اختر الإجراء المناسب:"
        )
        
        await query.edit_message_text(
            welcome_msg,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return MAIN_MENU
    
    async def settings(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض الإعدادات"""
        query = update.callback_query
        await query.answer()
        
        settings_msg = (
            "⚙️ *إعدادات البوت*\n\n"
            f"📊 *الإعدادات الحالية:*\n"
            f"• الحد الأقصى للدفعة: `{self.config.MAX_JOIN_PER_BATCH}`\n"
            f"• التاخير بين الدفعات: `{self.config.JOIN_DELAY_SECONDS} ثانية`\n"
            f"• قاعدة البيانات: `{self.config.DATABASE_FILE}`\n"
            f"• ملف الجلسة: `{self.config.SESSION_FILE}`\n\n"
            f"📞 *معلومات الاتصال:*\n"
            f"• API ID: `{self.config.API_ID}`\n"
            f"• رقم الهاتف: `{self.config.PHONE_NUMBER}`"
        )
        
        keyboard = [
            [InlineKeyboardButton("🔄 تحديث الإعدادات", callback_data="refresh_settings")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        
        await query.edit_message_text(
            settings_msg,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return SETTINGS
    
    def format_time(self, seconds: int) -> str:
        """تنسيق الوقت"""
        if seconds < 60:
            return f"{seconds} ثانية"
        elif seconds < 3600:
            minutes = seconds // 60
            return f"{minutes} دقيقة"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours} ساعة و {minutes} دقيقة"
    
    def split_message(self, message: str, max_length: int = 4000):
        """تقسيم الرسالة الطويلة"""
        if len(message) <= max_length:
            return [message]
        
        parts = []
        while len(message) > max_length:
            split_point = message[:max_length].rfind('\n')
            if split_point == -1:
                split_point = message[:max_length].rfind(' ')
            if split_point == -1:
                split_point = max_length
            
            parts.append(message[:split_point])
            message = message[split_point:].lstrip()
        
        if message:
            parts.append(message)
        
        return parts
    
    def setup_handlers(self):
        """إعداد معالجات البوت"""
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler("start", self.start)],
            states={
                MAIN_MENU: [
                    CallbackQueryHandler(self.collect_links, pattern="^collect_links$"),
                    CallbackQueryHandler(self.join_groups, pattern="^join_groups$"),
                    CallbackQueryHandler(self.queue_status, pattern="^queue_status$"),
                    CallbackQueryHandler(self.settings, pattern="^settings$"),
                    CallbackQueryHandler(self.connect_telegram, pattern="^connect_telegram$"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                VIEW_LINKS: [
                    CallbackQueryHandler(self.view_links, pattern=r"^view_links_.*"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                JOIN_GROUPS: [
                    MessageHandler(filters.TEXT & ~filters.COMMAND, self.process_join_links),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                MANAGE_QUEUE: [
                    CallbackQueryHandler(self.queue_status, pattern="^queue_status$"),
                    CallbackQueryHandler(self.clear_queue, pattern=r"^clear_.*"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                SETTINGS: [
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ]
            },
            fallbacks=[CommandHandler("cancel", self.cancel)],
            allow_reentry=True
        )
        
        self.application.add_handler(conv_handler)
        
        # أوامر إضافية
        self.application.add_handler(CommandHandler("help", self.show_help))
        self.application.add_handler(CommandHandler("stats", self.show_stats))
    
    async def cancel(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """إلغاء العملية"""
        await update.message.reply_text(
            "❌ تم الإلغاء. استخدم /start للبدء من جديد.",
            parse_mode='Markdown'
        )
        return ConversationHandler.END
    
    async def show_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض رسالة المساعدة"""
        help_msg = (
            "📚 *دليل استخدام البوت*\n\n"
            "🎯 *الأوامر المتاحة:*\n"
            "• /start - بدء البوت والقائمة الرئيسية\n"
            "• /help - عرض رسالة المساعدة\n"
            "• /stats - عرض الإحصائيات\n"
            "• /cancel - إلغاء العملية الحالية\n\n"
            "📱 *المميزات الرئيسية:*\n"
            "1. *الاتصال بـ Telegram:* للوصول للمجموعات\n"
            "2. *تجميع الروابط:* جمع روابط من المجموعات\n"
            "3. *الانضمام الذكي:* انضمام لـ 5 مجموعات كل 5 دقائق\n"
            "4. *إدارة القائمة:* متابعة حالة الانضمام\n\n"
            "⚠️ *ملاحظات هامة:*\n"
            "• يجب الحصول على API_ID و API_HASH من my.telegram.org\n"
            "• البوت يعمل مع روابط Telegram و WhatsApp\n"
            "• التزم بالحدود (5 روابط كل 5 دقائق)\n\n"
            "📞 *للدعم:* تواصل مع المطور"
        )
        
        await update.message.reply_text(
            help_msg,
            parse_mode='Markdown'
        )
    
    async def show_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض الإحصائيات"""
        queue_stats = self.scheduler.get_queue_status()
        links_count = self.db.get_links_count()
        
        stats_msg = (
            f"📊 *إحصائيات البوت*\n\n"
            f"📋 *قائمة الانتظار:*\n"
            f"• المعلقة: `{queue_stats.get('pending', 0)}`\n"
            f"• المكتملة: `{queue_stats.get('completed', 0)}`\n"
            f"• الفاشلة: `{queue_stats.get('failed', 0)}`\n"
            f"• الإجمالي: `{queue_stats.get('total', 0)}`\n\n"
            f"🔗 *الروابط المجمعة:*\n"
            f"• الإجمالي: `{links_count}`\n"
            f"• WhatsApp: `{self.db.get_links_count('whatsapp')}`\n"
            f"• Telegram: `{self.db.get_links_count('telegram')}`"
        )
        
        await update.message.reply_text(
            stats_msg,
            parse_mode='Markdown'
        )
    
    def run(self):
        """تشغيل البوت"""
        if not self.config.BOT_TOKEN:
            logger.error("❌ BOT_TOKEN غير معرف!")
            print("❌ الرجاء تعيين BOT_TOKEN في متغيرات البيئة")
            sys.exit(1)
        
        self.application = Application.builder().token(self.config.BOT_TOKEN).build()
        
        self.setup_handlers()
        
        logger.info("🤖 بدء تشغيل البوت...")
        self.running = True
        
        try:
            self.application.run_polling()
        except Exception as e:
            logger.error(f"❌ خطأ أثناء تشغيل البوت: {e}")
        finally:
            self.shutdown(None, None)
    
    def shutdown(self, signum, frame):
        """إيقاف البوت"""
        if not self.running:
            return
        
        logger.info("🛑 إيقاف البوت...")
        self.running = False
        
        # إيقاف الجدولة
        self.scheduler.stop()
        
        # قطع اتصال Telegram
        try:
            asyncio.run(self.telegram_collector.disconnect())
        except:
            pass
        
        # إغلاق قاعدة البيانات
        try:
            self.db.close()
        except Exception as e:
            logger.error(f"❌ خطأ في إغلاق قاعدة البيانات: {e}")
        
        logger.info("✅ تم إيقاف البوت بنجاح")
        sys.exit(0)

if __name__ == "__main__":
    bot = WhatsAppBot()
    bot.run()
