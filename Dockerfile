# ============================================
# 🐳 Dockerfile for WhatsApp Telegram Bot
# الإصدار: 3.0.0
# ============================================

# استخدم صورة Node.js الرسمية
FROM node:18-alpine AS builder

# إعداد بيئة العمل
WORKDIR /app

# نسخ ملفات package.json
COPY package*.json ./

# تثبيت التبعيات
RUN npm ci --only=production

# تثبيت حزم البناء إذا لزم الأمر
RUN npm install --save-dev @types/node

# نسخ بقية الملفات
COPY . .

# ============================================
# مرحلة التشغيل
# ============================================
FROM node:18-alpine AS runner

# إعداد بيئة العمل
WORKDIR /app

# نسخ ملفات من مرحلة البناء
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app ./

# إنشاء مستخدم غير root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S whatsappbot -u 1001

# تغيير ملكية الملفات
RUN chown -R whatsappbot:nodejs /app

# تبديل المستخدم
USER whatsappbot

# إنشاء المجلدات الضرورية
RUN mkdir -p /app/sessions /app/logs /app/temp /app/uploads /app/backups

# تعيين الأذونات
RUN chmod -R 755 /app/sessions /app/logs /app/temp /app/uploads /app/backups

# تثبيت حزم إضافية
RUN npm install -g pm2

# تعيين متغيرات البيئة
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# المنفذ المكشوف
EXPOSE 3000

# الأمر الافتراضي
CMD ["pm2-runtime", "start", "index.js", "--name", "whatsapp-bot"]
