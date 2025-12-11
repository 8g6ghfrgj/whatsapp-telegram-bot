import os
import time
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import qrcode
from io import BytesIO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhatsAppManager:
    def __init__(self, session_name="default"):
        self.session_name = session_name
        self.driver = None
        self.session_path = f"sessions/{session_name}"
        
        # إنشاء مجلد الجلسة إذا لم يكن موجوداً
        os.makedirs(self.session_path, exist_ok=True)
    
    def init_driver(self):
        """تهيئة متصفح Chrome مع الخيارات المناسبة"""
        options = webdriver.ChromeOptions()
        
        # إضافة خيارات للمتصفح
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument(f"--user-data-dir={os.path.abspath(self.session_path)}")
        
        # تجنب اكتشاف الأتمتة
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # تهيئة السائق
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        
        # تنفيذ script لمنع اكتشاف الأتمتة
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        return self.driver
    
    def connect_to_whatsapp(self):
        """الاتصال بواتساب ويب وعرض QR code"""
        try:
            if not self.driver:
                self.init_driver()
            
            # الانتقال إلى واتساب ويب
            self.driver.get("https://web.whatsapp.com")
            
            # الانتظار لتحميل صفحة QR code
            wait = WebDriverWait(self.driver, 60)
            
            # محاولة اكتشاف QR code
            qr_element = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "canvas[aria-label='Scan me!']"))
            )
            
            logger.info("QR code loaded. Please scan with your phone.")
            
            # انتظار المستخدم لمسح QR code (60 ثانية كحد أقصى)
            wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[title='Menu']"))
            )
            
            logger.info("WhatsApp connected successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to WhatsApp: {e}")
            return False
    
    def get_qr_code_image(self):
        """الحصول على QR code كصورة"""
        try:
            if not self.driver:
                self.init_driver()
                self.driver.get("https://web.whatsapp.com")
            
            # انتظار تحميل QR code
            wait = WebDriverWait(self.driver, 30)
            qr_element = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "canvas[aria-label='Scan me!']"))
            )
            
            # التقاط لقطة للشاشة
            screenshot = qr_element.screenshot_as_png
            
            # إنشاء QR code بديل باستخدام مكتبة qrcode
            qr = qrcode.QRCode()
            qr.add_data("https://web.whatsapp.com")  # أو يمكن استخدام بيانات QR الفعلية
            img = qr.make_image()
            
            # حفظ الصورة في buffer
            img_buffer = BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            return img_buffer
            
        except Exception as e:
            logger.error(f"Error getting QR code: {e}")
            return None
    
    def send_message(self, phone_number, message):
        """إرسال رسالة إلى رقم معين"""
        try:
            # الانتقال إلى محادثة مع الرقم
            self.driver.get(f"https://web.whatsapp.com/send?phone={phone_number}")
            
            wait = WebDriverWait(self.driver, 30)
            
            # انتظار تحميل حقل الرسالة
            message_box = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[contenteditable='true'][data-tab='10']"))
            )
            
            # كتابة الرسالة
            message_box.send_keys(message)
            
            # إرسال الرسالة
            send_button = self.driver.find_element(By.CSS_SELECTOR, "button[data-tab='11']")
            send_button.click()
            
            logger.info(f"Message sent to {phone_number}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False
    
    def close(self):
        """إغلاق المتصفح"""
        if self.driver:
            self.driver.quit()
            self.driver = None
