#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from datetime import timedelta

class Config:
    def __init__(self):
        # Telegram Bot Token
        self.BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
        
        # Telegram API (لجمع الروابط)
        self.API_ID = int(os.environ.get("API_ID", 0))
        self.API_HASH = os.environ.get("API_HASH", "")
        self.PHONE_NUMBER = os.environ.get("PHONE_NUMBER", "")
        
        # إعدادات الجلسة
        self.SESSION_FILE = os.environ.get("SESSION_FILE", "whatsapp_session.session")
        
        # قاعدة البيانات
        self.DATABASE_FILE = os.environ.get("DATABASE_FILE", "whatsapp_bot.db")
        
        # إعدادات الانضمام
        self.MAX_JOIN_PER_BATCH = int(os.environ.get("MAX_JOIN_PER_BATCH", "5"))
        self.JOIN_DELAY_SECONDS = int(os.environ.get("JOIN_DELAY_SECONDS", "300"))
        
        # التحقق من المتطلبات
        self.validate()
    
    def validate(self):
        if not self.BOT_TOKEN:
            raise ValueError("❌ BOT_TOKEN غير معرف")
        if not self.API_ID:
            raise ValueError("❌ API_ID غير معرف")
        if not self.API_HASH:
            raise ValueError("❌ API_HASH غير معرف")
        if not self.PHONE_NUMBER:
            raise ValueError("❌ PHONE_NUMBER غير معرف")
        
        print("✅ تم تحميل الإعدادات بنجاح")
    
    def get_join_delay(self):
        return timedelta(seconds=self.JOIN_DELAY_SECONDS)
