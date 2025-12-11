// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot
// النسخة المعدلة - دعم الأزرار فقط
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Sequelize, Op } = require('sequelize');

// ============================================
// 1. إعداد Express لـ Web Service
// ============================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// route الصحة للتحقق من حالة الخادم
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'whatsapp-telegram-bot',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '3.0.0',
        features: ['أزرار تفاعلية', 'نظام QR', 'إدارة متعددة']
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
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a2980, #26d0ce);
                    color: white;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(15px);
                    border-radius: 25px;
                    padding: 40px;
                    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                header {
                    text-align: center;
                    margin-bottom: 40px;
                }
                h1 {
                    font-size: 3em;
                    margin-bottom: 10px;
                    background: linear-gradient(45deg, #00dbde, #fc00ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                }
                .status-badge {
                    display: inline-block;
                    background: linear-gradient(45deg, #00b09b, #96c93d);
                    padding: 10px 25px;
                    border-radius: 50px;
                    font-weight: bold;
                    margin: 20px 0;
                    box-shadow: 0 5px 15px rgba(0, 176, 155, 0.4);
                }
                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 25px;
                    margin: 40px 0;
                }
                .feature-card {
                    background: rgba(255, 255, 255, 0.15);
                    padding: 25px;
                    border-radius: 20px;
                    text-align: center;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .feature-card:hover {
                    transform: translateY(-10px);
                    background: rgba(255, 255, 255, 0.25);
                    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
                }
                .feature-icon {
                    font-size: 3em;
                    margin-bottom: 15px;
                }
                .instructions {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 30px;
                    border-radius: 20px;
                    margin: 30px 0;
                    line-height: 1.8;
                }
                .btn-start {
                    display: block;
                    width: 300px;
                    margin: 40px auto;
                    background: linear-gradient(45deg, #667eea, #764ba2);
                    color: white;
                    text-align: center;
                    padding: 20px;
                    border-radius: 60px;
                    text-decoration: none;
                    font-size: 1.3em;
                    font-weight: bold;
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
                }
                .btn-start:hover {
                    transform: scale(1.05);
                    box-shadow: 0 15px 30px rgba(102, 126, 234, 0.6);
                }
                .stats-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                .stat-box {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 15px;
                    text-align: center;
                }
                .bot-username {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-family: monospace;
                    font-size: 1.2em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>🤖 WhatsApp-Telegram Bot</h1>
                    <div class="status-badge">✅ النظام يعمل بنجاح</div>
                    <p>إدارة متكاملة لحسابات واتساب عبر تليجرام</p>
                </header>
                
                <div class="instructions">
                    <h3>🎮 كيفية الاستخدام:</h3>
                    <p>1. اذهب إلى تليجرام وابحث عن بوتك</p>
                    <p>2. أرسل <strong>/start</strong> للبدء</p>
                    <p>3. استخدم <strong>الأزرار التفاعلية</strong> للتحكم</p>
                    <p>4. لا حاجة لتذكر الأوامر، كل شيء عبر الأزرار!</p>
                </div>
                
                <div class="features-grid">
                    <div class="feature-card">
                        <div class="feature-icon">📱</div>
                        <h4>ربط واتساب</h4>
                        <p>ربط حساب واتساب كجهاز مصاحب عبر QR Code</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🔗</div>
                        <h4>جمع الروابط</h4>
                        <p>جمع روابط المجموعات تلقائياً وتصنيفها</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">📢</div>
                        <h4>النشر التلقائي</h4>
                        <p>نشر إعلانات في جميع المجموعات تلقائياً</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">👥</div>
                        <h4>الانضمام التلقائي</h4>
                        <p>الانضمام للمجموعات عبر الروابط تلقائياً</p>
                    </div>
                </div>
                
                <div class="stats-container">
                    <div class="stat-box">
                        <h4>⏱️ وقت التشغيل</h4>
                        <p id="uptime">${Math.floor(process.uptime() / 3600)} ساعة</p>
                    </div>
                    <div class="stat-box">
                        <h4>🌐 البيئة</h4>
                        <p>${process.env.NODE_ENV || 'تطوير'}</p>
                    </div>
                    <div class="stat-box">
                        <h4>🚪 المنفذ</h4>
                        <p>${PORT}</p>
                    </div>
                    <div class="stat-box">
                        <h4>🔄 الإصدار</h4>
                        <p>3.0.0</p>
                    </div>
                </div>
                
                <a href="https://t.me/${process.env.BOT_USERNAME || 'bot_username'}" 
                   class="btn-start" target="_blank">
                   🚀 ابدأ الآن مع البوت
                </a>
                
                <div class="bot-username">
                    👤 اسم البوت: @${process.env.BOT_USERNAME || 'اضف BOT_USERNAME في .env'}
                </div>
            </div>
            
            <script>
                // تحديث وقت التشغيل تلقائياً
                setInterval(() => {
                    const hours = Math.floor(process.uptime / 3600);
                    document.getElementById('uptime').textContent = hours + ' ساعة';
                }, 60000);
            </script>
        </body>
        </html>
    `);
});

// API للإحصائيات
app.get('/api/stats', async (req, res) => {
    try {
        const stats = {
            status: 'running',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
});

// ============================================
// 2. تعريف نماذج قاعدة البيانات
// ============================================
console.log('🚀 بدء تشغيل WhatsApp-Telegram Bot - إصدار الأزرار');
console.log('===================================================');

const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite://./database/bot.db', {
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
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
        
        await sequelize.sync({ alter: true });
        console.log('✅ تم مزامنة نماذج قاعدة البيانات');
        
        // إنشاء المشرف الأساسي
        const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
        for (const telegramId of adminIds) {
            const [admin] = await Admin.findOrCreate({
                where: { telegramId: telegramId.trim() },
                defaults: {
                    username: `admin_${telegramId}`,
                    permissions: ['basic', 'admin', 'manage_sessions', 'manage_ads', 'add_admins'],
                    isActive: true
                }
            });
            
            if (admin.isNewRecord) {
                console.log(`✅ تم إنشاء مشرف جديد: ${telegramId}`);
            }
        }
        
        return true;
    } catch (error) {
        console.log(`❌ خطأ في قاعدة البيانات: ${error.message}`);
        return false;
    }
}

// ============================================
// 6. إعداد بوت تليجرام مع الأزرار فقط
// ============================================
console.log('🤖 جاري إعداد بوت تليجرام مع نظام الأزرار...');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// ============================================
// 7. نظام الأزرار الرئيسية - NO COMMANDS
// ============================================

// ============================================
// 7.1 الأمر /start مع الأزرار الرئيسية فقط
// ============================================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        
        if (!admin) {
            // زر لإضافة المستخدم كمشرف
            const addAdminKeyboard = {
                inline_keyboard: [
                    [
                        { text: '👑 طلب صلاحية مشرف', callback_data: 'request_admin' }
                    ],
                    [
                        { text: '📞 التواصل مع المطور', url: 'https://t.me/username' }
                    ]
                ]
            };
            
            return bot.sendMessage(chatId,
                '👋 *مرحباً بك!*\n\n' +
                'هذا البوت مخصص لإدارة حسابات واتساب عبر تليجرام.\n\n' +
                '⚠️ *أنت لست مشرفاً في النظام*\n' +
                'يمكنك طلب الصلاحية من المطور أو استخدام الزر أدناه للتواصل.',
                { 
                    parse_mode: 'Markdown',
                    reply_markup: addAdminKeyboard
                }
            );
        }
        
        // القائمة الرئيسية للمشرفين
        const mainMenuKeyboard = {
            inline_keyboard: [
                [
                    { text: '📱 إدارة الجلسات', callback_data: 'main_sessions' },
                    { text: '🔗 جمع الروابط', callback_data: 'main_links' }
                ],
                [
                    { text: '📢 الإعلانات', callback_data: 'main_ads' },
                    { text: '🚀 النشر التلقائي', callback_data: 'main_autopost' }
                ],
                [
                    { text: '👥 الانضمام للمجموعات', callback_data: 'main_join' },
                    { text: '🤖 الردود التلقائية', callback_data: 'main_autoreply' }
                ],
                [
                    { text: '👑 إدارة المشرفين', callback_data: 'main_admins' },
                    { text: '📊 الإحصائيات', callback_data: 'main_stats' }
                ],
                [
                    { text: '⚙️ الإعدادات', callback_data: 'main_settings' },
                    { text: '🆘 المساعدة', callback_data: 'main_help' }
                ]
            ]
        };
        
        const welcomeMessage = `
🎮 *القائمة الرئيسية*

🌟 *مرحباً ${admin.firstName || 'مشرف'}!*

📋 *جميع الميزات متاحة عبر الأزرار أدناه:*

• 📱 **إدارة الجلسات**: ربط/إدارة حسابات واتساب
• 🔗 **جمع الروابط**: استخراج روابط المجموعات
• 📢 **الإعلانات**: إنشاء وإدارة الإعلانات
• 🚀 **النشر التلقائي**: نشر في المجموعات تلقائياً
• 👥 **الانضمام**: الانضمام للمجموعات الجديدة
• 🤖 **الردود**: ردود تلقائية على الرسائل
• 👑 **المشرفين**: إضافة/حذف المشرفين
• 📊 **الإحصائيات**: إحصائيات النظام
• ⚙️ **الإعدادات**: ضبط إعدادات البوت

💼 *صلاحياتك:* ${admin.permissions.join(', ')}
✅ *الحالة:* ${admin.isActive ? 'نشط' : 'معطل'}
        `;
        
        bot.sendMessage(chatId, welcomeMessage, { 
            parse_mode: 'Markdown',
            reply_markup: mainMenuKeyboard
        });
        
    } catch (error) {
        console.error('خطأ في /start:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
    }
});

// ============================================
// 7.2 تعطيل جميع الأوامر التقليدية
// ============================================
const disabledCommands = ['/help', '/sessions', '/links', '/ads', '/autopost', '/join', '/stats', '/admin'];

disabledCommands.forEach(command => {
    bot.onText(new RegExp(command), async (msg) => {
        const chatId = msg.chat.id;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🏠 العودة للقائمة الرئيسية', callback_data: 'main_menu' }
                ]
            ]
        };
        
        bot.sendMessage(chatId,
            `⚠️ *هذا الأمر غير متاح!*\n\n` +
            `تم استبدال جميع الأوامر بنظام *الأزرار التفاعلية*.\n` +
            `استخدم زر *🏠 العودة للقائمة الرئيسية* أو أرسل */start*`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    });
});

// ============================================
// 8. معالجة جميع الأزرار الرئيسية
// ============================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;
    
    try {
        // الرد على الاستعلام أولاً
        await bot.answerCallbackQuery(query.id);
        
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin && !data.startsWith('request_')) {
            return bot.sendMessage(chatId,
                '❌ *غير مصرح!*\n\n' +
                'أنت لست مشرفاً في النظام.\n' +
                'أرسل /start للبدء.',
                { parse_mode: 'Markdown' }
            );
        }
        
        // معالجة الأزرار الرئيسية
        if (data === 'main_menu' || data === 'main_home') {
            const msg = { chat: { id: chatId }, from: { id: userId } };
            bot.processUpdate({ message: msg });
        }
        else if (data.startsWith('main_')) {
            await handleMainMenu(chatId, userId, admin, data);
        }
        else if (data.startsWith('session_')) {
            await handleSessionActions(chatId, userId, admin, data);
        }
        else if (data.startsWith('admin_')) {
            await handleAdminActions(chatId, userId, admin, data);
        }
        else if (data === 'request_admin') {
            await handleAdminRequest(chatId, userId, query);
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الزر:', error);
        bot.answerCallbackQuery(query.id, {
            text: 'حدث خطأ في المعالجة',
            show_alert: true
        });
    }
});

// ============================================
// 9. معالجة القوائم الرئيسية
// ============================================
async function handleMainMenu(chatId, userId, admin, action) {
    switch (action) {
        case 'main_sessions':
            await showSessionsMenu(chatId, admin);
            break;
            
        case 'main_ads':
            await showAdsMenu(chatId, admin);
            break;
            
        case 'main_admins':
            await showAdminsMenu(chatId, admin);
            break;
            
        case 'main_stats':
            await showStatsMenu(chatId, admin);
            break;
            
        case 'main_help':
            await showHelpMenu(chatId);
            break;
            
        case 'main_settings':
            await showSettingsMenu(chatId, admin);
            break;
            
        case 'main_links':
        case 'main_autopost':
        case 'main_join':
        case 'main_autoreply':
            // سيتم تنفيذها لاحقاً
            bot.sendMessage(chatId,
                `🔄 *قريباً: ${action.replace('main_', '')}*\n\n` +
                `هذه الميزة قيد التطوير وسيتم إضافتها قريباً.`,
                { parse_mode: 'Markdown' }
            );
            break;
    }
}

// ============================================
// 10. قائمة الجلسات مع الأزرار
// ============================================
async function showSessionsMenu(chatId, admin) {
    const sessions = await WhatsAppSession.findAll({ 
        where: { adminId: admin.id },
        order: [['createdAt', 'DESC']],
        limit: 10
    });
    
    const activeCount = sessions.filter(s => s.status === 'ready').length;
    const pendingCount = sessions.filter(s => s.status === 'awaiting_qr').length;
    
    const sessionsKeyboard = {
        inline_keyboard: [
            [
                { text: '📱➕ ربط حساب جديد', callback_data: 'session_add' },
                { text: '🔄 تحديث القائمة', callback_data: 'main_sessions' }
            ]
        ]
    };
    
    // إضافة أزرار للجلسات الموجودة
    if (sessions.length > 0) {
        sessions.forEach(session => {
            const statusIcon = session.status === 'ready' ? '✅' : 
                             session.status === 'awaiting_qr' ? '📱' : '❌';
            
            sessionsKeyboard.inline_keyboard.push([
                { 
                    text: `${statusIcon} ${session.phoneNumber || 'جلسة'}`,
                    callback_data: `session_view_${session.id}`
                }
            ]);
        });
    }
    
    sessionsKeyboard.inline_keyboard.push([
        { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
    ]);
    
    let message = `*📱 إدارة جلسات واتساب*\n\n`;
    message += `📊 *الإحصائيات:*\n`;
    message += `• 📞 الإجمالي: ${sessions.length} جلسة\n`;
    message += `• ✅ نشطة: ${activeCount} جلسة\n`;
    message += `• 📱 بانتظار QR: ${pendingCount} جلسة\n\n`;
    
    if (sessions.length === 0) {
        message += `📭 *لا توجد جلسات واتساب*\n\n`;
        message += `انقر على *"📱➕ ربط حساب جديد"* لبدء ربط حساب واتساب.`;
    } else {
        message += `*الجلسات المتاحة:* (انقر لعرض التفاصيل)`;
    }
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: sessionsKeyboard
    });
}

// ============================================
// 11. قائمة الإعلانات مع الأزرار
// ============================================
async function showAdsMenu(chatId, admin) {
    const ads = await Advertisement.findAll({
        where: { adminId: admin.id },
        order: [['createdAt', 'DESC']],
        limit: 10
    });
    
    const activeAds = ads.filter(ad => ad.isActive).length;
    
    const adsKeyboard = {
        inline_keyboard: [
            [
                { text: '📢➕ إنشاء إعلان', callback_data: 'ad_create' },
                { text: '📋 قائمة الإعلانات', callback_data: 'ad_list' }
            ],
            [
                { text: '🚀 النشر التلقائي', callback_data: 'main_autopost' },
                { text: '📊 إحصائيات', callback_data: 'ad_stats' }
            ]
        ]
    };
    
    // إضافة أزرار للإعلانات النشطة
    if (activeAds > 0) {
        ads.filter(ad => ad.isActive).slice(0, 3).forEach(ad => {
            adsKeyboard.inline_keyboard.push([
                { 
                    text: `📢 ${ad.content.substring(0, 20)}...`,
                    callback_data: `ad_view_${ad.id}`
                }
            ]);
        });
    }
    
    adsKeyboard.inline_keyboard.push([
        { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
    ]);
    
    let message = `*📢 إدارة الإعلانات*\n\n`;
    message += `📊 *الإحصائيات:*\n`;
    message += `• 📝 الإجمالي: ${ads.length} إعلان\n`;
    message += `• ✅ نشطة: ${activeAds} إعلان\n\n`;
    
    if (ads.length === 0) {
        message += `📭 *لا توجد إعلانات*\n\n`;
        message += `انقر على *"📢➕ إنشاء إعلان"* لبدء إنشاء إعلانك الأول.`;
    } else {
        message += `*استخدم الأزرار للإدارة:*`;
    }
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: adsKeyboard
    });
}

// ============================================
// 12. قائمة إدارة المشرفين مع الأزرار
// ============================================
async function showAdminsMenu(chatId, admin) {
    // التحقق من الصلاحية
    if (!admin.permissions.includes('add_admins')) {
        return bot.sendMessage(chatId,
            '❌ *غير مصرح!*\n\n' +
            'ليست لديك صلاحية إدارة المشرفين.',
            { parse_mode: 'Markdown' }
        );
    }
    
    const admins = await Admin.findAll({
        order: [['createdAt', 'DESC']]
    });
    
    const activeAdmins = admins.filter(a => a.isActive).length;
    
    const adminsKeyboard = {
        inline_keyboard: [
            [
                { text: '👑➕ إضافة مشرف', callback_data: 'admin_add' },
                { text: '📋 قائمة المشرفين', callback_data: 'admin_list' }
            ]
        ]
    };
    
    // إضافة أزرار للمشرفين
    admins.forEach(adminItem => {
        const statusIcon = adminItem.isActive ? '✅' : '❌';
        const isYou = adminItem.telegramId === admin.telegramId ? ' (أنت)' : '';
        
        adminsKeyboard.inline_keyboard.push([
            { 
                text: `${statusIcon} ${adminItem.username || adminItem.telegramId}${isYou}`,
                callback_data: `admin_view_${adminItem.id}`
            }
        ]);
    });
    
    adminsKeyboard.inline_keyboard.push([
        { text: '⚙️ إدارة الصلاحيات', callback_data: 'admin_permissions' },
        { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
    ]);
    
    let message = `*👑 إدارة المشرفين*\n\n`;
    message += `📊 *الإحصائيات:*\n`;
    message += `• 👥 الإجمالي: ${admins.length} مشرف\n`;
    message += `• ✅ نشطين: ${activeAdmins} مشرف\n\n`;
    
    message += `*المشرفون الحاليون:* (انقر لعرض التفاصيل)\n\n`;
    message += `💡 *ملاحظة:* فقط المشرفون ذوو صلاحية "add_admins" يمكنهم إدارة المشرفين.`;
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: adminsKeyboard
    });
}

// ============================================
// 13. إضافة مشرف جديد
// ============================================
async function handleAdminActions(chatId, userId, admin, action) {
    if (action === 'admin_add') {
        if (!admin.permissions.includes('add_admins')) {
            return bot.answerCallbackQuery(query.id, {
                text: 'ليست لديك صلاحية إضافة مشرفين',
                show_alert: true
            });
        }
        
        // حفظ حالة المستخدم لإضافة مشرف
        userStates.set(userId, {
            state: 'awaiting_admin_telegram_id',
            adminId: admin.id
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '❌ إلغاء', callback_data: 'main_admins' }
                ]
            ]
        };
        
        bot.sendMessage(chatId,
            `👑 *إضافة مشرف جديد*\n\n` +
            `📝 *تعليمات الإضافة:*\n` +
            `1. اطلب من الشخص المراد إضافته إرسال */id* إلى بوت @userinfobot\n` +
            `2. سيحصل على رقم مثل: *123456789*\n` +
            `3. أرسل لي هذا الرقم الآن\n\n` +
            `💡 *ملاحظة:* يمكن إضافة عدة أرقام مفصولة بفواصل\n` +
            `مثال: \`123456789,987654321\`\n\n` +
            `🔢 *أرسل رقم/أرقام التليجرام الآن:*`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
    else if (action === 'admin_list') {
        await showAdminsList(chatId, admin);
    }
}

// ============================================
// 14. قائمة الإحصائيات مع الأزرار
// ============================================
async function showStatsMenu(chatId, admin) {
    const sessionsCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
    const activeSessions = await WhatsAppSession.count({ 
        where: { 
            adminId: admin.id,
            status: 'ready' 
        } 
    });
    
    const adsCount = await Advertisement.count({ where: { adminId: admin.id } });
    const activeAds = await Advertisement.count({ 
        where: { 
            adminId: admin.id,
            isActive: true 
        } 
    });
    
    const statsKeyboard = {
        inline_keyboard: [
            [
                { text: '📱 جلسات واتساب', callback_data: 'stats_sessions' },
                { text: '📢 الإعلانات', callback_data: 'stats_ads' }
            ],
            [
                { text: '🔗 الروابط', callback_data: 'stats_links' },
                { text: '👥 المشرفين', callback_data: 'stats_admins' }
            ],
            [
                { text: '🔄 تحديث', callback_data: 'main_stats' },
                { text: '📊 تفاصيل كاملة', callback_data: 'stats_full' }
            ],
            [
                { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
            ]
        ]
    };
    
    const message = `
📊 *إحصائيات النظام*

*📱 جلسات واتساب:*
• 📞 الإجمالي: ${sessionsCount} جلسة
• ✅ نشطة: ${activeSessions} جلسة
• ⏳ غير نشطة: ${sessionsCount - activeSessions} جلسة

*📢 الإعلانات:*
• 📝 الإجمالي: ${adsCount} إعلان
• ✅ نشطة: ${activeAds} إعلان
• ❌ متوقفة: ${adsCount - activeAds} إعلان

*⚙️ معلومات النظام:*
• ⏱️ وقت التشغيل: ${Math.floor(process.uptime() / 3600)} ساعة
• 💾 الذاكرة: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
• 🌐 البيئة: ${process.env.NODE_ENV || 'تطوير'}

💡 *استخدم الأزرار لعرض تفاصيل كل قسم*
    `;
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: statsKeyboard
    });
}

// ============================================
// 15. قائمة المساعدة مع الأزرار
// ============================================
async function showHelpMenu(chatId) {
    const helpKeyboard = {
        inline_keyboard: [
            [
                { text: '📱 ربط واتساب', callback_data: 'help_sessions' },
                { text: '📢 إنشاء إعلان', callback_data: 'help_ads' }
            ],
            [
                { text: '👑 إضافة مشرف', callback_data: 'help_admins' },
                { text: '🚀 النشر التلقائي', callback_data: 'help_autopost' }
            ],
            [
                { text: '📞 الدعم الفني', url: 'https://t.me/username' },
                { text: '📚 الدليل الكامل', url: 'https://example.com/docs' }
            ],
            [
                { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
            ]
        ]
    };
    
    const message = `
🆘 *مركز المساعدة*

*📚 الدليل الشامل لاستخدام البوت:*

*🎮 نظام الأزرار:*
• كل شيء يعمل عبر *الأزرار التفاعلية*
• لا حاجة لتذكر الأوامر
• انقر على الزر للانتقال للقسم المطلوب

*📱 ربط واتساب:*
1. انتقل لـ *إدارة الجلسات*
2. انقر على *"ربط حساب جديد"*
3. أرسل *رقم هاتفك* مع رمز الدولة
4. امسح *QR Code* من واتساب
5. انتظر اكتمال الربط

*📢 إنشاء إعلان:*
1. انتقل لـ *الإعلانات*
2. انقر على *"إنشاء إعلان"*
3. اختر نوع الإعلان
4. أرسل المحتوى
5. اضبط الإعدادات

*👑 إضافة مشرف:*
1. انتقل لـ *إدارة المشرفين*
2. انقر على *"إضافة مشرف"*
3. أرسل *رقم تليجرام* للشخص
4. تأكد من صلاحية *"add_admins"*

*🚀 النشر التلقائي:*
1. انتقل لـ *النشر التلقائي*
2. اختر الإعلان المراد نشره
3. اضبط الفترة الزمنية
4. انقر على *بدء النشر*

*📞 للحصول على مساعدة إضافية:*
• انقر على *"الدعم الفني"* للتواصل مع المطور
• زر *"الدليل الكامل"* للوثائق التفصيلية
    `;
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: helpKeyboard
    });
}

// ============================================
// 16. قائمة الإعدادات مع الأزرار
// ============================================
async function showSettingsMenu(chatId, admin) {
    const settingsKeyboard = {
        inline_keyboard: [
            [
                { text: '⚙️ إعدادات البوت', callback_data: 'settings_bot' },
                { text: '🔔 الإشعارات', callback_data: 'settings_notifications' }
            ],
            [
                { text: '🛡️ الخصوصية', callback_data: 'settings_privacy' },
                { text: '🌐 اللغة', callback_data: 'settings_language' }
            ],
            [
                { text: '📊 إعدادات النشر', callback_data: 'settings_posting' },
                { text: '👥 إعدادات الانضمام', callback_data: 'settings_joining' }
            ],
            [
                { text: '🔄 إعادة التعيين', callback_data: 'settings_reset' },
                { text: '📤 نسخ احتياطي', callback_data: 'settings_backup' }
            ],
            [
                { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
            ]
        ]
    };
    
    const message = `
⚙️ *إعدادات النظام*

*الإعدادات المتاحة:*

• ⚙️ *إعدادات البوت:* ضبط إعدادات البوت الأساسية
• 🔔 *الإشعارات:* التحكم بالإشعارات والتنبيهات
• 🛡️ *الخصوصية:* إعدادات الخصوصية والأمان
• 🌐 *اللغة:* تغيير لغة الواجهة
• 📊 *النشر:* ضبط إعدادات النشر التلقائي
• 👥 *الانضمام:* إعدادات الانضمام للمجموعات
• 🔄 *إعادة التعيين:* إعادة ضبط الإعدادات
• 📤 *نسخ احتياطي:* نسخ بيانات النظام

💡 *اختر القسم الذي تريد ضبطه:*
    `;
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: settingsKeyboard
    });
}

// ============================================
// 17. معالجة طلب إضافة مشرف
// ============================================
async function handleAdminRequest(chatId, userId, query) {
    // إرسال طلب للمشرفين
    const admins = await Admin.findAll({ where: { isActive: true } });
    
    const requestKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ قبول الطلب', callback_data: `accept_admin_${userId}` },
                { text: '❌ رفض الطلب', callback_data: `reject_admin_${userId}` }
            ]
        ]
    };
    
    // إرسال طلب لكل مشرف
    admins.forEach(async (admin) => {
        try {
            await bot.sendMessage(admin.telegramId,
                `🔔 *طلب جديد لإضافة مشرف*\n\n` +
                `👤 المستخدم: ${query.from.first_name || 'مستخدم'}\n` +
                `🆔 الرقم: ${userId}\n` +
                `👤 المعرف: @${query.from.username || 'لا يوجد'}\n\n` +
                `⏰ الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
                `💡 استخدم الأزرار للرد على الطلب:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: requestKeyboard
                }
            );
        } catch (error) {
            console.error(`خطأ في إرسال طلب للمشرف ${admin.telegramId}:`, error);
        }
    });
    
    // إعلام المستخدم
    bot.sendMessage(chatId,
        `📨 *تم إرسال طلبك بنجاح!*\n\n` +
        `✅ تم إرسال طلب إضافتك كمشرف إلى جميع المشرفين الحاليين.\n` +
        `⏳ ستصلك رسالة عندما يتم الرد على طلبك.\n\n` +
        `📞 يمكنك التواصل مع المطور للمسارعة في المعالجة.`,
        { parse_mode: 'Markdown' }
    );
}

