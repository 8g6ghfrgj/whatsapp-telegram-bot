// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot
// نظام متعدد المشرفين وجلسات متعددة
// ============================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================
// 1. التحقق من الإعدادات المبدئية
// ============================================
console.log(chalk.cyan('🚀 بدء تشغيل WhatsApp-Telegram Bot...'));
console.log(chalk.gray('========================================='));

// التحقق من المتغيرات البيئية الأساسية
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_IDS', 'ENCRYPTION_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.log(chalk.red('❌ متغيرات بيئية مفقودة:'));
    missingEnvVars.forEach(varName => {
        console.log(chalk.red(`   - ${varName}`));
    });
    console.log(chalk.yellow('📝 راجع ملف .env.example وأنشئ ملف .env'));
    process.exit(1);
}

// ============================================
// 2. استيراد المكتبات
// ============================================
const chalk = require('chalk');
const TelegramBot = require('node-telegram-bot-api');
const { Sequelize } = require('sequelize');
const winston = require('winston');
const express = require('express');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ============================================
// 3. إعداد نظام التسجيل (Logging)
// ============================================
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        ...(process.env.LOG_TO_FILE === 'true' ? [
            new winston.transports.File({ 
                filename: process.env.LOG_FILE_PATH || './logs/bot.log',
                maxsize: 5242880, // 5MB
                maxFiles: 5
            })
        ] : [])
    ]
});

global.logger = logger;

// ============================================
// 4. إعداد قاعدة البيانات
// ============================================
console.log(chalk.blue('🗄️  جاري إعداد قاعدة البيانات...'));

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    logging: process.env.DB_LOGGING === 'true' ? msg => logger.debug(msg) : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// تعريف النماذج
const Admin = sequelize.define('Admin', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    telegramId: { type: Sequelize.STRING, unique: true, allowNull: false },
    username: { type: Sequelize.STRING },
    firstName: { type: Sequelize.STRING },
    lastName: { type: Sequelize.STRING },
    passwordHash: { type: Sequelize.STRING },
    permissions: { type: Sequelize.JSON, defaultValue: ['basic'] },
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { type: Sequelize.STRING, primaryKey: true, defaultValue: () => uuidv4() },
    sessionId: { type: Sequelize.STRING, unique: true },
    phoneNumber: { type: Sequelize.STRING },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    sessionData: { type: Sequelize.TEXT }, // مخزن كمشفر JSON
    status: { 
        type: Sequelize.ENUM('pending', 'authenticating', 'active', 'disconnected', 'error'),
        defaultValue: 'pending'
    },
    qrCode: { type: Sequelize.TEXT },
    lastActivity: { type: Sequelize.DATE },
    metadata: { type: Sequelize.JSON },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

const CollectedLink = sequelize.define('CollectedLink', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: Sequelize.STRING, unique: true, allowNull: false },
    category: { 
        type: Sequelize.ENUM('whatsapp', 'telegram', 'website', 'other'),
        defaultValue: 'other'
    },
    title: { type: Sequelize.STRING },
    description: { type: Sequelize.TEXT },
    sourceChat: { type: Sequelize.STRING },
    sessionId: { type: Sequelize.STRING },
    collectedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

const Advertisement = sequelize.define('Advertisement', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: Sequelize.INTEGER, allowNull: false },
    type: { 
        type: Sequelize.ENUM('text', 'image', 'video', 'contact', 'document'),
        defaultValue: 'text'
    },
    content: { type: Sequelize.TEXT, allowNull: false },
    fileId: { type: Sequelize.STRING },
    caption: { type: Sequelize.TEXT },
    isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
    schedule: { type: Sequelize.JSON },
    stats: { type: Sequelize.JSON, defaultValue: { sent: 0, failed: 0 } },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

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
    cooldown: { type: Sequelize.INTEGER, defaultValue: 30 }, // ثواني
    stats: { type: Sequelize.JSON, defaultValue: { triggered: 0 } },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

const Group = sequelize.define('Group', {
    id: { type: Sequelize.STRING, primaryKey: true },
    name: { type: Sequelize.STRING },
    sessionId: { type: Sequelize.STRING, allowNull: false },
    participantCount: { type: Sequelize.INTEGER },
    isMuted: { type: Sequelize.BOOLEAN, defaultValue: false },
    isArchived: { type: Sequelize.BOOLEAN, defaultValue: false },
    lastMessageAt: { type: Sequelize.DATE },
    metadata: { type: Sequelize.JSON },
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// العلاقات بين الجداول
Admin.hasMany(WhatsAppSession, { foreignKey: 'adminId' });
WhatsAppSession.belongsTo(Admin, { foreignKey: 'adminId' });

Admin.hasMany(Advertisement, { foreignKey: 'adminId' });
Advertisement.belongsTo(Admin, { foreignKey: 'adminId' });

Admin.hasMany(AutoReply, { foreignKey: 'adminId' });
AutoReply.belongsTo(Admin, { foreignKey: 'adminId' });

WhatsAppSession.hasMany(CollectedLink, { foreignKey: 'sessionId', sourceKey: 'sessionId' });
WhatsAppSession.hasMany(Group, { foreignKey: 'sessionId', sourceKey: 'sessionId' });

// ============================================
// 5. تهيئة قاعدة البيانات
// ============================================
async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log(chalk.green('✅ اتصال قاعدة البيانات ناجح'));
        
        // مزامنة النماذج (يمكن تغييرها إلى migrations لاحقاً)
        await sequelize.sync({ alter: true });
        console.log(chalk.green('✅ تم مزامنة نماذج قاعدة البيانات'));
        
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
                logger.info(`تم إنشاء مشرف جديد: ${telegramId}`);
            }
        }
        
        return true;
    } catch (error) {
        console.log(chalk.red(`❌ خطأ في قاعدة البيانات: ${error.message}`));
        logger.error(`فشل تهيئة قاعدة البيانات: ${error.message}`, { error });
        return false;
    }
}

