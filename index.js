// ============================================
// 📱 WhatsApp Telegram Bot - النسخة النهائية
// 🚀 مصمم للعمل على Render.com
// ⚡ إصدار: 2.0.0 - Optimized
// ============================================

require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// 1. إعداد Express للسيرفر
// ============================================
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
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    text-align: center;
                    padding: 50px;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    padding: 30px;
                    border-radius: 15px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 { margin-bottom: 20px; }
                .status { 
                    background: rgba(0,255,0,0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                .stat-box {
                    background: rgba(255,255,255,0.1);
                    padding: 15px;
                    border-radius: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Telegram Bot</h1>
                <div class="status">✅ البوت يعمل بنجاح</div>
                <div class="stats">
                    <div class="stat-box">⏱️ ${Math.floor(process.uptime())}s</div>
                    <div class="stat-box">🌐 ${PORT}</div>
                    <div class="stat-box">📊 ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB</div>
                    <div class="stat-box">🔧 2.0.0</div>
                </div>
                <p>🚀 نظام إدارة WhatsApp عبر Telegram</p>
                <p>⚡ مصمم للعمل على Render.com</p>
            </div>
        </body>
        </html>
    `);
});

// صفحة الصحة
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        bot: 'WhatsApp Telegram Bot 2.0.0'
    });
});

// ============================================
// 2. إعداد قاعدة البيانات
// ============================================
let sequelize;
if (process.env.NODE_ENV === 'production') {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false }
        }
    });
} else {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: './database/bot.db',
        logging: false
    });
}

// ============================================
// 3. نماذج قاعدة البيانات
// ============================================
const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    telegramId: { type: DataTypes.STRING, unique: true, allowNull: false },
    username: DataTypes.STRING,
    firstName: DataTypes.STRING,
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    permissions: { type: DataTypes.JSON, defaultValue: ['basic'] },
    settings: { type: DataTypes.JSON, defaultValue: {} },
    lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { type: DataTypes.STRING, primaryKey: true },
    sessionId: { type: DataTypes.STRING, unique: true },
    phoneNumber: { type: DataTypes.STRING, allowNull: false },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    status: { 
        type: DataTypes.ENUM('pending', 'awaiting_qr', 'connected', 'disconnected', 'error'),
        defaultValue: 'pending'
    },
    qrCode: DataTypes.TEXT,
    connectionData: { type: DataTypes.JSON, defaultValue: {} },
    lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    stats: { type: DataTypes.JSON, defaultValue: {} },
    settings: { type: DataTypes.JSON, defaultValue: {} }
});

const CollectedLink = sequelize.define('CollectedLink', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: DataTypes.STRING, unique: true, allowNull: false },
    type: { 
        type: DataTypes.ENUM('whatsapp_group', 'whatsapp_invite', 'telegram', 'website', 'other'),
        defaultValue: 'other'
    },
    title: DataTypes.STRING,
    source: DataTypes.STRING,
    sessionId: DataTypes.STRING,
    status: { type: DataTypes.ENUM('active', 'expired', 'joined'), defaultValue: 'active' },
    collectedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const Advertisement = sequelize.define('Advertisement', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('text', 'image', 'video'), defaultValue: 'text' },
    content: { type: DataTypes.TEXT, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    stats: { type: DataTypes.JSON, defaultValue: {} }
});

const AutoReply = sequelize.define('AutoReply', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    sessionId: DataTypes.STRING,
    name: { type: DataTypes.STRING, allowNull: false },
    trigger: { type: DataTypes.TEXT, allowNull: false },
    response: { type: DataTypes.TEXT, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

// ============================================
// 4. إعداد Telegram Bot
// ============================================
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: { timeout: 30 }
    },
    request: { timeout: 60000 }
});

// تخزينات الذاكرة
const whatsappClients = new Map();
const userStates = new Map();
const sessionQRs = new Map();

// ============================================
// 5. دوال WhatsApp الأساسية
// ============================================
async function createWhatsAppSession(phoneNumber, adminId, chatId) {
    const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
    
    console.log(`📱 جاري إنشاء جلسة جديدة: ${phoneNumber}`);
    
    try {
        // حفظ الجلسة في قاعدة البيانات
        const session = await WhatsAppSession.create({
            id: sessionId,
            sessionId: sessionId,
            phoneNumber: phoneNumber,
            adminId: adminId,
            status: 'awaiting_qr',
            settings: {
                autoReply: true,
                autoCollect: true
            }
        });
        
        // إنشاء مجلد الجلسة
        await fs.mkdir('./sessions', { recursive: true });
        
        // إعداد عميل WhatsApp
        const { Client, LocalAuth } = require('whatsapp-web.js');
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: sessionId, dataPath: './sessions' }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
            },
            qrTimeout: 60000
        });
        
        whatsappClients.set(sessionId, client);
        
        // معالج QR Code
        client.on('qr', async (qr) => {
            console.log(`📱 QR Code تم توليده للجلسة: ${sessionId}`);
            
            // حفظ QR في الذاكرة
            sessionQRs.set(sessionId, {
                qr: qr,
                phoneNumber: phoneNumber,
                timestamp: Date.now()
            });
            
            // تحديث الجلسة
            await session.update({
                qrCode: qr,
                status: 'awaiting_qr',
                lastActivity: new Date()
            });
            
            // إرسال QR Code للمستخدم
            await sendQRCodeToUser(adminId, qr, sessionId, phoneNumber, chatId);
        });
        
        // عند الاتصال
        client.on('ready', async () => {
            console.log(`✅ WhatsApp جاهز: ${sessionId} (${phoneNumber})`);
            
            await session.update({
                status: 'connected',
                connectionData: {
                    platform: client.info?.platform || 'unknown',
                    pushname: client.info?.pushname || '',
                    phone: client.info?.phone || {}
                },
                lastActivity: new Date()
            });
            
            // مسح QR
            sessionQRs.delete(sessionId);
            
            // إرسال إشعار الاتصال
            await bot.sendMessage(chatId,
                `🎉 *تم الربط بنجاح!*\n\n` +
                `📱 الرقم: ${phoneNumber}\n` +
                `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
                `✅ يمكنك الآن استخدام الميزات`,
                { parse_mode: 'Markdown' }
            );
        });
        
        // عند استقبال رسالة
        client.on('message', async (message) => {
            await handleWhatsAppMessage(message, sessionId);
        });
        
        // عند فقدان الاتصال
        client.on('disconnected', async (reason) => {
            console.log(`❌ فقدان الاتصال: ${sessionId} - ${reason}`);
            await session.update({
                status: 'disconnected',
                lastActivity: new Date()
            });
        });
        
        // تهيئة العميل
        await client.initialize();
        
        return sessionId;
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الجلسة:', error);
        
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            await session.update({
                status: 'error',
                lastActivity: new Date()
            });
        }
        
        throw error;
    }
}

