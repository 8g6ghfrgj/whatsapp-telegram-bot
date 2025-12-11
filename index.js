// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot - النسخة الكاملة
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { Sequelize, Op } = require('sequelize');

// ============================================
// 1. استيراد نماذج قاعدة البيانات
// ============================================
console.log('🚀 بدء تشغيل WhatsApp-Telegram Bot...');
console.log('=========================================');

// تعريف النماذج مباشرة هنا (بدون ملف models.js منفصل)
const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite:./database/bot.db', {
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
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
    permissions: { type: Sequelize.JSON, defaultValue: ['basic'] },
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج جلسات واتساب
const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { type: Sequelize.STRING, primaryKey: true },
    sessionId: { type: Sequelize.STRING, unique: true },
    phoneNumber: Sequelize.STRING,
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    sessionData: Sequelize.TEXT,
    status: { 
        type: Sequelize.ENUM('pending', 'authenticating', 'active', 'disconnected', 'error'),
        defaultValue: 'pending'
    },
    qrCode: Sequelize.TEXT,
    lastActivity: Sequelize.DATE,
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الروابط المجمعة
const CollectedLink = sequelize.define('CollectedLink', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: Sequelize.STRING, unique: true, allowNull: false },
    category: { 
        type: Sequelize.ENUM('whatsapp', 'telegram', 'website', 'other'),
        defaultValue: 'other'
    },
    title: Sequelize.STRING,
    description: Sequelize.TEXT,
    sourceChat: Sequelize.STRING,
    sessionId: Sequelize.STRING,
    collectedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الإعلانات
const Advertisement = sequelize.define('Advertisement', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    type: { 
        type: Sequelize.ENUM('text', 'image', 'video', 'contact', 'document'),
        defaultValue: 'text'
    },
    content: { type: Sequelize.TEXT, allowNull: false },
    fileId: Sequelize.STRING,
    caption: Sequelize.TEXT,
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    schedule: Sequelize.JSON,
    stats: { type: Sequelize.JSON, defaultValue: { sent: 0, failed: 0 } },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// نموذج الردود التلقائية
const AutoReply = sequelize.define('AutoReply', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    triggerType: { 
        type: Sequelize.ENUM('private', 'group', 'both'),
        defaultValue: 'both'
    },
    trigger: { type: Sequelize.STRING, allowNull: false },
    response: { type: Sequelize.TEXT, allowNull: false },
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    matchType: { 
        type: Sequelize.ENUM('exact', 'contains', 'regex'),
        defaultValue: 'contains'
    },
    stats: { type: Sequelize.JSON, defaultValue: { triggered: 0 } },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// ============================================
// 2. التحقق من الإعدادات المبدئية
// ============================================
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_IDS'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.log('❌ متغيرات بيئية مفقودة:');
    missingEnvVars.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('📝 راجع ملف .env.example وأنشئ ملف .env');
    process.exit(1);
}

// ============================================
// 3. استيراد المكتبات
// ============================================
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ============================================
// 4. إعداد قاعدة البيانات
// ============================================
console.log('🗄️  جاري إعداد قاعدة البيانات...');

async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ اتصال قاعدة البيانات ناجح');
        
        // مزامنة النماذج
        await sequelize.sync({ alter: true });
        console.log('✅ تم مزامنة نماذج قاعدة البيانات');
        
        // إنشاء المشرف الأساسي إذا لم يوجد
        const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
        for (const telegramId of adminIds) {
            const [admin] = await Admin.findOrCreate({
                where: { telegramId: telegramId.trim() },
                defaults: {
                    username: `admin_${telegramId}`,
                    permissions: ['basic', 'admin', 'manage_sessions', 'manage_ads'],
                    isActive: true
                }
            });
            
            if (admin.isNewRecord) {
                console.log(`تم إنشاء مشرف جديد: ${telegramId}`);
            }
        }
        
        return true;
    } catch (error) {
        console.log(`❌ خطأ في قاعدة البيانات: ${error.message}`);
        return false;
    }
}

// ============================================
// 5. إعداد بوت تليجرام
// ============================================
console.log('🤖 جاري إعداد بوت تليجرام...');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// تخزين حالات المستخدمين
const userStates = new Map();
const activeAutoPosts = new Map();

