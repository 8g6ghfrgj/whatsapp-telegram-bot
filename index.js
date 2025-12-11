// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot النسخة الشاملة
// يتضمن جميع الميزات المطلوبة
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Sequelize, Op } = require('sequelize');

// ============================================
// 1. إعداد Express للويب سيرفيس
// ============================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// صفحة الرئيسية
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Bot</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 {
                    margin-bottom: 30px;
                }
                .status {
                    background: rgba(0, 255, 0, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Telegram Bot</h1>
                <div class="status">
                    ✅ البوت يعمل بنجاح
                </div>
                <p>وقت التشغيل: ${Math.floor(process.uptime())} ثانية</p>
                <p>المنفذ: ${PORT}</p>
            </div>
        </body>
        </html>
    `);
});

// صفحة الصحة للـ Render
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// 2. إعداد قاعدة البيانات
// ============================================
console.log('🚀 بدء تشغيل WhatsApp Bot...');

const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite://./database/bot.db', {
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// نموذج المشرفين
const Admin = sequelize.define('Admin', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    telegramId: { type: Sequelize.STRING, unique: true, allowNull: false },
    username: Sequelize.STRING,
    firstName: Sequelize.STRING,
    lastName: Sequelize.STRING,
    passwordHash: Sequelize.STRING,
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    permissions: { type: Sequelize.JSON, defaultValue: ['basic'] },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج جلسات واتساب
const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { type: Sequelize.STRING, primaryKey: true },
    sessionId: { type: Sequelize.STRING, unique: true },
    phoneNumber: { type: Sequelize.STRING, allowNull: false },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    sessionData: Sequelize.TEXT,
    status: { 
        type: Sequelize.ENUM('pending', 'awaiting_qr', 'connected', 'disconnected', 'error'),
        defaultValue: 'pending'
    },
    qrCode: Sequelize.TEXT,
    lastActivity: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    connectedAt: Sequelize.DATE,
    groupsCount: { type: Sequelize.INTEGER, defaultValue: 0 },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الروابط المجمعة
const CollectedLink = sequelize.define('CollectedLink', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: Sequelize.STRING, unique: true, allowNull: false },
    type: { 
        type: Sequelize.ENUM('whatsapp_group', 'whatsapp_invite', 'telegram', 'website', 'other'),
        defaultValue: 'other'
    },
    title: Sequelize.STRING,
    description: Sequelize.TEXT,
    source: Sequelize.STRING,
    sessionId: Sequelize.STRING,
    collectedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الإعلانات
const Advertisement = sequelize.define('Advertisement', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    type: { 
        type: Sequelize.ENUM('text', 'image', 'video', 'contact', 'document'),
        defaultValue: 'text'
    },
    content: { type: Sequelize.TEXT, allowNull: false },
    fileId: Sequelize.STRING,
    caption: Sequelize.TEXT,
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    stats: { 
        type: Sequelize.JSON, 
        defaultValue: { 
            sent: 0, 
            failed: 0,
            groups: [],
            lastSent: null
        }
    },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج النشر التلقائي
const AutoPost = sequelize.define('AutoPost', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    sessionId: { type: Sequelize.STRING, allowNull: false },
    adId: { type: Sequelize.INTEGER, allowNull: false },
    status: { 
        type: Sequelize.ENUM('active', 'paused', 'completed', 'error'),
        defaultValue: 'active'
    },
    interval: { type: Sequelize.INTEGER, defaultValue: 1 },
    lastPostAt: Sequelize.DATE,
    nextPostAt: Sequelize.DATE,
    stats: { 
        type: Sequelize.JSON, 
        defaultValue: { 
            totalGroups: 0,
            postedGroups: 0,
            failedGroups: [],
            cycle: 0
        }
    },
    settings: { type: Sequelize.JSON, defaultValue: {} },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الردود التلقائية
const AutoReply = sequelize.define('AutoReply', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    sessionId: Sequelize.STRING,
    name: { type: Sequelize.STRING, allowNull: false },
    triggerType: { 
        type: Sequelize.ENUM('private', 'group', 'both'),
        defaultValue: 'both'
    },
    trigger: { type: Sequelize.TEXT, allowNull: false },
    response: { type: Sequelize.TEXT, allowNull: false },
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    matchType: { 
        type: Sequelize.ENUM('exact', 'contains', 'regex'),
        defaultValue: 'contains'
    },
    stats: { type: Sequelize.JSON, defaultValue: { triggered: 0 } },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الانضمام التلقائي
const AutoJoin = sequelize.define('AutoJoin', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    sessionId: { type: Sequelize.STRING, allowNull: false },
    status: { 
        type: Sequelize.ENUM('active', 'paused', 'completed'),
        defaultValue: 'active'
    },
    lastJoinAt: Sequelize.DATE,
    stats: { 
        type: Sequelize.JSON, 
        defaultValue: { 
            totalLinks: 0,
            joined: 0,
            failed: 0,
            lastLinks: []
        }
    },
    filters: { type: Sequelize.JSON, defaultValue: {} },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// ============================================
// 3. مكتبات إضافية
// ============================================
const TelegramBot = require('node-telegram-bot-api');
const { Client: WhatsAppClient, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

// ============================================
// 4. المتغيرات العامة
// ============================================
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true,
    request: {
        timeout: 60000
    }
});

// تخزين الجلسات النشطة
const whatsappClients = new Map();
const userStates = new Map();
const activeAutoPosts = new Map();
const activeAutoJoins = new Map();

// ============================================
// 5. دوال المساعدة
// ============================================
async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ قاعدة البيانات متصلة');
        
        await sequelize.sync({ alter: true });
        console.log('✅ تم مزامنة الجداول');
        
        // إنشاء المشرفين من متغير البيئة
        const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
        for (const telegramId of adminIds) {
            const [admin] = await Admin.findOrCreate({
                where: { telegramId: telegramId.trim() },
                defaults: {
                    username: `admin_${telegramId}`,
                    permissions: ['admin', 'manage_sessions', 'manage_ads'],
                    isActive: true
                }
            });
        }
        
        return true;
    } catch (error) {
        console.error('❌ خطأ في قاعدة البيانات:', error);
        return false;
    }
}

async function createWhatsAppSession(phoneNumber, adminId) {
    const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
    
    const session = await WhatsAppSession.create({
        id: sessionId,
        sessionId: sessionId,
        phoneNumber: phoneNumber,
        adminId: adminId,
        status: 'awaiting_qr'
    });
    
    const client = new WhatsAppClient({
        session: sessionId,
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        qrTimeout: 60000
    });
    
    // تخزين العميل
    whatsappClients.set(sessionId, client);
    
    // عند ظهور QR Code
    client.on('qr', async (qr) => {
        console.log(`📱 QR Code for ${phoneNumber}`);
        
        // تحديث الجلسة في قاعدة البيانات
        await session.update({
            qrCode: qr,
            status: 'awaiting_qr'
        });
        
        // إرسال QR للمشرف
        await sendQRToAdmin(adminId, qr, sessionId, phoneNumber);
    });
    
    // عند الاتصال
    client.on('ready', async () => {
        console.log(`✅ WhatsApp connected: ${phoneNumber}`);
        
        await session.update({
            status: 'connected',
            connectedAt: new Date()
        });
        
        // إعلام المشرف
        await bot.sendMessage(
            await getTelegramChatId(adminId),
            `✅ *تم ربط حساب WhatsApp بنجاح!*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
            `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `يمكنك الآن استخدام جميع الميزات.`,
            { parse_mode: 'Markdown' }
        );
        
        // بدء تجميع المجموعات
        setTimeout(() => collectGroups(client, sessionId), 5000);
    });
    
    // عند استقبال رسالة
    client.on('message', async (message) => {
        await handleWhatsAppMessage(message, sessionId);
    });
    
    // بدء الجلسة
    await client.initialize();
    
    return sessionId;
}

async function sendQRToAdmin(adminId, qr, sessionId, phoneNumber) {
    const chatId = await getTelegramChatId(adminId);
    
    // توليد QR Code نصي
    let qrText = '📱 *QR Code للربط*\n\n';
    qrText += `الرقم: ${phoneNumber}\n`;
    qrText += `المعرف: ${sessionId.substring(0, 8)}\n\n`;
    qrText += '*تعليمات الربط:*\n`;
    qrText += '1. افتح WhatsApp على هاتفك\n';
    qrText += '2. اضغط على النقاط الثلاث ⋮\n';
    qrText += '3. اختر "الأجهزة المرتبطة"\n';
    qrText += '4. اختر "ربط جهاز"\n';
    qrText += '5. مسح QR Code أدناه\n\n';
    qrText += '⏱️ هذا QR صالح لمدة 60 ثانية\n';
    qrText += '🔄 سيتم تجديده تلقائياً';
    
    await bot.sendMessage(chatId, qrText, { parse_mode: 'Markdown' });
    
    // إرسال QR Code كصورة (مؤقتاً كنص)
    await bot.sendMessage(chatId, 
        `🔗 *رابط QR Code:*\n\`${qr.substring(0, 50)}...\``,
        { parse_mode: 'Markdown' }
    );
}

async function getTelegramChatId(adminId) {
    const admin = await Admin.findOne({ where: { id: adminId } });
    return admin.telegramId;
}

async function collectGroups(client, sessionId) {
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            await session.update({
                groupsCount: groups.length
            });
        }
        
        console.log(`📊 جمع ${groups.length} مجموعة للجلسة ${sessionId}`);
    } catch (error) {
        console.error('خطأ في تجميع المجموعات:', error);
    }
}

