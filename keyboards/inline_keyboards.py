from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def main_menu() -> InlineKeyboardMarkup:
    """القائمة الرئيسية"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("🔗 ربط واتساب", callback_data="connect_whatsapp"),
        InlineKeyboardButton("📊 الإحصائيات", callback_data="stats"),
        InlineKeyboardButton("📢 الإعلانات", callback_data="ads_menu"),
        InlineKeyboardButton("🔗 الروابط", callback_data="links_menu"),
        InlineKeyboardButton("👥 المشرفين", callback_data="admins_menu"),
        InlineKeyboardButton("🤖 الردود", callback_data="replies_menu"),
        InlineKeyboardButton("📤 نشر تلقائي", callback_data="auto_publish"),
        InlineKeyboardButton("➕ انضمام تلقائي", callback_data="auto_join"),
        InlineKeyboardButton("⚙️ الإعدادات", callback_data="settings")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    keyboard.add(*buttons[4:6])
    keyboard.add(*buttons[6:8])
    keyboard.add(buttons[8])
    
    return keyboard

def ads_menu() -> InlineKeyboardMarkup:
    """قائمة الإعلانات"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("➕ إضافة إعلان", callback_data="add_ad"),
        InlineKeyboardButton("📋 قائمة الإعلانات", callback_data="list_ads"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(buttons[2])
    
    return keyboard

def links_menu() -> InlineKeyboardMarkup:
    """قائمة الروابط"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("📥 جمع الروابط", callback_data="collect_links"),
        InlineKeyboardButton("📋 عرض الروابط", callback_data="show_links"),
        InlineKeyboardButton("🧹 مسح الروابط", callback_data="clear_links"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    
    return keyboard

def publish_control() -> InlineKeyboardMarkup:
    """تحكم النشر التلقائي"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("▶️ تشغيل النشر", callback_data="start_publishing"),
        InlineKeyboardButton("⏸️ إيقاف النشر", callback_data="stop_publishing"),
        InlineKeyboardButton("📊 إحصائيات النشر", callback_data="publish_stats"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    
    return keyboard

def join_control() -> InlineKeyboardMarkup:
    """تحكم الانضمام التلقائي"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("▶️ تشغيل الانضمام", callback_data="start_joining"),
        InlineKeyboardButton("⏸️ إيقاف الانضمام", callback_data="stop_joining"),
        InlineKeyboardButton("➕ انضمام جماعي", callback_data="mass_join"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    
    return keyboard

def admin_management() -> InlineKeyboardMarkup:
    """إدارة المشرفين"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("➕ إضافة مشرف", callback_data="add_admin"),
        InlineKeyboardButton("🗑️ حذف مشرف", callback_data="remove_admin"),
        InlineKeyboardButton("📋 قائمة المشرفين", callback_data="list_admins"),
        InlineKeyboardButton("◀️ رجوع", callback_data="main_menu")
    ]
    
    keyboard.add(*buttons[:2])
    keyboard.add(*buttons[2:4])
    
    return keyboard

def confirm_keyboard(action: str) -> InlineKeyboardMarkup:
    """لوحة تأكيد"""
    keyboard = InlineKeyboardMarkup(row_width=2)
    
    buttons = [
        InlineKeyboardButton("✅ نعم", callback_data=f"confirm_{action}"),
        InlineKeyboardButton("❌ لا", callback_data="cancel_action")
    ]
    
    keyboard.add(*buttons)
    
    return keyboard
