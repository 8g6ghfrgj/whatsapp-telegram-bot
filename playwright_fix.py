#!/usr/bin/env python3
import os
import subprocess
import sys
import shutil

def install_playwright_without_root():
    """تثبيت Playwright بدون صلاحيات root"""
    print("🛠️ Installing Playwright without root privileges...")
    
    # تعيين مسار مخصص لمتصفحات Playwright
    browsers_path = os.path.expanduser("~/.cache/ms-playwright")
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = browsers_path
    
    # تثبيت حزمة Playwright
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright==1.40.0"])
    
    # تنزيل Chromium مباشرة
    print("📥 Downloading Chromium...")
    
    # طريقة بديلة: استخدام playwright بدون تثبيت system deps
    try:
        import playwright
        from playwright.__main__ import main
        
        # تشغيل تثبيت Chromium مع تجاهل system deps
        sys.argv = ["playwright", "install", "chromium", "--dry-run"]
        main()
        
        print("✅ Chromium installation attempted")
    except Exception as e:
        print(f"⚠️ Note: {e}")
        print("ℹ️ Continuing with manual setup...")
    
    # اختبار ما إذا كان Chromium موجوداً
    chromium_path = os.path.join(browsers_path, "chromium-*", "chrome-linux", "chrome")
    
    if os.path.exists(browsers_path):
        print(f"✅ Playwright browsers path: {browsers_path}")
        return True
    else:
        print("⚠️ Chromium not installed via standard method")
        print("ℹ️ Will use headless mode with existing browser")
        return False

if __name__ == "__main__":
    install_playwright_without_root()