async function handleWhatsAppMessage(message, sessionId) {
    try {
        // تجميع الروابط من الرسالة
        const links = extractLinks(message.body);
        
        for (const link of links) {
            await saveLink(link, message, sessionId);
        }
        
        // التحقق من الردود التلقائية
        await checkAutoReplies(message, sessionId);
        
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
    }
}

function extractLinks(text) {
    if (!text) return [];
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    
    return matches.map(link => ({
        url: link,
        type: classifyLink(link)
    }));
}

function classifyLink(url) {
    if (url.includes('chat.whatsapp.com')) return 'whatsapp_group';
    if (url.includes('whatsapp.com')) return 'whatsapp_invite';
    if (url.includes('t.me') || url.includes('telegram.me')) return 'telegram';
    if (url.includes('http')) return 'website';
    return 'other';
}

async function saveLink(linkData, message, sessionId) {
    try {
        const existing = await CollectedLink.findOne({ 
            where: { url: linkData.url } 
        });
        
        if (existing) return;
        
        await CollectedLink.create({
            url: linkData.url,
            type: linkData.type,
            title: `رابط من ${message.from || 'مجهول'}`,
            description: message.body?.substring(0, 100),
            source: message.from,
            sessionId: sessionId,
            collectedAt: new Date()
        });
        
        console.log(`✅ رابط محفوظ: ${linkData.url}`);
    } catch (error) {
        console.error('خطأ في حفظ الرابط:', error);
    }
}