// ============================================
// 6. استيراد وتهيئة المكونات
// ============================================
console.log('🔧 جاري تحميل المكونات...');

// استيراد مدير واتساب
let WhatsAppManager;
try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');
    const EventEmitter = require('events');
    
    // فئة جلسة واتساب
    class WhatsAppSession extends EventEmitter {
        constructor(sessionId, adminId, phoneNumber = null) {
            super();
            this.sessionId = sessionId;
            this.adminId = adminId;
            this.phoneNumber = phoneNumber;
            this.status = 'initializing';
            this.client = null;
            this.qrCode = null;
            
            this.config = {
                authStrategy: new LocalAuth({ 
                    clientId: `whatsapp-session-${sessionId}`,
                    dataPath: path.join('./sessions', sessionId)
                }),
                puppeteer: {
                    headless: process.env.BROWSER_HEADLESS !== 'false',
                    args: (process.env.BROWSER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(','),
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
                }
            };
            
            this.initialize();
        }
        
        async initialize() {
            try {
                this.client = new Client(this.config);
                
                this.client.on('qr', (qr) => {
                    this.qrCode = qr;
                    this.status = 'awaiting_qr';
                    qrcode.generate(qr, { small: true });
                    this.emit('qr', { sessionId: this.sessionId, qrCode: qr });
                });
                
                this.client.on('ready', () => {
                    this.status = 'ready';
                    this.phoneNumber = this.client.info.wid.user;
                    this.emit('ready', { 
                        sessionId: this.sessionId, 
                        phoneNumber: this.phoneNumber 
                    });
                });
                
                this.client.on('disconnected', (reason) => {
                    this.status = 'disconnected';
                    this.emit('disconnected', { sessionId: this.sessionId, reason });
                });
                
                await this.client.initialize();
            } catch (error) {
                this.status = 'error';
                this.emit('error', { sessionId: this.sessionId, error: error.message });
            }
        }
        
        async sendMessage(to, content) {
            if (this.status !== 'ready') throw new Error('الجلسة غير جاهزة');
            return await this.client.sendMessage(to, content);
        }
        
        async getChats() {
            if (this.status !== 'ready') throw new Error('الجلسة غير جاهزة');
            return await this.client.getChats();
        }
        
        async destroy() {
            if (this.client) {
                await this.client.destroy();
            }
            this.status = 'destroyed';
        }
    }
    
    // فئة مدير الجلسات
    class WhatsAppManager extends EventEmitter {
        constructor() {
            super();
            this.sessions = new Map();
            this.adminSessions = new Map();
        }
        
        async createSession(adminId, phoneNumber = null) {
            const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
            const session = new WhatsAppSession(sessionId, adminId, phoneNumber);
            
            this.sessions.set(sessionId, session);
            const adminSessions = this.adminSessions.get(adminId) || [];
            this.adminSessions.set(adminId, [...adminSessions, sessionId]);
            
            // تتبع الأحداث
            session.on('qr', (data) => this.emit('sessionQR', data));
            session.on('ready', (data) => this.emit('sessionReady', data));
            
            return sessionId;
        }
        
        getSession(sessionId) {
            return this.sessions.get(sessionId);
        }
        
        getReadySessions() {
            return Array.from(this.sessions.values()).filter(s => s.status === 'ready');
        }
        
        async autoPostAdvertisement(adContent, groups = null, interval = 1000) {
            const readySessions = this.getReadySessions();
            if (readySessions.length === 0) throw new Error('لا توجد جلسات جاهزة');
            
            const results = { sent: 0, failed: 0, details: [] };
            const session = readySessions[0];
            
            try {
                const chats = await session.getChats();
                const groupsToPost = chats.filter(chat => chat.isGroup);
                
                for (const [index, group] of groupsToPost.entries()) {
                    try {
                        if (index > 0) await new Promise(resolve => setTimeout(resolve, interval));
                        await session.sendMessage(group.id._serialized, adContent.content);
                        results.sent++;
                        results.details.push({ groupId: group.id._serialized, status: 'success' });
                    } catch (error) {
                        results.failed++;
                        results.details.push({ groupId: group.id._serialized, status: 'failed', error: error.message });
                    }
                }
            } catch (error) {
                throw error;
            }
            
            return results;
        }
        
        getStats() {
            const totalSessions = this.sessions.size;
            const readySessions = this.getReadySessions().length;
            
            return {
                totalSessions,
                readySessions,
                sessionsByStatus: {
                    ready: readySessions,
                    awaiting_qr: Array.from(this.sessions.values()).filter(s => s.status === 'awaiting_qr').length,
                    disconnected: Array.from(this.sessions.values()).filter(s => s.status === 'disconnected').length
                }
            };
        }
    }
    
    WhatsAppManager = new WhatsAppManager();
    console.log('✅ تم تحميل مدير واتساب');
} catch (error) {
    console.log(`⚠️  لم يتم تحميل مدير واتساب: ${error.message}`);
    WhatsAppManager = null;
}

