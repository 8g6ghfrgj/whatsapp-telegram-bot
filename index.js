require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs-extra');

// ============= الإعدادات الأساسية =============
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;

// إنشاء مجلدات التخزين
['data/sessions', 'data/media', 'data/qrcodes'].forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// ============= WhatsApp Client =============
const whatsappClient = new Client({
    authStrategy: new LocalAuth({ clientId: "render-client" }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// ============= قاعدة البيانات =============
const db = { ads: [], groups: [], replies: { private: [], groups: [] } };

// ============= لوحة المفاتيح =============
function getMainKeyboard() {
    return Markup.keyboard([
        ['📢 إدارة الإعلانات', '👥 إدارة المجموعات'],
        ['➕ الانضمام للقروبات', '📊 حالة النظام']
    ]).resize();
}

// ============= أوامر البوت =============
bot.start(async (ctx) => {
    await ctx.reply('👋 مرحباً! أنا بوت إدارة WhatsApp', getMainKeyboard());
});

// ============= WhatsApp Events =============
whatsappClient.on('qr', async (qr) => {
    console.log('📱 QR Code received');
    const qrPath = `./data/qrcodes/qr-${Date.now()}.png`;
    await qrcode.toFile(qrPath, qr);
    
    try {
        await bot.telegram.sendPhoto(process.env.ADMIN_ID, 
            { source: qrPath },
            { caption: '📱 مسح QR Code للاتصال' }
        );
    } catch (error) {
        console.error('Error sending QR:', error);
    }
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp connected!');
});

// ============= Express Routes =============
app.get('/', (req, res) => {
    res.json({ status: 'success', service: 'whatsapp-bot' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

// ============= بدء النظام =============
async function startServer() {
    try {
        // === الحل: Webhook للإنتاج ===
        if (process.env.NODE_ENV === 'production') {
            const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || 'https://whatsapp-bot-exj1.onrender.com';
            
            // إعداد Webhook
            await bot.telegram.setWebhook(`${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);
            
            // معالجة Webhook
            app.use(await bot.createWebhook({ domain: WEBHOOK_URL }));
            
            // بدء الخادم
            app.listen(PORT, () => {
                console.log('='.repeat(50));
                console.log('🚀 WhatsApp Bot (Webhook Mode)');
                console.log(`📡 Port: ${PORT}`);
                console.log(`🌐 Webhook: ${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);
                console.log('='.repeat(50));
                
                // بدء WhatsApp بعد 3 ثواني
                setTimeout(() => {
                    console.log('🔧 Starting WhatsApp Client...');
                    whatsappClient.initialize();
                }, 3000);
            });
            
        } else {
            // التطوير المحلي
            app.listen(PORT, () => {
                console.log('🚀 Server started (Local Mode)');
            });
            
            await bot.launch();
            whatsappClient.initialize();
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// ============= بدء التشغيل =============
startServer();