async function checkAutoReplies(message, sessionId) {
    try {
        const autoReplies = await AutoReply.findAll({
            where: { 
                sessionId: sessionId,
                isActive: true
            }
        });
        
        for (const reply of autoReplies) {
            if (shouldTriggerReply(message, reply)) {
                await sendAutoReply(message, reply);
                
                // تحديث الإحصائيات
                await reply.update({
                    stats: {
                        triggered: (reply.stats?.triggered || 0) + 1
                    }
                });
            }
        }
    } catch (error) {
        console.error('خطأ في الرد التلقائي:', error);
    }
}

function shouldTriggerReply(message, reply) {
    const text = message.body || '';
    
    // التحقق من نوع المحادثة
    if (reply.triggerType === 'private' && message.from.includes('@g.us')) {
        return false; // مجموعة ولكن الرد خاص
    }
    
    if (reply.triggerType === 'group' && !message.from.includes('@g.us')) {
        return false; // خاصة ولكن الرد للمجموعات
    }
    
    // التحقق من المحتوى
    switch (reply.matchType) {
        case 'exact':
            return text.trim() === reply.trigger;
        case 'contains':
            return text.includes(reply.trigger);
        case 'regex':
            try {
                const regex = new RegExp(reply.trigger, 'i');
                return regex.test(text);
            } catch {
                return false;
            }
        default:
            return false;
    }
}

