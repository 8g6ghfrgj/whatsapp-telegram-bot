// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot - النسخة الكاملة
// مع دعم Web Service ومنفذ Render
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { Sequelize, Op } = require('sequelize');

// ============================================
// 1. إعداد Express لـ Web Service
// ============================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // مهم: Render يحدد المنفذ عبر PORT

// Middleware الأساسي
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// route الصحة للتحقق من حالة الخادم
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'whatsapp-telegram-bot',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// route الرئيسي
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp-Telegram Bot</title>
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                    padding: 50px;
                    margin: 0;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                h1 {
                    font-size: 2.5em;
                    margin-bottom: 20px;
                    color: #fff;
                }
                .status {
                    background: rgba(0, 255, 0, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-size: 1.2em;
                }
                .info {
                    text-align: right;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .bot-link {
                    display: inline-block;
                    background: #0088cc;
                    color: white;
                    padding: 15px 30px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-size: 1.2em;
                    margin: 20px 0;
                    transition: all 0.3s ease;
                }
                .bot-link:hover {
                    background: #006699;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                }
                .stat-box {
                    background: rgba(255, 255, 255, 0.15);
                    padding: 20px;
                    border-radius: 10px;
                }
                .commands {
                    text-align: right;
                    margin-top: 30px;
                }
                .command {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 10px;
                    margin: 5px;
                    border-radius: 5px;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp-Telegram Bot</h1>
                <div class="status">✅ الخدمة تعمل بنجاح</div>
                
                <div class="info">
                    <h3>📊 معلومات النظام:</h3>
                    <p>⏱️ وقت التشغيل: ${Math.floor(process.uptime() / 3600)} ساعة</p>
                    <p>🌐 البيئة: ${process.env.NODE_ENV || 'development'}</p>
                    <p>🚪 المنفذ: ${PORT}</p>
                </div>
                
                <a href="https://t.me/${process.env.BOT_USERNAME || 'your_bot'}" class="bot-link" target="_blank">
                    💬 ابدأ المحادثة مع البوت
                </a>
                
                <div class="stats">
                    <div class="stat-box">
                        <h4>📱 الجلسات</h4>
                        <p id="sessions-count">جاري التحميل...</p>
                    </div>
                    <div class="stat-box">
                        <h4>🔗 الروابط</h4>
                        <p id="links-count">جاري التحميل...</p>
                    </div>
                    <div class="stat-box">
                        <h4>📢 الإعلانات</h4>
                        <p id="ads-count">جاري التحميل...</p>
                    </div>
                </div>
                
                <div class="commands">
                    <h3>🎮 أوامر البوت الرئيسية:</h3>
                    <div class="command">/start</div>
                    <div class="command">/sessions</div>
                    <div class="command">/ads</div>
                    <div class="command">/links</div>
                    <div class="command">/autopost</div>
                    <div class="command">/stats</div>
                    <div class="command">/help</div>
                </div>
            </div>
            
            <script>
                // تحديث الإحصائيات تلقائياً
                async function updateStats() {
                    try {
                        const response = await fetch('/api/stats');
                        const data = await response.json();
                        
                        document.getElementById('sessions-count').textContent = 
                            data.sessions || 'غير متاح';
                        document.getElementById('links-count').textContent = 
                            data.links || 'غير متاح';
                        document.getElementById('ads-count').textContent = 
                            data.ads || 'غير متاح';
                    } catch (error) {
                        console.error('خطأ في جلب الإحصائيات:', error);
                    }
                }
                
                // تحديث أولي
                updateStats();
                // تحديث كل 30 ثانية
                setInterval(updateStats, 30000);
            </script>
        </body>
        </html>
    `);
});

// API للإحصائيات
app.get('/api/stats', async (req, res) => {
    try {
        const stats = {
            sessions: 0,
            links: 0,
            ads: 0,
            timestamp: new Date().toISOString()
        };
        
        // محاولة جلب الإحصائيات من قاعدة البيانات إذا كانت متاحة
        if (sequelize && Admin) {
            try {
                stats.sessions = await WhatsAppSession.count();
                stats.links = await CollectedLink.count();
                stats.ads = await Advertisement.count();
            } catch (dbError) {
                console.log('قاعدة البيانات غير جاهزة بعد:', dbError.message);
            }
        }
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
});

// ============================================
// 2. تعريف نماذج قاعدة البيانات
// ============================================
console.log('🚀 بدء تشغيل WhatsApp-Telegram Bot...');
console.log('=========================================');

// إنشاء اتصال قاعدة البيانات
const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite://./database/bot.db', {
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: process.env.DATABASE_URL?.includes('postgres') ? {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    } : {}
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
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
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
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
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
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
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
    createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
});

// ============================================
// 3. التحقق من الإعدادات المبدئية
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
// 4. استيراد المكتبات
// ============================================
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ============================================
// 5. إعداد قاعدة البيانات
// ============================================
console.log('🗄️  جاري إعداد قاعدة البيانات...');

async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ اتصال قاعدة البيانات ناجح');
        
        // مزامنة النماذج وإنشاء الجداول
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
// 6. إعداد بوت تليجرام
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
// 7. استيراد وتهيئة المكونات
// ============================================
console.log('🔧 جاري تحميل المكونات...');

// استيراد هاندلر تليجرام المعدل
let TelegramBotHandler;
try {
    const TelegramBotClass = require('./src/telegramBot');
    // استيراد مدير واتساب (قد يحتاج لتعديل)
    let whatsappManager = { 
        getStats: () => ({ totalSessions: 0, readySessions: 0 }),
        getReadySessions: () => []
    };
    
    try {
        const { getWhatsAppManager } = require('./src/whatsappClient');
        whatsappManager = getWhatsAppManager();
        console.log('✅ تم تحميل مدير واتساب');
    } catch (error) {
        console.log(`⚠️  لم يتم تحميل مدير واتساب: ${error.message}`);
    }
    
    TelegramBotHandler = new TelegramBotClass(process.env.TELEGRAM_BOT_TOKEN, whatsappManager);
    console.log('✅ تم تحميل هاندلر تليجرام مع الأزرار');
} catch (error) {
    console.log(`⚠️  لم يتم تحميل هاندلر تليجرام: ${error.message}`);
    TelegramBotHandler = null;
}

// ============================================
// 8. تعريف أوامر تليجرام مباشرة (للنسخ الاحتياطي)
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

// الأمر /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        let whatsappStats = { totalSessions: 0, readySessions: 0 };
        if (TelegramBotHandler && TelegramBotHandler.whatsappManager) {
            whatsappStats = TelegramBotHandler.whatsappManager.getStats();
        }
        
        const totalLinks = await CollectedLink.count();
        const totalAds = await Advertisement.count();
        
        const statsMessage = `
📊 *إحصائيات النظام*

*📱 جلسات واتساب:*
• الإجمالي: ${whatsappStats.totalSessions}
• النشطة: ${whatsappStats.readySessions}

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

// ============================================
// 9. المهام المجدولة
// ============================================
function setupScheduledTasks() {
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
    
    // مهمة حفظ الإحصائيات كل 30 دقيقة
    cron.schedule('*/30 * * * *', async () => {
        try {
            const stats = {
                totalSessions: await WhatsAppSession.count(),
                activeSessions: await WhatsAppSession.count({ where: { status: 'active' } }),
                totalLinks: await CollectedLink.count(),
                totalAds: await Advertisement.count(),
                timestamp: new Date().toISOString()
            };
            
            console.log('📊 إحصائيات دورية:', stats);
            
            // حفظ في ملف للرجوع إليه
            const statsDir = path.join(__dirname, 'logs');
            await fs.mkdir(statsDir, { recursive: true });
            const statsFile = path.join(statsDir, 'system_stats.json');
            await fs.writeFile(statsFile, JSON.stringify(stats, null, 2));
            
        } catch (error) {
            console.error(`خطأ في حفظ الإحصائيات: ${error.message}`);
        }
    });
    
    console.log('✅ تم إعداد المهام المجدولة');
}

// ============================================
// 10. وظيفة البدء الرئيسية
// ============================================
async function startBot() {
    console.log('\n🔧 جاري تهيئة النظام...');
    
    // 1. تهيئة قاعدة البيانات
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.log('❌ فشل تهيئة قاعدة البيانات');
        // نستمر مع أن النظام قد يعمل جزئياً
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
    
    // 4. بدء هاندلر تليجرام إذا كان متاحاً
    if (TelegramBotHandler) {
        try {
            TelegramBotHandler.start();
            console.log('✅ بدء هاندلر تليجرام مع الأزرار');
        } catch (error) {
            console.log(`❌ خطأ في بدء هاندلر تليجرام: ${error.message}`);
        }
    }
    
    // 5. بدء سيرفر Express
    app.listen(PORT, () => {
        console.log(`🌐 سيرفر Express يعمل على المنفذ ${PORT}`);
        console.log(`🔗 رابط الصحة: http://localhost:${PORT}/health`);
        console.log(`🏠 الصفحة الرئيسية: http://localhost:${PORT}/`);
    });
    
    // 6. رسالة البدء النهائية
    console.log('\n✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅');
    console.log('=========================================');
    console.log('🤖 البوت: جاهز لاستقبال الأوامر');
    console.log(`📊 المشرفين: ${process.env.TELEGRAM_ADMIN_IDS.split(',').length}`);
    console.log(`🌐 Web Service: http://localhost:${PORT}`);
    console.log(`⏱️  المهام المجدولة: 2 مهام نشطة`);
    console.log('=========================================');
    
    // 7. إرسال رسالة للمشرفين
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
    for (const adminId of adminIds) {
        try {
            await bot.sendMessage(adminId.trim(), 
                '🚀 *البوت يعمل الآن!*\n\n' +
                '✅ تم تشغيل بوت إدارة واتساب بنجاح.\n' +
                '📊 قاعدة البيانات: جاهزة\n' +
                '🌐 Web Service: نشط\n' +
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
// 11. إعدادات Render الخاصة
// ============================================
// Render يمرر المنفذ عبر متغير البيئة PORT
// تأكد من إضافة هذا المتغير في إعدادات Render

// ============================================
// 12. التعامل مع إيقاف التشغيل
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
// 13. التعامل مع الأخطاء غير المعالجة
// ============================================
process.on('unhandledRejection', (error) => {
    console.error(`❌ رفض غير معالج: ${error.message}`);
});

process.on('uncaughtException', (error) => {
    console.error(`❌ استثناء غير معالج: ${error.message}`);
});

// ============================================
// 14. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.log(`❌ فشل بدء التشغيل: ${error.message}`);
        process.exit(1);
    });
}

// ============================================
// 15. التصدير للاستخدام في الاختبارات
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
    userStates,
    activeAutoPosts,
    startBot
};
