#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import logging
import time
from datetime import datetime, timedelta
from threading import Thread
from typing import Dict, List

logger = logging.getLogger(__name__)

class JoinScheduler:
    def __init__(self, database, bot_instance, max_per_batch: int = 5, delay_seconds: int = 300):
        self.db = database
        self.bot = bot_instance
        self.max_per_batch = max_per_batch
        self.delay_seconds = delay_seconds
        self.running = False
        self.scheduler_thread = None
        self.current_tasks = {}
        
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
        while self.running:
            try:
                accounts = self.db.get_all_accounts()
                
                for account in accounts:
                    if not self.running:
                        break
                    
                    account_id = account['id']
                    account_name = account['name']
                    
                    pending_joins = self.db.get_pending_joins(account_id, self.max_per_batch)
                    
                    if pending_joins:
                        logger.info(f"📋 معالجة {len(pending_joins)} رابط للحساب {account_name}")
                        
                        for join_task in pending_joins:
                            if not self.running:
                                break
                            
                            self._process_join_task(account, join_task)
                            time.sleep(2)
                    
                    if len(accounts) > 1:
                        time.sleep(10)
                
                logger.info(f"⏳ انتظار {self.delay_seconds} ثانية للدورة التالية...")
                time.sleep(self.delay_seconds)
                
            except Exception as e:
                logger.error(f"❌ خطأ في حلقة الجدولة: {e}")
                time.sleep(60)
    
    def _process_join_task(self, account: dict, join_task: dict):
        account_id = account['id']
        account_name = account['name']
        join_id = join_task['id']
        link = join_task['link']
        
        try:
            self.db.update_join_status(join_id, 'processing')
            
            logger.info(f"🔗 معالجة الانضمام {join_id}: {link[:50]}...")
            
            whatsapp_manager = self.bot.get_whatsapp_manager(account_name)
            
            if not whatsapp_manager:
                error_msg = f"❌ مدير واتساب للحساب {account_name} غير موجود"
                self.db.update_join_status(join_id, 'failed', error_msg)
                
                self.db.add_notification(
                    user_id=self.bot.get_admin_id(),
                    message=error_msg,
                    notification_type='join_failed'
                )
                return
            
            result = whatsapp_manager.join_group_by_link(link)
            
            if result['success']:
                self.db.update_join_status(join_id, 'completed', result['message'])
                self.db.update_statistics(account_id, 'groups_joined')
                
                logger.info(f"✅ نجاح الانضمام {join_id}: {result['message']}")
                
                success_msg = f"✅ تم الانضمام بنجاح للمجموعة: {link[:50]}..."
                self.db.add_notification(
                    user_id=self.bot.get_admin_id(),
                    message=success_msg,
                    notification_type='join_success'
                )
                
            else:
                self.db.update_join_status(join_id, 'failed', result['message'])
                self.db.update_statistics(account_id, 'groups_failed')
                
                logger.error(f"❌ فشل الانضمام {join_id}: {result['message']}")
                
                fail_msg = f"❌ فشل الانضمام للمجموعة: {link[:50]}...\nالسبب: {result['message']}"
                self.db.add_notification(
                    user_id=self.bot.get_admin_id(),
                    message=fail_msg,
                    notification_type='join_failed'
                )
        
        except Exception as e:
            error_msg = f"❌ خطأ غير متوقع: {str(e)}"
            self.db.update_join_status(join_id, 'failed', error_msg)
            logger.error(f"❌ خطأ في معالجة الانضمام {join_id}: {e}")
    
    def add_links_to_queue(self, account_id: int, links: List[str]) -> Dict:
        results = {
            'total': len(links),
            'added': 0,
            'duplicates': 0,
            'errors': 0
        }
        
        for link in links:
            try:
                if not self._is_valid_whatsapp_link(link):
                    results['errors'] += 1
                    continue
                
                join_id = self.db.add_to_join_queue(account_id, link)
                
                if join_id:
                    results['added'] += 1
                    logger.info(f"📥 أضيف الرابط لقائمة الانتظار: {link[:50]}...")
                else:
                    results['duplicates'] += 1
                
            except Exception as e:
                results['errors'] += 1
                logger.error(f"❌ خطأ في إضافة الرابط {link[:50]}...: {e}")
        
        return results
    
    def _is_valid_whatsapp_link(self, link: str) -> bool:
        import re
        
        whatsapp_patterns = [
            r'https?://chat\.whatsapp\.com/',
            r'https?://wa\.me/',
            r'whatsapp://'
        ]
        
        for pattern in whatsapp_patterns:
            if re.search(pattern, link, re.IGNORECASE):
                return True
        return False
    
    def get_queue_status(self, account_id: int) -> Dict:
        return self.db.get_join_queue_stats(account_id)
    
    def clear_queue(self, account_id: int, status: str = None) -> bool:
        try:
            cursor = self.db.conn.cursor()
            
            if status:
                cursor.execute(
                    "DELETE FROM join_queue WHERE account_id = ? AND status = ?",
                    (account_id, status)
                )
            else:
                cursor.execute(
                    "DELETE FROM join_queue WHERE account_id = ?",
                    (account_id,)
                )
            
            self.db.conn.commit()
            deleted_count = cursor.rowcount
            
            logger.info(f"🗑️ تم مسح {deleted_count} مهمة من قائمة الانتظار")
            return deleted_count > 0
            
        except Exception as e:
            logger.error(f"❌ خطأ في مسح قائمة الانتظار: {e}")
            return False