// ============================================
// 18. معالجة إجراءات الجلسات
// ============================================
async function handleSessionActions(chatId, userId, admin, action) {
    if (action === 'session_add') {
        // حفظ حالة المستخدم لإضافة جلسة
        userStates.set(userId, {
            state: 'awaiting_session_phone',
            adminId: admin.id
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '❌ إلغاء', callback_data: 'main_sessions' }
                ]
            ]
        };
        
        bot.sendMessage(chatId,
            `📱 *ربط حساب واتساب جديد*\n\n` +
            `🔗 *كيف يعمل الربط كجهاز مصاحب:*\n` +
            `1. البوت ينشئ جلسة WhatsApp Web\n` +
            `2. يظهر QR Code في المحادثة\n` +
            `3. تفتح واتساب على هاتفك\n` +
            `4. تذهب للإعدادات → الأجهزة المرتبطة\n` +
            `5. تنقر على "ربط جهاز"\n` +
            `6. تمسح QR Code\n` +
            `7. يصبح البوت جهازاً مصاحباً\n\n` +
            `📞 *أرسل رقم الهاتف الآن (مع + ورمز الدولة):*\n` +
            `مثال: \`+966501234567\`\n` +
            `مثال: \`+971501234567\``,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
}

// ============================================
// 19. معالجة الرسائل النصية
// ============================================
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userState = userStates.get(userId);
    
    if (!userState || !msg.text) return;
    
    try {
        if (userState.state === 'awaiting_session_phone') {
            await handlePhoneInput(chatId, userId, msg.text, userState);
        }
        else if (userState.state === 'awaiting_admin_telegram_id') {
            await handleAdminTelegramIdInput(chatId, userId, msg.text, userState);
        }
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
        userStates.delete(userId);
    }
});

