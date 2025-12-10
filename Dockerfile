FROM python:3.11-slim

# تثبيت المتطلبات النظامية
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY requirements.txt .
COPY . .

# تثبيت متطلبات Python
RUN pip install --no-cache-dir -r requirements.txt

# إنشاء مجلدات ضرورية
RUN mkdir -p session database logs

# متغيرات البيئة
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99

# تشغيل البوت
CMD ["python", "main.py"]
