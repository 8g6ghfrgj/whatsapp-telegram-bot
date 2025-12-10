import threading
import time
import logging
from whatsapp_browser import WhatsAppBrowser
from database import SessionLocal, Group, User

class WhatsAppManager:
    _instances = {}
    _lock = threading.Lock()
    
    def __init__(self, user_id):
        self.user_id = user_id
        self.browser = None
        self.is_running = False
        self.logger = logging.getLogger(__name__)
        
    @classmethod
    def get_instance(cls, user_id):
        """الحصول على نسخة واحدة لكل مستخدم"""
        with cls._lock:
            if user_id not in cls._instances:
                cls._instances[user_id] = cls(user_id)
            return cls._instances[user_id]
    
    def start(self):
        """بدء تشغيل المدير"""
        if self.is_running:
            return True
        
        try:
            self.browser = WhatsAppBrowser(self.user_id)
            self.browser.setup_driver()
            
            # محاولة تحميل الجلسة
            if not self.browser.load_session():
                self.logger.info("📱 No session found, starting new login")
                self.browser.driver.get("https://web.whatsapp.com")
                
                # انتظار QR Code
                if not self.browser.wait_for_login():
                    self.logger.error("❌ Failed to load WhatsApp Web")
                    return False
                
                # حفظ الجلسة بعد تسجيل الدخول
                time.sleep(5)
                self.browser.save_session()
            
            self.is_running = True
            self.logger.info(f"✅ WhatsApp Manager started for user {self.user_id}")
            
            # بدء مراقبة الحالة
            self._start_monitoring()
            
            return True
        except Exception as e:
            self.logger.error(f"❌ Error starting WhatsApp Manager: {e}")
            return False
    
    def _start_monitoring(self):
        """بدء مراقبة حالة تسجيل الدخول"""
        def monitor():
            while self.is_running:
                try:
                    if self.browser and self.browser.driver:
                        # التحقق من حالة تسجيل الدخول
                        if not self.browser.is_logged_in():
                            self.logger.warning("⚠️ User logged out, restarting...")
                            self.restart()
                        
                        # حفظ الجلسة دورياً
                        if time.time() % 300 < 5:  # كل 5 دقائق
                            self.browser.save_session()
                except:
                    pass
                
                time.sleep(5)  # التحقق كل 5 ثواني
        
        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()
    
    def get_qr_code(self):
        """الحصول على QR Code"""
        if not self.browser:
            return None
        
        return self.browser.get_qr_code()
    
    def get_groups(self, refresh=False):
        """جلب قائمة المجموعات"""
        if not self.browser:
            return []
        
        try:
            # جلب المجموعات من المتصفح
            whatsapp_groups = self.browser.get_groups()
            
            if refresh:
                # تحديث قاعدة البيانات
                db = SessionLocal()
                try:
                    # حذف المجموعات القديمة
                    db.query(Group).filter(Group.user_id == self.user_id).delete()
                    
                    # إضافة المجموعات الجديدة
                    for group in whatsapp_groups:
                        db_group = Group(
                            whatsapp_id=group["id"],
                            name=group["name"],
                            user_id=self.user_id
                        )
                        db.add(db_group)
                    
                    db.commit()
                    self.logger.info(f"✅ Updated {len(whatsapp_groups)} groups in database")
                finally:
                    db.close()
            
            return whatsapp_groups
        except Exception as e:
            self.logger.error(f"❌ Error getting groups: {e}")
            return []
    
    def send_message(self, group_id, message):
        """إرسال رسالة إلى مجموعة"""
        if not self.browser:
            return False
        
        try:
            return self.browser.send_message(group_id, message)
        except Exception as e:
            self.logger.error(f"❌ Error sending message: {e}")
            return False
    
    def join_group(self, invite_link):
        """الانضمام إلى مجموعة عبر رابط"""
        if not self.browser:
            return False
        
        try:
            success = self.browser.join_group_via_link(invite_link)
            
            if success:
                # جلب المجموعات المحدثة
                self.get_groups(refresh=True)
            
            return success
        except Exception as e:
            self.logger.error(f"❌ Error joining group: {e}")
            return False
    
    def restart(self):
        """إعادة تشغيل المدير"""
        self.stop()
        time.sleep(2)
        return self.start()
    
    def stop(self):
        """إيقاف المدير"""
        self.is_running = False
        if self.browser:
            self.browser.save_session()
            self.browser.close()
            self.browser = None
        
        self.logger.info(f"✅ WhatsApp Manager stopped for user {self.user_id}")
    
    def get_status(self):
        """الحصول على الحالة الحالية"""
        return {
            "is_running": self.is_running,
            "is_logged_in": self.browser.is_logged_in() if self.browser else False,
            "user_id": self.user_id
        }