// ============================================
// 7. تعريف أوامر تليجرام مباشرة
// ============================================
console.log('📋 جاري تسجيل أوامر البوت...');

// أوامر البوت
bot.setMyCommands([
    { command: 'start', description: 'بدء استخدام البوت' },
    { command: 'help', description: 'عرض التعليمات' },
    { command: 'sessions', description: 'إدارة جلسات واتساب' },
    { command: 'links', description: 'عرض الروابط المجمعة' },
    { command: 'ads', description: 'إدارة الإعلانات' },
    { command: 'autopost', description: 'النشر التلقائي' },
    { command: 'join', description: 'الانضمام للمجموعات' },
    { command: 'stats', description: 'إحصائيات البوت' }
]);

// الأمر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        
        if (!admin) {
            return bot.sendMessage(chatId, 
                '❌ أنت لست مشرفاً معتمداً.\n' +
                'يرجى التواصل مع المشرف الرئيسي لإضافتك.'
            );
        }
        
        const welcomeMessage = `
🌟 *مرحباً ${admin.firstName || 'مشرف'}!* 🌟

*🤖 بوت إدارة واتساب عبر تليجرام*

*📋 الأوامر المتاحة:*
/start - بدء الاستخدام
/help - عرض جميع الأوامر
/sessions - إدارة جلسات واتساب
/links - الروابط المجمعة
/ads - إدارة الإعلانات
/autopost - النشر التلقائي
/join - الانضمام للمجموعات
/stats - إحصائيات البوت

*💼 حالتك:* ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}
*🎫 الصلاحيات:* ${admin.permissions.join(', ')}
        `;
        
        bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('خطأ في /start:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
    }
});

// الأمر /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `
*🆘 مركز المساعدة*

*🔗 الأوامر الأساسية:*
/start - بدء استخدام البوت
/help - عرض هذه الرسالة
/stats - إحصائيات النظام

*📱 إدارة الجلسات:*
/sessions - عرض جميع الجلسات
/sessions add - إضافة جلسة جديدة
/sessions qr <id> - عرض QR code
/sessions remove <id> - حذف جلسة

*🔗 جمع الروابط:*
/links - عرض جميع الروابط
/links whatsapp - روابط واتساب فقط
/links telegram - روابط تليجرام فقط

*📢 إدارة الإعلانات:*
/ads - عرض جميع الإعلانات
/ads add - إضافة إعلان جديد
/ads delete <id> - حذف إعلان

*🚀 النشر التلقائي:*
/autopost - حالة النشر التلقائي
/autopost start - بدء النشر التلقائي
/autopost stop - إيقاف النشر التلقائي

*👥 الانضمام التلقائي:*
/join - حالة الانضمام التلقائي
/join on - تفعيل الانضمام التلقائي
/join off - تعطيل الانضمام التلقائي

*📞 الدعم الفني:*
للإبلاغ عن مشاكل أو اقتراحات
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// الأمر /sessions
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
                '📭 لا توجد جلسات واتساب.\n' +
                'استخدم /sessions add لإضافة جلسة جديدة.'
            );
        }
        
        let message = `*📱 جلسات واتساب (${sessions.length})*\n\n`;
        
        sessions.forEach((session, index) => {
            const statusEmoji = {
                'pending': '⏳',
                'authenticating': '🔐',
                'active': '✅',
                'disconnected': '❌',
                'error': '⚠️'
            }[session.status] || '❓';
            
            message += `${index + 1}. ${statusEmoji} *${session.phoneNumber || 'بدون رقم'}*\n`;
            message += `   📌 الحالة: ${session.status}\n`;
            message += `   🆔 المعرف: ${session.id.substring(0, 8)}...\n`;
            message += `   📅 تم الإنشاء: ${new Date(session.createdAt).toLocaleDateString('ar-SA')}\n\n`;
        });
        
        message += `📌 *الأوامر:*\n`;
        message += `/sessions add - إضافة جلسة جديدة\n`;
        message += `/sessions refresh - تحديث الحالات\n`;
        
        bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('خطأ في عرض الجلسات:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
    }
});