async function sendQRCodeToUser(adminId, qr, sessionId, phoneNumber, chatId) {
    try {
        // إنشاء صورة QR
        const qrPath = `./temp/qr_${sessionId}.png`;
        await qrcode.toFile(qrPath, qr);
        
        // إرسال الصورة
        await bot.sendPhoto(chatId, qrPath, {
            caption: `📱 *QR Code لربط حساب WhatsApp*\n\n` +
                    `🔗 الرقم: ${phoneNumber}\n` +
                    `🆔 المعرف: ${sessionId.substring(0, 8)}\n\n` +
                    `🚀 *طريقة الربط:*\n` +
                    `1. افتح WhatsApp على هاتفك\n` +
                    `2. اذهب إلى الإعدادات → الأجهزة المرتبطة\n` +
                    `3. اختر "ربط جهاز"\n` +
                    `4. مسح هذا QR Code\n\n` +
                    `⏱️ صالح لمدة 60 ثانية`,
            parse_mode: 'Markdown'
        });
        
        // حذف الملف المؤقت
        await fs.unlink(qrPath).catch(() => {});
        
    } catch (error) {
        console.error('❌ خطأ في إرسال QR:', error);
        
        // إرسال الرابط كبديل
        await bot.sendMessage(chatId,
            `📱 *QR Code (رابط):*\n\`${qr}\`\n\n` +
            `انسخ هذا الرابط وافتحه في المتصفح لرؤية QR Code`,
            { parse_mode: 'Markdown' }
        );
    }
}

