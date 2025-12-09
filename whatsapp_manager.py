#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import logging
import re
from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.functions.messages import ImportChatInviteRequest
from telethon.tl.functions.channels import JoinChannelRequest

logger = logging.getLogger(__name__)

class TelegramCollector:
    def __init__(self, api_id: int, api_hash: str, phone_number: str, session_file: str = "telegram_session.session"):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone_number = phone_number
        self.session_file = session_file
        self.client = None
        self.is_connected = False
        
    async def connect(self):
        """الاتصال بـ Telegram"""
        try:
            self.client = TelegramClient(self.session_file, self.api_id, self.api_hash)
            await self.client.start(phone=self.phone_number)
            self.is_connected = True
            logger.info("✅ تم الاتصال بـ Telegram بنجاح")
            return True
        except Exception as e:
            logger.error(f"❌ خطأ في الاتصال بـ Telegram: {e}")
            return False
    
    async def disconnect(self):
        """قطع الاتصال"""
        if self.client:
            await self.client.disconnect()
            self.is_connected = False
            logger.info("✅ تم قطع الاتصال بـ Telegram")
    
    async def collect_links_from_groups(self, max_groups: int = 50):
        """تجميع الروابط من المجموعات"""
        if not self.is_connected:
            logger.error("❌ غير متصل بـ Telegram")
            return {'whatsapp': [], 'telegram': [], 'total_checked': 0}
        
        whatsapp_links = set()
        telegram_links = set()
        groups_checked = 0
        
        try:
            # الحصول على الدردشات
            async for dialog in self.client.iter_dialogs(limit=max_groups):
                if dialog.is_group or dialog.is_channel:
                    try:
                        group_name = dialog.name
                        logger.info(f"🔍 فحص المجموعة: {group_name}")
                        
                        # جمع الرسائل الأخيرة
                        messages = await self.client.get_messages(dialog.id, limit=20)
                        
                        for message in messages:
                            if message.text:
                                # البحث عن روابط في النص
                                links = self.extract_links_from_text(message.text)
                                whatsapp_links.update(links['whatsapp'])
                                telegram_links.update(links['telegram'])
                        
                        groups_checked += 1
                        
                    except Exception as e:
                        logger.error(f"❌ خطأ في فحص المجموعة: {e}")
                        continue
            
            result = {
                'whatsapp': list(whatsapp_links),
                'telegram': list(telegram_links),
                'total_checked': groups_checked,
                'total_links': len(whatsapp_links) + len(telegram_links)
            }
            
            logger.info(f"✅ تم تجميع {len(whatsapp_links)} رابط واتساب و {len(telegram_links)} رابط تليجرام من {groups_checked} مجموعة")
            return result
            
        except Exception as e:
            logger.error(f"❌ خطأ في تجميع الروابط: {e}")
            return {'whatsapp': [], 'telegram': [], 'total_checked': 0}
    
    def extract_links_from_text(self, text: str):
        """استخراج الروابط من النص"""
        whatsapp_links = set()
        telegram_links = set()
        
        # نمط البحث عن الروابط
        url_pattern = r'https?://[^\s]+'
        links = re.findall(url_pattern, text)
        
        for link in links:
            if self._is_whatsapp_link(link):
                whatsapp_links.add(link)
            elif self._is_telegram_link(link):
                telegram_links.add(link)
        
        return {'whatsapp': whatsapp_links, 'telegram': telegram_links}
    
    def _is_whatsapp_link(self, link: str) -> bool:
        """التحقق إذا كان الرابط خاص بواتساب"""
        whatsapp_patterns = [
            r'chat\.whatsapp\.com',
            r'wa\.me/',
            r'whatsapp\.com/'
        ]
        
        for pattern in whatsapp_patterns:
            if re.search(pattern, link, re.IGNORECASE):
                return True
        return False
    
    def _is_telegram_link(self, link: str) -> bool:
        """التحقق إذا كان الرابط خاص بتليجرام"""
        telegram_patterns = [
            r't\.me/',
            r'telegram\.me/',
            r'telegram\.dog/'
        ]
        
        for pattern in telegram_patterns:
            if re.search(pattern, link, re.IGNORECASE):
                return True
        return False
    
    async def join_group_by_link(self, link: str) -> dict:
        """الانضمام لمجموعة عبر الرابط"""
        if not self.is_connected:
            return {'success': False, 'message': 'غير متصل بـ Telegram'}
        
        try:
            logger.info(f"🔗 محاولة الانضمام للمجموعة: {link}")
            
            # استخراج رابط الدعوة
            if 't.me/joinchat/' in link or 't.me/+' in link:
                # رابط دعوة
                invite_hash = self.extract_invite_hash(link)
                if invite_hash:
                    try:
                        await self.client(ImportChatInviteRequest(invite_hash))
                        logger.info(f"✅ تم الانضمام بنجاح للمجموعة: {link}")
                        return {'success': True, 'message': 'تم الانضمام بنجاح'}
                    except FloodWaitError as e:
                        logger.error(f"⏳ انتظار {e.seconds} ثانية: {e}")
                        return {'success': False, 'message': f'يجب الانتظار {e.seconds} ثانية'}
                    except Exception as e:
                        logger.error(f"❌ خطأ في الانضمام: {e}")
                        return {'success': False, 'message': f'خطأ: {str(e)}'}
            
            # رابط قناة/مجموعة عادي
            elif 't.me/' in link:
                username = self.extract_username(link)
                if username:
                    try:
                        await self.client(JoinChannelRequest(username))
                        logger.info(f"✅ تم الانضمام بنجاح للمجموعة: {link}")
                        return {'success': True, 'message': 'تم الانضمام بنجاح'}
                    except Exception as e:
                        logger.error(f"❌ خطأ في الانضمام: {e}")
                        return {'success': False, 'message': f'خطأ: {str(e)}'}
            
            return {'success': False, 'message': 'رابط غير مدعوم'}
            
        except Exception as e:
            logger.error(f"❌ خطأ في الانضمام للمجموعة {link}: {e}")
            return {'success': False, 'message': f'خطأ: {str(e)}'}
    
    def extract_invite_hash(self, link: str):
        """استخراج هاش الدعوة من الرابط"""
        patterns = [
            r't\.me/joinchat/([a-zA-Z0-9_-]+)',
            r't\.me/\+([a-zA-Z0-9_-]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, link)
            if match:
                return match.group(1)
        return None
    
    def extract_username(self, link: str):
        """استخراج اسم المستخدم من الرابط"""
        patterns = [
            r't\.me/([a-zA-Z0-9_]+)',
            r'telegram\.me/([a-zA-Z0-9_]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, link)
            if match:
                return match.group(1)
        return None
