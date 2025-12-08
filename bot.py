import os
import asyncio
import logging
import sqlite3
import base64
import json
from datetime import datetime
from threading import Thread, Lock
import time

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes, ConversationHandler

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.common.action_chains import ActionChains

# تكوين البوت
BOT_TOKEN = os.environ.get('BOT_TOKEN')

# تهيئة السجل
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# حالات المحادثة
WAITING_FOR_QR = 1
MAIN_MENU = 2
ADD_GROUP = 3
ADD_MESSAGE = 4
SEND_MESSAGE = 5
SELECT_GROUP = 6
MANAGE_GROUPS = 7

class WhatsAppManager:
    def __init__(self):
        self.driver = None
        self.is_logged_in = False
        self.qr_code_image = None
        self.qr_message_id = None
        self.contact_list = []
        self.group_list = []
        self.lock = Lock()
        self.setup_driver()
        
    def setup_driver(self):
        """إعداد متصفح Chrome"""
        try:
            chrome_options = Options()
            
            # إعدادات لتحسين الأداء
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-extensions")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_argument("--start-maximized")
            
            # لإخفاء كونها أتمتة
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # User agent حقيقي
            chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            # حفظ الجلسة
            chrome_options.add_argument(f"--user-data-dir=./whatsapp_session")
            
            self.driver = webdriver.Chrome(options=chrome_options)
            
            # إخفاء الـ WebDriver
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # فتح WhatsApp Web
            self.driver.get("https://web.whatsapp.com")
            logger.info("📱 تم فتح WhatsApp Web")
            
            # انتظار تحميل الصفحة
            time.sleep(3)
            
        except Exception as e:
            logger.error(f"❌ خطأ في إعداد المتصفح: {str(e)}")
            raise
    
    def get_qr_code(self):
        """الحصول على QR code كـ base64"""
        with self.lock:
            try:
                # انتظار ظهور QR code
                wait = WebDriverWait(self.driver, 10)
                
                # البحث عن QR code بعدة طرق
                try:
                    qr_element = wait.until(
                        EC.presence_of_element_located((By.XPATH, '//div[@data-ref]'))
                    )
                except:
                    # محاولة أخرى للبحث عن QR
                    qr_element = wait.until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, 'canvas'))
                    )
                
                # الحصول على لقطة QR code
                qr_screenshot = qr_element.screenshot_as_base64
                self.qr_code_image = qr_screenshot
                logger.info("✅ تم الحصول على QR code")
                return qr_screenshot
                
            except TimeoutException:
                logger.warning("⏳ جاري انتظار ظهور QR code...")
                time.sleep(2)
                return None
            except Exception as e:
                logger.error(f"❌ خطأ في الحصول على QR: {str(e)}")
                return None
    
    def check_login_status(self):
        """التحقق من حالة تسجيل الدخول"""
        with self.lock:
            try:
                # البحث عن صندوق البحث (يدل على تسجيل الدخول)
                search_box = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
                )
                
                if search_box and not self.is_logged_in:
                    self.is_logged_in = True
                    logger.info("✅ تم تسجيل الدخول إلى WhatsApp")
                    
                    # جلب قائمة المجموعات بعد تسجيل الدخول
                    self.load_groups()
                    
                return self.is_logged_in
                
            except TimeoutException:
                # لم يتم تسجيل الدخول بعد
                if self.is_logged_in:
                    self.is_logged_in = False
                    logger.warning("❌ تم تسجيل الخروج من WhatsApp")
                return False
            except Exception as e:
                logger.error(f"❌ خطأ في التحقق من الحالة: {str(e)}")
                return False
    
    def load_groups(self):
        """تحميل قائمة المجموعات"""
        try:
            self.group_list = []
            
            # البحث عن عنصر قائمة المجموعات
            time.sleep(2)
            
            # فتح القائمة الجانبية للمحادثات
            try:
                # البحث عن عناصر المجموعات
                group_elements = self.driver.find_elements(By.XPATH, '//div[@role="listitem"]')
                
                for element in group_elements[:50]:  # أول 50 مجموعة فقط
                    try:
                        # الحصول على اسم المجموعة
                        name_element = element.find_element(By.XPATH, './/span[@dir="auto"]')
                        group_name = name_element.text
                        
                        if group_name:  # إذا كان هناك اسم
                            # الحصول على معلومات إضافية
                            try:
                                last_msg = element.find_element(By.XPATH, './/span[contains(@class, "last-msg")]').text[:30]
                            except:
                                last_msg = ""
                            
                            # إضافة المجموعة للقائمة
                            self.group_list.append({
                                'name': group_name,
                                'element': element,
                                'last_message': last_msg
                            })
                            
                    except:
                        continue
                
                logger.info(f"✅ تم تحميل {len(self.group_list)} مجموعة")
                
            except Exception as e:
                logger.error(f"❌ خطأ في تحميل المجموعات: {str(e)}")
                
        except Exception as e:
            logger.error(f"❌ خطأ عام في تحميل المجموعات: {str(e)}")
    
    def send_message_to_group(self, group_name, message):
        """إرسال رسالة إلى مجموعة"""
        with self.lock:
            try:
                # البحث عن المجموعة
                search_box = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
                )
                
                # مسح البحث السابق
                search_box.click()
                actions = ActionChains(self.driver)
                actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).perform()
                actions.send_keys(Keys.DELETE).perform()
                
                # البحث عن المجموعة
                search_box.send_keys(group_name)
                time.sleep(2)
                
                # اختيار المجموعة من النتائج
                try:
                    group_result = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, f'//span[@title="{group_name}"]'))
                    )
                    group_result.click()
                    time.sleep(2)
                except:
                    # محاولة البحث بطرق أخرى
                    search_results = self.driver.find_elements(By.XPATH, '//div[@role="listitem"]')
                    for result in search_results:
                        try:
                            if group_name in result.text:
                                result.click()
                                time.sleep(2)
                                break
                        except:
                            continue
                
                # إرسال الرسالة
                message_box = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
                )
                
                message_box.click()
                message_box.send_keys(message)
                message_box.send_keys(Keys.ENTER)
                
                logger.info(f"✅ تم إرسال الرسالة إلى {group_name}")
                return True
                
            except Exception as e:
                logger.error(f"❌ خطأ في إرسال الرسالة: {str(e)}")
                return False
    
    def add_group_by_link(self, group_link):
        """الانضمام إلى مجموعة بواسطة الرابط"""
        with self.lock:
            try:
                # فتح الرابط في المتصفح
                self.driver.get(group_link)
                time.sleep(5)
                
                # البحث عن زر الانضمام
                try:
                    join_button = WebDriverWait(self.driver, 10).until(
                        EC.element_to_be_clickable((By.XPATH, '//div[@role="button" and contains(text(), "انضمام")]'))
                    )
                    join_button.click()
                    time.sleep(3)
                    
                    logger.info(f"✅ تم الانضمام إلى المجموعة: {group_link}")
                    return True
                    
                except:
                    # قد يكون الرابط غير صالح أو المجموعة خاصة
                    logger.warning(f"⚠️ لم أتمكن من الانضمام إلى: {group_link}")
                    return False
                    
            except Exception as e:
                logger.error(f"❌ خطأ في الانضمام للمجموعة: {str(e)}")
                return False
    
    def get_group_list_names(self):
        """الحصول على أسماء المجموعات فقط"""
        return [group['name'] for group in self.group_list]
    
    def close(self):
        """إغلاق المتصفح"""
        if self.driver:
            self.driver.quit()
            logger.info("✅ تم إغلاق المتصفح")