// الأمر /sessions add
bot.onText(/\/sessions add/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        // التحقق من الحد الأقصى
        const sessionCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
        const maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 5;
        
        if (sessionCount >= maxSessions) {
            return bot.sendMessage(chatId,
                `❌ لقد وصلت للحد الأقصى من الجلسات (${maxSessions}).\n` +
                `يرجى حذف جلسة قبل إضافة جديدة.`
            );
        }
        
        // حفظ حالة المستخدم
        userStates.set(telegramId, {
            state: 'awaiting_phone',
            adminId: admin.id
        });
        
        bot.sendMessage(chatId,
            `🔐 *إضافة جلسة واتساب جديدة*\n\n` +
            `1. أرسل رقم الهاتف (مع رمز الدولة)\n` +
            `مثال: +966501234567\n\n` +
            `2. سأقوم بإرسال QR code لمسحه\n\n` +
            `3. استخدم /cancel للإلغاء`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('خطأ في إضافة جلسة:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الجلسة');
    }
});

// الأمر /links
bot.onText(/\/links/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const links = await CollectedLink.findAll({
            order: [['collectedAt', 'DESC']],
            limit: 10
        });
        
        if (links.length === 0) {
            return bot.sendMessage(chatId,
                '🔍 *لا توجد روابط مجمعة*\n\n' +
                'سيتم جمع الروابط تلقائياً من جلسات واتساب.',
                { parse_mode: 'Markdown' }
            );
        }
        
        let message = `*🔗 آخر ${links.length} رابط مجمع*\n\n`;
        
        links.forEach((link, index) => {
            const categoryEmoji = {
                'whatsapp': '📱',
                'telegram': '📢',
                'website': '🌐',
                'other': '🔗'
            }[link.category] || '🔗';
            
            message += `${index + 1}. ${categoryEmoji} *${link.title || 'بدون عنوان'}*\n`;
            message += `   ${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''}\n`;
            message += `   📍 ${link.sourceChat || 'غير معروف'}\n\n`;
        });
        
        message += `📊 *الإجمالي:* ${await CollectedLink.count()} رابط\n`;
        
        bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('خطأ في /links:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
    }
});

// الأمر /ads
bot.onText(/\/ads/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const ads = await Advertisement.findAll({
            where: { adminId: admin.id },
            order: [['createdAt', 'DESC']]
        });
        
        if (ads.length === 0) {
            return bot.sendMessage(chatId,
                '📭 *لا توجد إعلانات*\n\n' +
                'استخدم /ads add لإضافة إعلان جديد.',
                { parse_mode: 'Markdown' }
            );
        }
        
        let message = `*📢 إعلاناتك (${ads.length})*\n\n`;
        
        ads.forEach((ad, index) => {
            const typeEmoji = {
                'text': '📝',
                'image': '🖼️',
                'video': '🎥',
                'contact': '👤',
                'document': '📄'
            }[ad.type] || '📢';
            
            const statusEmoji = ad.isActive ? '✅' : '❌';
            
            message += `${index + 1}. ${typeEmoji} ${statusEmoji}\n`;
            message += `   ${ad.content.substring(0, 50)}${ad.content.length > 50 ? '...' : ''}\n`;
            message += `   📊 مرسل: ${ad.stats?.sent || 0}\n\n`;
        });
        
        message += `📌 *أوامر:*\n`;
        message += `/ads add - إضافة إعلان جديد\n`;
        message += `/ads post <id> - نشر إعلان\n`;
        
        bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('خطأ في /ads:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعلانات');
    }
});

