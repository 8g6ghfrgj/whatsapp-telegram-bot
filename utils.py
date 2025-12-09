#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
أدوات مساعدة للبوت
"""

import re
import logging
from datetime import datetime
from typing import List, Tuple, Optional
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

logger = logging.getLogger(__name__)

def validate_whatsapp_link(link: str) -> bool:
    """التحقق من صحة رابط واتساب"""
    whatsapp_patterns = [
        r'^https?://chat\.whatsapp\.com/[A-Za-z0-9]+$',
        r'^https?://wa\.me/\d+',
        r'^whatsapp://[A-Za-z0-9]+'
    ]
    
    for pattern in whatsapp_patterns:
        if re.match(pattern, link, re.IGNORECASE):
            return True
    return False

def validate_telegram_link(link: str) -> bool:
    """التحقق من صحة رابط تليجرام"""
    telegram_patterns = [
        r'^https?://t\.me/[A-Za-z0-9_]+$',
        r'^https?://telegram\.me/[A-Za-z0-9_]+$',
        r'^@[A-Za-z0-9_]+$'
    ]
    
    for pattern in telegram_patterns:
        if re.match(pattern, link, re.IGNORECASE):
            return True
    return False

def extract_links_from_text(text: str) -> Tuple[List[str], List[str]]:
    """استخراج الروابط من النص"""
    whatsapp_links = []
    telegram_links = []
    other_links = []
    
    # البحث عن جميع الروابط في النص
    url_pattern = r'https?://[^\s]+'
    links = re.findall(url_pattern, text)
    
    for link in links:
        if validate_whatsapp_link(link):
            whatsapp_links.append(link)
        elif validate_telegram_link(link):
            telegram_links.append(link)
        else:
            other_links.append(link)
    
    return whatsapp_links, telegram_links, other_links

def format_time(seconds: int) -> str:
    """تنسيق الوقت بالثواني"""
    if seconds < 60:
        return f"{seconds} ثانية"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} دقيقة"
    else:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours} ساعة و {minutes} دقيقة"

def create_keyboard(buttons_data: List[List[Tuple[str, str]]], 
                    back_button: bool = True, 
                    back_data: str = "back_to_main") -> InlineKeyboardMarkup:
    """إنشاء لوحة مفاتيح إنلاين"""
    keyboard = []
    
    for row in buttons_data:
        row_buttons = []
        for text, callback_data in row:
            row_buttons.append(InlineKeyboardButton(text, callback_data=callback_data))
        keyboard.append(row_buttons)
    
    if back_button:
        keyboard.append([InlineKeyboardButton("🔙 رجوع", callback_data=back_data)])
    
    return InlineKeyboardMarkup(keyboard)

def create_pagination_keyboard(current_page: int, total_pages: int, 
                               prefix: str, data: List) -> InlineKeyboardMarkup:
    """إنشاء لوحة مفاتيح مع ترقيم الصفحات"""
    keyboard = []
    
    # إضافة البيانات للصفحة الحالية
    start_idx = current_page * 10
    end_idx = min(start_idx + 10, len(data))
    
    for i in range(start_idx, end_idx):
        item = data[i]
        keyboard.append([
            InlineKeyboardButton(
                f"• {item.get('name', item.get('link', 'غير معروف'))[:30]}",
                callback_data=f"{prefix}_{i}"
            )
        ])
    
    # أزرار التنقل بين الصفحات
    nav_buttons = []
    
    if current_page > 0:
        nav_buttons.append(
            InlineKeyboardButton("◀️ السابق", callback_data=f"page_{prefix}_{current_page - 1}")
        )
    
    nav_buttons.append(
        InlineKeyboardButton(f"{current_page + 1}/{total_pages}", callback_data="current_page")
    )
    
    if current_page < total_pages - 1:
        nav_buttons.append(
            InlineKeyboardButton("▶️ التالي", callback_data=f"page_{prefix}_{current_page + 1}")
        )
    
    if nav_buttons:
        keyboard.append(nav_buttons)
    
    keyboard.append([InlineKeyboardButton("🔙 رجوع", callback_data="back_to_main")])
    
    return InlineKeyboardMarkup(keyboard)

def format_stats(stats: dict) -> str:
    """تنسيق الإحصائيات"""
    message = "📊 *الإحصائيات*\n\n"
    
    if 'links_collected' in stats:
        message += f"📎 الروابط المجمعة: `{stats['links_collected']}`\n"
    
    if 'groups_joined' in stats:
        message += f"✅ المجموعات المنضمة: `{stats['groups_joined']}`\n"
    
    if 'groups_failed' in stats:
        message += f"❌ المجموعات الفاشلة: `{stats['groups_failed']}`\n"
    
    if 'messages_sent' in stats:
        message += f"📨 الرسائل المرسلة: `{stats['messages_sent']}`\n"
    
    if 'pending' in stats:
        message += f"⏳ المهام المعلقة: `{stats['pending']}`\n"
    
    if 'processing' in stats:
        message += f"🔄 المهام قيد المعالجة: `{stats['processing']}`\n"
    
    if 'completed' in stats:
        message += f"✅ المهام المكتملة: `{stats['completed']}`\n"
    
    if 'failed' in stats:
        message += f"❌ المهام الفاشلة: `{stats['failed']}`\n"
    
    if 'total' in stats:
        message += f"📋 الإجمالي: `{stats['total']}`\n"
    
    return message

def split_message(message: str, max_length: int = 4000) -> List[str]:
    """تقسيم الرسالة الطويلة إلى أجزاء"""
    if len(message) <= max_length:
        return [message]
    
    parts = []
    while len(message) > max_length:
        # البحث عن آخر مسافة قبل الحد الأقصى
        split_point = message[:max_length].rfind('\n')
        if split_point == -1:
            split_point = message[:max_length].rfind(' ')
        if split_point == -1:
            split_point = max_length
        
        parts.append(message[:split_point])
        message = message[split_point:].lstrip()
    
    if message:
        parts.append(message)
    
    return parts

def sanitize_filename(filename: str) -> str:
    """تنظيف اسم الملف من الأحغير غير الآمنة"""
    # إزالة الأحغير غير الآمنة
    unsafe_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    for char in unsafe_chars:
        filename = filename.replace(char, '_')
    
    # تقليل الطول
    if len(filename) > 100:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:95] + '...' + ('.' + ext if ext else '')
    
    return filename