// ============================================
// 6. إعداد بوت تليجرام
// ============================================
console.log(chalk.blue('🤖 جاري إعداد بوت تليجرام...'));

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// تخزين حالات المستخدمين للواجهات التفاعلية
const userStates = new Map();
const userSessions = new Map();

// ============================================
// 7. استيراد وتهيئة المكونات
// ============================================
console.log(chalk.blue('🔧 جاري تحميل المكونات...'));

// استيراد مدير واتساب (سيتم إنشاؤه لاحقاً)
let WhatsAppManager;
try {
    WhatsAppManager = require('./src/whatsappClient');
    console.log(chalk.green('✅ تم تحميل مدير واتساب'));
} catch (error) {
    console.log(chalk.yellow(`⚠️  لم يتم تحميل مدير واتساب بعد: ${error.message}`));
    WhatsAppManager = null;
}

// استيراد الخدمات (سيتم إنشاؤها لاحقاً)
const services = {
    linkCollector: null,
    autoPoster: null,
    autoJoiner: null,
    replyManager: null
};

// ============================================
// 8. تعريف الأوامر الأساسية للبوت
// ============================================
console.log(chalk.blue('📋 جاري تسجيل أوامر البوت...'));

// قائمة الأوامر الرسمية
bot.setMyCommands([
    { command: 'start', description: 'بدء استخدام البوت' },
    { command: 'help', description: 'عرض التعليمات' },
    { command: 'sessions', description: 'إدارة جلسات واتساب' },
    { command: 'links', description: 'عرض الروابط المجمعة' },
    { command: 'ads', description: 'إدارة الإعلانات' },
    { command: 'autopost', description: 'النشر التلقائي' },
    { command: 'autoreply', description: 'إدارة الردود التلقائية' },
    { command: 'join', description: 'الانضمام للمجموعات' },
    { command: 'stats', description: 'إحصائيات البوت' },
    { command: 'admin', description: 'أدوات المشرف' }
]);

// ============================================
// 9. معالجة الأوامر الأساسية
// ============================================

// الأمر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        // التحقق إذا كان المستخدم مشرفاً
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
/admin - أدوات المشرف

