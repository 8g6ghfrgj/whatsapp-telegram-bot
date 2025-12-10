from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import os
import pickle
from pathlib import Path
import logging

class WhatsAppBrowser:
    def __init__(self, user_id):
        self.user_id = user_id
        self.driver = None
        self.session_path = f"session/user_{user_id}"
        Path(self.session_path).mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        
    def setup_driver(self):
        """إعداد متصفح Chrome في وضع Headless"""
        chrome_options = Options()
        
        # إعدادات للمتصفح بدون واجهة
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        
        # إضافة User-Agent
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        # تفعيل وضع Headless
        chrome_options.add_argument("--headless")
        
        # إعدادات إضافية للاستقرار
        chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])
        chrome_options.add_experimental_option('prefs', {
            'profile.default_content_setting_values.notifications': 2
        })
        
        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options
        )
        self.driver.implicitly_wait(10)
        
    def save_session(self):
        """حفظ ملفات الجلسة"""
        cookies = self.driver.get_cookies()
        with open(f"{self.session_path}/cookies.pkl", "wb") as f:
            pickle.dump(cookies, f)
        
        # حفظ localStorage و sessionStorage
        local_storage = self.driver.execute_script("return Object.keys(localStorage).reduce((obj, key) => ({...obj, [key]: localStorage.getItem(key)}), {});")
        with open(f"{self.session_path}/local_storage.pkl", "wb") as f:
            pickle.dump(local_storage, f)
            
        self.logger.info("✅ Session saved successfully")
        
    def load_session(self):
        """تحميل الجلسة المحفوظة"""
        try:
            # تحميل الكوكيز
            if os.path.exists(f"{self.session_path}/cookies.pkl"):
                self.driver.get("https://web.whatsapp.com")
                with open(f"{self.session_path}/cookies.pkl", "rb") as f:
                    cookies = pickle.load(f)
                
                for cookie in cookies:
                    try:
                        self.driver.add_cookie(cookie)
                    except:
                        pass
                
                # تحميل localStorage
                if os.path.exists(f"{self.session_path}/local_storage.pkl"):
                    self.driver.refresh()
                    with open(f"{self.session_path}/local_storage.pkl", "rb") as f:
                        local_storage = pickle.load(f)
                    
                    for key, value in local_storage.items():
                        self.driver.execute_script(f"localStorage.setItem('{key}', '{value}');")
                
                self.driver.refresh()
                return True
        except Exception as e:
            self.logger.error(f"❌ Error loading session: {e}")
        return False
        
    def wait_for_login(self):
        """انتظار تسجيل الدخول وعرض QR Code"""
        try:
            WebDriverWait(self.driver, 60).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "canvas[aria-label='Scan me!']"))
            )
            self.logger.info("✅ QR Code is ready for scanning")
            return True
        except:
            # التحقق إذا كان المستخدم مسجل الدخول بالفعل
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-testid='chat-list']"))
                )
                self.logger.info("✅ User is already logged in")
                return True
            except:
                return False
    
    def is_logged_in(self):
        """التحقق من حالة تسجيل الدخول"""
        try:
            self.driver.find_element(By.CSS_SELECTOR, "div[data-testid='chat-list']")
            return True
        except:
            return False
    
    def get_qr_code(self):
        """الحصول على QR Code كصورة"""
        try:
            qr_element = self.driver.find_element(By.CSS_SELECTOR, "canvas[aria-label='Scan me!']")
            
            # التقاط لقطة للـ QR Code
            qr_element.screenshot(f"{self.session_path}/qr_code.png")
            
            # يمكن إرجاع الصورة كـ bytes أو حفظها
            with open(f"{self.session_path}/qr_code.png", "rb") as f:
                qr_image = f.read()
            
            return qr_image
        except Exception as e:
            self.logger.error(f"❌ Error getting QR code: {e}")
            return None
    
    def get_groups(self):
        """جلب قائمة المجموعات"""
        groups = []
        try:
            # البحث عن عناصر المجموعات
            group_elements = self.driver.find_elements(By.CSS_SELECTOR, "div[data-testid='cell-frame-container']")
            
            for element in group_elements:
                try:
                    name_element = element.find_element(By.CSS_SELECTOR, "div[data-testid='cell-frame-title']")
                    group_name = name_element.text
                    
                    # الحصول على ID الخاص بالمجموعة
                    group_div = element.find_element(By.XPATH, "./ancestor::div[@role='button']")
                    group_id = group_div.get_attribute("data-id")
                    
                    if group_name and group_id:
                        groups.append({
                            "id": group_id,
                            "name": group_name
                        })
                except:
                    continue
            
            self.logger.info(f"✅ Found {len(groups)} groups")
            return groups
        except Exception as e:
            self.logger.error(f"❌ Error getting groups: {e}")
            return groups
    
    def send_message(self, group_id, message):
        """إرسال رسالة إلى مجموعة"""
        try:
            # البحث عن المجموعة
            group_selector = f"div[data-id='{group_id}']"
            group_element = self.driver.find_element(By.CSS_SELECTOR, group_selector)
            group_element.click()
            time.sleep(2)
            
            # إدخال الرسالة
            message_box = self.driver.find_element(By.CSS_SELECTOR, "div[contenteditable='true'][data-testid='conversation-compose-box-input']")
            message_box.click()
            message_box.clear()
            
            # إرسال الرسالة سطراً سطراً
            lines = message.split('\n')
            for i, line in enumerate(lines):
                message_box.send_keys(line)
                if i < len(lines) - 1:
                    message_box.send_keys(Keys.SHIFT + Keys.ENTER)
            
            time.sleep(1)
            
            # زر الإرسال
            send_button = self.driver.find_element(By.CSS_SELECTOR, "button[data-testid='compose-btn-send']")
            send_button.click()
            
            self.logger.info(f"✅ Message sent to group {group_id}")
            return True
        except Exception as e:
            self.logger.error(f"❌ Error sending message: {e}")
            return False
    
    def join_group_via_link(self, invite_link):
        """الانضمام لمجموعة عبر رابط الدعوة"""
        try:
            self.driver.get(invite_link)
            time.sleep(3)
            
            # البحث عن زر الانضمام
            join_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "div[role='button']"))
            )
            join_button.click()
            
            time.sleep(2)
            
            # التحقق من الانضمام الناجح
            if "تم الانضمام" in self.driver.page_source or "Joined" in self.driver.page_source:
                self.logger.info("✅ Successfully joined group")
                return True
            
            return False
        except Exception as e:
            self.logger.error(f"❌ Error joining group: {e}")
            return False
    
    def close(self):
        """إغلاق المتصفح"""
        if self.driver:
            self.driver.quit()
            self.logger.info("✅ Browser closed")
