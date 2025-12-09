#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import asyncio
import logging
import sqlite3
import base64
from datetime import datetime
from threading import Lock
import time
import signal
import sys

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

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.action_chains import ActionChains

# ---------- تكوين ----------
BOT_TOKEN = os.environ.get("BOT_TOKEN")
SESSION_DIR = os.environ.get("WHATSAPP_SESSION_DIR", "/tmp/whatsapp_session")
CHROME_BIN = os.environ.get("CHROME_BIN", "/usr/bin/chromium")
CHROMEDRIVER_PATH = os.environ.get("CHROMEDRIVER_PATH", "/usr/lib/chromium/chromedriver")
DATABASE_FILE = os.environ.get("DATABASE_FILE", "whatsapp_bot.db")

# سجل
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

# Conversation states
WAITING_FOR_QR = 1
MAIN_MENU = 2
ADD_GROUP = 3
ADD_MESSAGE = 4
SEND_MESSAGE = 5
SELECT_GROUP = 6
MANAGE_GROUPS = 7

class WhatsAppManager:
    def __init__(self, session_dir=SESSION_DIR):
        self.driver = None
        self.is_logged_in = False
        self.qr_code_image = None
        self.lock = Lock()
        self.session_dir = session_dir
        os.makedirs(self.session_dir, exist_ok=True)
        self.setup_driver()

    def setup_driver(self):
        try:
            chrome_options = Options()
            # headless suitable for Render
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-extensions")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_argument("--start-maximized")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option("useAutomationExtension", False)
            chrome_options.add_argument(f"user-data-dir={os.path.abspath(self.session_dir)}")
            chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

            # If CHROME_BIN provided, set it
            if CHROME_BIN:
                chrome_options.binary_location = CHROME_BIN

            # create webdriver
            # Note: path to chromedriver may vary; if fails, Render logs will show errors.
            self.driver = webdriver.Chrome(executable_path=CHROMEDRIVER_PATH, options=chrome_options)
            # hide webdriver property if possible
            try:
                self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                    "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
                })
            except Exception:
                pass

            self.driver.get("https://web.whatsapp.com")
            logger.info("📱 فتح WhatsApp Web")
            time.sleep(2)
        except Exception as e:
            logger.error(f"❌ خطأ إعداد المتصفح: {e}")
            raise

    def get_qr_code(self):
        with self.lock:
            try:
                wait = WebDriverWait(self.driver, 10)
                try:
                    qr_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "canvas")))
                except TimeoutException:
                    qr_element = wait.until(EC.presence_of_element_located((By.XPATH, '//div[@data-ref]')))
                qr_base64 = qr_element.screenshot_as_base64
                self.qr_code_image = qr_base64
                logger.info("✅ الحصول على QR")
                return qr_base64
            except TimeoutException:
                logger.warning("⏳ لم يظهر QR بعد")
                return None
            except Exception as e:
                logger.error(f"❌ خطأ QR: {e}")
                return None

    def check_login_status(self):
        with self.lock:
            try:
                wait = WebDriverWait(self.driver, 5)
                try:
                    _ = wait.until(EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]')))
                    if not self.is_logged_in:
                        self.is_logged_in = True
                        logger.info("✅ تم تسجيل الدخول")
                        self.load_groups()
                    return True
                except TimeoutException:
                    if self.is_logged_in:
                        self.is_logged_in = False
                        logger.warning("❌ تم تسجيل الخروج")
                    return False
            except Exception as e:
                logger.error(f"❌ خطأ تحقق حالة: {e}")
                return False

    def load_groups(self):
        with self.lock:
            self.group_list = []
            time.sleep(1)
            try:
                items = self.driver.find_elements(By.XPATH, '//div[@role="row" or @role="listitem"]')
                if not items:
                    items = self.driver.find_elements(By.XPATH, '//div[contains(@data-testid,"cell-frame-container")]')
                for el in items[:100]:
                    try:
                        title_el = el.find_element(By.XPATH, './/span[@dir="auto" and string-length(text())>0]')
                        name = title_el.text.strip()
                        if name:
                            self.group_list.append({'name': name, 'element': el})
                    except Exception:
                        continue
                logger.info(f"✅ تم تحميل {len(self.group_list)} محادثة/مجموعة")
            except Exception as e:
                logger.error(f"❌ خطأ load_groups: {e}")

    def get_group_list_names(self):
        return [g["name"] for g in getattr(self, "group_list", [])]

    def send_message_to_group(self, group_name, message):
        with self.lock:
            try:
                wait = WebDriverWait(self.driver, 10)
                search_box = wait.until(EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]')))
                search_box.click()
                actions = ActionChains(self.driver)
                actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).perform()
                actions.send_keys(Keys.DELETE).perform()
                time.sleep(0.2)
                search_box.send_keys(group_name)
                time.sleep(2)
                try:
                    target = wait.until(EC.element_to_be_clickable((By.XPATH, f'//span[@title="{group_name}"]')))
                    target.click()
                except Exception:
                    results = self.driver.find_elements(By.XPATH, '//div[@role="row" or @role="listitem"]')
                    found = False
                    for r in results:
                        try:
                            if group_name in r.text:
                                r.click()
                                found = True
                                break
                        except Exception:
                            continue
                    if not found:
                        logger.warning("⚠️ لم أجد المجموعة في نتائج البحث")
                        return False
                try:
                    message_box = wait.until(EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]')))
                except TimeoutException:
                    message_box = self.driver.find_element(By.XPATH, '//div[@contenteditable="true" and @data-tab]')
                message_box.click()
                message_box.send_keys(message)
                message_box.send_keys(Keys.ENTER)
                time.sleep(0.5)
                logger.info(f"✅ تم إرسال الرسالة إلى {group_name}")
                return True
            except Exception as e:
                logger.error(f"❌ فشل إرسال الرسالة: {e}")
                return False

    def add_group_by_link(self, group_link):
        with self.lock:
            try:
                self.driver.get(group_link)
                time.sleep(4)
                try:
                    join_btn = WebDriverWait(self.driver, 8).until(
                        EC.element_to_be_clickable((By.XPATH, '//a[contains(@href,"/invite/") or contains(text(),"Join") or contains(text(),"انضم")]'))
                    )
                    join_btn.click()
                    time.sleep(3)
                    logger.info(f"✅ حاولت الانضمام إلى: {group_link}")
                    return True
                except Exception:
                    try:
                        btn = self.driver.find_element(By.XPATH, '//div[@role="button"]')
                        btn.click()
                        time.sleep(2)
                        return True
                    except Exception:
                        logger.warning("⚠️ لم أجد زر الانضمام")
                        return False
            except Exception as e:
                logger.error(f"❌ خطأ add_group_by_link: {e}")
                return False

    def close(self):
        try:
            if self.driver:
                self.driver.quit()
                logger.info("✅ تم إغلاق المتصفح")
        except Exception:
            pass

