#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
إدارة قاعدة البيانات للبوت
"""

import sqlite3
import logging
from datetime import datetime
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

class WhatsAppDatabase:
    """فئة إدارة قاعدة البيانات"""
    
    def __init__(self, db_file: str = "whatsapp_bot.db"):
        self.db_file = db_file
        self.conn = sqlite3.connect(db_file, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_database()
    
    def init_database(self):
        """تهيئة جداول قاعدة البيانات"""
        cursor = self.conn.cursor()
        
        # جدول الحسابات
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                phone_number TEXT,
                status TEXT DEFAULT 'inactive',
                last_login DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # جدول المجموعات
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                whatsapp_link TEXT,
                telegram_link TEXT,
                status TEXT DEFAULT 'active',
                is_collected BOOLEAN DEFAULT FALSE,
                last_checked DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        """)
        
        # جدول الروابط المجمعة
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS collected_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                link TEXT NOT NULL,
                link_type TEXT NOT NULL,  -- 'whatsapp' أو 'telegram'
                source_group TEXT,
                status TEXT DEFAULT 'pending',
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                UNIQUE(account_id, link),
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        """)
        
        # جدول قائمة انتظار الانضمام
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS join_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                link TEXT NOT NULL,
                status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
                attempts INTEGER DEFAULT 0,
                last_attempt DATETIME,
                result_message TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        """)
        
        # جدول الرسائل
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        """)
        
        # جدول الإرسال
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                message_id INTEGER NOT NULL,
                group_name TEXT NOT NULL,
                status TEXT NOT NULL,  -- sent, failed
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT,
                FOREIGN KEY (account_id) REFERENCES accounts (id),
                FOREIGN KEY (message_id) REFERENCES messages (id)
            )
        """)
        
        # جدول الإشعارات
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # جدول الإحصائيات
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                date DATE NOT NULL,
                links_collected INTEGER DEFAULT 0,
                groups_joined INTEGER DEFAULT 0,
                groups_failed INTEGER DEFAULT 0,
                messages_sent INTEGER DEFAULT 0,
                UNIQUE(account_id, date)
            )
        """)
        
        self.conn.commit()
        logger.info("✅ تم تهيئة قاعدة البيانات")
    
    # ========== حسابات ==========
    
    def add_account(self, name: str, phone_number: str = None) -> int:
        """إضافة حساب جديد"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO accounts (name, phone_number, status)
                VALUES (?, ?, 'active')
                ON CONFLICT(name) DO UPDATE SET
                phone_number = excluded.phone_number,
                updated_at = CURRENT_TIMESTAMP
            """, (name, phone_number))
            self.conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة حساب: {e}")
            return None
    
    def get_account(self, account_id: int = None, name: str = None):
        """الحصول على معلومات حساب"""
        cursor = self.conn.cursor()
        if account_id:
            cursor.execute("SELECT * FROM accounts WHERE id = ?", (account_id,))
        elif name:
            cursor.execute("SELECT * FROM accounts WHERE name = ?", (name,))
        else:
            cursor.execute("SELECT * FROM accounts WHERE status = 'active' LIMIT 1")
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_all_accounts(self):
        """الحصول على جميع الحسابات"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM accounts ORDER BY created_at DESC")
        return [dict(row) for row in cursor.fetchall()]
    
    def update_account_status(self, account_id: int, status: str):
        """تحديث حالة الحساب"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE accounts 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status, account_id))
        self.conn.commit()
        return cursor.rowcount > 0
    
    # ========== المجموعات ==========
    
    def add_group(self, account_id: int, name: str, whatsapp_link: str = None, 
                  telegram_link: str = None) -> int:
        """إضافة مجموعة جديدة"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO groups (account_id, name, whatsapp_link, telegram_link)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(account_id, name) DO UPDATE SET
                whatsapp_link = excluded.whatsapp_link,
                telegram_link = excluded.telegram_link,
                last_checked = CURRENT_TIMESTAMP
            """, (account_id, name, whatsapp_link, telegram_link))
            self.conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة مجموعة: {e}")
            return None
    
    def get_groups(self, account_id: int = None, limit: int = 100):
        """الحصول على المجموعات"""
        cursor = self.conn.cursor()
        if account_id:
            cursor.execute("""
                SELECT * FROM groups 
                WHERE account_id = ? 
                ORDER BY name
                LIMIT ?
            """, (account_id, limit))
        else:
            cursor.execute("SELECT * FROM groups ORDER BY name LIMIT ?", (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def mark_group_collected(self, group_id: int):
        """تحديد المجموعة كمجمعة"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE groups 
            SET is_collected = TRUE, last_checked = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (group_id,))
        self.conn.commit()
    
    # ========== الروابط المجمعة ==========
    
    def add_collected_link(self, account_id: int, link: str, link_type: str, 
                          source_group: str = None) -> bool:
        """إضافة رابط مجمع"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO collected_links (account_id, link, link_type, source_group)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(account_id, link) DO NOTHING
            """, (account_id, link, link_type, source_group))
            self.conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة رابط مجمع: {e}")
            return False
    
    def get_collected_links(self, account_id: int = None, link_type: str = None, 
                           status: str = None, limit: int = 100):
        """الحصول على الروابط المجمعة"""
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM collected_links WHERE 1=1"
        params = []
        
        if account_id:
            query += " AND account_id = ?"
            params.append(account_id)
        
        if link_type:
            query += " AND link_type = ?"
            params.append(link_type)
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY added_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    
    def get_links_count(self, account_id: int = None, link_type: str = None) -> int:
        """الحصول على عدد الروابط"""
        cursor = self.conn.cursor()
        
        query = "SELECT COUNT(*) as count FROM collected_links WHERE 1=1"
        params = []
        
        if account_id:
            query += " AND account_id = ?"
            params.append(account_id)
        
        if link_type:
            query += " AND link_type = ?"
            params.append(link_type)
        
        cursor.execute(query, params)
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    def update_link_status(self, link_id: int, status: str):
        """تحديث حالة الرابط"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE collected_links 
            SET status = ?, processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status, link_id))
        self.conn.commit()
    
    # ========== قائمة انتظار الانضمام ==========
    
    def add_to_join_queue(self, account_id: int, link: str) -> int:
        """إضافة رابط لقائمة انتظار الانضمام"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO join_queue (account_id, link, status)
                VALUES (?, ?, 'pending')
            """, (account_id, link))
            self.conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة لقائمة الانتظار: {e}")
            return None
    
    def get_pending_joins(self, account_id: int, limit: int = 5):
        """الحصول على الروابط المعلقة للانضمام"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM join_queue 
            WHERE account_id = ? AND status = 'pending'
            ORDER BY added_at
            LIMIT ?
        """, (account_id, limit))
        return [dict(row) for row in cursor.fetchall()]
    
    def update_join_status(self, join_id: int, status: str, result_message: str = None):
        """تحديث حالة الانضمام"""
        cursor = self.conn.cursor()
        if status == 'completed':
            cursor.execute("""
                UPDATE join_queue 
                SET status = ?, result_message = ?, 
                    completed_at = CURRENT_TIMESTAMP,
                    last_attempt = CURRENT_TIMESTAMP,
                    attempts = attempts + 1
                WHERE id = ?
            """, (status, result_message, join_id))
        elif status == 'processing':
            cursor.execute("""
                UPDATE join_queue 
                SET status = ?, last_attempt = CURRENT_TIMESTAMP,
                    attempts = attempts + 1
                WHERE id = ?
            """, (status, join_id))
        else:
            cursor.execute("""
                UPDATE join_queue 
                SET status = ?, result_message = ?,
                    last_attempt = CURRENT_TIMESTAMP,
                    attempts = attempts + 1
                WHERE id = ?
            """, (status, result_message, join_id))
        
        self.conn.commit()
    
    def get_join_queue_stats(self, account_id: int):
        """الحصول على إحصائيات قائمة الانتظار"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM join_queue 
            WHERE account_id = ?
        """, (account_id,))
        
        return dict(cursor.fetchone())
    
    # ========== الرسائل ==========
    
    def add_message(self, account_id: int, content: str, message_type: str = 'text') -> int:
        """إضافة رسالة جديدة"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO messages (account_id, content, message_type)
                VALUES (?, ?, ?)
            """, (account_id, content, message_type))
            self.conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة رسالة: {e}")
            return None
    
    def get_messages(self, account_id: int = None, limit: int = 50):
        """الحصول على الرسائل"""
        cursor = self.conn.cursor()
        if account_id:
            cursor.execute("""
                SELECT * FROM messages 
                WHERE account_id = ? AND status = 'active'
                ORDER BY created_at DESC
                LIMIT ?
            """, (account_id, limit))
        else:
            cursor.execute("""
                SELECT * FROM messages 
                WHERE status = 'active'
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def delete_message(self, message_id: int) -> bool:
        """حذف رسالة"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE messages 
            SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (message_id,))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def get_messages_count(self, account_id: int = None) -> int:
        """الحصول على عدد الرسائل"""
        cursor = self.conn.cursor()
        if account_id:
            cursor.execute("""
                SELECT COUNT(*) as count FROM messages 
                WHERE account_id = ? AND status = 'active'
            """, (account_id,))
        else:
            cursor.execute("SELECT COUNT(*) as count FROM messages WHERE status = 'active'")
        
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    # ========== الإشعارات ==========
    
    def add_notification(self, user_id: int, message: str, notification_type: str):
        """إضافة إشعار"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO notifications (user_id, message, notification_type)
            VALUES (?, ?, ?)
        """, (user_id, message, notification_type))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_unread_notifications(self, user_id: int, limit: int = 10):
        """الحصول على الإشعارات غير المقروءة"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM notifications 
            WHERE user_id = ? AND is_read = FALSE
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, limit))
        return [dict(row) for row in cursor.fetchall()]
    
    def mark_notification_read(self, notification_id: int):
        """تحديد الإشعار كمقروء"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE notifications 
            SET is_read = TRUE
            WHERE id = ?
        """, (notification_id,))
        self.conn.commit()
    
    # ========== الإحصائيات ==========
    
    def update_statistics(self, account_id: int, stat_type: str, value: int = 1):
        """تحديث الإحصائيات"""
        today = datetime.now().date()
        cursor = self.conn.cursor()
        
        # التحقق إذا كان هناك سجل لهذا اليوم
        cursor.execute("""
            SELECT id FROM statistics 
            WHERE account_id = ? AND date = ?
        """, (account_id, today))
        
        if cursor.fetchone():
            # تحديث السجل الموجود
            cursor.execute(f"""
                UPDATE statistics 
                SET {stat_type} = {stat_type} + ?
                WHERE account_id = ? AND date = ?
            """, (value, account_id, today))
        else:
            # إنشاء سجل جديد
            stats_data = {
                'account_id': account_id,
                'date': today,
                'links_collected': 0,
                'groups_joined': 0,
                'groups_failed': 0,
                'messages_sent': 0
            }
            stats_data[stat_type] = value
            
            cursor.execute("""
                INSERT INTO statistics 
                (account_id, date, links_collected, groups_joined, groups_failed, messages_sent)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                stats_data['account_id'], stats_data['date'],
                stats_data['links_collected'], stats_data['groups_joined'],
                stats_data['groups_failed'], stats_data['messages_sent']
            ))
        
        self.conn.commit()
    
    def close(self):
        """إغلاق اتصال قاعدة البيانات"""
        if self.conn:
            self.conn.close()
            logger.info("✅ تم إغلاق اتصال قاعدة البيانات")