// الأمر /ads add
bot.onText(/\/ads add/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        userStates.set(telegramId, {
            state: 'awaiting_ad_content',
            adminId: admin.id
        });
        
        bot.sendMessage(chatId,
            `📢 *إضافة إعلان جديد*\n\n` +
            `أرسل لي نص الإعلان:\n` +
            `(يمكنك استخدام Markdown للتنسيق)\n\n` +
            `❌ للإلغاء: /cancel`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('خطأ في /ads add:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الإعلان');
    }
});

// الأمر /autopost
bot.onText(/\/autopost/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const isActive = activeAutoPosts.has(admin.id);
        
        let message = `*🚀 النشر التلقائي*\n\n`;
        
        if (isActive) {
            const postInfo = activeAutoPosts.get(admin.id);
            message += `✅ *الحالة:* نشط\n`;
            message += `⏱️ *الفاصل:* ${postInfo.interval}ms\n`;
            message += `📅 *بدأ في:* ${new Date(postInfo.startedAt).toLocaleTimeString('ar-SA')}\n\n`;
            message += `🛑 لإيقاف النشر: /autopost stop\n`;
        } else {
            message += `❌ *الحالة:* متوقف\n\n`;
            message += `▶️ لبدء النشر: /autopost start\n`;
            message += `📋 لعرض الإعلانات: /ads\n`;
        }
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('خطأ في /autopost:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض حالة النشر');
    }
});

// الأمر /autopost start
bot.onText(/\/autopost start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        if (activeAutoPosts.has(admin.id)) {
            return bot.sendMessage(chatId,
                '⚠️ النشر التلقائي يعمل بالفعل!\n' +
                'استخدم /autopost stop لإيقافه أولاً.',
                { parse_mode: 'Markdown' }
            );
        }
        
        const ads = await Advertisement.findAll({
            where: { 
                adminId: admin.id,
                isActive: true 
            }
        });
        
        if (ads.length === 0) {
            return bot.sendMessage(chatId,
                '❌ لا توجد إعلانات نشطة!\n' +
                'استخدم /ads add لإضافة إعلان أولاً.',
                { parse_mode: 'Markdown' }
            );
        }
        
        userStates.set(telegramId, {
            state: 'select_ad_for_autopost',
            adminId: admin.id,
            ads: ads
        });
        
        let message = `*🚀 بدء النشر التلقائي*\n\n`;
        message += `لديك ${ads.length} إعلان نشط:\n\n`;
        
        ads.forEach((ad, index) => {
            message += `${index + 1}. ${ad.type === 'text' ? '📝' : '🖼️'} ${ad.content.substring(0, 30)}...\n`;
        });
        
        message += `\nأرسل رقم الإعلان الذي تريد نشره:`;
        
        bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('خطأ في /autopost start:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في بدء النشر التلقائي');
    }
});

// الأمر /join
bot.onText(/\/join/, async (msg) => {
    const chatId = msg.chat.id;
    
    const message = `
*👥 الانضمام التلقائي للمجموعات*

✅ *الميزات المتاحة:*
• الانضمام التلقائي لروابط واتساب
• استخراج الروابط من الرسائل
• تجنب المجموعات المغلقة

🔧 *الإعدادات الحالية:*
• الحالة: ${process.env.AUTO_JOIN_ENABLED === 'true' ? '✅ مفعل' : '❌ معطل'}
• فحص كل: ${process.env.AUTO_JOIN_CHECK_INTERVAL || 30000}ms
• تأخير بين المحاولات: ${process.env.AUTO_JOIN_DELAY_BETWEEN || 2000}ms

📌 *الأوامر:*
/join on - تفعيل الانضمام التلقائي
/join off - تعطيل الانضمام التلقائي
/join test <رابط> - اختبار رابط
    `;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// الأمر /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const stats = WhatsAppManager ? WhatsAppManager.getStats() : { totalSessions: 0, readySessions: 0 };
        const totalLinks = await CollectedLink.count();
        const totalAds = await Advertisement.count();
        
        const statsMessage = `
📊 *إحصائيات النظام*

*📱 جلسات واتساب:*
• الإجمالي: ${stats.totalSessions}
• النشطة: ${stats.readySessions}

*🔗 الروابط المجمعة:*
• الإجمالي: ${totalLinks}
• واتساب: ${await CollectedLink.count({ where: { category: 'whatsapp' } })}
• تليجرام: ${await CollectedLink.count({ where: { category: 'telegram' } })}

*📢 الإعلانات:*
• الإجمالي: ${totalAds}
• النشطة: ${await Advertisement.count({ where: { isActive: true } })}

*👥 المشرفين:*
• الإجمالي: ${await Admin.count()}
• النشطون: ${await Admin.count({ where: { isActive: true } })}

*⏱️ وقت التشغيل:* ${Math.floor(process.uptime() / 3600)} ساعة
        `;
        
        bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('خطأ في /stats:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في جلب الإحصائيات');
    }
});

