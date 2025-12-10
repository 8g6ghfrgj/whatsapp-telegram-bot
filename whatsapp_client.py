import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class WhatsAppClientSimple:
    """عميل واتساب مبسط للاختبار الأولي"""
    
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.is_connected = False
        
    async def initialize(self):
        """تهيئة العميل (بدون Playwright حالياً)"""
        logger.info("🤖 Initializing WhatsApp client (simple mode)")
        self.is_connected = False
        return True
        
    async def get_qr_code(self):
        """إرجاع QR code وهمي للاختبار"""
        logger.info("📱 Generating mock QR code")
        
        # إنشاء صورة QR وهمية
        from PIL import Image, ImageDraw
        import io
        
        # إنشاء صورة بسيطة
        img = Image.new('RGB', (300, 300), color='white')
        d = ImageDraw.Draw(img)
        d.rectangle([50, 50, 250, 250], outline='black', width=5)
        d.text((100, 130), "TEST MODE", fill='black')
        d.text((80, 160), "WhatsApp Bot", fill='green')
        
        # تحويل إلى bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return img_byte_arr
        
    async def mock_connection(self):
        """محاكاة اتصال ناجح"""
        self.is_connected = True
        return True
        
    async def close(self):
        """إغلاق العميل"""
        logger.info("🔌 Closing WhatsApp client")
        self.is_connected = False
