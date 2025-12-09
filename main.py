#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
البوت الرئيسي - WhatsApp Bot
إدارة حسابات WhatsApp عبر Telegram مع جميع الميزات المطلوبة
"""

import os
import asyncio
import logging
import sys
import signal
from datetime import datetime

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
from whatsapp_manager import WhatsAppManager
from database import WhatsAppDatabase
from scheduler import JoinScheduler
from utils import (
    validate_whatsapp_link,
    extract_links_from_text,
    format_time,
    create_keyboard,
    format_stats
)

# إعداد السجل
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
    MANAGE_ACCOUNTS,
    COLLECT_LINKS,
    VIEW_LINKS,
    SEND_MESSAGES,
    JOIN_GROUPS,
    MANAGE_QUEUE,
    SETTINGS,
    WAITING_FOR_QR
) = range(9)

class WhatsAppBot:
    def __init__(self):
        """تهيئة البوت"""
        self.config = Config()
        self.db = WhatsAppDatabase()
        
        # إدارة الحسابات
        self.whatsapp_managers = {}
        self.current_account = "default"
        self.user_sessions = {}
        
        # الجدولة
        self.scheduler = JoinScheduler(self.db, self, 
                                      self.config.MAX_JOIN_PER_BATCH,
                                      self.config.JOIN_DELAY_SECONDS)
        
        self.application = None
        self.running = False
        
        # معالجة الإشارات
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)
        
        logger.info("🤖 تم تهيئة بوت WhatsApp")
    
    def get_whatsapp_manager(self, account_name: str = None) -> WhatsAppManager:
        """الحصول على مدير واتساب للحساب"""
        if not account_name:
            account_name = self.current_account
        
        if account_name not in self.whatsapp_managers:
            try:
                manager = WhatsAppManager(
                    session_dir=self.config.SESSION_DIR,
                    account_name=account_name
                )
                self.whatsapp_managers[account_name] = manager
                logger.info(f"✅ تم إنشاء مدير للحساب: {account_name}")
            except Exception as e:
                logger.error(f"❌ خطأ في إنشاء مدير للحساب {account_name}: {e}")
                return None
        
        return self.whatsapp_managers.get(account_name)
    
    def get_admin_id(self) -> int:
        """الحصول على معرف المسؤول"""
        # يمكنك تغيير هذا ليكون معرف المستخدم الخاص بك
        return int(os.environ.get("ADMIN_USER_ID", 0))
    
    # ========== معالجات الأوامر ==========
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """بدء البوت"""
        user_id = update.effective_user.id
        
        # إنشاء جلسة المستخدم
        self.user_sessions[user_id] = {
            'current_account': self.current_account,
            'state': 'main_menu'
        }
        
        # التحقق من أن الجدولة تعمل
        if not self.scheduler.running:
            self.scheduler.start()
        
        # القائمة الرئيسية
        keyboard = [
            [InlineKeyboardButton("📱 إدارة الحسابات", callback_data="manage_accounts")],
            [InlineKeyboardButton("🔗 تجميع الروابط", callback_data="collect_links")],
            [InlineKeyboardButton("📨 إرسال رسائل", callback_data="send_messages")],
            [InlineKeyboardButton("👥 الانضمام للمجموعات", callback_data="join_groups")],
            [InlineKeyboardButton("📊 حالة القائمة", callback_data="queue_status")],
            [InlineKeyboardButton("⚙️ الإعدادات", callback_data="settings")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # رسالة الترحيب
        welcome_msg = (
            "🤖 *مرحباً بك في بوت WhatsApp المتقدم*\n\n"
            "🎯 *المميزات المتوفرة:*\n"
            "• ربط وإدارة حسابات WhatsApp متعددة\n"
            "• تجميع روابط WhatsApp و Telegram من المجموعات\n"
            "• إرسال رسائل للمجموعات\n"
            "• الانضمام الذكي للمجموعات (5 روابط كل 5 دقائق)\n"
            "• إشعارات فورية عند النجاح/الفشل\n\n"
            "اختر الإجراء المناسب:"
        )
        
        await update.message.reply_text(
            welcome_msg,
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        
        return MAIN_MENU
    
    async def manage_accounts(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """إدارة الحسابات"""
        query = update.callback_query
        await query.answer()
        
        # الحصول على جميع الحسابات
        accounts = self.db.get_all_accounts()
        
        # إنشاء لوحة المفاتيح
        keyboard = []
        for account in accounts:
            account_name = account['name']
            is_active = "🟢" if account_name == self.current_account else "⚪"
            keyboard.append([
                InlineKeyboardButton(
                    f"{is_active} {account_name}",
                    callback_data=f"select_account_{account_name}"
                )
            ])
        
        keyboard.append([
            InlineKeyboardButton("➕ إنشاء حساب جديد", callback_data="create_account"),
            InlineKeyboardButton("🔄 ربط حساب", callback_data=f"connect_account_{self.current_account}")
        ])
        
        keyboard.append([
            InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")
        ])
        
        await query.edit_message_text(
            "📱 *إدارة الحسابات*\n\n"
            "اختر حساباً للتبديل إليه أو إنشاء حساب جديد:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return MANAGE_ACCOUNTS
    
    async def select_account(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """اختيار حساب"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        account_name = data.replace("select_account_", "")
        
        # تحديث الحساب الحالي
        self.current_account = account_name
        self.db.update_account_status(
            self.db.get_account(name=account_name)['id'],
            'active'
        )
        
        # تحديث جلسة المستخدم
        user_id = query.from_user.id
        if user_id in self.user_sessions:
            self.user_sessions[user_id]['current_account'] = account_name
        
        await query.edit_message_text(
            f"✅ تم التبديل إلى الحساب: *{account_name}*",
            parse_mode='Markdown'
        )
        
        return await self.back_to_main(update, context)
    
    async def connect_account(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """ربط حساب واتساب"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        account_name = data.replace("connect_account_", "")
        
        # الحصول على مدير الحساب
        manager = self.get_whatsapp_manager(account_name)
        if not manager:
            await query.edit_message_text(
                f"❌ لا يمكن العثور على مدير للحساب: {account_name}",
                parse_mode='Markdown'
            )
            return MANAGE_ACCOUNTS
        
        # التحقق إذا كان الحساب مربوطاً بالفعل
        if manager.is_logged_in:
            await query.edit_message_text(
                f"✅ الحساب *{account_name}* مربوط بالفعل!",
                parse_mode='Markdown'
            )
            return MANAGE_ACCOUNTS
        
        # الحصول على QR Code
        await query.edit_message_text(
            f"⏳ جاري تحضير QR Code للحساب *{account_name}*...",
            parse_mode='Markdown'
        )
        
        qr_code = manager.get_qr_code()
        if not qr_code:
            await query.edit_message_text(
                "❌ فشل في الحصول على QR Code. حاول مرة أخرى.",
                parse_mode='Markdown'
            )
            return MANAGE_ACCOUNTS
        
        try:
            # إرسال صورة QR Code
            await query.message.reply_photo(
                photo=base64.b64decode(qr_code),
                caption=f"📱 *QR Code لحساب {account_name}*\n\n"
                       "1. افتح WhatsApp على هاتفك\n"
                       "2. اضغط على القائمة ☰\n"
                       "3. اختر 'الأجهزة المرتبطة'\n"
                       "4. اضغط على 'ربط جهاز'\n"
                       "5. مسح هذا الـ QR Code\n\n"
                       "سيتم إعلامك تلقائياً عند نجاح الربط.",
                parse_mode='Markdown'
            )
            
            # بدء التحقق الدوري من حالة الدخول
            asyncio.create_task(self._check_login_status(manager, account_name, query.from_user.id))
            
            await query.edit_message_text(
                f"⏳ بانتظار مسح QR Code للحساب *{account_name}*...",
                parse_mode='Markdown'
            )
            
            return WAITING_FOR_QR
            
        except Exception as e:
            logger.error(f"❌ خطأ في إرسال QR Code: {e}")
            await query.edit_message_text(
                "❌ حدث خطأ في إرسال QR Code. حاول مرة أخرى.",
                parse_mode='Markdown'
            )
            return MANAGE_ACCOUNTS
    
    async def _check_login_status(self, manager: WhatsAppManager, account_name: str, user_id: int):
        """التحقق الدوري من حالة الدخول"""
        for _ in range(60):  # 60 محاولة (5 دقائق)
            if manager.check_login_status():
                try:
                    await self.application.bot.send_message(
                        chat_id=user_id,
                        text=f"✅ تم ربط حساب *{account_name}* بنجاح!",
                        parse_mode='Markdown'
                    )
                    
                    # تحديث حالة الحساب في قاعدة البيانات
                    account = self.db.get_account(name=account_name)
                    if account:
                        self.db.update_account_status(account['id'], 'active')
                    
                except Exception as e:
                    logger.error(f"❌ خطأ في إرسال إشعار النجاح: {e}")
                break
            
            await asyncio.sleep(5)  # الانتظار 5 ثواني بين المحاولات
    
    async def collect_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """تجميع الروابط من المجموعات"""
        query = update.callback_query
        await query.answer()
        
        # التحقق من أن الحساب مربوط
        manager = self.get_whatsapp_manager()
        if not manager or not manager.is_logged_in:
            await query.edit_message_text(
                "❌ يجب ربط حساب WhatsApp أولاً!",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        await query.edit_message_text(
            "⏳ *جاري تجميع الروابط من جميع المجموعات...*\n\n"
            "هذه العملية قد تستغرق بضع دقائق.",
            parse_mode='Markdown'
        )
        
        # تجميع الروابط
        links_data = manager.collect_links_from_groups(self.config.MAX_GROUPS_TO_SCAN)
        
        if not links_data['total_checked']:
            await query.edit_message_text(
                "❌ لم يتم العثور على أي مجموعات أو لم يتم جمع أي روابط.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        # حفظ الروابط في قاعدة البيانات
        account = self.db.get_account(name=self.current_account)
        if not account:
            await query.edit_message_text(
                "❌ حساب غير موجود في قاعدة البيانات!",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        account_id = account['id']
        
        # حفظ روابط WhatsApp
        whatsapp_count = 0
        for link in links_data['whatsapp']:
            if self.db.add_collected_link(account_id, link, 'whatsapp', 'auto-collected'):
                whatsapp_count += 1
        
        # حفظ روابط Telegram
        telegram_count = 0
        for link in links_data['telegram']:
            if self.db.add_collected_link(account_id, link, 'telegram', 'auto-collected'):
                telegram_count += 1
        
        # تحديث الإحصائيات
        self.db.update_statistics(account_id, 'links_collected', whatsapp_count + telegram_count)
        
        # عرض النتائج
        result_msg = (
            f"✅ *تم تجميع الروابط بنجاح*\n\n"
            f"📊 *الإحصائيات:*\n"
            f"• المجموعات المفحوصة: `{links_data['total_checked']}`\n"
            f"• روابط WhatsApp: `{whatsapp_count}`\n"
            f"• روابط Telegram: `{telegram_count}`\n"
            f"• الإجمالي: `{whatsapp_count + telegram_count}`\n\n"
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
    
    async def view_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """عرض الروابط المجمعة"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        link_type = data.replace("view_links_", "")
        
        # الحصول على الحساب الحالي
        account = self.db.get_account(name=self.current_account)
        if not account:
            await query.edit_message_text(
                "❌ حساب غير موجود!",
                parse_mode='Markdown'
            )
            return VIEW_LINKS
        
        account_id = account['id']
        
        # الحصول على الروابط
        if link_type == 'all':
            links = self.db.get_collected_links(account_id=account_id, limit=50)
            title = "جميع الروابط المجمعة"
        else:
            links = self.db.get_collected_links(account_id=account_id, link_type=link_type, limit=50)
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
            message += f"{i}. `{link_url}`\n   📍 المصدر: {source[:30]}\n\n"
        
        # لوحة المفاتيح
        keyboard = [
            [InlineKeyboardButton("📱 روابط WhatsApp", callback_data="view_links_whatsapp")],
            [InlineKeyboardButton("📨 روابط Telegram", callback_data="view_links_telegram")],
            [InlineKeyboardButton("📋 جميع الروابط", callback_data="view_links_all")],
            [InlineKeyboardButton("🔗 أضف للانضمام", callback_data="add_to_join_queue")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        
        await query.edit_message_text(
            message[:4000],  # الحد الأقصى لطول الرسالة
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return VIEW_LINKS
    
    async def join_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """الانضمام للمجموعات"""
        query = update.callback_query
        await query.answer()
        
        await query.edit_message_text(
            "🔗 *إرسال روابط المجموعات للانضمام*\n\n"
            "يمكنك إرسال:\n"
            "• رابط واحد\n"
            "• عدة روابط (سطر لكل رابط)\n"
            "• نص يحتوي على روابط\n\n"
            "⚠️ *ملاحظة:* سيتم الانضمام لـ 5 روابط كل 5 دقائق",
            parse_mode='Markdown'
        )
        
        return JOIN_GROUPS
    
    async def process_join_links(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """معالجة روابط الانضمام"""
        text = update.message.text
        
        # استخراج الروابط
        whatsapp_links, telegram_links, other_links = extract_links_from_text(text)
        
        if not whatsapp_links:
            await update.message.reply_text(
                "❌ لم يتم العثور على أي روابط WhatsApp صالحة!",
                parse_mode='Markdown'
            )
            return JOIN_GROUPS
        
        # الحصول على الحساب الحالي
        account = self.db.get_account(name=self.current_account)
        if not account:
            await update.message.reply_text(
                "❌ حساب غير موجود!",
                parse_mode='Markdown'
            )
            return JOIN_GROUPS
        
        account_id = account['id']
        account_name = account['name']
        
        # إضافة الروابط لقائمة الانتظار
        result = self.scheduler.add_links_to_queue(account_id, whatsapp_links)
        
        # رسالة النتيجة
        result_msg = (
            f"📥 *تمت إضافة الروابط لقائمة الانتظار*\n\n"
            f"📊 *النتائج:*\n"
            f"• الإجمالي المقدم: `{result['total']}`\n"
            f"• المضاف: `{result['added']}`\n"
            f"• المكرر: `{result['duplicates']}`\n"
            f"• الأخطاء: `{result['errors']}`\n\n"
            f"⏰ سيتم الانضمام لـ {self.config.MAX_JOIN_PER_BATCH} رابط كل "
            f"{format_time(self.config.JOIN_DELAY_SECONDS)}\n\n"
            f"📋 *روابط Telegram المكتشفة:* `{len(telegram_links)}`\n"
            f"🔗 *روابط أخرى:* `{len(other_links)}`"
        )
        
        await update.message.reply_text(
            result_msg,
            parse_mode='Markdown'
        )
        
        # إضافة إشعار
        if result['added'] > 0:
            notification_msg = (
                f"📥 تمت إضافة {result['added']} رابط لقائمة انتظار الانضمام "
                f"للحساب {account_name}"
            )
            self.db.add_notification(
                user_id=update.effective_user.id,
                message=notification_msg,
                notification_type='links_added'
            )
        
        return JOIN_GROUPS
    
    async def queue_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """عرض حالة قائمة الانتظار"""
        query = update.callback_query
        await query.answer()
        
        # الحصول على الحساب الحالي
        account = self.db.get_account(name=self.current_account)
        if not account:
            await query.edit_message_text(
                "❌ حساب غير موجود!",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        account_id = account['id']
        
        # الحصول على إحصائيات قائمة الانتظار
        queue_stats = self.scheduler.get_queue_status(account_id)
        
        # الحصول على إحصائيات عامة
        links_count = self.db.get_links_count(account_id)
        whatsapp_count = self.db.get_links_count(account_id, 'whatsapp')
        telegram_count = self.db.get_links_count(account_id, 'telegram')
        
        # رسالة الحالة
        status_msg = (
            f"📊 *حالة البوت*\n\n"
            f"👤 *الحساب:* {self.current_account}\n\n"
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
            f"• التاخير بين الدفعات: `{format_time(self.config.JOIN_DELAY_SECONDS)}`"
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
    
    async def clear_queue(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """مسح قائمة الانتظار"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        status = data.replace("clear_", "")  # completed أو failed
        
        # الحصول على الحساب الحالي
        account = self.db.get_account(name=self.current_account)
        if not account:
            await query.edit_message_text(
                "❌ حساب غير موجود!",
                parse_mode='Markdown'
            )
            return MANAGE_QUEUE
        
        account_id = account['id']
        
        # مسح القائمة
        if self.scheduler.clear_queue(account_id, status):
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
    
    async def send_messages(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """إرسال رسائل للمجموعات"""
        query = update.callback_query
        await query.answer()
        
        await query.edit_message_text(
            "📨 *إرسال رسالة للمجموعات*\n\n"
            "يمكنك:\n"
            "1. إرسال رسالة لجميع المجموعات\n"
            "2. إرسال رسالة لمجموعات محددة\n"
            "3. إدارة الرسائل المحفوظة\n\n"
            "اختر الإجراء:",
            parse_mode='Markdown'
        )
        
        keyboard = [
            [InlineKeyboardButton("📝 كتابة رسالة جديدة", callback_data="compose_message")],
            [InlineKeyboardButton("📋 الرسائل المحفوظة", callback_data="saved_messages")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        
        await query.edit_message_text(
            "📨 *إرسال الرسائل*\n\n"
            "اختر الإجراء المناسب:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return SEND_MESSAGES
    
    async def back_to_main(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """العودة للقائمة الرئيسية"""
        query = update.callback_query
        await query.answer()
        
        # القائمة الرئيسية
        keyboard = [
            [InlineKeyboardButton("📱 إدارة الحسابات", callback_data="manage_accounts")],
            [InlineKeyboardButton("🔗 تجميع الروابط", callback_data="collect_links")],
            [InlineKeyboardButton("📨 إرسال رسائل", callback_data="send_messages")],
            [InlineKeyboardButton("👥 الانضمام للمجموعات", callback_data="join_groups")],
            [InlineKeyboardButton("📊 حالة القائمة", callback_data="queue_status")],
            [InlineKeyboardButton("⚙️ الإعدادات", callback_data="settings")]
        ]
        
        # الحصول على حالة الحساب
        manager = self.get_whatsapp_manager()
        account_status = "🔴 غير مرتبط"
        if manager and manager.is_logged_in:
            account_status = "🟢 مرتبط"
        
        welcome_msg = (
            f"🏠 *القائمة الرئيسية*\n\n"
            f"👤 الحساب النشط: *{self.current_account}*\n"
            f"📶 حالة الربط: {account_status}\n\n"
            f"اختر الإجراء المناسب:"
        )
        
        await query.edit_message_text(
            welcome_msg,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown'
        )
        
        return MAIN_MENU
    
    async def cancel(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """إلغاء العملية الحالية"""
        user_id = update.effective_user.id
        
        # مسح جلسة المستخدم
        if user_id in self.user_sessions:
            self.user_sessions[user_id].clear()
        
        await update.message.reply_text(
            "❌ تم الإلغاء. استخدم /start للبدء من جديد.",
            parse_mode='Markdown'
        )
        
        return ConversationHandler.END
    
    def setup_handlers(self):
        """إعداد معالجات البوت"""
        # معالج المحادثة الرئيسي
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler("start", self.start)],
            states={
                MAIN_MENU: [
                    CallbackQueryHandler(self.manage_accounts, pattern="^manage_accounts$"),
                    CallbackQueryHandler(self.collect_links, pattern="^collect_links$"),
                    CallbackQueryHandler(self.send_messages, pattern="^send_messages$"),
                    CallbackQueryHandler(self.join_groups, pattern="^join_groups$"),
                    CallbackQueryHandler(self.queue_status, pattern="^queue_status$"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$"),
                    CallbackQueryHandler(self.settings, pattern="^settings$")
                ],
                MANAGE_ACCOUNTS: [
                    CallbackQueryHandler(self.select_account, pattern=r"^select_account_.*"),
                    CallbackQueryHandler(self.connect_account, pattern=r"^connect_account_.*"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                COLLECT_LINKS: [
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                VIEW_LINKS: [
                    CallbackQueryHandler(self.view_links, pattern=r"^view_links_.*"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                SEND_MESSAGES: [
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
                WAITING_FOR_QR: [
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ]
            },
            fallbacks=[CommandHandler("cancel", self.cancel)],
            allow_reentry=True
        )
        
        self.application.add_handler(conv_handler)
        
        # معالج الإشعارات
        self.application.add_handler(CommandHandler("notifications", self.show_notifications))
        
        # معالج الإحصائيات
        self.application.add_handler(CommandHandler("stats", self.show_stats))
        
        # معالج المساعدة
        self.application.add_handler(CommandHandler("help", self.show_help))
    
    async def show_notifications(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض الإشعارات"""
        user_id = update.effective_user.id
        
        # الحصول على الإشعارات غير المقروءة
        notifications = self.db.get_unread_notifications(user_id)
        
        if not notifications:
            await update.message.reply_text(
                "📭 لا توجد إشعارات جديدة.",
                parse_mode='Markdown'
            )
            return
        
        # عرض الإشعارات
        message = "📢 *الإشعارات غير المقروءة:*\n\n"
        
        for i, notification in enumerate(notifications, 1):
            message += f"{i}. {notification['message']}\n"
            
            # تحديد الإشعار كمقروء
            self.db.mark_notification_read(notification['id'])
        
        await update.message.reply_text(
            message,
            parse_mode='Markdown'
        )
    
    async def show_stats(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض الإحصائيات"""
        # الحصول على الحساب الحالي
        account = self.db.get_account(name=self.current_account)
        if not account:
            await update.message.reply_text(
                "❌ حساب غير موجود!",
                parse_mode='Markdown'
            )
            return
        
        account_id = account['id']
        
        # الحصول على إحصائيات قائمة الانتظار
        queue_stats = self.scheduler.get_queue_status(account_id)
        
        # إعداد الرسالة
        stats_msg = format_stats(queue_stats)
        
        await update.message.reply_text(
            stats_msg,
            parse_mode='Markdown'
        )
    
    async def show_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض رسالة المساعدة"""
        help_msg = (
            "📚 *دليل استخدام البوت*\n\n"
            "🎯 *الأوامر المتاحة:*\n"
            "• /start - بدء البوت والقائمة الرئيسية\n"
            "• /notifications - عرض الإشعارات\n"
            "• /stats - عرض الإحصائيات\n"
            "• /help - عرض رسالة المساعدة\n"
            "• /cancel - إلغاء العملية الحالية\n\n"
            "📱 *المميزات الرئيسية:*\n"
            "1. *إدارة الحسابات:* ربط وإدارة حسابات WhatsApp متعددة\n"
            "2. *تجميع الروابط:* تجميع روابط WhatsApp و Telegram من المجموعات\n"
            "3. *الانضمام الذكي:* انضمام لـ 5 مجموعات كل 5 دقائق\n"
            "4. *إرسال الرسائل:* إرسال رسائل للمجموعات\n"
            "5. *الإشعارات:* إشعارات فورية عند النجاح/الفشل\n\n"
            "⚠️ *ملاحظات هامة:*\n"
            "• البوت يعمل فقط مع روابط WhatsApp\n"
            "• التزم بالحدود (5 روابط كل 5 دقائق) لتجنب الحظر\n"
            "• استخدم البوت بمسؤولية\n\n"
            "📞 *للدعم:* تواصل مع المطور"
        )
        
        await update.message.reply_text(
            help_msg,
            parse_mode='Markdown'
        )
    
    async def settings(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
        """إعدادات البوت"""
        query = update.callback_query
        await query.answer()
        
        settings_msg = (
            "⚙️ *إعدادات البوت*\n\n"
            f"📊 *الإعدادات الحالية:*\n"
            f"• الحد الأقصى للدفعة: `{self.config.MAX_JOIN_PER_BATCH}`\n"
            f"• التاخير بين الدفعات: `{self.config.JOIN_DELAY_SECONDS} ثانية`\n"
            f"• الحد الأقصى للمجموعات للمسح: `{self.config.MAX_GROUPS_TO_SCAN}`\n"
            f"• إشعارات الفشل: `{'مفعلة' if self.config.NOTIFY_ON_FAILURE else 'معطلة'}`\n\n"
            f"📁 *المجلدات:*\n"
            f"• مجلد الجلسات: `{self.config.SESSION_DIR}`\n"
            f"• قاعدة البيانات: `{self.config.DATABASE_FILE}`"
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
    
    def run(self):
        """تشغيل البوت"""
        if not self.config.BOT_TOKEN:
            logger.error("❌ BOT_TOKEN غير معرف!")
            print("❌ الرجاء تعيين BOT_TOKEN في متغيرات البيئة")
            sys.exit(1)
        
        # إنشاء تطبيق Telegram
        self.application = Application.builder().token(self.config.BOT_TOKEN).build()
        
        # إعداد المعالجات
        self.setup_handlers()
        
        # بدء الجدولة
        self.scheduler.start()
        
        # تشغيل البوت
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
        
        # إغلاق مديري واتساب
        for account_name, manager in self.whatsapp_managers.items():
            try:
                manager.close()
            except Exception as e:
                logger.error(f"❌ خطأ في إغلاق مدير {account_name}: {e}")
        
        # إغلاق قاعدة البيانات
        try:
            self.db.close()
        except Exception as e:
            logger.error(f"❌ خطأ في إغلاق قاعدة البيانات: {e}")
        
        logger.info("✅ تم إيقاف البوت بنجاح")
        sys.exit(0)

# نقطة الدخول الرئيسية
if __name__ == "__main__":
    bot = WhatsAppBot()
    bot.run()