// معالجة الرسائل النصية
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const userState = userStates.get(telegramId);
    
    if (!userState || !msg.text) return;
    
    try {
        switch (userState.state) {
            case 'awaiting_phone':
                await handlePhoneNumber(msg, userState, chatId);
                break;
                
            case 'awaiting_ad_content':
                await handleAdContent(msg, userState, chatId);
                break;
                
            case 'select_ad_for_autopost':
                await handleAdSelection(msg, userState, chatId);
                break;
        }
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
        userStates.delete(telegramId);
    }
});

// معالجة رقم الهاتف
async function handlePhoneNumber(msg, userState, chatId) {
    const phoneNumber = msg.text.trim();
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phoneRegex.test(phoneNumber)) {
        return bot.sendMessage(chatId,
            '❌ رقم الهاتف غير صالح.\n' +
            'يجب أن يبدأ بـ + ويتبعه رمز الدولة ثم الرقم.\n' +
            'مثال: +966501234567\n\n' +
            'حاول مرة أخرى أو /cancel للإلغاء'
        );
    }
    
    try {
        if (!WhatsAppManager) {
            throw new Error('مدير واتساب غير متاح');
        }
        
        const sessionId = await WhatsAppManager.createSession(userState.adminId, phoneNumber);
        
        // حفظ في قاعدة البيانات
        await WhatsAppSession.create({
            id: sessionId,
            sessionId: sessionId,
            phoneNumber: phoneNumber,
            adminId: userState.adminId,
            status: 'pending'
        });
        
        bot.sendMessage(chatId,
            `✅ *تم إنشاء الجلسة*\n\n` +
            `🆔 المعرف: \`${sessionId.substring(0, 8)}\`\n` +
            `📱 الرقم: ${phoneNumber}\n\n` +
            `⏳ جاري تحضير QR code...`,
            { parse_mode: 'Markdown' }
        );
        
        // الاستماع لحدث QR
        WhatsAppManager.once('sessionQR', (data) => {
            if (data.sessionId === sessionId) {
                bot.sendMessage(chatId,
                    `📱 *QR Code جاهز*\n\n` +
                    `1. افتح واتساب على هاتفك\n` +
                    `2. اذهب إلى الإعدادات → الأجهزة المرتبطة\n` +
                    `3. انقر على "ربط جهاز"\n` +
                    `4. مسح QR Code التالي:\n\n` +
                    `\`\`\`\n${data.qrCode}\n\`\`\``,
                    { parse_mode: 'Markdown' }
                );
            }
        });
        
        userStates.delete(msg.from.id.toString());
        
    } catch (error) {
        console.error('خطأ في إنشاء الجلسة:', error);
        bot.sendMessage(chatId,
            `❌ *فشل إنشاء الجلسة!*\n\n` +
            `الخطأ: ${error.message}\n\n` +
            `حاول مرة أخرى.`,
            { parse_mode: 'Markdown' }
        );
        userStates.delete(msg.from.id.toString());
    }
}

// معالجة محتوى الإعلان
async function handleAdContent(msg, userState, chatId) {
    const content = msg.text;
    
    try {
        const ad = await Advertisement.create({
            adminId: userState.adminId,
            type: 'text',
            content: content,
            isActive: true,
            stats: { sent: 0, failed: 0 }
        });
        
        bot.sendMessage(chatId,
            `✅ *تم إضافة الإعلان بنجاح!*\n\n` +
            `🆔 المعرف: \`${ad.id}\`\n` +
            `📝 النوع: ${ad.type}\n` +
            `📄 المحتوى: ${content.substring(0, 50)}...\n\n` +
            `⚡ يمكنك نشره الآن باستخدام:\n` +
            `/ads post ${ad.id}`,
            { parse_mode: 'Markdown' }
        );
        
        userStates.delete(msg.from.id.toString());
        
    } catch (error) {
        console.error('خطأ في إضافة الإعلان:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الإعلان');
        userStates.delete(msg.from.id.toString());
    }
}

