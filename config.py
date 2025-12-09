#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
إعدادات التكوين للبوت
"""

import os
from datetime import timedelta

class Config:
    """فئة التكوين للبوت"""
    
    def __init__(self):
        # توكن بوت تليجرام
        self.BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
        
        # إعدادات واتساب
        self.SESSION_DIR = os.environ.get("WHATSAPP_SESSION_DIR", "/tmp/whatsapp_session")
        self.CHROME_BIN = os.environ.get("CHROME_BIN", "/usr/bin/chromium")
        self.CHROMEDRIVER_PATH = os.environ.get("CHROMEDRIVER_PATH", "/usr/lib/chromium/chromedriver")
        
        # قاعدة البيانات
        self.DATABASE_FILE = os.environ.get("DATABASE_FILE", "whatsapp_bot.db")
        
        # إعدادات الانضمام
        self.MAX_JOIN_PER_BATCH = int(os.environ.get("MAX_JOIN_PER_BATCH", "5"))
        self.JOIN_DELAY_SECONDS = int(os.environ.get("JOIN_DELAY_SECONDS", "300"))
        
        # إعدادات التجميع
        self.MAX_GROUPS_TO_SCAN = int(os.environ.get("MAX_GROUPS_TO_SCAN", "100"))
        self.SCROLL_PAUSE_TIME = float(os.environ.get("SCROLL_PAUSE_TIME", "1.0"))
        
        # الإشعارات
        self.NOTIFY_ON_FAILURE = os.environ.get("NOTIFY_ON_FAILURE", "true").lower() == "true"
        
        # التحقق من المتطلبات
        self.validate()
    
    def validate(self):
        """التحقق من صحة الإعدادات"""
        if not self.BOT_TOKEN:
            raise ValueError("❌ BOT_TOKEN غير معرف. أضفه إلى متغيرات البيئة.")
        
        # إنشاء المجلدات اللازمة
        os.makedirs(self.SESSION_DIR, exist_ok=True)
        
        print("✅ تم تحميل الإعدادات بنجاح")
    
    def get_join_delay(self):
        """الحصول على تأخير الانضمام"""
        return timedelta(seconds=self.JOIN_DELAY_SECONDS)