async function sendAutoReply(message, reply) {
    try {
        const client = whatsappClients.get(reply.sessionId);
        if (!client) return;
        
        await client.sendMessage(message.from, reply.response);
        console.log(`✅ تم إرسال رد تلقائي: ${reply.name}`);
    } catch (error) {
        console.error('خطأ في إرسال الرد التلقائي:', error);
    }
}

// ============================================
// 6. أوامر تليجرام الرئيسية
// ============================================
bot.setMyCommands([
    { command: 'start', description: 'بدء البوت' },
    { command: 'sessions', description: 'إدارة الجلسات' },
    { command: 'addsession', description: 'إضافة جلسة جديدة' },
    { command: 'links', description: 'عرض الروابط' },
    { command: 'ads', description: 'إدارة الإعلانات' },
    { command: 'addad', description: 'إضافة إعلان' },
    { command: 'autopost', description: 'النشر التلقائي' },
    { command: 'autojoin', description: 'الانضمام التلقائي' },
    { command: 'autoreply', description: 'الردود التلقائية' },
    { command: 'addadmin', description: 'إضافة مشرف' },
    { command: 'stats', description: 'الإحصائيات' },
    { command: 'help', description: 'المساعدة' }
]);

// أمر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        
        if (!admin) {
            return bot.sendMessage(chatId, 
                '❌ أنت لست مشرفاً.\n' +
                'يرجى التواصل مع المشرف لإضافتك.'
            );
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 إدارة الجلسات', callback_data: 'menu_sessions' },
                    { text: '🔗 الروابط', callback_data: 'menu_links' }
                ],
                [
                    { text: '📢 الإعلانات', callback_data: 'menu_ads' },
                    { text: '🔄 النشر التلقائي', callback_data: 'menu_autopost' }
                ],
                [
                    { text: '➕ الانضمام التلقائي', callback_data: 'menu_autojoin' },
                    { text: '🤖 الردود التلقائية', callback_data: 'menu_autoreply' }
                ],
                [
                    { text: '👥 إدارة المشرفين', callback_data: 'menu_admins' },
                    { text: '📊 الإحصائيات', callback_data: 'menu_stats' }
                ]
            ]
        };
        
        const welcomeMsg = `
🤖 *مرحباً ${admin.firstName || 'مشرف'}!*

*WhatsApp Bot - الإصدار المتقدم*

*الميزات المتاحة:*
• 📱 ربط حسابات WhatsApp كجهاز مصاحب
• 🔗 تجميع الروابط تلقائياً
• 📢 نظام إعلانات متكامل
• 🔄 نشر تلقائي في المجموعات
• ➕ انضمام تلقائي للمجموعات
• 🤖 ردود تلقائية ذكية
• 👥 إدارة مشرفين متعددة

*💼 حالتك:* ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}
        `;
        
        await bot.sendMessage(chatId, welcomeMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
    } catch (error) {
        console.error('خطأ في /start:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ');
    }
});

// أمر إضافة جلسة
bot.onText(/\/addsession/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    const admin = await Admin.findOne({ where: { telegramId } });
    if (!admin) return;
    
    // حفظ حالة المستخدم
    userStates.set(telegramId, {
        state: 'awaiting_phone',
        data: { adminId: admin.id }
    });
    
    await bot.sendMessage(chatId,
        `📱 *إضافة جلسة WhatsApp جديدة*\n\n` +
        `أرسل لي رقم الهاتف مع رمز الدولة:\n` +
        `مثال: \`+966501234567\``,
        { parse_mode: 'Markdown' }
    );
});