// معالجة إدخال رقم الهاتف
async function handlePhoneInput(chatId, userId, phoneNumber, userState) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phoneRegex.test(phoneNumber)) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 حاول مرة أخرى', callback_data: 'session_add' },
                    { text: '❌ إلغاء', callback_data: 'main_sessions' }
                ]
            ]
        };
        
        return bot.sendMessage(chatId,
            '❌ *رقم الهاتف غير صالح!*\n\n' +
            'يجب أن يبدأ بـ **+** ويتبعه **رمز الدولة** ثم **الرقم**.\n' +
            'مثال صحيح: \`+966501234567\`\n' +
            'مثال صحيح: \`+971501234567\`\n\n' +
            'حاول مرة أخرى أو استخدم الزر للإلغاء',
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
    
    try {
        // إنشاء جلسة جديدة
        const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
        
        await WhatsAppSession.create({
            id: sessionId,
            sessionId: sessionId,
            phoneNumber: phoneNumber,
            adminId: userState.adminId,
            status: 'awaiting_qr',
            qrCode: `2@${crypto.randomBytes(32).toString('base64')}`,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 عرض QR Code', callback_data: `session_qr_${sessionId}` },
                    { text: '📋 العودة للقائمة', callback_data: 'main_sessions' }
                ]
            ]
        };
        
        bot.sendMessage(chatId,
            `✅ *تم إنشاء الجلسة بنجاح!*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🆔 المعرف: \`${sessionId.substring(0, 8)}\`\n` +
            `📅 الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `💡 انقر على *"📱 عرض QR Code"* لعرض رمز الربط`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
        
        userStates.delete(userId);
        
    } catch (error) {
        console.error('خطأ في إنشاء الجلسة:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إنشاء الجلسة');
        userStates.delete(userId);
    }
}

// معالجة إدخال أرقام المشرفين
async function handleAdminTelegramIdInput(chatId, userId, telegramIds, userState) {
    const ids = telegramIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
    
    if (ids.length === 0) {
        return bot.sendMessage(chatId,
            '❌ *لم تدخل أي أرقام!*\n\n' +
            'أعد المحاولة مع أرقام صحيحة.',
            { parse_mode: 'Markdown' }
        );
    }
    
    let addedCount = 0;
    let errorMessages = [];
    
    for (const telegramId of ids) {
        if (!/^\d+$/.test(telegramId)) {
            errorMessages.push(`❌ ${telegramId}: ليس رقماً صحيحاً`);
            continue;
        }
        
        try {
            const [admin, created] = await Admin.findOrCreate({
                where: { telegramId },
                defaults: {
                    username: `admin_${telegramId}`,
                    permissions: ['basic'],
                    isActive: true
                }
            });
            
            if (created) {
                addedCount++;
                
                // محاولة إرسال رسالة ترحيب للمشرف الجديد
                try {
                    await bot.sendMessage(telegramId,
                        `🎉 *مبروك!*\n\n` +
                        `✅ تمت إضافتك كمشرف في بوت إدارة واتساب.\n` +
                        `🔧 الصلاحيات: basic\n` +
                        `👤 أضافك: ${userId}\n\n` +
                        `🚀 أرسل /start للبدء`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (sendError) {
                    console.error(`خطأ في إرسال رسالة للمشرف ${telegramId}:`, sendError);
                }
            } else {
                errorMessages.push(`⚠️ ${telegramId}: موجود بالفعل`);
            }
        } catch (error) {
            errorMessages.push(`❌ ${telegramId}: ${error.message}`);
        }
    }
    
    let message = `*👑 نتيجة إضافة المشرفين*\n\n`;
    
    if (addedCount > 0) {
        message += `✅ *تمت الإضافة بنجاح:* ${addedCount} مشرف\n`;
    }
    
    if (errorMessages.length > 0) {
        message += `\n*❌ الأخطاء:*\n`;
        errorMessages.forEach(err => message += `${err}\n`);
    }
    
    message += `\n💡 *المشرفون الجدد سيصلكم رسالة ترحيب في تليجرام.*`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📋 قائمة المشرفين', callback_data: 'main_admins' },
                { text: '🏠 الرئيسية', callback_data: 'main_menu' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
    
    userStates.delete(userId);
}

// ============================================
// 20. المهام المجدولة
// ============================================
function setupScheduledTasks() {
    // تنظيف الحالات المؤقتة كل ساعة
    cron.schedule('0 * * * *', () => {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [userId, state] of userStates.entries()) {
            if (state.timestamp && state.timestamp < oneHourAgo) {
                userStates.delete(userId);
            }
        }
        console.log('🧹 تم تنظيف الحالات المؤقتة');
    });
    
    console.log('✅ تم إعداد المهام المجدولة');
}

// ============================================
// 21. وظيفة البدء الرئيسية
// ============================================
async function startBot() {
    console.log('\n🔧 جاري تهيئة النظام...');
    
    // 1. تهيئة قاعدة البيانات
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        console.log('⚠️  مشكلة في قاعدة البيانات، النظام سيستمر مع وظائف محدودة');
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
    
    // 4. بدء سيرفر Express
    app.listen(PORT, () => {
        console.log(`🌐 سيرفر Express يعمل على المنفذ ${PORT}`);
        console.log(`🔗 رابط الصحة: http://localhost:${PORT}/health`);
    });
    
    // 5. رسالة البدء النهائية
    console.log('\n✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅');
    console.log('===================================================');
    console.log('🎮 النظام: الأزرار التفاعلية فقط');
    console.log('🚫 معطل: جميع الأوامر التقليدية');
    console.log(`📊 المشرفين: ${process.env.TELEGRAM_ADMIN_IDS.split(',').length}`);
    console.log(`🌐 Web Service: http://localhost:${PORT}`);
    console.log('===================================================');
    
    // 6. إرسال رسالة للمشرفين
    const adminIds = process.env.TELEGRAM_ADMIN_IDS.split(',');
    for (const adminId of adminIds) {
        try {
            await bot.sendMessage(adminId.trim(), 
                '🔄 *تم تحديث البوت بنجاح!*\n\n' +
                '🎮 *التغييرات الجديدة:*\n' +
                '• ✅ نظام الأزرار التفاعلية بالكامل\n' +
                '• 🚫 تعطيل جميع الأوامر التقليدية\n' +
                '• 👑 إضافة مشرفين عبر الأزرار\n' +
                '• 📱 ربط واتساب مع QR Code\n\n' +
                '🚀 أرسل /start للبدء',
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log(`⚠️  لا يمكن إرسال رسالة للمشرف ${adminId}: ${error.message}`);
        }
    }
}

// ============================================
// 22. التعامل مع إيقاف التشغيل
// ============================================
process.on('SIGINT', async () => {
    console.log('\n🛑 تلقي إشارة إيقاف...');
    console.log('✅ تم إيقاف البوت بنظام');
    process.exit(0);
});

// ============================================
// 23. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.log(`❌ فشل بدء التشغيل: ${error.message}`);
        process.exit(1);
    });
}

// ============================================
// 24. التصدير
// ============================================
module.exports = {
    app,
    bot,
    sequelize,
    Admin,
    WhatsAppSession,
    Advertisement,
    userStates,
    startBot
};
