FROM node:18-alpine

WORKDIR /app

# تثبيت dependencies النظام
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# تعيين متغيرات بيئة Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# نسخ ملفات المشروع
COPY package*.json ./
COPY . .

# تثبيت dependencies
RUN npm ci --only=production

# إنشاء مجلدات ضرورية
RUN mkdir -p sessions database logs

# تشغيل التطبيق
CMD ["node", "index.js"]
