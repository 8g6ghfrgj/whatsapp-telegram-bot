#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class WhatsAppDatabase:
    def __init__(self, db_file: str = "whatsapp_bot.db"):
        self.db_file = db_file
        self.conn = sqlite3.connect(db_file, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.init_database()
    
    def init_database(self):
        cursor = self.conn.cursor()
        
        # جدول المجموعات
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT,
                whatsapp_link TEXT,
                telegram_link TEXT,
                status TEXT DEFAULT 'active',
                is_collected BOOLEAN DEFAULT FALSE,
                last_checked DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # جدول الروابط المجمعة
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS collected_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link TEXT NOT NULL UNIQUE,
                link_type TEXT NOT NULL,
                source_group TEXT,
                status TEXT DEFAULT 'pending',
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME
            )
        """)
        
        # جدول قائمة انتظار الانضمام
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS join_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                last_attempt DATETIME,
                result_message TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            )
        """)
        
        # جدول الإحصائيات
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                links_collected INTEGER DEFAULT 0,
                groups_joined INTEGER DEFAULT 0,
                groups_failed INTEGER DEFAULT 0,
                UNIQUE(date)
            )
        """)
        
        self.conn.commit()
        logger.info("✅ تم تهيئة قاعدة البيانات")
    
    def add_group(self, name: str, username: str = None, whatsapp_link: str = None, telegram_link: str = None):
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO groups (name, username, whatsapp_link, telegram_link)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                name = excluded.name,
                whatsapp_link = excluded.whatsapp_link,
                telegram_link = excluded.telegram_link,
                last_checked = CURRENT_TIMESTAMP
            """, (name, username, whatsapp_link, telegram_link))
            self.conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة مجموعة: {e}")
            return None
    
    def get_groups(self, limit: int = 100):
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM groups ORDER BY name LIMIT ?", (limit,))
        return [dict(row) for row in cursor.fetchall()]
    
    def add_collected_link(self, link: str, link_type: str, source_group: str = None):
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO collected_links (link, link_type, source_group)
                VALUES (?, ?, ?)
                ON CONFLICT(link) DO NOTHING
            """, (link, link_type, source_group))
            self.conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة رابط مجمع: {e}")
            return False
    
    def get_collected_links(self, link_type: str = None, status: str = None, limit: int = 100):
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM collected_links WHERE 1=1"
        params = []
        
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
    
    def get_links_count(self, link_type: str = None):
        cursor = self.conn.cursor()
        
        query = "SELECT COUNT(*) as count FROM collected_links"
        params = []
        
        if link_type:
            query += " WHERE link_type = ?"
            params.append(link_type)
        
        cursor.execute(query, params)
        result = cursor.fetchone()
        return result['count'] if result else 0
    
    def add_to_join_queue(self, link: str):
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO join_queue (link, status)
                VALUES (?, 'pending')
            """, (link,))
            self.conn.commit()
            return cursor.lastrowid
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة لقائمة الانتظار: {e}")
            return None
    
    def get_pending_joins(self, limit: int = 5):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM join_queue 
            WHERE status = 'pending'
            ORDER BY added_at
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]
    
    def update_join_status(self, join_id: int, status: str, result_message: str = None):
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
        else:
            cursor.execute("""
                UPDATE join_queue 
                SET status = ?, result_message = ?,
                    last_attempt = CURRENT_TIMESTAMP,
                    attempts = attempts + 1
                WHERE id = ?
            """, (status, result_message, join_id))
        
        self.conn.commit()
    
    def get_join_queue_stats(self):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM join_queue
        """)
        
        return dict(cursor.fetchone())
    
    def update_statistics(self, stat_type: str, value: int = 1):
        today = datetime.now().date()
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT id FROM statistics WHERE date = ?", (today,))
        
        if cursor.fetchone():
            cursor.execute(f"""
                UPDATE statistics 
                SET {stat_type} = {stat_type} + ?
                WHERE date = ?
            """, (value, today))
        else:
            stats_data = {
                'date': today,
                'links_collected': 0,
                'groups_joined': 0,
                'groups_failed': 0
            }
            stats_data[stat_type] = value
            
            cursor.execute("""
                INSERT INTO statistics (date, links_collected, groups_joined, groups_failed)
                VALUES (?, ?, ?, ?)
            """, (today, stats_data['links_collected'], 
                  stats_data['groups_joined'], stats_data['groups_failed']))
        
        self.conn.commit()
    
    def close(self):
        if self.conn:
            self.conn.close()
            logger.info("✅ تم إغلاق اتصال قاعدة البيانات")
