import os
import asyncio
import logging
import sqlite3
from datetime import datetime
from threading import Thread
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes, ConversationHandler

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

class WhatsAppManager:
    def __init__(self):
        self.driver = None
        self.is_logged_in = False
        self.groups = []
        self.setup_driver()
    
    def setup_driver(self):
        """إعداد متصفح Chrome"""
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # لإخفاء كونها أتمتة
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.get("https://web.whatsapp.com")
        logger.info("📱 تم فتح WhatsApp Web")
    
    def wait_for_login(self):
        """انتظار تسجيل الدخول"""
        try:
            # انتظار ظهور QR code أو الدردشة
            wait = WebDriverWait(self.driver, 60)  # انتظار 60 ثانية
            
            try:
                # التحقق من وجود QR code (غير مسجل دخول)
                qr_element = wait.until(
                    EC.presence_of_element_located((By.XPATH, '//div[@data-ref]'))
                )
                logger.info("📱 ينتظر مسح QR Code...")
                return False
            except:
                # التحقق من وجود صندوق البحث (مسجل دخول)
                search_box = wait.until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
                )
                logger.info("✅ تم تسجيل الدخول إلى WhatsApp")
                self.is_logged_in = True
                return True
                
        except TimeoutException:
            logger.error("⏰ انتهت مهلة انتظار تسجيل الدخول")
            return False
    
    def get_qr_code_image(self):
        """الحصول على صورة QR Code ك base64"""
        try:
            # البحث عن عنصر QR
            qr_element = self.driver.find_element(By.XPATH, '//div[@data-ref]')
            canvas = qr_element.find_element(By.TAG_NAME, 'canvas')
            
            # التقاط لقطة للQR
            qr_screenshot = canvas.screenshot_as_base64
            return qr_screenshot
        except Exception as e:
            logger.error(f"❌ خطأ في الحصول على QR: {str(e)}")
            return None
    
    def search_and_open_chat(self, contact_name):
        """البحث عن دردشة وفتحها"""
        try:
            # البحث عن صندوق البحث
            search_box = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@