// أمر عرض الروابط
bot.onText(/\/links/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    const admin = await Admin.findOne({ where: { telegramId } });
    if (!admin) return;
    
    const sessions = await WhatsAppSession.findAll({ 
        where: { adminId: admin.id } 
    });
    
    const sessionIds = sessions.map(s => s.id);
    
    const whatsappLinks = await CollectedLink.count({ 
        where: { 
            type: ['whatsapp_group', 'whatsapp_invite'],
            sessionId: sessionIds
        }
    });
    
    const telegramLinks = await CollectedLink.count({ 
        where: { 
            type: 'telegram',
            sessionId: sessionIds
        }
    });
    
    const otherLinks = await CollectedLink.count({ 
        where: { 
            type: ['website', 'other'],
            sessionId: sessionIds
        }
    });
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: `📱 واتساب (${whatsappLinks})`, callback_data: 'links_whatsapp' },
                { text: `📢 تليجرام (${telegramLinks})`, callback_data: 'links_telegram' }
            ],
            [
                { text: `🌐 روابط أخرى (${otherLinks})`, callback_data: 'links_other' },
                { text: '📋 جميع الروابط', callback_data: 'links_all' }
            ],
            [
                { text: '🔄 تحديث', callback_data: 'links_refresh' },
                { text: '🗑️ مسح الكل', callback_data: 'links_clear' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId,
        `🔗 *الروابط المجمعة*\n\n` +
        `📱 روابط واتساب: ${whatsappLinks}\n` +
        `📢 روابط تليجرام: ${telegramLinks}\n` +
        `🌐 روابط أخرى: ${otherLinks}\n\n` +
        `اختر نوع الروابط لعرضها:`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }
    );
});

// ============================================
// 7. معالجة الرسائل النصية
// ============================================
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const userState = userStates.get(telegramId);
    
    if (!userState || !msg.text) return;
    
    if (userState.state === 'awaiting_phone') {
        await handlePhoneInput(chatId, telegramId, msg.text, userState.data);
    }
});

async function handlePhoneInput(chatId, telegramId, phoneNumber, data) {
    // التحقق من صحة الرقم
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
        await bot.sendMessage(chatId,
            '❌ رقم غير صالح!\n' +
            'يجب أن يبدأ بـ + ويتبعه رمز الدولة ثم الرقم.\n' +
            'مثال: +966501234567\n\n' +
            'أرسل الرقم مرة أخرى:'
        );
        return;
    }
    
    await bot.sendMessage(chatId, `⏳ جاري إنشاء جلسة للرقم: ${phoneNumber}...`);
    
    try {
        const sessionId = await createWhatsAppSession(phoneNumber, data.adminId);
        
        await bot.sendMessage(chatId,
            `✅ *تم إنشاء الجلسة*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🆔 المعرف: ${sessionId}\n\n` +
            `⏳ انتظر QR Code للربط...`,
            { parse_mode: 'Markdown' }
        );
        
        // مسح حالة المستخدم
        userStates.delete(telegramId);
        
    } catch (error) {
        console.error('خطأ في إنشاء الجلسة:', error);
        await bot.sendMessage(chatId, '❌ فشل إنشاء الجلسة: ' + error.message);
        userStates.delete(telegramId);
    }
}

// ============================================
// 8. معالجة الأزرار التفاعلية
// ============================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;
    
    try {
        await bot.answerCallbackQuery(query.id);
        
        // تقسيم البيانات
        const [action, ...params] = data.split('_');
        
        switch (action) {
            case 'menu':
                await handleMenu(chatId, userId, params[0]);
                break;
            case 'links':
                await handleLinks(chatId, userId, params[0]);
                break;
            case 'session':
                await handleSession(chatId, userId, params);
                break;
            case 'ad':
                await handleAd(chatId, userId, params);
                break;
            default:
                console.log('زر غير معروف:', data);
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الزر:', error);
        await bot.answerCallbackQuery(query.id, {
            text: 'حدث خطأ',
            show_alert: true
        });
    }
});

async function handleMenu(chatId, userId, menu) {
    const admin = await Admin.findOne({ where: { telegramId: userId } });
    if (!admin) return;
    
    switch (menu) {
        case 'sessions':
            await showSessionsMenu(chatId, admin.id);
            break;
        case 'links':
            await showLinksMenu(chatId, admin.id);
            break;
        case 'ads':
            await showAdsMenu(chatId, admin.id);
            break;
        case 'autopost':
            await showAutoPostMenu(chatId, admin.id);
            break;
        case 'autojoin':
            await showAutoJoinMenu(chatId, admin.id);
            break;
        case 'autoreply':
            await showAutoReplyMenu(chatId, admin.id);
            break;
        case 'admins':
            await showAdminsMenu(chatId, admin.id);
            break;
        case 'stats':
            await showStatsMenu(chatId, admin.id);
            break;
    }
}

