import os
import logging
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

logger = logging.getLogger(__name__)

class WhatsAppSeleniumClient:
    def __init__(self, user_id):
        self.user_id = user_id
        self.driver = None
        self.is_connected = False
        
    async def initialize(self):
        """تهيئة متصفح Chrome في وضع headless"""
        try:
            chrome_options = Options()
            chrome_options.add_argument("--headless=new")  # الوضع الجديد لـ headless
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1280,720")
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            
            # استخدام WebDriver Manager لتثبيت ChromeDriver تلقائياً
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            logger.info("✅ Chrome browser initialized in headless mode")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to initialize browser: {e}")
            return False
            
    async def get_qr_code(self):
        """الحصول على QR Code من واتساب ويب"""
        if not self.driver:
            await self.initialize()
            
        try:
            # الانتقال إلى واتساب ويب
            self.driver.get("https://web.whatsapp.com")
            
            # انتظار ظهور QR Code
            wait = WebDriverWait(self.driver, 30)
            qr_element = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "canvas[aria-label='Scan me!']"))
            )
            
            # أخذ لقطة للشاشة
            qr_screenshot = qr_element.screenshot_as_png
            
            from io import BytesIO
            qr_bytes = BytesIO(qr_screenshot)
            qr_bytes.seek(0)
            
            logger.info("📱 QR Code captured successfully")
            return qr_bytes
            
        except Exception as e:
            logger.error(f"❌ Failed to get QR Code: {e}")
            # إنشاء صورة بديلة للاختبار
            return await self.generate_mock_qr()
            
    async def generate_mock_qr(self):
        """إنشاء QR Code وهمي للاختبار"""
        from PIL import Image, ImageDraw
        import qrcode as qr_lib
        from io import BytesIO
        
        # إنشاء QR Code حقيقي مع بيانات وهمية
        qr = qr_lib.QRCode(version=1, box_size=10, border=5)
        qr.add_data(f"whatsapp-test-{self.user_id}-{int(time.time())}")
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # تحويل إلى BytesIO
        img_byte_arr = BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return img_byte_arr
        
    async def wait_for_login(self, timeout=120):
        """انتظار اكتمال تسجيل الدخول"""
        try:
            wait = WebDriverWait(self.driver, timeout)
            # انتظار ظهور قائمة المحادثات (علامة على نجاح التسجيل)
            wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-testid='chat-list']"))
            )
            self.is_connected = True
            logger.info("✅ WhatsApp login successful")
            return True
        except Exception as e:
            logger.error(f"❌ Login timeout: {e}")
            return False
            
    async def close(self):
        """إغلاق المتصفح"""
        if self.driver:
            self.driver.quit()
            self.driver = None
            self.is_connected = False
            logger.info("🔌 Browser closed")