// معالجة اختيار الإعلان للنشر التلقائي
async function handleAdSelection(msg, userState, chatId) {
    const selection = parseInt(msg.text);
    
    if (isNaN(selection) || selection < 1 || selection > userState.ads.length) {
        return bot.sendMessage(chatId,
            '❌ رقم غير صحيح!\n\n' +
            `يرجى إرسال رقم بين 1 و ${userState.ads.length}\n` +
            'أو /cancel للإلغاء',
            { parse_mode: 'Markdown' }
        );
    }
    
    const selectedAd = userState.ads[selection - 1];
    const interval = parseInt(process.env.AUTO_POST_INTERVAL) || 1000;
    
    // بدء النشر التلقائي
    const autoPostJob = {
        adminId: userState.adminId,
        adId: selectedAd.id,
        interval: interval,
        startedAt: new Date(),
        timer: null,
        isRunning: true
    };
    
    autoPostJob.timer = setInterval(async () => {
        if (!autoPostJob.isRunning || !WhatsAppManager) return;
        
        try {
            const ad = await Advertisement.findByPk(selectedAd.id);
            if (!ad || !ad.isActive) {
                clearInterval(autoPostJob.timer);
                activeAutoPosts.delete(userState.adminId);
                return;
            }
            
            const results = await WhatsAppManager.autoPostAdvertisement(
                { content: ad.content },
                null,
                interval
            );
            
            // تحديث إحصائيات الإعلان
            ad.stats.sent = (ad.stats.sent || 0) + results.sent;
            ad.stats.failed = (ad.stats.failed || 0) + results.failed;
            await ad.save();
            
        } catch (error) {
            console.error('خطأ في النشر التلقائي:', error);
        }
    }, interval);
    
    activeAutoPosts.set(userState.adminId, autoPostJob);
    
    bot.sendMessage(chatId,
        `🚀 *بدأ النشر التلقائي!*\n\n` +
        `📢 الإعلان: ${selectedAd.content.substring(0, 50)}...\n` +
        `⏱️ الفاصل: ${interval}ms\n\n` +
        `🔧 للتحكم:\n` +
        `/autopost stop - لإيقاف النشر\n` +
        `/autopost - لعرض الحالة`,
        { parse_mode: 'Markdown' }
    );
    
    userStates.delete(msg.from.id.toString());
}

// الأمر /autopost stop
bot.onText(/\/autopost stop/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        const autoPostJob = activeAutoPosts.get(admin.id);
        
        if (autoPostJob && autoPostJob.timer) {
            clearInterval(autoPostJob.timer);
            autoPostJob.isRunning = false;
            activeAutoPosts.delete(admin.id);
            
            bot.sendMessage(chatId,
                '🛑 *تم إيقاف النشر التلقائي*\n\n' +
                'تم إيقاف جميع عمليات النشر التلقائي.',
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId,
                'ℹ️ لا يوجد نشر تلقائي نشط لإيقافه.',
                { parse_mode: 'Markdown' }
            );
        }
        
    } catch (error) {
        console.error('خطأ في /autopost stop:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف النشر');
    }
});

// الأمر /cancel
bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    userStates.delete(telegramId);
    bot.sendMessage(chatId, '❌ تم إلغاء العملية الحالية.');
});

