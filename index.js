require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs-extra');

// ============= إعداد التطبيق =============
const app = express();
const PORT = process.env.PORT || 3000;

// ============= إنشاء مجلدات التخزين =============
['data/sessions', 'data/media', 'data/qrcodes'].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// ============= تهيئة WhatsApp Client =============
const whatsappClient = new Client({
    authStrategy: new LocalAuth({
        clientId: "render-whatsapp-client",
        dataPath: "./data/sessions"
    }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// ============= تهيئة Telegram Bot =============
const bot = new Telegraf(process.env.BOT_TOKEN);

// ============= متغيرات النظام =============
let isWhatsAppConnected = false;
let currentQRCode = null;

// ============= قاعدة البيانات البسيطة =============
const db = {
    ads: [],
    groups: [],
    links: { whatsapp: [], telegram: [], other: [] },
    replies: { private: [], groups: [] },
    settings: { autoPostDelay: 5, repliesEnabled: true }
};

// ============= لوحة المفاتيح =============
function getMainKeyboard() {
    return Markup.keyboard([
        ['📢 إدارة الإعلانات', '👥 إدارة المجموعات'],
        ['➕ الانضمام للقروبات', '🔄 النشر التلقائي'],
        ['💬 إدارة الردود', '📊 حالة النظام']
    ]).resize();
}

// ============= WhatsApp QR Handler =============
whatsappClient.on('qr', async (qr) => {
    console.log('📱 QR Code received');
    
    const qrPath = `./data/qrcodes/qr-${Date.now()}.png`;
    await qrcode.toFile(qrPath, qr);
    
    try {
        await bot.telegram.sendPhoto(process.env.ADMIN_ID, 
            { source: qrPath },
            {
                caption: '📱 *مسح QR Code للاتصال بـ WhatsApp*\n\n' +
                         '1. افتح WhatsApp\n' +
                         '2. ☰ → الأجهزة المرتبطة\n' +
                         '3. ربط جهاز\n' +
                         '4. مسح هذا الكود\n\n' +
                         '⏰ صالح لمدة 30 ثانية',
                parse_mode: 'Markdown'
            }
        );
        
        currentQRCode = qrPath;
        setTimeout(() => {
            if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
        }, 30000);
        
    } catch (error) {
        console.error('Error sending QR:', error);
    }
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp connected!');
    isWhatsAppConnected = true;
    
    bot.telegram.sendMessage(process.env.ADMIN_ID,
        '✅ *تم الاتصال بحساب WhatsApp بنجاح!*',
        { parse_mode: 'Markdown' }
    );
});

// ============= Telegram Bot Commands =============
bot.start(async (ctx) => {
    const welcome = `
    👋 *مرحباً بك في بوت إدارة WhatsApp!*
    
    🔧 *الميزات المتاحة:*
    📢 إدارة الإعلانات
    👥 إدارة المجموعات
    ➕ الانضمام للقروبات
    🔄 النشر التلقائي
    💬 إدارة الردود
    
    📊 *الحالة:* ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
    `;
    
    await ctx.reply(welcome, {
        parse_mode: 'Markdown',
        ...getMainKeyboard()
    });
    
    if (!isWhatsAppConnected) {
        whatsappClient.initialize();
    }
});

// إدارة الإعلانات
bot.hears('📢 إدارة الإعلانات', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ إضافة إعلان', 'add_ad')],
        [Markup.button.callback('📋 عرض الإعلانات', 'list_ads')],
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')]
    ]);
    
    await ctx.reply('📢 *قسم إدارة الإعلانات*', {
        parse_mode: 'Markdown',
        ...keyboard
    });
});

// إدارة المجموعات
bot.hears('👥 إدارة المجموعات', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔗 تجميع الروابط', 'collect_links')],
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')]
    ]);
    
    await ctx.reply('👥 *قسم إدارة المجموعات*', {
        parse_mode: 'Markdown',
        ...keyboard
    });
});

// حالة النظام
bot.hears('📊 حالة النظام', async (ctx) => {
    const status = `
    📊 *حالة النظام*
    
    🔗 WhatsApp: ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
    📢 الإعلانات: ${db.ads.length}
    👥 المجموعات: ${db.groups.length}
    💬 الردود: ${db.replies.private.length + db.replies.groups.length}
    
    🚦 *جميع الأنظمة جاهزة*
    `;
    
    await ctx.reply(status, { parse_mode: 'Markdown' });
});

// ============= Express Routes =============
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        service: 'whatsapp-telegram-bot',
        whatsapp: isWhatsAppConnected ? 'connected' : 'disconnected',
        time: new Date().toISOString(),
        endpoints: ['/health', '/qr', '/status']
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        whatsapp: isWhatsAppConnected
    });
});

app.get('/status', (req, res) => {
    res.json({
        whatsapp: isWhatsAppConnected,
        telegram: 'running',
        ads_count: db.ads.length,
        groups_count: db.groups.length
    });
});

// ============= بدء التشغيل =============
async function startServer() {
    try {
        // بدء Express Server
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 WhatsApp Telegram Bot Started');
            console.log(`📡 Port: ${PORT}`);
            console.log(`⏰ ${new Date().toLocaleString()}`);
            console.log('='.repeat(50));
        });
        
        // بدء Telegram Bot
        await bot.launch();
        console.log('🤖 Telegram Bot started successfully');
        
        // بدء WhatsApp Client
        setTimeout(() => {
            console.log('🔧 Initializing WhatsApp Client...');
            whatsappClient.initialize();
        }, 3000);
        
        console.log('✅ All systems are running!');
        
    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}

// ============= إدارة الإغلاق =============
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stop('SIGINT');
    whatsappClient.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stop('SIGTERM');
    whatsappClient.destroy();
    process.exit(0);
});

// ============= بدء النظام =============
startServer();