async function showSessionsMenu(chatId, adminId) {
    const sessions = await WhatsAppSession.findAll({
        where: { adminId },
        order: [['createdAt', 'DESC']]
    });
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📱➕ إضافة جلسة', callback_data: 'add_session' },
                { text: '🔄 تحديث', callback_data: 'refresh_sessions' }
            ]
        ]
    };
    
    // إضافة أزرار للجلسات
    sessions.forEach(session => {
        const statusEmoji = session.status === 'connected' ? '✅' : 
                          session.status === 'awaiting_qr' ? '📱' : '❌';
        
        keyboard.inline_keyboard.push([
            { 
                text: `${statusEmoji} ${session.phoneNumber}`, 
                callback_data: `session_info_${session.id}`
            }
        ]);
    });
    
    keyboard.inline_keyboard.push([
        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
    ]);
    
    let message = `📱 *جلسات WhatsApp*\n\n`;
    
    if (sessions.length === 0) {
        message += 'لا توجد جلسات.\nانقر على "إضافة جلسة" لبدء الربط.';
    } else {
        sessions.forEach(session => {
            message += `${session.status === 'connected' ? '✅' : '📱'} ${session.phoneNumber} - ${session.status}\n`;
        });
    }
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// ============================================
// 9. نظام النشر التلقائي
// ============================================
async function startAutoPost(adminId, sessionId, adId, interval = 1) {
    const key = `${adminId}_${sessionId}_${adId}`;
    
    if (activeAutoPosts.has(key)) {
        return false; // مسبقاً نشط
    }
    
    const autoPost = await AutoPost.create({
        adminId,
        sessionId,
        adId,
        interval,
        status: 'active',
        nextPostAt: new Date(Date.now() + interval * 1000)
    });
    
    // بدء النشر
    const timer = setInterval(async () => {
        await processAutoPost(autoPost);
    }, interval * 1000);
    
    activeAutoPosts.set(key, {
        timer,
        autoPostId: autoPost.id
    });
    
    return true;
}

async function processAutoPost(autoPost) {
    try {
        const client = whatsappClients.get(autoPost.sessionId);
        if (!client) {
            await autoPost.update({ status: 'error' });
            return;
        }
        
        const ad = await Advertisement.findByPk(autoPost.adId);
        if (!ad || !ad.isActive) {
            await autoPost.update({ status: 'paused' });
            return;
        }
        
        // الحصول على المجموعات
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        
        // إرسال الإعلان للمجموعات
        for (const group of groups) {
            try {
                await sendAdvertisement(client, group.id._serialized, ad);
                
                // تحديث الإحصائيات
                const stats = autoPost.stats || {};
                stats.postedGroups = (stats.postedGroups || 0) + 1;
                stats.lastPostAt = new Date();
                
                await autoPost.update({
                    stats: stats,
                    lastPostAt: new Date()
                });
                
                // انتظر ثانية واحدة بين المجموعات
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`خطأ في النشر للمجموعة ${group.id}:`, error);
            }
        }
        
        // إذا أكمل دورة كاملة
        await autoPost.update({
            'stats.cycle': (autoPost.stats?.cycle || 0) + 1
        });
        
    } catch (error) {
        console.error('خطأ في النشر التلقائي:', error);
    }
}

async function sendAdvertisement(client, chatId, ad) {
    switch (ad.type) {
        case 'text':
            await client.sendMessage(chatId, ad.content);
            break;
        case 'image':
            // معالجة الصور
            break;
        case 'contact':
            // معالجة جهات الاتصال
            break;
        default:
            await client.sendMessage(chatId, ad.content);
    }
}

// ============================================
// 10. نظام الانضمام التلقائي
// ============================================
async function startAutoJoin(adminId, sessionId) {
    const key = `${adminId}_${sessionId}`;
    
    if (activeAutoJoins.has(key)) {
        return false;
    }
    
    const autoJoin = await AutoJoin.create({
        adminId,
        sessionId,
        status: 'active'
    });
    
    // بدء مراقبة الروابط
    const interval = setInterval(async () => {
        await processAutoJoin(autoJoin);
    }, 5000); // كل 5 ثواني
    
    activeAutoJoins.set(key, {
        interval,
        autoJoinId: autoJoin.id
    });
    
    return true;
}