class WhatsAppDatabase:
    def __init__(self):
        self.conn = sqlite3.connect('whatsapp_bot.db')
        self.init_database()
    
    def init_database(self):
        """تهيئة قاعدة البيانات"""
        cursor = self.conn.cursor()
        
        # جدول المجموعات
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                link TEXT,
                status TEXT DEFAULT 'active',
                added_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # جدول الرسائل
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_text TEXT,
                message_type TEXT,
                media_path TEXT,
                status TEXT DEFAULT 'pending',
                sent_date DATETIME,
                added_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # جدول النشر المجدول
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER,
                group_id INTEGER,
                schedule_time DATETIME,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (message_id) REFERENCES messages (id),
                FOREIGN KEY (group_id) REFERENCES groups (id)
            )
        ''')
        
        self.conn.commit()
    
    def add_group(self, name, link=None):
        """إضافة مجموعة جديدة"""
        cursor = self.conn.cursor()
        cursor.execute('INSERT INTO groups (name, link) VALUES (?, ?)', (name, link))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_groups(self):
        """الحصول على جميع المجموعات"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM groups ORDER BY name')
        return cursor.fetchall()
    
    def add_message(self, message_text, message_type='text', media_path=None):
        """إضافة رسالة جديدة"""
        cursor = self.conn.cursor()
        cursor.execute('INSERT INTO messages (message_text, message_type, media_path) VALUES (?, ?, ?)', 
                      (message_text, message_type, media_path))
        self.conn.commit()
        return cursor.lastrowid

class WhatsAppBot:
    def __init__(self):
        self.db = WhatsAppDatabase()
        self.whatsapp_manager = WhatsAppManager()
        self.application = None
        self.qr_check_task = None
        self.login_check_task = None
        self.user_sessions = {}
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """بدء البوت"""
        user_id = update.message.from_user.id
        
        # التحقق إذا كان المستخدم في الجلسة
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = {
                'whatsapp_logged_in': False,
                'current_group': None,
                'current_message': None
            }
        
        keyboard = [
            [InlineKeyboardButton("📱 ربط حساب WhatsApp", callback_data="connect_whatsapp")],
            [InlineKeyboardButton("👥 إدارة المجموعات", callback_data="manage_groups")],
            [InlineKeyboardButton("📢 إرسال رسالة", callback_data="send_message")],
            [InlineKeyboardButton("🔗 الانضمام لمجموعة", callback_data="join_group")],
            [InlineKeyboardButton("📊 المجموعات المتاحة", callback_data="available_groups")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # التحقق من حالة الربط
        status = "🔴 غير مرتبط" if not self.whatsapp_manager.is_logged_in else "🟢 مرتبط"
        
        await update.message.reply_text(
            f"🚀 **بوت WhatsApp للنشر**\n\n"
            f"حالة الربط: {status}\n\n"
            f"اختر الإجراء الذي تريد تنفيذه:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return MAIN_MENU
    
    async def connect_whatsapp(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """ربط حساب WhatsApp"""
        query = update.callback_query
        await query.answer()
        
        # التحقق إذا كان مرتبطاً بالفعل
        if self.whatsapp_manager.is_logged_in:
            await query.edit_message_text(
                "✅ **حساب WhatsApp مرتبط بالفعل!**\n\n"
                "يمكنك الآن استخدام المميزات الأخرى.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        # الحصول على QR code
        qr_image = self.whatsapp_manager.get_qr_code()
        
        if qr_image:
            # إرسال صورة QR
            await query.message.reply_photo(
                photo=base64.b64decode(qr_image),
                caption="📱 **QR Code لربط حساب WhatsApp**\n\n"
                       "1. افتح WhatsApp على هاتفك\n"
                       "2. اضغط على النقاط الثلاثة (⋮)\n"
                       "3. اختر 'الأجهزة المرتبطة'\n"
                       "4. اضغط على 'ربط جهاز'\n"
                       "5. مسح هذا الـ QR Code\n\n"
                       "⚠️ لا تشارك هذا الـ QR مع أي شخص!",
                parse_mode='Markdown'
            )
            
            # حفظ معرف الرسالة
            self.whatsapp_manager.qr_message_id = query.message.message_id
            
            # بدء التحقق من حالة تسجيل الدخول
            if not self.login_check_task:
                self.login_check_task = asyncio.create_task(self.check_login_periodically(query.message.chat_id))
            
            await query.edit_message_text(
                "⏳ **جاري انتظار الربط...**\n\n"
                "يرجى مسح QR Code على هاتفك.\n"
                "سأخبرك عندما يتم الربط بنجاح.",
                parse_mode='Markdown'
            )
            return WAITING_FOR_QR
        else:
            await query.edit_message_text(
                "❌ **لم يتم العثور على QR Code**\n\n"
                "يرجى المحاولة مرة أخرى لاحقاً.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
    
    async def check_login_periodically(self, chat_id):
        """التحقق الدوري من حالة تسجيل الدخول"""
        while True:
            try:
                # التحقق من حالة تسجيل الدخول
                if self.whatsapp_manager.check_login_status():
                    # إرسال رسالة نجاح
                    await self.application.bot.send_message(
                        chat_id=chat_id,
                        text="✅ **تم ربط حساب WhatsApp بنجاح!**\n\n"
                             "يمكنك الآن استخدام جميع مميزات البوت.",
                        parse_mode='Markdown'
                    )
                    break
                
                await asyncio.sleep(5)  # التحقق كل 5 ثواني
                
            except Exception as e:
                logger.error(f"❌ خطأ في التحقق الدوري: {str(e)}")
                await asyncio.sleep(10)
    
    async def manage_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """إدارة المجموعات"""
        query = update.callback_query
        await query.answer()
        
        # التحقق من الربط
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text(
                "❌ **يجب ربط حساب WhatsApp أولاً!**\n\n"
                "استخدم زر 'ربط حساب WhatsApp' للبدء.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        keyboard = [
            [InlineKeyboardButton("🔄 تحديث قائمة المجموعات", callback_data="refresh_groups")],
            [InlineKeyboardButton("➕ إضافة مجموعة يدوياً", callback_data="add_group_manual")],
            [InlineKeyboardButton("📋 عرض المجموعات المحفوظة", callback_data="show_saved_groups")],
            [InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "👥 **إدارة المجموعات**\n\n"
            "يمكنك تحديث قائمة المجموعات من WhatsApp أو إضافة مجموعات يدوياً.",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return MANAGE_GROUPS
    
    async def refresh_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """تحديث قائمة المجموعات"""
        query = update.callback_query
        await query.answer()
        
        await query.edit_message_text("🔄 جاري تحديث قائمة المجموعات...")
        
        # تحديث قائمة المجموعات
        self.whatsapp_manager.load_groups()
        groups = self.whatsapp_manager.get_group_list_names()
        
        if groups:
            groups_text = "\n".join([f"• {group}" for group in groups[:20]])  # أول 20 مجموعة فقط
            
            keyboard = [[InlineKeyboardButton("🔙 رجوع", callback_data="manage_groups")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                f"✅ **تم تحديث قائمة المجموعات**\n\n"
                f"عدد المجموعات: {len(groups)}\n\n"
                f"**أهم المجموعات:**\n{groups_text}",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        else:
            await query.edit_message_text(
                "❌ **لم يتم العثور على مجموعات**\n\n"
                "تأكد من وجود مجموعات في حساب WhatsApp.",
                parse_mode='Markdown'
            )
        
        return MANAGE_GROUPS
    
    async def send_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """إرسال رسالة"""
        query = update.callback_query
        await query.answer()
        
        # التحقق من الربط
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text(
                "❌ **يجب ربط حساب WhatsApp أولاً!**\n\n"
                "استخدم زر 'ربط حساب WhatsApp' للبدء.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        # الحصول على قائمة المجموعات
        groups = self.whatsapp_manager.get_group_list_names()
        
        if not groups:
            await query.edit_message_text(
                "❌ **لا توجد مجموعات متاحة**\n\n"
                "تأكد من وجود مجموعات في حساب WhatsApp.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        # إنشاء أزرار للمجموعات (أول 10 مجموعات)
        keyboard = []
        for group in groups[:10]:
            keyboard.append([InlineKeyboardButton(f"👥 {group[:30]}", callback_data=f"select_group_{group}")])
        
        keyboard.append([InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")])
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "📢 **إرسال رسالة**\n\n"
            "اختر المجموعة التي تريد إرسال الرسالة إليها:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return SELECT_GROUP
    
    async def select_group_for_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """اختيار مجموعة لإرسال الرسالة"""
        query = update.callback_query
        await query.answer()
        
        # استخراج اسم المجموعة من callback_data
        group_name = query.data.replace("select_group_", "")
        
        # حفظ المجموعة المختارة
        user_id = query.from_user.id
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = {}
        self.user_sessions[user_id]['current_group'] = group_name
        
        await query.edit_message_text(
            f"👥 **المجموعة المختارة:** {group_name}\n\n"
            f"الآن أرسل الرسالة التي تريد نشرها:\n\n"
            f"أو أرسل /cancel للإلغاء",
            parse_mode='Markdown'
        )
        
        return ADD_MESSAGE
    
    async def add_message_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """إضافة نص الرسالة"""
        user_id = update.message.from_user.id
        message_text = update.message.text
        
        # التحقق من وجود مجموعة مختارة
        if user_id not in self.user_sessions or not self.user_sessions[user_id].get('current_group'):
            await update.message.reply_text("❌ لم يتم اختيار مجموعة. استخدم /start للبدء من جديد.")
            return ConversationHandler.END
        
        # حفظ الرسالة
        self.user_sessions[user_id]['current_message'] = message_text
        
        group_name = self.user_sessions[user_id]['current_group']
        
        keyboard = [
            [InlineKeyboardButton("✅ نعم، أرسل الآن", callback_data="confirm_send")],
            [InlineKeyboardButton("❌ لا، أعد الكتابة", callback_data="rewrite_message")],
            [InlineKeyboardButton("🔙 اختيار مجموعة أخرى", callback_data="send_message")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            f"📝 **تأكيد الإرسال**\n\n"
            f"**المجموعة:** {group_name}\n"
            f"**الرسالة:**\n{message_text[:200]}...\n\n"
            f"هل تريد إرسال هذه الرسالة؟",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        
        return SEND_MESSAGE
    
    async def confirm_send_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """تأكيد وإرسال الرسالة"""
        query = update.callback_query
        await query.answer()
        
        user_id = query.from_user.id
        group_name = self.user_sessions[user_id].get('current_group')
        message_text = self.user_sessions[user_id].get('current_message')
        
        await query.edit_message_text(f"⏳ جاري إرسال الرسالة إلى {group_name}...")
        
        # إرسال الرسالة عبر WhatsApp
        success = self.whatsapp_manager.send_message_to_group(group_name, message_text)
        
        if success:
            # حفظ في قاعدة البيانات
            self.db.add_message(message_text)
            
            keyboard = [[InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_to_main")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                f"✅ **تم إرسال الرسالة بنجاح!**\n\n"
                f"**المجموعة:** {group_name}\n"
                f"**الرسالة:**\n{message_text[:200]}...",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        else:
            await query.edit_message_text(
                f"❌ **فشل إرسال الرسالة**\n\n"
                f"تأكد من صحة اسم المجموعة وحاول مرة أخرى.",
                parse_mode='Markdown'
            )
        
        # تنظيف الجلسة
        if user_id in self.user_sessions:
            del self.user_sessions[user_id]
        
        return ConversationHandler.END
    
    async def join_group(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """الانضمام إلى مجموعة بواسطة الرابط"""
        query = update.callback_query
        await query.answer()
        
        # التحقق من الربط
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text(
                "❌ **يجب ربط حساب WhatsApp أولاً!**\n\n"
                "استخدم زر 'ربط حساب WhatsApp' للبدء.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        await query.edit_message_text(
            "🔗 **الانضمام إلى مجموعة**\n\n"
            "أرسل رابط المجموعة (رابط دعوة WhatsApp):\n\n"
            "مثال: https://chat.whatsapp.com/ABC123...\n\n"
            "أو أرسل /cancel للإلغاء",
            parse_mode='Markdown'
        )
        
        return ADD_GROUP
    
    async def add_group_link(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """معالجة رابط المجموعة"""
        group_link = update.message.text.strip()
        
        # التحقق من صحة الرابط
        if 'whatsapp.com' not in group_link:
            await update.message.reply_text(
                "❌ **رابط غير صالح!**\n\n"
                "يجب أن يكون رابط WhatsApp صالحاً.\n"
                "مثال: https://chat.whatsapp.com/ABC123...\n\n"
                "أرسل الرابط الصحيح أو /cancel للإلغاء"
            )
            return ADD_GROUP
        
        await update.message.reply_text(f"⏳ جاري الانضمام إلى المجموعة...")
        
        # الانضمام إلى المجموعة
        success = self.whatsapp_manager.add_group_by_link(group_link)
        
        if success:
            # حفظ في قاعدة البيانات
            group_name = f"مجموعة من رابط: {group_link[:30]}..."
            self.db.add_group(group_name, group_link)
            
            keyboard = [[InlineKeyboardButton("🔙 القائمة الرئيسية", callback_data="back_to_main")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                f"✅ **تم الانضمام إلى المجموعة بنجاح!**\n\n"
                f"**الرابط:** {group_link}",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        else:
            await update.message.reply_text(
                f"❌ **فشل الانضمام إلى المجموعة**\n\n"
                f"تأكد من صحة الرابط وحاول مرة أخرى.",
                parse_mode='Markdown'
            )
        
        return ConversationHandler.END
    
    async def available_groups(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """عرض المجموعات المتاحة"""
        query = update.callback_query
        await query.answer()
        
        # التحقق من الربط
        if not self.whatsapp_manager.is_logged_in:
            await query.edit_message_text(
                "❌ **يجب ربط حساب WhatsApp أولاً!**\n\n"
                "استخدم زر 'ربط حساب WhatsApp' للبدء.",
                parse_mode='Markdown'
            )
            return MAIN_MENU
        
        # الحصول على قائمة المجموعات
        groups = self.whatsapp_manager.get_group_list_names()
        
        if groups:
            # تقسيم المجموعات إلى صفحات
            groups_text = ""
            for i, group in enumerate(groups[:50], 1):  # أول 50 مجموعة فقط
                groups_text += f"{i}. {group}\n"
            
            keyboard = [[InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                f"📋 **المجموعات المتاحة ({len(groups)})**\n\n"
                f"{groups_text}",
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
        else:
            await query.edit_message_text(
                "❌ **لا توجد مجموعات متاحة**\n\n"
                "تأكد من وجود مجموعات في حساب WhatsApp.",
                parse_mode='Markdown'
            )
        
        return MAIN_MENU
    
    async def cancel(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """إلغاء الأمر"""
        user_id = update.message.from_user.id
        if user_id in self.user_sessions:
            del self.user_sessions[user_id]
        
        await update.message.reply_text("❌ تم إلغاء الأمر.")
        await self.start(update, context)
        return ConversationHandler.END
    
    async def back_to_main(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """الرجوع إلى القائمة الرئيسية"""
        query = update.callback_query
        await query.answer()
        
        await self.start_from_query(query, context)
        return MAIN_MENU
    
    async def start_from_query(self, query, context):
        """بدء البوت من استعلام"""
        user_id = query.from_user.id
        
        keyboard = [
            [InlineKeyboardButton("📱 ربط حساب WhatsApp", callback_data="connect_whatsapp")],
            [InlineKeyboardButton("👥 إدارة المجموعات", callback_data="manage_groups")],
            [InlineKeyboardButton("📢 إرسال رسالة", callback_data="send_message")],
            [InlineKeyboardButton("🔗 الانضمام لمجموعة", callback_data="join_group")],
            [InlineKeyboardButton("📊 المجموعات المتاحة", callback_data="available_groups")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # التحقق من حالة الربط
        status = "🔴 غير مرتبط" if not self.whatsapp_manager.is_logged_in else "🟢 مرتبط"
        
        await query.edit_message_text(
            f"🚀 **بوت WhatsApp للنشر**\n\n"
            f"حالة الربط: {status}\n\n"
            f"اختر الإجراء الذي تريد تنفيذه:",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
    
    def setup_handlers(self):
        """إعداد معالجات البوت"""
        self.application.add_handler(CommandHandler("start", self.start))
        self.application.add_handler(CommandHandler("cancel", self.cancel))
        
        # معالجة الأزرار
        self.application.add_handler(CallbackQueryHandler(self.connect_whatsapp, pattern="^connect_whatsapp$"))
        self.application.add_handler(CallbackQueryHandler(self.manage_groups, pattern="^manage_groups$"))
        self.application.add_handler(CallbackQueryHandler(self.send_message, pattern="^send_message$"))
        self.application.add_handler(CallbackQueryHandler(self.join_group, pattern="^join_group$"))
        self.application.add_handler(CallbackQueryHandler(self.available_groups, pattern="^available_groups$"))
        self.application.add_handler(CallbackQueryHandler(self.refresh_groups, pattern="^refresh_groups$"))
        self.application.add_handler(CallbackQueryHandler(self.back_to_main, pattern="^back_to_main$"))
        self.application.add_handler(CallbackQueryHandler(self.confirm_send_message, pattern="^confirm_send$"))
        self.application.add_handler(CallbackQueryHandler(self.rewrite_message, pattern="^rewrite_message$"))
        
        # معالجة اختيار المجموعات
        self.application.add_handler(CallbackQueryHandler(self.select_group_for_message, pattern="^select_group_"))
        
        # معالجة المحادثات
        join_group_conv = ConversationHandler(
            entry_points=[CallbackQueryHandler(self.join_group, pattern="^join_group$")],
            states={
                ADD_GROUP: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.add_group_link)]
            },
            fallbacks=[CommandHandler("cancel", self.cancel)]
        )
        self.application.add_handler(join_group_conv)
        
        send_message_conv = ConversationHandler(
            entry_points=[CallbackQueryHandler(self.send_message, pattern="^send_message$")],
            states={
                SELECT_GROUP: [CallbackQueryHandler(self.select_group_for_message, pattern="^select_group_")],
                ADD_MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, self.add_message_text)],
                SEND_MESSAGE: [CallbackQueryHandler(self.confirm_send_message, pattern="^confirm_send$")]
            },
            fallbacks=[CommandHandler("cancel", self.cancel)]
        )
        self.application.add_handler(send_message_conv)
        
        # معالجة الأزرار العامة
        self.application.add_handler(CallbackQueryHandler(self.handle_callback))
    
    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """معالجة الأزرار العامة"""
        query = update.callback_query
        await query.answer()
        
        # يمكنك إضافة معالجات إضافية هنا
    
    def run(self):
        """تشغيل البوت"""
        self.application = Application.builder().token(BOT_TOKEN).build()
        self.setup_handlers()
        
        print("🚀 **بوت WhatsApp للنشر يعمل الآن!**")
        print("✅ المميزات المتوفرة:")
        print("   📱 ربط حساب WhatsApp عبر QR Code")
        print("   👥 إدارة المجموعات")
        print("   📢 إرسال رسائل إلى مجموعات")
        print("   🔗 الانضمام إلى مجموعات بواسطة الروابط")
        print("   📊 عرض المجموعات المتاحة")
        print("")
        print("⚠️  تحذير: هذا البوت يستخدم WhatsApp Web وقد يتم حظر حسابك!")
        print("⚠️  استخدامك لهذا البوت على مسؤوليتك الخاصة")
        
        self.application.run_polling()

# تشغيل البوت
if __name__ == "__main__":
    # التحقق من وجود التوكن
    if not BOT_TOKEN:
        print("❌ خطأ: لم يتم تعيين BOT_TOKEN في متغيرات البيئة")
        print("⚠️  يرجى إضافة BOT_TOKEN في Render.com → Environment")
        exit(1)
    
    # إنشاء المجلدات المطلوبة
    os.makedirs("whatsapp_session", exist_ok=True)
    
    # تشغيل البوت
    try:
        bot = WhatsAppBot()
        print("🚀 Starting WhatsApp Telegram Bot...")
        bot.run()
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        # إغلاق المتصفح عند الخروج
        if hasattr(bot, 'whatsapp_manager'):
            bot.whatsapp_manager.close()