class WhatsAppDatabase:
    def __init__(self, db_file=DATABASE_FILE):
        self.conn = sqlite3.connect(db_file, check_same_thread=False)
        self.init_database()

    def init_database(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT, link TEXT, status TEXT DEFAULT 'active', added_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )""")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_text TEXT,
                message_type TEXT,
                media_path TEXT,
                status TEXT DEFAULT 'pending',
                sent_date DATETIME,
                added_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )""")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER,
                group_id INTEGER,
                schedule_time DATETIME,
                status TEXT DEFAULT 'pending'
            )""")
        self.conn.commit()

    def add_group(self, name, link=None):
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO groups (name, link) VALUES (?, ?)", (name, link))
        self.conn.commit()
        return cursor.lastrowid

    def get_groups(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM groups ORDER BY name")
        return cursor.fetchall()

    def add_message(self, message_text, message_type='text', media_path=None):
        cursor = self.conn.cursor()
        cursor.execute("INSERT INTO messages (message_text, message_type, media_path) VALUES (?, ?, ?)",
                       (message_text, message_type, media_path))
        self.conn.commit()
        return cursor.lastrowid

class WhatsAppBot:
    def __init__(self):
        self.db = WhatsAppDatabase()
        self.whatsapp_manager = WhatsAppManager()
        self.application = None
        self.login_check_task = None
        self.user_sessions = {}
        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.message.from_user.id
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = {'whatsapp_logged_in': False, 'current_group': None, 'current_message': None}
        keyboard = [
            [InlineKeyboardButton("📱 ربط حساب WhatsApp", callback_data="connect_whatsapp")],
            [InlineKeyboardButton("👥 إدارة المجموعات", callback_data="manage_groups")],
            [InlineKeyboardButton("📢 إرسال رسالة", callback_data="send_message")],
            [InlineKeyboardButton("🔗 الانضمام لمجموعة", callback_data="join_group")],
            [InlineKeyboardButton("📊 المجموعات المتاحة", callback_data="available_groups")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        status = "🟢 مرتبط" if self.whatsapp_manager.is_logged_in else "🔴 غير مرتبط"
        await update.message.reply_text(f"🚀 *بوت WhatsApp للنشر*\n\nحالة الربط: {status}\n\nاختر الإجراء:", reply_markup=reply_markup, parse_mode='Markdown')
        return MAIN_MENU

    async def connect_whatsapp(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        if self.whatsapp_manager.is_logged_in:
            await query.edit_message_text("✅ *حساب WhatsApp مرتبط بالفعل!*", parse_mode='Markdown')
            return MAIN_MENU
        qr = self.whatsapp_manager.get_qr_code()
        if not qr:
            await query.edit_message_text("❌ *لم يتم العثور على QR Code. أعد المحاولة لاحقًا.*", parse_mode='Markdown')
            return MAIN_MENU
        try:
            await query.message.reply_photo(photo=base64.b64decode(qr), caption="📱 *QR Code لربط حساب WhatsApp*", parse_mode='Markdown')
            if not self.login_check_task:
                self.login_check_task = asyncio.create_task(self.check_login_periodically(query.message.chat_id))
            await query.edit_message_text("⏳ *جاري انتظار الربط...*", parse_mode='Markdown')
            return WAITING_FOR_QR
        except Exception as e:
            logger.error(f"❌ خطأ إرسال QR: {e}")
            await query.edit_message_text("❌ حدث خطأ عند إرسال صورة الـ QR.", parse_mode='Markdown')
            return MAIN_MENU

    async def check_login_periodically(self, chat_id):
        while True:
            try:
                if self.whatsapp_manager.check_login_status():
                    try:
                        await self.application.bot.send_message(chat_id=chat_id, text="✅ *تم ربط حساب WhatsApp بنجاح!*", parse_mode='Markdown')
                    except Exception as e:
                        logger.error(f"❌ خطأ إرسال إشعار تليجرام: {e}")
                    break
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"❌ خطأ التحقق الدوري: {e}")
                await asyncio.sleep(10)

    async def manage_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text("❌ *يجب ربط حساب WhatsApp أولاً!*", parse_mode='Markdown')
            return MAIN_MENU
        keyboard = [
            [InlineKeyboardButton("🔄 تحديث قائمة المجموعات", callback_data="refresh_groups")],
            [InlineKeyboardButton("➕ إضافة مجموعة يدوياً", callback_data="add_group_manual")],
            [InlineKeyboardButton("📋 عرض المجموعات المحفوظة", callback_data="show_saved_groups")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        await query.edit_message_text("👥 *إدارة المجموعات*", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return MANAGE_GROUPS

    async def refresh_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        await query.edit_message_text("🔄 جاري تحديث قائمة المجموعات...")
        self.whatsapp_manager.load_groups()
        groups = self.whatsapp_manager.get_group_list_names()
        if groups:
            groups_text = "\n".join([f"• {g}" for g in groups[:20]])
            await query.edit_message_text(f"✅ *تم تحديث القائمة*\n\n{groups_text}", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 رجوع", callback_data="manage_groups")]]), parse_mode='Markdown')
        else:
            await query.edit_message_text("❌ *لم يتم العثور على مجموعات.*", parse_mode='Markdown')
        return MANAGE_GROUPS

    async def show_saved_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        groups = self.db.get_groups()
        if not groups:
            await query.edit_message_text("📭 لا توجد مجموعات محفوظة.", parse_mode='Markdown')
            return MANAGE_GROUPS
        msg = "📋 *قائمة المجموعات المحفوظة:*\n\n"
        for g in groups:
            msg += f"• {g[1]}\n"
        await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 رجوع", callback_data="manage_groups")]]), parse_mode='Markdown')
        return MANAGE_GROUPS

    async def send_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text("❌ *يجب ربط حساب WhatsApp أولاً!*", parse_mode='Markdown')
            return MAIN_MENU
        groups = self.whatsapp_manager.get_group_list_names()
        if not groups:
            await query.edit_message_text("❌ *لا توجد مجموعات متاحة.*", parse_mode='Markdown')
            return MAIN_MENU
        keyboard = []
        for group in groups[:10]:
            callback = f"select_group__{group}"
            keyboard.append([InlineKeyboardButton(f"👥 {group[:30]}", callback_data=callback)])
        keyboard.append([InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")])
        await query.edit_message_text("📢 *اختر المجموعة:*", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return SELECT_GROUP

    async def select_group_for_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        data = query.data
        group_name = data.split("__", 1)[1] if "__" in data else data.replace("select_group_", "")
        user_id = query.from_user.id
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = {}
        self.user_sessions[user_id]['current_group'] = group_name
        await query.edit_message_text(f"👥 *المجموعة:* {group_name}\nأرسل نص الرسالة الآن.", parse_mode='Markdown')
        return ADD_MESSAGE

    async def add_message_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.message.from_user.id
        message_text = update.message.text
        if user_id not in self.user_sessions or not self.user_sessions[user_id].get('current_group'):
            await update.message.reply_text("❌ *لم يتم اختيار مجموعة.*", parse_mode='Markdown')
            return ConversationHandler.END
        self.user_sessions[user_id]['current_message'] = message_text
        group_name = self.user_sessions[user_id]['current_group']
        keyboard = [
            [InlineKeyboardButton("✅ نعم، أرسل الآن", callback_data="confirm_send")],
            [InlineKeyboardButton("❌ لا، أعد الكتابة", callback_data="rewrite_message")],
            [InlineKeyboardButton("🔙 اختيار أخرى", callback_data="send_message")]
        ]
        await update.message.reply_text(f"📝 *تأكيد*\nالمجموعة: {group_name}\nالرسالة: {message_text[:500]}", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return SEND_MESSAGE

    async def confirm_send_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        user_id = query.from_user.id
        session = self.user_sessions.get(user_id, {})
        group_name = session.get('current_group')
        message_text = session.get('current_message')
        await query.edit_message_text(f"⏳ جاري الإرسال إلى {group_name}...")
        success = self.whatsapp_manager.send_message_to_group(group_name, message_text)
        if success:
            self.db.add_message(message_text)
            await query.edit_message_text(f"✅ *تم الإرسال إلى* {group_name}", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_to_main")]]), parse_mode='Markdown')
        else:
            await query.edit_message_text("❌ *فشل الإرسال.*", parse_mode='Markdown')
        if user_id in self.user_sessions:
            del self.user_sessions[user_id]
        return ConversationHandler.END

    async def rewrite_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        await query.edit_message_text("✏️ *أرسل نص الرسالة الجديد الآن:*", parse_mode='Markdown')
        return ADD_MESSAGE

    async def join_group(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text("❌ *ربط WhatsApp مطلوب.*", parse_mode='Markdown')
            return MAIN_MENU
        await query.edit_message_text("🔗 *أرسل رابط دعوة المجموعة:*", parse_mode='Markdown')
        return ADD_GROUP

    async def add_group_link(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        group_link = update.message.text.strip()
        if 'whatsapp.com' not in group_link:
            await update.message.reply_text("❌ *رابط غير صالح.*", parse_mode='Markdown')
            return ADD_GROUP
        await update.message.reply_text("⏳ *محاولة الانضمام...*")
        success = self.whatsapp_manager.add_group_by_link(group_link)
        if success:
            name = f"مجموعة من رابط: {group_link[:40]}..."
            self.db.add_group(name, group_link)
            await update.message.reply_text("✅ *تمت محاولة الانضمام.*", parse_mode='Markdown')
        else:
            await update.message.reply_text("❌ *فشل الانضمام.*", parse_mode='Markdown')
        return ConversationHandler.END

    async def available_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text("❌ *ربط WhatsApp مطلوب.*", parse_mode='Markdown')
            return MAIN_MENU
        groups = self.whatsapp_manager.get_group_list_names()
        if groups:
            await query.edit_message_text("📋 *المجموعات:*\n\n" + "\n".join(f"{i+1}. {g}" for i,g in enumerate(groups[:50])), parse_mode='Markdown')
        else:
            await query.edit_message_text("❌ *لا توجد مجموعات.*", parse_mode='Markdown')
        return MAIN_MENU

    async def back_to_main(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        keyboard = [
            [InlineKeyboardButton("📱 ربط حساب WhatsApp", callback_data="connect_whatsapp")],
            [InlineKeyboardButton("👥 إدارة المجموعات", callback_data="manage_groups")],
            [InlineKeyboardButton("📢 إرسال رسالة", callback_data="send_message")],
            [InlineKeyboardButton("🔗 الانضمام لمجموعة", callback_data="join_group")],
            [InlineKeyboardButton("📊 المجموعات", callback_data="available_groups")],
        ]
        await query.edit_message_text("🏠 *القائمة الرئيسية*", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return MAIN_MENU

    async def cancel(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        try:
            if update.callback_query:
                await update.callback_query.answer()
                await update.callback_query.edit_message_text("❎ تم الإلغاء.")
            else:
                await update.message.reply_text("❎ تم الإلغاء.")
        except Exception:
            pass
        return ConversationHandler.END

    def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        pass

    def setup_handlers(self):
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler("start", self.start)],
            states={
                MAIN_MENU: [
                    CallbackQueryHandler(self.connect_whatsapp, pattern="^connect_whatsapp$"),
                    CallbackQueryHandler(self.manage_groups, pattern="^manage_groups$"),
                    CallbackQueryHandler(self.send_message, pattern="^send_message$"),
                    CallbackQueryHandler(self.join_group, pattern="^join_group$"),
                    CallbackQueryHandler(self.available_groups, pattern="^available_groups$"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                WAITING_FOR_QR: [],
                MANAGE_GROUPS: [
                    CallbackQueryHandler(self.refresh_groups, pattern="^refresh_groups$"),
                    CallbackQueryHandler(self.show_saved_groups, pattern="^show_saved_groups$"),
                    CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$")
                ],
                SELECT_GROUP: [CallbackQueryHandler(self.select_group_for_message, pattern=r"^select_group__.*")],
                ADD_MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.add_message_text)],
                SEND_MESSAGE: [
                    CallbackQueryHandler(self.confirm_send_message, pattern="^confirm_send$"),
                    CallbackQueryHandler(self.rewrite_message, pattern="^rewrite_message$")
                ],
                ADD_GROUP: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.add_group_link)]
            },
            fallbacks=[CommandHandler("cancel", self.cancel)],
            allow_reentry=True
        )
        self.application.add_handler(conv_handler)
        self.application.add_handler(CallbackQueryHandler(self.handle_callback))

    def run(self):
        if not BOT_TOKEN:
            logger.error("❌ BOT_TOKEN غير معرف")
            print("❌ BOT_TOKEN غير معرف. عيّنه في Environment variables على Render.")
            sys.exit(1)
        self.application = Application.builder().token(BOT_TOKEN).build()
        self.setup_handlers()
        logger.info("🤖 البوت يعمل الآن")
        try:
            self.application.run_polling()
        except Exception as e:
            logger.error(f"❌ خطأ أثناء التشغيل: {e}")
        finally:
            try:
                self.whatsapp_manager.close()
            except Exception:
                pass

    def _shutdown(self, signum, frame):
        logger.info("🔻 إيقاف ...")
        try:
            if self.application:
                asyncio.get_event_loop().stop()
        except Exception:
            pass
        try:
            self.whatsapp_manager.close()
        except Exception:
            pass
        sys.exit(0)

if __name__ == "__main__":
    bot = WhatsAppBot()
    bot.run()