async function processAutoJoin(autoJoin) {
    try {
        const client = whatsappClients.get(autoJoin.sessionId);
        if (!client) return;
        
        // البحث عن روابط واتساب جديدة
        const whatsappLinks = await CollectedLink.findAll({
            where: {
                type: 'whatsapp_group',
                sessionId: autoJoin.sessionId,
                collectedAt: {
                    [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // آخر 24 ساعة
                }
            },
            limit: 10
        });
        
        for (const link of whatsappLinks) {
            try {
                // محاولة الانضمام للمجموعة
                await client.acceptInvite(link.url);
                
                // تحديث الإحصائيات
                const stats = autoJoin.stats || {};
                stats.joined = (stats.joined || 0) + 1;
                stats.lastJoinAt = new Date();
                
                await autoJoin.update({
                    stats: stats
                });
                
                // إعلام المشرف
                const admin = await Admin.findByPk(autoJoin.adminId);
                if (admin) {
                    await bot.sendMessage(admin.telegramId,
                        `✅ تم الانضمام للمجموعة:\n${link.url}`
                    );
                }
                
            } catch (error) {
                console.error('خطأ في الانضمام للمجموعة:', error);
            }
        }
        
    } catch (error) {
        console.error('خطأ في الانضمام التلقائي:', error);
    }
}

// ============================================
// 11. بدء التشغيل
// ============================================
async function startBot() {
    console.log('\n🔧 بدء تهيئة البوت...');
    
    // 1. إنشاء المجلدات
    await fs.mkdir('database', { recursive: true });
    await fs.mkdir('sessions', { recursive: true });
    await fs.mkdir('logs', { recursive: true });
    await fs.mkdir('temp', { recursive: true });
    
    // 2. تهيئة قاعدة البيانات
    await initializeDatabase();
    
    // 3. بدء سيرفر Express
    app.listen(PORT, () => {
        console.log(`🌐 السيرفر يعمل على: http://localhost:${PORT}`);
    });
    
    // 4. إعلام المشرفين
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
    for (const adminId of adminIds) {
        try {
            await bot.sendMessage(adminId.trim(),
                '🚀 *البوت يعمل الآن!*\n\n' +
                '✅ تم تشغيل بوت WhatsApp بنجاح.\n' +
                '📊 النظام جاهز لاستقبال الأوامر.\n\n' +
                'أرسل /start للبدء.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log(`⚠️ لا يمكن إرسال للمشرف ${adminId}`);
        }
    }
    
    console.log('\n✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅');
    console.log('=========================================');
    console.log('🤖 Telegram Bot: جاهز');
    console.log('📱 WhatsApp Manager: جاهز');
    console.log('🗄️  Database: جاهزة');
    console.log(`👥 المشرفين: ${adminIds.length}`);
    console.log('=========================================');
}

// ============================================
// 12. التعامل مع الإيقاف
// ============================================
process.on('SIGINT', async () => {
    console.log('\n🛑 إيقاف البوت...');
    
    // إيقاف جميع النشر التلقائي
    for (const [key, job] of activeAutoPosts.entries()) {
        clearInterval(job.timer);
    }
    
    // إيقاف جميع الانضمام التلقائي
    for (const [key, job] of activeAutoJoins.entries()) {
        clearInterval(job.interval);
    }
    
    // إغلاق جلسات WhatsApp
    for (const [sessionId, client] of whatsappClients.entries()) {
        try {
            await client.destroy();
        } catch (error) {
            console.error(`خطأ في إغلاق الجلسة ${sessionId}:`, error);
        }
    }
    
    console.log('✅ تم إيقاف البوت');
    process.exit(0);
});

// ============================================
// 13. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.error('❌ فشل بدء التشغيل:', error);
        process.exit(1);
    });
}

// ============================================
// 14. التصدير
// ============================================
module.exports = {
    app,
    bot,
    sequelize,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin,
    whatsappClients,
    userStates,
    activeAutoPosts,
    activeAutoJoins,
    startBot
};