*💼 حالتك:* ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}
*🎫 الصلاحيات:* ${admin.permissions.join(', ')}
        `;
        
        bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        logger.info(`المشرف ${telegramId} بدأ استخدام البوت`);
        
    } catch (error) {
        logger.error(`خطأ في الأمر /start: ${error.message}`, { error });
        bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
    }
});

// الأمر /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
*🆘 مركز المساعدة*

*🔗 إدارة الجلسات:*
/sessions - عرض جميع الجلسات
/sessions add - إضافة جلسة جديدة
/sessions remove <id> - حذف جلسة
/sessions qr <id> - عرض QR code

*📊 جمع الروابط:*
/links - عرض جميع الروابط
/links whatsapp - روابط واتساب فقط
/links telegram - روابط تليجرام فقط
/links export - تصدير الروابط

*📢 الإعلانات:*
/ads - عرض الإعلانات
/ads add - إضافة إعلان جديد
/ads edit <id> - تعديل إعلان
/ads delete <id> - حذف إعلان
/ads stats - إحصائيات الإعلانات

*🚀 النشر التلقائي:*
/autopost start - بدء النشر التلقائي
/autopost stop - إيقاف النشر التلقائي
/autopost status - حالة النشر
/autopost interval <ثواني> - ضبط الفترة

*👥 الانضمام التلقائي:*
/join auto <on/off> - تفعيل/تعطيل الانضمام
/join list - المجموعات المنضمة
/join stats - إحصائيات الانضمام

*🤖 الردود التلقائية:*
/autoreply - عرض الردود
/autoreply add - إضافة رد جديد
/autoreply delete <id> - حذف رد

*📈 الإحصائيات:*
/stats - إحصائيات عامة
/stats sessions - إحصائيات الجلسات
/stats links - إحصائيات الروابط

*👑 أدوات المشرف:*
/admin list - قائمة المشرفين
/admin add <id> - إضافة مشرف
/admin remove <id> - حذف مشرف
/admin permissions <id> <صلاحيات> - تعديل الصلاحيات

*❓ للمساعدة:* @دعم_البوت
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// ============================================
// 10. نظام إدارة الجلسات
// ============================================

// عرض جميع الجلسات
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
            message += `   📅 آخر نشاط: ${new Date(session.lastActivity).toLocaleDateString('ar-SA')}\n`;
            message += `   🔧 [QR Code](/sessions qr ${session.id}) | [حذف](/sessions remove ${session.id})\n\n`;
        });
        
        message += `\n📌 *الأوامر:*\n`;
        message += `/sessions add - إضافة جلسة جديدة\n`;
        message += `/sessions refresh - تحديث الحالات\n`;
        
        bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        logger.error(`خطأ في عرض الجلسات: ${error.message}`, { error });
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
    }
});

// إضافة جلسة جديدة
bot.onText(/\/sessions add/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        // التحقق من الحد الأقصى للجلسات
        const sessionCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
        const maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 5;
        
        if (sessionCount >= maxSessions) {
            return bot.sendMessage(chatId,
                `❌ لقد وصلت للحد الأقصى من الجلسات (${maxSessions}).\n` +
                `يرجى حذف جلسة قبل إضافة جديدة.`
            );
        }
        
        // إنشاء جلسة جديدة
        const sessionId = uuidv4();
        const newSession = await WhatsAppSession.create({
            sessionId: sessionId,
            adminId: admin.id,
            status: 'pending'
        });
        
        // تخزين حالة المستخدم للاستكمال
        userStates.set(telegramId, {
            state: 'awaiting_phone',
            sessionId: newSession.id
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
        logger.error(`خطأ في إضافة جلسة: ${error.message}`, { error });
        bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الجلسة');
    }
});

// ============================================
// 11. معالجة الرسائل النصية (للاستكمال التفاعلي)
// ============================================
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // تجاهل الأوامر
    
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const userState = userStates.get(telegramId);
    
    if (!userState) return;
    
    try {
        switch (userState.state) {
            case 'awaiting_phone':
                await handlePhoneNumberInput(msg, userState);
                break;
            // يمكن إضافة حالات أخرى لاحقاً
        }
    } catch (error) {
        logger.error(`خطأ في معالجة الرسالة: ${error.message}`, { error });
        userStates.delete(telegramId);
        bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
    }
});

// معالجة إدخال رقم الهاتف
async function handlePhoneNumberInput(msg, userState) {
    const chatId = msg.chat.id;
    const phoneNumber = msg.text.trim();
    
    // التحقق من صحة رقم الهاتف
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
        // تحديث الجلسة برقم الهاتف
        await WhatsAppSession.update(
            { phoneNumber: phoneNumber, status: 'authenticating' },
            { where: { id: userState.sessionId } }
        );
        
        // تغيير حالة المستخدم
        userState.state = 'awaiting_qr';
        
        // هنا سيكون توليد QR code من مدير واتساب
        // مؤقتاً: إرسال رسالة توضيحية
        bot.sendMessage(chatId,
            `✅ تم حفظ رقم الهاتف: ${phoneNumber}\n\n` +
            `📱 جاري تحضير QR code للاتصال...\n` +
            `الرجاء الانتظار لحظة.`
        );
        
        // محاكاة إنشاء QR (في النسخة الكاملة سيتم الاتصال بـ WhatsAppManager)
        setTimeout(async () => {
            try {
                // في الواقع، هنا سيتم استدعاء WhatsAppManager لإنشاء الجلسة
                const qrCode = "SIMULATED_QR_CODE_DATA";
                
                await WhatsAppSession.update(
                    { 
                        qrCode: qrCode,
                        status: 'pending'
                    },
                    { where: { id: userState.sessionId } }
                );
                
                bot.sendMessage(chatId,
                    `📲 *QR Code جاهز للمسح*\n\n` +
                    `1. افتح واتساب على هاتفك\n` +
                    `2. اذهب إلى الإعدادات → الأجهزة المرتبطة\n` +
                    `3. انقر على "ربط جهاز"\n` +
                    `4. مسح QR Code التالي:\n\n` +
                    `[QR Code سيظهر هنا في النسخة الكاملة]\n\n` +
                    `⏳ هذا QR صالح لمدة 60 ثانية\n` +
                    `🔄 سيتم تجديده تلقائياً إذا انتهت`,
                    { parse_mode: 'Markdown' }
                );
                
                // مسح حالة المستخدم بعد 5 دقائق
                setTimeout(() => {
                    userStates.delete(msg.from.id.toString());
                }, 5 * 60 * 1000);
                
            } catch (error) {
                logger.error(`خطأ في إنشاء QR: ${error.message}`, { error });
                bot.sendMessage(chatId, '❌ حدث خطأ في إنشاء QR code');
                userStates.delete(msg.from.id.toString());
            }
        }, 2000);
        
    } catch (error) {
        logger.error(`خطأ في حفظ رقم الهاتف: ${error.message}`, { error });
        throw error;
    }
}

// ============================================
// 12. إعداد سيرفر Express للواجهة الداخلية
// ============================================
function setupExpressServer() {
    const app = express();
    const PORT = process.env.SERVER_PORT || 3000;
    
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // route أساسي للتحقق من حالة الخادم
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            sessions: userSessions.size,
            uptime: process.uptime()
        });
    });
    
    // route لحالة الجلسات (محمي بمفتاح API)
    app.get('/api/sessions', (req, res) => {
        const apiKey = req.headers['x-api-key'];
        
        if (apiKey !== process.env.API_SECRET_KEY) {
            return res.status(401).json({ error: 'غير مصرح' });
        }
        
        const sessions = Array.from(userSessions.entries()).map(([key, session]) => ({
            sessionId: key,
            adminId: session.adminId,
            status: session.status,
            phoneNumber: session.phoneNumber
        }));
        
        res.json({ sessions });
    });
    
    // بدء السيرفر
    app.listen(PORT, () => {
        logger.info(`سيرفر Express يعمل على المنفذ ${PORT}`);
        console.log(chalk.green(`🌐 سيرفر Express يعمل على http://localhost:${PORT}`));
    });
    
    return app;
}