async function handleWhatsAppMessage(message, sessionId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            // تحديث الإحصائيات
            const stats = session.stats || {};
            stats.messagesReceived = (stats.messagesReceived || 0) + 1;
            await session.update({ 
                stats,
                lastActivity: new Date() 
            });
            
            // تجميع الروابط
            if (session.settings?.autoCollect) {
                await collectLinksFromMessage(message, sessionId);
            }
            
            // الردود التلقائية
            if (session.settings?.autoReply) {
                await checkAutoReplies(message, sessionId);
            }
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الرسالة:', error);
    }
}

async function collectLinksFromMessage(message, sessionId) {
    try {
        if (!message.body) return;
        
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.body.match(urlRegex) || [];
        
        for (const url of links) {
            let type = 'other';
            if (url.includes('chat.whatsapp.com')) type = 'whatsapp_group';
            else if (url.includes('whatsapp.com')) type = 'whatsapp_invite';
            else if (url.includes('t.me')) type = 'telegram';
            
            const existing = await CollectedLink.findOne({ where: { url } });
            if (!existing) {
                await CollectedLink.create({
                    url: url,
                    type: type,
                    title: `رابط من ${message.from}`,
                    source: message.from,
                    sessionId: sessionId,
                    collectedAt: new Date()
                });
                console.log(`✅ رابط جديد: ${type} - ${url.substring(0, 50)}...`);
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تجميع الروابط:', error);
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
            if (message.body && message.body.includes(reply.trigger)) {
                const client = whatsappClients.get(sessionId);
                if (client) {
                    await client.sendMessage(message.from, reply.response);
                    
                    // تحديث إحصائيات
                    const stats = reply.stats || {};
                    stats.triggered = (stats.triggered || 0) + 1;
                    stats.lastTriggered = new Date();
                    await reply.update({ stats });
                    
                    console.log(`🤖 رد تلقائي: ${reply.name}`);
                    break;
                }
            }
        }
    } catch (error) {
        console.error('❌ خطأ في الرد التلقائي:', error);
    }
}

// ============================================
// 6. أوامر Telegram الأساسية
// ============================================
bot.setMyCommands([
    { command: 'start', description: '🚀 بدء البوت' },
    { command: 'addsession', description: '➕ إضافة جلسة' },
    { command: 'sessions', description: '📱 الجلسات' },
    { command: 'links', description: '🔗 الروابط' },
    { command: 'stats', description: '📊 الإحصائيات' },
    { command: 'help', description: '🆘 المساعدة' }
]);

// أمر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        
        if (!admin) {
            return bot.sendMessage(chatId,
                `🔒 *غير مصرح لك!*\n\n` +
                `🆔 رقمك: \`${telegramId}\`\n` +
                `📞 تواصل مع المشرف للإضافة.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        await admin.update({ lastActivity: new Date() });
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '📱 إضافة جلسة', callback_data: 'add_session' }],
                [{ text: '📊 الجلسات', callback_data: 'show_sessions' }],
                [{ text: '🔗 الروابط', callback_data: 'show_links' }],
                [{ text: '📢 إعلانات', callback_data: 'show_ads' }]
            ]
        };
        
        await bot.sendMessage(chatId,
            `🎉 *مرحباً ${admin.firstName || 'مستخدم'}!*\n\n` +
            `🤖 *WhatsApp Telegram Bot*\n` +
            `🚀 الإصدار: 2.0.0\n\n` +
            `📊 *الميزات المتاحة:*\n` +
            `• ربط حسابات WhatsApp\n` +
            `• تجميع الروابط تلقائياً\n` +
            `• ردود تلقائية\n` +
            `• إعلانات ونشر\n\n` +
            `⚡ اختر من القائمة:`,
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
        
    } catch (error) {
        console.error('❌ خطأ في /start:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى.');
    }
});

// أمر /addsession
bot.onText(/\/addsession/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        // التحقق من الحد الأقصى
        const sessionCount = await WhatsAppSession.count({ 
            where: { adminId: admin.id, status: { [Op.ne]: 'disconnected' } } 
        });
        
        if (sessionCount >= 5) {
            return bot.sendMessage(chatId,
                `❌ *وصلت للحد الأقصى!*\n\n` +
                `لديك ${sessionCount} جلسة نشطة.\n` +
                `استخدم /sessions لإدارة الجلسات.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        // حفظ حالة المستخدم
        userStates.set(telegramId, {
            state: 'awaiting_phone',
            data: { adminId: admin.id }
        });
        
        await bot.sendMessage(chatId,
            `📱 *إضافة جلسة WhatsApp جديدة*\n\n` +
            `📞 *أرسل رقم الهاتف مع رمز الدولة:*\n` +
            `مثال: \`+966501234567\`\n` +
            `مثال: \`+971501234567\`\n\n` +
            `⚡ *تأكد من:*\n` +
            `• الرقم نشط على WhatsApp\n` +
            `• الهاتف متصل بالإنترنت\n` +
            `• سيصلك QR Code للربط`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في /addsession:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الجلسة');
    }
});

// أمر /sessions
bot.onText(/\/sessions/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: admin.id },
            order: [['createdAt', 'DESC']]
        });
        
        if (sessions.length === 0) {
            return bot.sendMessage(chatId,
                `📭 *لا توجد جلسات*\n\n` +
                `استخدم /addsession لإضافة جلسة جديدة.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        let message = `📱 *جلسات WhatsApp*\n\n`;
        
        sessions.forEach((session, index) => {
            const statusEmoji = 
                session.status === 'connected' ? '🟢' :
                session.status === 'awaiting_qr' ? '📱' :
                session.status === 'disconnected' ? '🔴' : '⚪';
            
            message += `${index + 1}. ${statusEmoji} ${session.phoneNumber}\n`;
            message += `   📌 ${session.status}\n`;
            message += `   ⏰ ${new Date(session.lastActivity).toLocaleDateString('ar-SA')}\n\n`;
        });
        
        message += `📊 الإجمالي: ${sessions.length} جلسة`;
        
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('❌ خطأ في /sessions:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
    }
});

// أمر /links
bot.onText(/\/links/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: admin.id }
        });
        
        const sessionIds = sessions.map(s => s.id);
        const linksCount = await CollectedLink.count({
            where: { sessionId: sessionIds }
        });
        
        const whatsappGroups = await CollectedLink.count({
            where: { 
                type: 'whatsapp_group',
                sessionId: sessionIds
            }
        });
        
        await bot.sendMessage(chatId,
            `🔗 *الروابط المجمعة*\n\n` +
            `📊 *الإحصائيات:*\n` +
            `• 📋 الإجمالي: ${linksCount} رابط\n` +
            `• 📱 مجموعات واتساب: ${whatsappGroups}\n` +
            `• 🔄 آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `🚀 *كيفية العمل:*\n` +
            `1. يراقب البوت الرسائل تلقائياً\n` +
            `2. يستخرج جميع الروابط\n` +
            `3. يصنفها حسب النوع\n` +
            `4. يمنع التكرار`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في /links:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
    }
});

