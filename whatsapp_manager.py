#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time
import logging
import base64
import re
from threading import Lock
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

logger = logging.getLogger(__name__)

class WhatsAppManager:
    def __init__(self, session_dir: str = "/tmp/whatsapp_session", account_name: str = "default"):
        self.session_dir = os.path.join(session_dir, account_name)
        self.account_name = account_name
        self.driver = None
        self.is_logged_in = False
        self.lock = Lock()
        self.group_cache = []
        self.last_check = None
        
        os.makedirs(self.session_dir, exist_ok=True)
        self.setup_driver()
        
        logger.info(f"📱 تم تهيئة مدير واتساب للحساب: {account_name}")
    
    def setup_driver(self):
        try:
            chrome_options = Options()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-extensions")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_argument("--start-maximized")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            chrome_options.add_argument("--disable-background-timer-throttling")
            chrome_options.add_argument("--disable-backgrounding-occluded-windows")
            chrome_options.add_argument("--disable-renderer-backgrounding")
            
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option("useAutomationExtension", False)
            chrome_options.add_argument(f"user-data-dir={self.session_dir}")
            chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    window.navigator.chrome = {runtime: {}, etc: {}};
                """
            })
            
            self.driver.get("https://web.whatsapp.com")
            time.sleep(3)
            
            logger.info(f"✅ تم إعداد المتصفح للحساب: {self.account_name}")
            
        except Exception as e:
            logger.error(f"❌ خطأ في إعداد المتصفح: {e}")
            raise
    
    def get_qr_code(self):
        with self.lock:
            try:
                wait = WebDriverWait(self.driver, 30)
                qr_element = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "canvas, div[data-ref]"))
                )
                
                qr_base64 = qr_element.screenshot_as_base64
                logger.info(f"✅ تم الحصول على QR Code للحساب: {self.account_name}")
                return qr_base64
                
            except TimeoutException:
                logger.warning(f"⏳ لم يظهر QR Code للحساب: {self.account_name}")
                if self.check_login_status():
                    return None
                return None
            except Exception as e:
                logger.error(f"❌ خطأ في الحصول على QR Code: {e}")
                return None
    
    def check_login_status(self):
        with self.lock:
            try:
                wait = WebDriverWait(self.driver, 10)
                search_box = wait.until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
                )
                
                if not self.is_logged_in:
                    self.is_logged_in = True
                    logger.info(f"✅ تم تسجيل الدخول للحساب: {self.account_name}")
                    self.load_groups()
                
                return True
                
            except TimeoutException:
                if self.is_logged_in:
                    self.is_logged_in = False
                    logger.warning(f"❌ تم تسجيل الخروج للحساب: {self.account_name}")
                return False
            except Exception as e:
                logger.error(f"❌ خطأ في التحقق من حالة الدخول: {e}")
                return False
    
    def load_groups(self):
        with self.lock:
            try:
                self.group_cache = []
                time.sleep(2)
                
                group_elements = self.driver.find_elements(
                    By.XPATH, '//div[contains(@data-testid, "cell-frame")]'
                )
                
                for element in group_elements[:100]:
                    try:
                        name_element = element.find_element(
                            By.XPATH, './/span[contains(@class, "selectable-text")]'
                        )
                        group_name = name_element.text.strip()
                        
                        if group_name:
                            self.group_cache.append({
                                'name': group_name,
                                'element': element
                            })
                    except NoSuchElementException:
                        continue
                
                logger.info(f"✅ تم تحميل {len(self.group_cache)} مجموعة للحساب: {self.account_name}")
                
            except Exception as e:
                logger.error(f"❌ خطأ في تحميل المجموعات: {e}")
    
    def collect_links_from_groups(self, max_groups: int = 50):
        with self.lock:
            if not self.is_logged_in:
                logger.error(f"❌ الحساب {self.account_name} غير مرتبط")
                return {'whatsapp': [], 'telegram': [], 'total_checked': 0}
            
            whatsapp_links = set()
            telegram_links = set()
            groups_checked = 0
            
            try:
                for group in self.group_cache[:max_groups]:
                    try:
                        group_name = group['name']
                        logger.info(f"🔍 فحص المجموعة: {group_name}")
                        
                        group['element'].click()
                        time.sleep(2)
                        
                        messages = self.driver.find_elements(
                            By.XPATH, '//div[contains(@class, "message-")]//a[@href]'
                        )
                        
                        for message in messages[:20]:
                            try:
                                link = message.get_attribute("href")
                                if not link:
                                    continue
                                
                                if self._is_whatsapp_link(link):
                                    whatsapp_links.add(link)
                                    logger.debug(f"📱 رابط واتساب: {link[:50]}...")
                                elif self._is_telegram_link(link):
                                    telegram_links.add(link)
                                    logger.debug(f"📨 رابط تليجرام: {link[:50]}...")
                                
                            except Exception as e:
                                logger.debug(f"⚠️ خطأ في معالجة رابط: {e}")
                                continue
                        
                        self._go_back_to_chat_list()
                        groups_checked += 1
                        time.sleep(1)
                        
                    except Exception as e:
                        logger.error(f"❌ خطأ في فحص المجموعة {group.get('name', 'غير معروف')}: {e}")
                        try:
                            self._go_back_to_chat_list()
                        except:
                            pass
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
    
    def _is_whatsapp_link(self, link: str) -> bool:
        whatsapp_patterns = [
            r'https?://chat\.whatsapp\.com/',
            r'https?://wa\.me/',
            r'https?://whatsapp\.com/',
            r'https?://www\.whatsapp\.com/',
            r'whatsapp://'
        ]
        
        for pattern in whatsapp_patterns:
            if re.search(pattern, link, re.IGNORECASE):
                return True
        return False
    
    def _is_telegram_link(self, link: str) -> bool:
        telegram_patterns = [
            r'https?://t\.me/',
            r'https?://telegram\.me/',
            r'https?://telegram\.dog/',
            r'telegram://'
        ]
        
        for pattern in telegram_patterns:
            if re.search(pattern, link, re.IGNORECASE):
                return True
        return False
    
    def _go_back_to_chat_list(self):
        try:
            self.driver.find_element(By.XPATH, '//div[@data-testid="chatlist"]').click()
            time.sleep(1)
        except:
            self.driver.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)
            time.sleep(1)
    
    def join_group_by_link(self, link: str) -> dict:
        with self.lock:
            if not self.is_logged_in:
                return {'success': False, 'message': 'الحساب غير مرتبط'}
            
            try:
                logger.info(f"🔗 محاولة الانضمام للمجموعة: {link}")
                
                self.driver.get(link)
                time.sleep(5)
                
                join_button = None
                
                button_selectors = [
                    '//a[contains(@href, "/invite/")]',
                    '//div[contains(text(), "Join") or contains(text(), "انضم")]',
                    '//button[contains(text(), "Join") or contains(text(), "انضم")]',
                    '//span[contains(text(), "Join") or contains(text(), "انضم")]',
                    '//div[@role="button"][contains(., "Join") or contains(., "انضم")]'
                ]
                
                for selector in button_selectors:
                    try:
                        join_button = WebDriverWait(self.driver, 5).until(
                            EC.element_to_be_clickable((By.XPATH, selector))
                        )
                        if join_button:
                            break
                    except:
                        continue
                
                if not join_button:
                    try:
                        buttons = self.driver.find_elements(By.XPATH, '//div[@role="button"]')
                        for btn in buttons:
                            if btn.is_displayed() and btn.is_enabled():
                                join_button = btn
                                break
                    except:
                        pass
                
                if join_button:
                    join_button.click()
                    time.sleep(3)
                    
                    try:
                        success_elements = self.driver.find_elements(
                            By.XPATH, '//*[contains(text(), "تم") or contains(text(), "Success") or contains(text(), "Joined")]'
                        )
                        
                        if success_elements:
                            logger.info(f"✅ تم الانضمام بنجاح للمجموعة: {link}")
                            return {'success': True, 'message': 'تم الانضمام بنجاح'}
                        else:
                            logger.info(f"✅ تمت محاولة الانضمام للمجموعة: {link}")
                            return {'success': True, 'message': 'تمت محاولة الانضمام'}
                    
                    except Exception as e:
                        logger.warning(f"⚠️ لم أتمكن من التحقق من نجاح الانضمام: {e}")
                        return {'success': True, 'message': 'تمت المحاولة'}
                
                else:
                    logger.warning(f"⚠️ لم أجد زر الانضمام للرابط: {link}")
                    return {'success': False, 'message': 'لم يتم العثور على زر الانضمام'}
                
            except Exception as e:
                logger.error(f"❌ خطأ في الانضمام للمجموعة {link}: {e}")
                return {'success': False, 'message': f'خطأ: {str(e)}'}
            finally:
                try:
                    self.driver.get("https://web.whatsapp.com")
                    time.sleep(3)
                except:
                    pass
    
    def send_message_to_group(self, group_name: str, message: str) -> bool:
        with self.lock:
            if not self.is_logged_in:
                logger.error(f"❌ الحساب {self.account_name} غير مرتبط")
                return False
            
            try:
                search_box = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="3"]'))
                )
                
                search_box.click()
                actions = ActionChains(self.driver)
                actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).perform()
                actions.send_keys(Keys.DELETE).perform()
                time.sleep(0.5)
                
                search_box.send_keys(group_name)
                time.sleep(2)
                
                try:
                    group_element = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, f'//span[@title="{group_name}"]'))
                    )
                    group_element.click()
                except:
                    results = self.driver.find_elements(
                        By.XPATH, '//div[contains(@data-testid, "cell-frame")]'
                    )
                    found = False
                    for result in results:
                        if group_name in result.text:
                            result.click()
                            found = True
                            break
                    
                    if not found:
                        logger.error(f"❌ لم أجد المجموعة: {group_name}")
                        return False
                
                time.sleep(1)
                
                message_box = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//div[@contenteditable="true"][@data-tab="10"]'))
                )
                
                message_box.click()
                message_box.send_keys(message)
                message_box.send_keys(Keys.ENTER)
                time.sleep(1)
                
                logger.info(f"✅ تم إرسال الرسالة للمجموعة: {group_name}")
                return True
                
            except Exception as e:
                logger.error(f"❌ خطأ في إرسال الرسالة للمجموعة {group_name}: {e}")
                return False
    
    def get_group_list(self) -> list:
        if not self.group_cache:
            self.load_groups()
        return [group['name'] for group in self.group_cache]
    
    def close(self):
        try:
            if self.driver:
                self.driver.quit()
                self.is_logged_in = False
                logger.info(f"✅ تم إغلاق متصفح الحساب: {self.account_name}")
        except Exception as e:
            logger.error(f"❌ خطأ في إغلاق المتصفح: {e}")