// ============================================
// 13. المهام المجدولة
// ============================================
function setupScheduledTasks() {
    // مهمة تنظيف الجلسات المنتهية كل ساعة
    cron.schedule('0 * * * *', async () => {
        try {
            const timeout = parseInt(process.env.WHATSAPP_SESSION_TIMEOUT) || 300000;
            const cutoffTime = new Date(Date.now() - timeout);
            
            const expiredSessions = await WhatsAppSession.findAll({
                where: {
                    status: 'pending',
                    lastActivity: { [Sequelize.Op.lt]: cutoffTime }
                }
            });
            
            if (expiredSessions.length > 0) {
                await WhatsAppSession.destroy({
                    where: {
                        id: expiredSessions.map(s => s.id)
                    }
                });
                
                logger.info(`تم تنظيف ${expiredSessions.length} جلسة منتهية`);
            }
        } catch (error) {
            logger.error(`خطأ في مهمة التنظيف: ${error.message}`, { error });
        }
    });
    
    // مهمة حفظ الإحصائيات كل يوم
    cron.schedule('0 0 * * *', async () => {
        try {
            const stats = {
                totalSessions: await WhatsAppSession.count(),
                activeSessions: await WhatsAppSession.count({ where: { status: 'active' } }),
                totalLinks: await CollectedLink.count(),
                totalAds: await Advertisement.count({ where: { isActive: true } }),
                timestamp: new Date()
            };
            
            logger.info('إحصائيات يومية:', stats);
        } catch (error) {
            logger.error(`خطأ في حفظ الإحصائيات: ${error.message}`, { error });
        }
    });
    
    console.log(chalk.green('✅ تم إعداد المهام المجدولة'));
}

