#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import logging
import time
from threading import Thread
from typing import Dict, List

logger = logging.getLogger(__name__)

class JoinScheduler:
    def __init__(self, database, telegram_collector, max_per_batch: int = 5, delay_seconds: int = 300):
        self.db = database
        self.telegram_collector = telegram_collector
        self.max_per_batch = max_per_batch
        self.delay_seconds = delay_seconds
        self.running = False
        self.scheduler_thread = None
        
        logger.info(f"✅ تم تهيئة الجدولة: {max_per_batch} روابط كل {delay_seconds} ثانية")
    
    def start(self):
        if self.running:
            logger.warning("⚠️ الجدولة تعمل بالفعل")
            return
        
        self.running = True
        self.scheduler_thread = Thread(target=self._scheduler_loop, daemon=True)
        self.scheduler_thread.start()
        
        logger.info("🚀 بدأ جدولة الانضمام للمجموعات")
    
    def stop(self):
        self.running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        
        logger.info("🛑 توقفت جدولة الانضمام للمجموعات")
    
    def _scheduler_loop(self):
        """حلقة الجدولة الرئيسية"""
        while self.running:
            try:
                # الحصول على الروابط المعلقة
                pending_joins = self.db.get_pending_joins(self.max_per_batch)
                
                if pending_joins:
                    logger.info(f"📋 معالجة {len(pending_joins)} رابط")
                    
                    # تشغيل حلقة asyncio لمعالجة الروابط
                    asyncio.run(self._process_batch(pending_joins))
                
                logger.info(f"⏳ انتظار {self.delay_seconds} ثانية للدورة التالية...")
                time.sleep(self.delay_seconds)
                
            except Exception as e:
                logger.error(f"❌ خطأ في حلقة الجدولة: {e}")
                time.sleep(60)
    
    async def _process_batch(self, join_tasks):
        """معالجة دفعة من الروابط"""
        for join_task in join_tasks:
            if not self.running:
                break
            
            await self._process_join_task(join_task)
            await asyncio.sleep(2)  # تأخير بين المعالجات
    
    async def _process_join_task(self, join_task):
        """معالجة مهمة انضمام واحدة"""
        join_id = join_task['id']
        link = join_task['link']
        
        try:
            logger.info(f"🔗 معالجة الانضمام {join_id}: {link[:50]}...")
            
            # محاولة الانضمام للمجموعة
            result = await self.telegram_collector.join_group_by_link(link)
            
            if result['success']:
                self.db.update_join_status(join_id, 'completed', result['message'])
                self.db.update_statistics('groups_joined')
                logger.info(f"✅ نجاح الانضمام {join_id}: {result['message']}")
            else:
                self.db.update_join_status(join_id, 'failed', result['message'])
                self.db.update_statistics('groups_failed')
                logger.error(f"❌ فشل الانضمام {join_id}: {result['message']}")
        
        except Exception as e:
            error_msg = f"❌ خطأ غير متوقع: {str(e)}"
            self.db.update_join_status(join_id, 'failed', error_msg)
            logger.error(f"❌ خطأ في معالجة الانضمام {join_id}: {e}")
    
    def add_links_to_queue(self, links: List[str]) -> Dict:
        """إضافة روابط لقائمة الانتظار"""
        results = {
            'total': len(links),
            'added': 0,
            'duplicates': 0,
            'errors': 0
        }
        
        for link in links:
            try:
                if not self._is_valid_link(link):
                    results['errors'] += 1
                    continue
                
                join_id = self.db.add_to_join_queue(link)
                
                if join_id:
                    results['added'] += 1
                    logger.info(f"📥 أضيف الرابط لقائمة الانتظار: {link[:50]}...")
                else:
                    results['duplicates'] += 1
                
            except Exception as e:
                results['errors'] += 1
                logger.error(f"❌ خطأ في إضافة الرابط {link[:50]}...: {e}")
        
        return results
    
    def _is_valid_link(self, link: str) -> bool:
        """التحقق من صحة الرابط"""
        import re
        
        valid_patterns = [
            r'https?://t\.me/',
            r'https?://telegram\.me/',
            r'https?://chat\.whatsapp\.com/',
            r'https?://wa\.me/'
        ]
        
        for pattern in valid_patterns:
            if re.search(pattern, link, re.IGNORECASE):
                return True
        return False
    
    def get_queue_status(self):
        """الحصول على حالة قائمة الانتظار"""
        return self.db.get_join_queue_stats()
    
    def clear_queue(self, status: str = None):
        """مسح قائمة الانتظار"""
        try:
            cursor = self.db.conn.cursor()
            
            if status:
                cursor.execute(
                    "DELETE FROM join_queue WHERE status = ?",
                    (status,)
                )
            else:
                cursor.execute("DELETE FROM join_queue")
            
            self.db.conn.commit()
            deleted_count = cursor.rowcount
            
            logger.info(f"🗑️ تم مسح {deleted_count} مهمة من قائمة الانتظار")
            return deleted_count > 0
            
        except Exception as e:
            logger.error(f"❌ خطأ في مسح قائمة الانتظار: {e}")
            return False
