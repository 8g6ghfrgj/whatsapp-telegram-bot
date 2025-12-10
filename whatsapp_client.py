import asyncio
import json
import os
from typing import Optional, Dict, List
from playwright.async_api import async_playwright, Page
from datetime import datetime
import qrcode
from io import BytesIO
import config

class WhatsAppClient:
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.page: Optional[Page] = None
        self.browser = None
        self.playwright = None
        self.session_path = f"{config.SESSIONS_DIR}/whatsapp_session_{user_id}.json"
        self.is_authenticated = False
        
    async def initialize(self):
        """تهيئة المتصفح"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,
            args=[
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        )
        
        # تحميل الجلسة إذا موجودة
        context = await self.load_session()
        self.page = await context.new_page()
        
    async def load_session(self):
        """تحميل جلسة موجودة"""
        context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        if os.path.exists(self.session_path):
            with open(self.session_path, 'r') as f:
                storage_state = json.load(f)
            await context.add_cookies(storage_state.get('cookies', []))
            
        return context
        
    async def save_session(self):
        """حفظ الجلسة"""
        if self.page:
            storage_state = await self.page.context.storage_state()
            with open(self.session_path, 'w') as f:
                json.dump(storage_state, f)
                
    async def get_qr_code(self) -> BytesIO:
        """الحصول على QR Code"""
        await self.page.goto('https://web.whatsapp.com')
        
        # انتظار ظهور QR Code
        qr_element = await self.page.wait_for_selector('canvas[aria-label="Scan me!"]', timeout=30000)
        
        # التقاط صورة QR
        qr_screenshot = await qr_element.screenshot()
        
        # تحويل إلى BytesIO
        qr_bytes = BytesIO(qr_screenshot)
        qr_bytes.seek(0)
        
        return qr_bytes
        
    async def wait_for_login(self, timeout: int = 120):
        """انتظار تسجيل الدخول"""
        try:
            # انتظار ظهور شاشة المحادثات
            await self.page.wait_for_selector('div[data-testid="chat-list"]', timeout=timeout*1000)
            self.is_authenticated = True
            
            # حفظ الجلسة
            await self.save_session()
            return True
        except Exception as e:
            print(f"Login timeout/error: {e}")
            return False
            
    async def get_chats(self) -> List[Dict]:
        """الحصول على قائمة المحادثات"""
        chats = []
        
        # الانتظار لتحميل المحادثات
        await self.page.wait_for_selector('div[data-testid="chat-list"] div[role="button"]')
        
        # جلب عناصر المحادثات
        chat_elements = await self.page.query_selector_all('div[data-testid="chat-list"] div[role="button"]')
        
        for chat in chat_elements[:50]:  # أول 50 محادثة
            try:
                # الحصول على اسم المحادثة
                name_element = await chat.query_selector('span[aria-label]')
                name = await name_element.text_content() if name_element else "Unknown"
                
                # الحصول على آخر رسالة
                last_msg_element = await chat.query_selector('div[class*="message-text"]')
                last_msg = await last_msg_element.text_content() if last_msg_element else ""
                
                chats.append({
                    'name': name,
                    'last_message': last_msg,
                    'element': chat
                })
            except:
                continue
                
        return chats
        
    async def send_message(self, chat_name: str, message: str):
        """إرسال رسالة لمحادثة"""
        try:
            # البحث عن المحادثة
            search_btn = await self.page.query_selector('div[data-testid="search"]')
            if search_btn:
                await search_btn.click()
                await self.page.fill('div[contenteditable="true"][data-testid="search"]', chat_name)
                await asyncio.sleep(2)
                
                # اختيار المحادثة الأولى
                first_chat = await self.page.query_selector('div[data-testid="chat-list"] div[role="button"]:first-child')
                if first_chat:
                    await first_chat.click()
                    await asyncio.sleep(1)
                    
                    # كتابة الرسالة
                    input_box = await self.page.query_selector('div[contenteditable="true"][data-testid="conversation-compose-box-input"]')
                    if input_box:
                        await input_box.fill(message)
                        await input_box.press("Enter")
                        return True
        except Exception as e:
            print(f"Error sending message: {e}")
            return False
            
    async def extract_links_from_chat(self, chat_name: str) -> List[str]:
        """استخراج الروابط من محادثة"""
        links = []
        
        try:
            await self.open_chat(chat_name)
            
            # تمرير لأعلى لتحميل المزيد من الرسائل
            chat_container = await self.page.query_selector('div[data-testid="conversation-panel-messages"]')
            if chat_container:
                for _ in range(3):  # تحميل 3 صفحات من الرسائل
                    await chat_container.press("PageUp")
                    await asyncio.sleep(1)
                    
            # البحث عن الروابط في النص
            messages = await self.page.query_selector_all('div[class*="message-text"]')
            
            for msg in messages:
                text = await msg.text_content()
                if text:
                    # استخراج الروابط
                    import re
                    found_links = re.findall(r'https?://[^\s]+', text)
                    links.extend(found_links)
                    
        except Exception as e:
            print(f"Error extracting links: {e}")
            
        return links
        
    async def open_chat(self, chat_name: str):
        """فتح محادثة"""
        await self.send_message(chat_name, "")
        
    async def join_group(self, invite_link: str) -> bool:
        """الانضمام لمجموعة عبر الرابط"""
        try:
            await self.page.goto(invite_link)
            await asyncio.sleep(3)
            
            # النقر على زر الانضمام
            join_button = await self.page.query_selector('div[role="button"] >> text=/انضمام|Join/i')
            if join_button:
                await join_button.click()
                await asyncio.sleep(5)
                return True
                
            return False
        except Exception as e:
            print(f"Error joining group: {e}")
            return False
            
    async def close(self):
        """إغلاق العميل"""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