// معالجة الرسائل النصية
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
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phoneRegex.test(phoneNumber)) {
        return bot.sendMessage(chatId,
            `❌ *رقم غير صالح!*\n\n` +
            `📋 *الصيغة الصحيحة:*\n` +
            `• يبدأ ب +\n` +
            `• يتبعه رمز الدولة\n` +
            `• ثم رقم الهاتف\n\n` +
            `📝 *أمثلة:*\n` +
            `\`+966501234567\`\n` +
            `\`+971501234567\`\n\n` +
            `🔧 حاول مرة أخرى:`,
            { parse_mode: 'Markdown' }
        );
    }
    
    try {
        // التحقق من التكرار
        const existingSession = await WhatsAppSession.findOne({
            where: { 
                phoneNumber: phoneNumber,
                adminId: data.adminId,
                status: { [Op.ne]: 'disconnected' }
            }
        });
        
        if (existingSession) {
            userStates.delete(telegramId);
            return bot.sendMessage(chatId,
                `⚠️ *هذا الرقم مضاف مسبقاً!*\n\n` +
                `📱 الرقم: ${phoneNumber}\n` +
                `📌 الحالة: ${existingSession.status}\n\n` +
                `استخدم /sessions لعرض الجلسات.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        await bot.sendMessage(chatId,
            `⏳ *جاري إنشاء الجلسة...*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🔧 جاري التحضير...`,
            { parse_mode: 'Markdown' }
        );
        
        const sessionId = await createWhatsAppSession(phoneNumber, data.adminId, chatId);
        
        userStates.delete(telegramId);
        
        await bot.sendMessage(chatId,
            `✅ *تم إنشاء الجلسة!*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🆔 المعرف: ${sessionId.substring(0, 8)}\n\n` +
            `📤 *جاري إرسال QR Code...*`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الجلسة:', error);
        userStates.delete(telegramId);
        
        await bot.sendMessage(chatId,
            `❌ *فشل إنشاء الجلسة!*\n\n` +
            `📋 الخطأ: ${error.message.substring(0, 100)}\n\n` +
            `🔧 *الأسباب المحتملة:*\n` +
            `• مشكلة في اتصال WhatsApp\n` +
            `• الرقم غير صحيح\n` +
            `• حساب غير نشط\n\n` +
            `🔄 حاول مرة أخرى.`,
            { parse_mode: 'Markdown' }
        );
    }
}

// معالجة الأزرار
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;
    
    try {
        await bot.answerCallbackQuery(query.id);
        
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        switch (data) {
            case 'add_session':
                await bot.sendMessage(chatId, 'استخدم الأمر: /addsession');
                break;
                
            case 'show_sessions':
                await bot.sendMessage(chatId, 'استخدم الأمر: /sessions');
                break;
                
            case 'show_links':
                await bot.sendMessage(chatId, 'استخدم الأمر: /links');
                break;
                
            case 'show_ads':
                await bot.sendMessage(chatId, '🚧 قريباً...');
                break;
        }
        
    } catch (error) {
        console.error('❌ خطأ في الزر:', error);
    }
});

// ============================================
// 7. تهيئة وتشغيل النظام
// ============================================
async function initializeDatabase() {
    try {
        console.log('🔧 جاري تهيئة قاعدة البيانات...');
        
        await sequelize.authenticate();
        console.log('✅ قاعدة البيانات متصلة');
        
        await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
        console.log('✅ تم مزامنة الجداول');
        
        // إنشاء المشرفين
        const adminIds = process.env.TELEGRAM_ADMIN_IDS ? 
            process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()) : [];
        
        for (const telegramId of adminIds) {
            try {
                const [admin] = await Admin.findOrCreate({
                    where: { telegramId },
                    defaults: {
                        firstName: 'مشرف',
                        permissions: ['admin', 'manage_sessions', 'view_stats'],
                        settings: { maxSessions: 5, notificationEnabled: true }
                    }
                });
                console.log(`✅ المشرف ${telegramId} جاهز`);
            } catch (error) {
                console.log(`⚠️ خطأ في المشرف ${telegramId}: ${error.message}`);
            }
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
        return false;
    }
}

async function startBot() {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 بدء تشغيل WhatsApp Telegram Bot');
    console.log('='.repeat(50));
    
    try {
        // إنشاء المجلدات
        console.log('\n📁 جاري إنشاء المجلدات...');
        const folders = ['database', 'sessions', 'temp'];
        
        for (const folder of folders) {
            try {
                await fs.mkdir(folder, { recursive: true });
                console.log(`   ✅ ${folder}/`);
            } catch (error) {
                console.log(`   ⚠️ ${folder}/: ${error.message}`);
            }
        }
        
        // تهيئة قاعدة البيانات
        console.log('\n🗄️  جاري تهيئة قاعدة البيانات...');
        const dbSuccess = await initializeDatabase();
        if (!dbSuccess) {
            console.error('❌ فشل تهيئة قاعدة البيانات!');
            process.exit(1);
        }
        
        // تشغيل السيرفر
        console.log('\n🌐 جاري تشغيل سيرفر الويب...');
        const server = app.listen(PORT, () => {
            console.log(`   ✅ السيرفر يعمل على: http://localhost:${PORT}`);
            console.log(`   ✅ صفحة الصحة: http://localhost:${PORT}/health`);
        });
        
        // إعلام المشرفين
        console.log('\n👥 جاري إعلام المشرفين...');
        const adminIds = process.env.TELEGRAM_ADMIN_IDS ? 
            process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()) : [];
        
        for (const adminId of adminIds) {
            try {
                await bot.sendMessage(adminId,
                    '🚀 *البوت يعمل الآن!*\n\n' +
                    '✅ تم تشغيل WhatsApp Telegram Bot\n\n' +
                    '📋 *معلومات التشغيل:*\n' +
                    `• 🌐 Port: ${PORT}\n` +
                    `• ⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                    '🚀 *للبدء:* أرسل /start',
                    { parse_mode: 'Markdown' }
                );
                console.log(`   ✅ ${adminId}`);
            } catch (error) {
                console.log(`   ⚠️ ${adminId}: ${error.message}`);
            }
        }
        
        // عرض رسالة النجاح
        console.log('\n' + '='.repeat(50));
        console.log('✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅');
        console.log('='.repeat(50));
        console.log('\n📋 *معلومات التشغيل:*');
        console.log(`🤖 Telegram Bot: ✅ جاهز`);
        console.log(`🌐 Web Server: ✅ جاهز (Port: ${PORT})`);
        console.log(`🗄️  Database: ✅ جاهزة`);
        console.log(`📊 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log('\n' + '='.repeat(50));
        console.log('⚡ *نصائح التشغيل:*');
        console.log('• استخدم /start في بوت التليجرام');
        console.log('• تابع الـ logs للاطلاع على الأحداث');
        console.log('='.repeat(50));
        
        return true;
        
    } catch (error) {
        console.error('\n❌ ❌ ❌ فشل بدء التشغيل! ❌ ❌ ❌');
        console.error('📋 الخطأ:', error.message);
        process.exit(1);
    }
}

// التعامل مع الإيقاف
process.on('SIGINT', async () => {
    console.log('\n🛑 جاري الإغلاق النظيف...');
    
    try {
        // إغلاق جلسات WhatsApp
        for (const [sessionId, client] of whatsappClients.entries()) {
            try {
                await client.destroy();
                console.log(`✅ جلسة ${sessionId.substring(0, 8)}`);
            } catch (error) {
                console.log(`⚠️ جلسة ${sessionId.substring(0, 8)}`);
            }
        }
        
        // تحديث الجلسات
        await WhatsAppSession.update(
            { status: 'disconnected' },
            { where: { status: ['connected', 'awaiting_qr'] } }
        );
        
        await sequelize.close();
        console.log('✅ تم الإغلاق بنجاح');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ خطأ في الإغلاق:', error);
        process.exit(1);
    }
});

// ============================================
// 8. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.error('❌ فشل بدء التشغيل:', error);
        process.exit(1);
    });
}

// ============================================
// 9. التصدير
// ============================================
module.exports = {
    app,
    bot,
    sequelize,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoReply,
    whatsappClients,
    userStates,
    sessionQRs,
    initializeDatabase,
    startBot
};