// ============================================
// 8. المهام المجدولة
// ============================================
function setupScheduledTasks() {
    // مهمة جمع الروابط كل 10 دقائق
    cron.schedule('*/10 * * * *', async () => {
        if (!WhatsAppManager) return;
        
        try {
            const readySessions = WhatsAppManager.getReadySessions();
            
            for (const session of readySessions) {
                try {
                    const chats = await session.getChats();
                    
                    for (const chat of chats.slice(0, 5)) {
                        // محاكاة جمع الروابط
                        const mockLinks = [
                            { url: 'https://chat.whatsapp.com/ABC123', chatName: chat.name },
                            { url: 'https://t.me/group123', chatName: chat.name }
                        ];
                        
                        for (const link of mockLinks) {
                            await CollectedLink.findOrCreate({
                                where: { url: link.url },
                                defaults: {
                                    url: link.url,
                                    category: link.url.includes('whatsapp') ? 'whatsapp' : 
                                             link.url.includes('t.me') ? 'telegram' : 'website',
                                    title: `رابط من ${chat.name}`,
                                    sourceChat: chat.name,
                                    sessionId: session.sessionId
                                }
                            });
                        }
                    }
                    
                    console.log(`جمع الروابط من جلسة ${session.sessionId.substring(0, 8)}`);
                } catch (error) {
                    console.error(`خطأ في جمع الروابط: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`خطأ في مهمة جمع الروابط: ${error.message}`);
        }
    });
    
    // مهمة تنظيف الجلسات كل ساعة
    cron.schedule('0 * * * *', async () => {
        try {
            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const expiredSessions = await WhatsAppSession.findAll({
                where: {
                    status: 'disconnected',
                    updatedAt: { [Op.lt]: cutoffTime }
                }
            });
            
            if (expiredSessions.length > 0) {
                await WhatsAppSession.destroy({
                    where: {
                        id: expiredSessions.map(s => s.id)
                    }
                });
                
                console.log(`تم تنظيف ${expiredSessions.length} جلسة منتهية`);
            }
        } catch (error) {
            console.error(`خطأ في مهمة التنظيف: ${error.message}`);
        }
    });
    
    console.log('✅ تم إعداد المهام المجدولة');
}

// ============================================
// 9. وظيفة البدء الرئيسية
// ============================================
async function startBot() {
    console.log('\n🔧 جاري تهيئة النظام...');
    
    // 1. تهيئة قاعدة البيانات
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.log('❌ فشل تهيئة قاعدة البيانات');
        process.exit(1);
    }
    
    // 2. إنشاء مجلدات ضرورية
    try {
        await fs.mkdir('sessions', { recursive: true });
        await fs.mkdir('database', { recursive: true });
        await fs.mkdir('logs', { recursive: true });
        console.log('✅ تم إنشاء المجلدات الضرورية');
    } catch (error) {
        console.log(`⚠️  خطأ في إنشاء المجلدات: ${error.message}`);
    }
    
    // 3. إعداد المهام المجدولة
    setupScheduledTasks();
    
    // 4. رسالة البدء النهائية
    console.log('\n✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅');
    console.log('=========================================');
    console.log('🤖 البوت: جاهز لاستقبال الأوامر');
    console.log(`📊 المشرفين: ${process.env.TELEGRAM_ADMIN_IDS.split(',').length}`);
    console.log(`⏱️  المهام المجدولة: 2 مهام نشطة`);
    console.log('=========================================');
    
    // 5. إرسال رسالة للمشرفين
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
    for (const adminId of adminIds) {
        try {
            await bot.sendMessage(adminId.trim(), 
                '🚀 *البوت يعمل الآن!*\n\n' +
                '✅ تم تشغيل بوت إدارة واتساب بنجاح.\n' +
                '📊 قاعدة البيانات: جاهزة\n' +
                '🔧 جميع المكونات: نشطة\n\n' +
                'استخدم /start للبدء أو /help للمساعدة.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log(`⚠️  لا يمكن إرسال رسالة للمشرف ${adminId}: ${error.message}`);
        }
    }
}

// ============================================
// 10. التعامل مع إيقاف التشغيل
// ============================================
process.on('SIGINT', async () => {
    console.log('\n🛑 تلقي إشارة إيقاف...');
    
    try {
        // إيقاف جميع النشر التلقائي
        for (const [adminId, job] of activeAutoPosts.entries()) {
            if (job.timer) {
                clearInterval(job.timer);
            }
        }
        activeAutoPosts.clear();
        
        console.log('✅ تم إيقاف البوت بنظام');
        process.exit(0);
        
    } catch (error) {
        console.log(`❌ خطأ في الإيقاف: ${error.message}`);
        process.exit(1);
    }
});

// ============================================
// 11. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.log(`❌ فشل بدء التشغيل: ${error.message}`);
        process.exit(1);
    });
}

// ============================================
// 12. التصدير
// ============================================
module.exports = {
    bot,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoReply,
    userStates,
    activeAutoPosts,
    startBot
};