// ============================================
// 14. وظيفة البدء الرئيسية
// ============================================
async function startBot() {
    console.log(chalk.cyan('\n🔧 جاري تهيئة النظام...'));
    
    // 1. تهيئة قاعدة البيانات
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.log(chalk.red('❌ فشل تهيئة قاعدة البيانات'));
        process.exit(1);
    }
    
    // 2. إعداد سيرفر Express
    if (process.env.NODE_ENV !== 'test') {
        setupExpressServer();
    }
    
    // 3. إعداد المهام المجدولة
    setupScheduledTasks();
    
    // 4. تهيئة مدير واتساب (إذا كان موجوداً)
    if (WhatsAppManager) {
        try {
            // سيتم إنشاء هذا في ملف whatsappClient.js
            console.log(chalk.yellow('⚠️  مدير واتساب يحتاج لملف whatsappClient.js'));
        } catch (error) {
            console.log(chalk.red(`❌ خطأ في مدير واتساب: ${error.message}`));
        }
    }
    
    // 5. رسالة البدء النهائية
    console.log(chalk.green('\n✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅'));
    console.log(chalk.cyan('========================================='));
    console.log(chalk.white('🤖 البوت: جاهز لاستقبال الأوامر'));
    console.log(chalk.white(`📊 المشرفين: ${process.env.TELEGRAM_ADMIN_IDS.split(',').length}`));
    console.log(chalk.white(`🗄️  قاعدة البيانات: ${process.env.DATABASE_URL}`));
    console.log(chalk.white(`🌐 الواجهة: http://localhost:${process.env.SERVER_PORT || 3000}/health`));
    console.log(chalk.cyan('========================================='));
    
    // إرسال رسالة للمشرفين
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
    for (const adminId of adminIds) {
        try {
            await bot.sendMessage(adminId.trim(), 
                '🚀 *البوت يعمل الآن!*\n\n' +
                'تم تشغيل بوت إدارة واتساب بنجاح.\n' +
                'استخدم /start للبدء أو /help للمساعدة.',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log(chalk.yellow(`⚠️  لا يمكن إرسال رسالة للمشرف ${adminId}: ${error.message}`));
        }
    }
}

// ============================================
// 15. التعامل مع إيقاف التشغيل
// ============================================
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 تلقي إشارة إيقاف...'));
    
    try {
        // حفظ جميع الجلسات النشطة
        if (WhatsAppManager && WhatsAppManager.saveAllSessions) {
            await WhatsAppManager.saveAllSessions();
        }
        
        // إغلاق قاعدة البيانات
        await sequelize.close();
        
        // إرسال رسالة للمشرفين
        const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
        for (const adminId of adminIds) {
            try {
                await bot.sendMessage(adminId.trim(), 
                    '🛑 *البوت متوقف*\n\n' +
                    'تم إيقاف بوت إدارة واتساب.\n' +
                    'سيتم إعادة التشغيل تلقائياً على Render.',
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                // تجاهل الأخطاء في الإرسال
            }
        }
        
        console.log(chalk.green('✅ تم إيقاف البوت بنظام'));
        process.exit(0);
        
    } catch (error) {
        console.log(chalk.red(`❌ خطأ في الإيقاف: ${error.message}`));
        process.exit(1);
    }
});

// ============================================
// 16. التعامل مع الأخطاء غير المعالجة
// ============================================
process.on('unhandledRejection', (error) => {
    logger.error(`رفض غير معالج: ${error.message}`, { error });
    console.log(chalk.red(`❌ رفض غير معالج: ${error.message}`));
});

process.on('uncaughtException', (error) => {
    logger.error(`استثناء غير معالج: ${error.message}`, { error });
    console.log(chalk.red(`❌ استثناء غير معالج: ${error.message}`));
    // لا نخرج من العملية، بل نستمر مع تسجيل الخطأ
});

// ============================================
// 17. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.log(chalk.red(`❌ فشل بدء التشغيل: ${error.message}`));
        logger.error(`فشل بدء التشغيل: ${error.message}`, { error });
        process.exit(1);
    });
}

// ============================================
// 18. التصدير للمكونات الأخرى
// ============================================
module.exports = {
    bot,
    sequelize,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoReply,
    Group,
    userStates,
    userSessions,
    logger,
    startBot
};
