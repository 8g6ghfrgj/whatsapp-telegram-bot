require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs-extra');

// ============= الإعدادات الأساسية =============
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;

// إنشاء مجلدات التخزين
const folders = ['data/sessions', 'data/qrcodes'];
folders.forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

// ============= WhatsApp Client (مبسط) =============
let whatsappClient = null;
let isWhatsAppConnected = false;

function initializeWhatsApp() {
    console.log('🔧 Starting WhatsApp Client...');
    
    whatsappClient = new Client({
        puppeteer: {
            executablePath: '/usr/bin/chromium', // ⭐ استخدم Chromium
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            headless: true
        }
    });

    // QR Code Event
    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code received');
        
        try {
            const qrPath = `./data/qrcodes/qr-${Date.now()}.png`;
            await qrcode.toFile(qrPath, qr);
            
            await bot.telegram.sendPhoto(process.env.ADMIN_ID, 
                { source: qrPath },
                {
                    caption: '📱 مسح QR Code للاتصال بـ WhatsApp',
                    parse_mode: 'Markdown'
                }
            );
            
            setTimeout(() => {
                if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
            }, 30000);
            
        } catch (error) {
            console.error('Error sending QR:', error);
        }
    });

    whatsappClient.on('ready', () => {
        console.log('✅ WhatsApp connected successfully!');
        isWhatsAppConnected = true;
        
        bot.telegram.sendMessage(process.env.ADMIN_ID,
            '✅ تم الاتصال بحساب WhatsApp بنجاح!',
            { parse_mode: 'Markdown' }
        ).catch(console.error);
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('❌ WhatsApp disconnected:', reason);
        isWhatsAppConnected = false;
    });

    // Initialize WhatsApp
    whatsappClient.initialize();
}

// ============= قاعدة البيانات البسيطة =============
const db = {
    ads: [],
    groups: [],
    replies: { private: [], groups: [] }
};

// ============= أوامر Telegram Bot =============

// 👋 أمر /start
bot.start(async (ctx) => {
    const welcomeMessage = `
    *👋 مرحباً بك في بوت إدارة WhatsApp!*

    *🔧 الأوامر المتاحة:*
    /start - عرض القائمة
    /connect - ربط WhatsApp
    /status - حالة النظام
    /ads - إدارة الإعلانات
    /groups - إدارة المجموعات

    *📊 الحالة:*
    WhatsApp: ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
    `;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
});

// 🔗 أمر /connect
bot.command('connect', async (ctx) => {
    if (isWhatsAppConnected) {
        return ctx.reply('✅ أنت متصل بالفعل بـ WhatsApp!');
    }
    
    await ctx.reply('🔄 جاري إعداد QR Code للاتصال بـ WhatsApp...');
    
    if (!whatsappClient) {
        initializeWhatsApp();
    } else {
        whatsappClient.initialize();
    }
});

// 📊 أمر /status
bot.command('status', async (ctx) => {
    await ctx.reply(
        `📊 *حالة النظام*\n\n` +
        `WhatsApp: ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}\n` +
        `الإعلانات: ${db.ads.length}\n` +
        `المجموعات: ${db.groups.length}\n` +
        `الوقت: ${new Date().toLocaleString()}`,
        { parse_mode: 'Markdown' }
    );
});

// 📢 أمر /ads
bot.command('ads', async (ctx) => {
    await ctx.reply(
        '*📢 إدارة الإعلانات*\n\n' +
        'الأوامر:\n' +
        '/ads add - إضافة إعلان\n' +
        '/ads list - عرض الإعلانات\n' +
        '/ads delete [رقم] - حذف إعلان',
        { parse_mode: 'Markdown' }
    );
});

// 👥 أمر /groups
bot.command('groups', async (ctx) => {
    await ctx.reply(
        '*👥 إدارة المجموعات*\n\n' +
        'الأوامر:\n' +
        '/groups collect - تجميع المجموعات\n' +
        '/groups list - عرض المجموعات',
        { parse_mode: 'Markdown' }
    );
});

// ============= Express Routes =============
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        service: 'whatsapp-bot',
        whatsapp: isWhatsAppConnected ? 'connected' : 'disconnected',
        time: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
});

// ============= Webhook Setup =============
async function setupBot() {
    try {
        if (process.env.NODE_ENV === 'production') {
            // استخدم Webhook في الإنتاج
            const webhookUrl = `https://whatsapp-bot-exj1.onrender.com/bot${process.env.BOT_TOKEN}`;
            await bot.telegram.setWebhook(webhookUrl);
            app.use(await bot.createWebhook({ domain: 'whatsapp-bot-exj1.onrender.com' }));
            console.log('🌐 Webhook configured');
        } else {
            // التطوير المحلي
            await bot.launch();
            console.log('🤖 Bot running in polling mode');
        }
    } catch (error) {
        console.error('❌ Error setting up bot:', error.message);
    }
}

// ============= بدء الخادم =============
async function startServer() {
    try {
        // بدء Express
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 WHATSAPP TELEGRAM BOT');
            console.log(`📡 Port: ${PORT}`);
            console.log(`⏰ Time: ${new Date().toLocaleString()}`);
            console.log('='.repeat(50));
        });

        // إعداد البوت
        await setupBot();

        // بدء WhatsApp بعد 5 ثواني
        setTimeout(() => {
            console.log('🔧 Initializing WhatsApp Client...');
            initializeWhatsApp();
        }, 5000);

    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}

// ============= بدء التشغيل =============
startServer();
