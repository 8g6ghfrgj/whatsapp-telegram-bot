# ============================================
# 🐳 Dockerfile - WhatsApp Telegram Bot
# الإصدار: 2.0.0 - Render Optimized
# ============================================

# ============================================
# 📦 المرحلة الأولى: بناء التطبيق
# ============================================
FROM node:18-alpine AS builder

# تحديث النظام وتثبيت أدوات البناء
RUN apk update && apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    bash \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# تعيين البيئة الافتراضية
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    PORT=3000

# إنشاء مجلد التطبيق
WORKDIR /app

# نسخ ملف package.json و package-lock.json
COPY package*.json ./

# تثبيت المكتبات الضرورية للبناء
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================
# 📦 المرحلة الثانية: التطبيق النهائي
# ============================================
FROM node:18-alpine AS runner

# تثبيت متصفح Chromium الضروري لـ WhatsApp
RUN apk update && apk upgrade && \
    apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    # مكتبات الوسائط
    ffmpeg \
    # أدوات النظام
    curl \
    bash \
    tzdata \
    # أدوات التطوير (للتشخيص)
    vim \
    htop \
    && rm -rf /var/cache/apk/*

# تعيين المتغيرات البيئية
ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    # إعدادات Chromium
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    DISABLE_SETUID_SANDBOX=1 \
    NO_SANDBOX=1 \
    # إعدادات التطبيق
    MAX_OLD_SPACE_SIZE=4096 \
    NODE_OPTIONS="--max-old-space-size=4096"

# تعيين المنطقة الزمنية إلى الرياض
RUN cp /usr/share/zoneinfo/Asia/Riyadh /etc/localtime && \
    echo "Asia/Riyadh" > /etc/timezone

# إنشاء مستخدم غير root لزيادة الأمان
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# إنشاء المجلدات الضرورية
RUN mkdir -p /app /app/sessions /app/database /app/logs /app/temp && \
    chown -R nodejs:nodejs /app

# تبديل إلى المستخدم nodejs
USER nodejs

# تعيين مجلد العمل
WORKDIR /app

# نسخ الملفات من مرحلة البناء
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# ============================================
# 🔧 إعدادات إضافية للتطبيق
# ============================================

# إنشاء ملفات تهيئة افتراضية
RUN mkdir -p /app/config && \
    echo "# ملف التهيئة" > /app/config/default.json

# إعداد أذونات المجلدات
RUN chmod 755 /app && \
    chmod 755 /app/sessions && \
    chmod 755 /app/database && \
    chmod 755 /app/logs && \
    chmod 755 /app/temp

# ============================================
# 📊 مراقبة الصحة (Health Checks)
# ============================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# ============================================
# 📁 التعامل مع المنافذ
# ============================================
EXPOSE ${PORT}

# ============================================
# 🚀 أوامر البدء
# ============================================

# الأمر الرئيسي للبدء
CMD ["node", "index.js"]

# ============================================
# 📝 تسميات Docker
# ============================================
LABEL maintainer="Your Name <your.email@example.com>" \
      version="2.0.0" \
      description="WhatsApp Telegram Bot for Render.com" \
      org.label-schema.name="whatsapp-telegram-bot" \
      org.label-schema.description="مشروع WhatsApp Telegram Bot متعدد الميزات" \
      org.label-schema.url="https://github.com/yourusername/whatsapp-telegram-bot" \
      org.label-schema.vcs-url="https://github.com/yourusername/whatsapp-telegram-bot.git" \
      org.label-schema.vendor="Your Company" \
      org.label-schema.schema-version="1.0"
