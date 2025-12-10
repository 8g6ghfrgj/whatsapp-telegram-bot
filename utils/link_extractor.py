import re
from typing import List, Dict
from urllib.parse import urlparse
import asyncio

class LinkExtractor:
    @staticmethod
    def extract_links(text: str) -> List[str]:
        """استخراج جميع الروابط من النص"""
        pattern = r'https?://[^\s]+'
        return re.findall(pattern, text)
    
    @staticmethod
    def categorize_link(url: str) -> str:
        """تصنيف الرابط"""
        domain = urlparse(url).netloc.lower()
        
        if 'whatsapp.com' in domain or 'wa.me' in domain:
            return 'whatsapp'
        elif 't.me' in domain or 'telegram.org' in domain:
            return 'telegram'
        elif 'facebook.com' in domain or 'fb.com' in domain:
            return 'facebook'
        elif 'instagram.com' in domain:
            return 'instagram'
        elif 'tiktok.com' in domain:
            return 'tiktok'
        elif 'youtube.com' in domain or 'youtu.be' in domain:
            return 'youtube'
        else:
            return 'other'
    
    @staticmethod
    def is_whatsapp_group_link(url: str) -> bool:
        """التحقق إذا كان رابط مجموعة واتساب"""
        patterns = [
            r'https?://chat\.whatsapp\.com/[A-Za-z0-9]+',
            r'https?://whatsapp\.com/channel/[A-Za-z0-9]+',
            r'https?://wa\.me/[0-9]+'
        ]
        
        for pattern in patterns:
            if re.match(pattern, url):
                return True
        return False
    
    @staticmethod
    def is_telegram_link(url: str) -> bool:
        """التحقق إذا كان رابط تليجرام"""
        patterns = [
            r'https?://t\.me/[A-Za-z0-9_]+',
            r'https?://telegram\.me/[A-Za-z0-9_]+'
        ]
        
        for pattern in patterns:
            if re.match(pattern, url):
                return True
        return False
    
    @staticmethod
    def filter_unique_links(links: List[str]) -> List[str]:
        """تصفية الروابط المكررة"""
        seen = set()
        unique_links = []
        
        for link in links:
            if link not in seen:
                seen.add(link)
                unique_links.append(link)
                
        return unique_links
    
    @staticmethod
    def clean_link(url: str) -> str:
        """تنظيف الرابط من المقاييس غير الضرورية"""
        # إزالة المقاييس (UTM parameters)
        parsed = urlparse(url)
        clean_query = '&'.join(
            param for param in parsed.query.split('&')
            if not param.startswith('utm_')
        )
        
        # إعادة بناء الرابط
        if clean_query:
            cleaned_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{clean_query}"
        else:
            cleaned_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            
        return cleaned_url.rstrip('?')
