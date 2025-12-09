FROM python:3.11-slim

# تثبيت متطلبات النظام
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    chromium \
    chromium-driver \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# إنشاء مجلد التطبيق
WORKDIR /app

# نسخ المتطلبات
COPY requirements.txt .

# تثبيت متطلبات Python
RUN pip install --no-cache-dir -r requirements.txt

# نسخ الكود
COPY . .

# تهيئة قاعدة البيانات
RUN python -c "from database import WhatsAppDatabase; WhatsAppDatabase()"

# تشغيل البوت
CMD ["python", "main.py"]
# Create app dir
WORKDIR /app

# Copy requirements and code
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

# Make start script executable
RUN chmod +x /app/start.sh

# Environment variables recommended
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/lib/chromium/chromedriver

# Create session dir (persist via Render disk)
RUN mkdir -p /tmp/whatsapp_session
VOLUME ["/tmp/whatsapp_session"]

# Expose nothing (bot uses polling)
CMD ["/app/start.sh"]
