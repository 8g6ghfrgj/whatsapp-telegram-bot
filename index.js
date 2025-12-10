require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');

// ============= الإعدادات الأساسية =============
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;

// إنشاء مجلدات التخزين
const folders = ['data/sessions', 'data/media', 'data/qrcodes', 'data/database'];
folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }
});

// ============= WhatsApp Client =============
let whatsappClient = null;
let isWhatsAppConnected = false;
let qrCodeSent = false;

function initializeWhatsApp() {
    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            clientId: "whatsapp-bot-render",
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
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
        }
    });

    // أحداث WhatsApp
    whatsappClient.on('qr', async (qr) => {
        console.log('📱 QR Code received');
        
        const qrPath = path.join(__dirname, 'data', 'qrcodes', `qr-${Date.now()}.png`);
        
        try {
            await qrcode.toFile(qrPath, qr, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 300
            });
            
            // إرسال QR Code للمسؤول
            await bot.telegram.sendPhoto(process.env.ADMIN_ID, 
                { source: qrPath },
                {
                    caption: '📱 *مسح QR Code للاتصال بـ WhatsApp*\n\n' +
                             '1. افتح WhatsApp على هاتفك\n' +
                             '2. اضغط على القائمة (ثلاث نقاط)\n' +
                             '3. اختر "الأجهزة المرتبطة"\n' +
                             '4. اضغط على "ربط جهاز"\n' +
                             '5. مسح هذا الكود\n\n' +
                             '⏰ هذا الكود صالح لمدة 30 ثانية فقط',
                    parse_mode: 'Markdown'
                }
            );
            
            qrCodeSent = true;
            
            // حذف QR بعد 30 ثانية
            setTimeout(() => {
                if (fs.existsSync(qrPath)) {
                    fs.unlinkSync(qrPath);
                }
            }, 30000);
            
        } catch (error) {
            console.error('❌ Error generating/sending QR:', error);
        }
    });

    whatsappClient.on('ready', () => {
        console.log('✅ WhatsApp connected successfully!');
        isWhatsAppConnected = true;
        qrCodeSent = false;
        
        // إرسال رسالة نجاح الاتصال
        bot.telegram.sendMessage(process.env.ADMIN_ID,
            '✅ *تم الاتصال بحساب WhatsApp بنجاح!*\n' +
            'يمكنك الآن استخدام جميع الميزات.',
            { parse_mode: 'Markdown' }
        ).catch(console.error);
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('❌ WhatsApp disconnected:', reason);
        isWhatsAppConnected = false;
        
        bot.telegram.sendMessage(process.env.ADMIN_ID,
            '❌ *تم فصل الاتصال بـ WhatsApp*\n' +
            `السبب: ${reason}\n` +
            'جاري محاولة إعادة الاتصال...',
            { parse_mode: 'Markdown' }
        ).catch(console.error);
        
        // إعادة التهيئة بعد 5 ثواني
        setTimeout(() => {
            whatsappClient.initialize();
        }, 5000);
    });

    whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ WhatsApp auth failure:', msg);
    });

    // تهيئة WhatsApp
    whatsappClient.initialize();
}

// ============= قاعدة البيانات =============
const db = {
    ads: [],
    groups: [],
    links: {
        whatsapp: [],
        telegram: [],
        other: []
    },
    replies: {
        private: [],
        groups: []
    },
    settings: {
        autoPostDelay: 5,
        repliesEnabled: true,
        autoPostEnabled: false
    }
};

// حفظ قاعدة البيانات
function saveDB() {
    const dbPath = path.join(__dirname, 'data', 'database', 'db.json');
    fs.writeJsonSync(dbPath, db, { spaces: 2 });
}

// تحميل قاعدة البيانات
function loadDB() {
    const dbPath = path.join(__dirname, 'data', 'database', 'db.json');
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readJsonSync(dbPath);
            Object.assign(db, data);
            console.log('✅ Database loaded successfully');
        }
    } catch (error) {
        console.log('📁 Creating new database...');
        saveDB();
    }
}

// ============= Express Middleware =============
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============= أوامر Telegram Bot =============

// 👋 أمر /start - القائمة الرئيسية
bot.start(async (ctx) => {
    const welcomeMessage = `
    *👋 مرحباً بك في بوت إدارة WhatsApp!*

    *🔧 قائمة الأوامر المتاحة:*

    */start* - عرض هذه القائمة
    */connect* - ربط حساب WhatsApp (إظهار QR Code)
    */status* - عرض حالة النظام
    */ads* - إدارة الإعلانات
    */groups* - إدارة المجموعات
    */join* - الانضمام لمجموعات WhatsApp
    */auto_post* - تفعيل/إيقاف النشر التلقائي
    */replies* - إدارة الردود التلقائية
    */stats* - عرض الإحصائيات
    */help* - عرض المساعدة

    *📊 حالة النظام:*
    🔗 WhatsApp: ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
    📢 النشر: ${db.settings.autoPostEnabled ? '✅ مفعل' : '❌ معطل'}
    💬 الردود: ${db.settings.repliesEnabled ? '✅ مفعل' : '❌ معطل'}

    *📌 ملاحظة:* اكتب الأمر كما هو (مثال: /connect)
    `;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
});

// ℹ️ أمر /help - المساعدة
bot.help(async (ctx) => {
    const helpMessage = `
    *ℹ️ مساعدة - كيفية استخدام البوت*

    *1. ربط WhatsApp:*
    - اكتب */connect*
    - ستصلك صورة QR Code
    - امسحها من تطبيق WhatsApp
    - انتظر رسالة التأكيد

    *2. إدارة الإعلانات:*
    - */ads add* - إضافة إعلان جديد
    - */ads list* - عرض الإعلانات
    - */ads delete [رقم]* - حذف إعلان

    *3. إدارة المجموعات:*
    - */groups collect* - تجميع روابط المجموعات
    - */groups list* - عرض المجموعات
    - */groups clean* - تنظيف المكرر

    *4. الانضمام للمجموعات:*
    - أرسل */join* ثم أرسل الروابط
    - رابط واحد لكل سطر
    - مثال: https://chat.whatsapp.com/xxxx

    *5. النشر التلقائي:*
    - */auto_post on* - تشغيل النشر
    - */auto_post off* - إيقاف النشر

    *📞 الدعم:* للاستفسارات، راسل المطور
    `;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// 🔗 أمر /connect - ربط WhatsApp
bot.command('connect', async (ctx) => {
    if (isWhatsAppConnected) {
        return ctx.reply('✅ أنت متصل بالفعل بـ WhatsApp!');
    }
    
    if (qrCodeSent) {
        return ctx.reply('📱 تم إرسال QR Code مسبقاً، يرجى الانتظار 30 ثانية أو مسح الكود السابق.');
    }
    
    await ctx.reply('🔄 جاري إعداد QR Code للاتصال بـ WhatsApp...');
    
    if (!whatsappClient) {
        initializeWhatsApp();
    } else {
        whatsappClient.initialize();
    }
});

// 📊 أمر /status - حالة النظام
bot.command('status', async (ctx) => {
    const statusMessage = `
    *📊 حالة النظام الحالية*

    *🔗 الاتصالات:*
    WhatsApp: ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
    Telegram: ✅ نشط

    *📈 الإحصائيات:*
    📢 الإعلانات: ${db.ads.length}
    👥 المجموعات: ${db.groups.length}
    💬 ردود الخاصة: ${db.replies.private.length}
    💬 ردود المجموعات: ${db.replies.groups.length}

    *⚙️ الإعدادات:*
    النشر التلقائي: ${db.settings.autoPostEnabled ? '✅ مفعل' : '❌ معطل'}
    تأخير النشر: ${db.settings.autoPostDelay} دقائق
    الردود التلقائية: ${db.settings.repliesEnabled ? '✅ مفعل' : '❌ معطل'}

    *💾 التخزين:*
    الجلسات: ${fs.readdirSync('./data/sessions').length}
    قاعدة البيانات: ${Object.keys(db).length} جدول

    *🕐 آخر تحديث:* ${new Date().toLocaleString()}
    `;

    await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
});

// 📢 أمر /ads - إدارة الإعلانات
bot.command('ads', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const action = args[0] || 'help';
    
    if (action === 'add') {
        await ctx.reply('✍️ أرسل نص الإعلان الذي تريد إضافته:');
        // هنا يمكنك إضافة حالة للمستخدم
    } else if (action === 'list') {
        if (db.ads.length === 0) {
            await ctx.reply('📭 لا توجد إعلانات مضافة.');
        } else {
            let adsList = '*📋 قائمة الإعلانات:*\n\n';
            db.ads.forEach((ad, index) => {
                adsList += `${index + 1}. ${ad.content.substring(0, 50)}...\n`;
            });
            await ctx.reply(adsList, { parse_mode: 'Markdown' });
        }
    } else if (action === 'delete') {
        const adIndex = parseInt(args[1]) - 1;
        if (isNaN(adIndex) || adIndex < 0 || adIndex >= db.ads.length) {
            await ctx.reply('❌ الرقم غير صالح. استخدم: /ads delete [رقم]');
        } else {
            const deletedAd = db.ads.splice(adIndex, 1)[0];
            saveDB();
            await ctx.reply(`✅ تم حذف الإعلان: ${deletedAd.content.substring(0, 100)}...`);
        }
    } else {
        await ctx.reply(
            '*📢 إدارة الإعلانات*\n\n' +
            '*الأوامر المتاحة:*\n' +
            '`/ads add` - إضافة إعلان جديد\n' +
            '`/ads list` - عرض جميع الإعلانات\n' +
            '`/ads delete [رقم]` - حذف إعلان\n\n' +
            '*مثال:* `/ads delete 1`',
            { parse_mode: 'Markdown' }
        );
    }
});

// 👥 أمر /groups - إدارة المجموعات
bot.command('groups', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const action = args[0] || 'help';
    
    if (action === 'collect') {
        if (!isWhatsAppConnected) {
            return ctx.reply('❌ لم يتم الاتصال بـ WhatsApp بعد! استخدم /connect أولاً.');
        }
        
        await ctx.reply('🔍 جاري تجميع معلومات المجموعات...');
        
        try {
            const chats = await whatsappClient.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            db.groups = groups.map(group => ({
                id: group.id._serialized,
                name: group.name,
                participants: group.participants.length,
                timestamp: new Date().toISOString()
            }));
            
            saveDB();
            
            await ctx.reply(
                `✅ تم تجميع ${groups.length} مجموعة\n\n` +
                `📊 الإجمالي الآن: ${db.groups.length} مجموعة`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            await ctx.reply(`❌ خطأ في تجميع المجموعات: ${error.message}`);
        }
        
    } else if (action === 'list') {
        if (db.groups.length === 0) {
            await ctx.reply('📭 لا توجد مجموعات مسجلة.');
        } else {
            let groupsList = '*👥 قائمة المجموعات:*\n\n';
            db.groups.slice(0, 10).forEach((group, index) => {
                groupsList += `${index + 1}. ${group.name} (${group.participants} عضو)\n`;
            });
            
            if (db.groups.length > 10) {
                groupsList += `\n... و ${db.groups.length - 10} مجموعة أخرى`;
            }
            
            await ctx.reply(groupsList, { parse_mode: 'Markdown' });
        }
    } else {
        await ctx.reply(
            '*👥 إدارة المجموعات*\n\n' +
            '*الأوامر المتاحة:*\n' +
            '`/groups collect` - تجميع المجموعات من WhatsApp\n' +
            '`/groups list` - عرض المجموعات المسجلة\n' +
            '`/groups clean` - تنظيف المكرر\n\n' +
            '*ملاحظة:* يجب أن تكون متصلاً بـ WhatsApp أولاً',
            { parse_mode: 'Markdown' }
        );
    }
});

// ➕ أمر /join - الانضمام للمجموعات
bot.command('join', async (ctx) => {
    await ctx.reply(
        '➕ *الانضمام لمجموعات WhatsApp*\n\n' +
        'أرسل روابط المجموعات (واحد لكل سطر):\n' +
        'مثال:\n' +
        '`https://chat.whatsapp.com/xxxxxxxxxxx`\n' +
        '`https://chat.whatsapp.com/yyyyyyyyyyy`\n\n' +
        '⚠️ *ملاحظة:* يجب أن تبدأ الروابط بـ https://chat.whatsapp.com/',
        { parse_mode: 'Markdown' }
    );
});

// 🔄 أمر /auto_post - النشر التلقائي
bot.command('auto_post', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const action = args[0] || 'status';
    
    if (action === 'on' || action === 'تشغيل') {
        if (!isWhatsAppConnected) {
            return ctx.reply('❌ لم يتم الاتصال بـ WhatsApp بعد!');
        }
        
        if (db.ads.length === 0) {
            return ctx.reply('❌ لا توجد إعلانات! أضف إعلانات أولاً باستخدام /ads add');
        }
        
        if (db.groups.length === 0) {
            return ctx.reply('❌ لا توجد مجموعات! قم بتجميع المجموعات أولاً باستخدام /groups collect');
        }
        
        db.settings.autoPostEnabled = true;
        saveDB();
        
        await ctx.reply(
            '✅ *تم تشغيل النشر التلقائي*\n\n' +
            `📢 عدد الإعلانات: ${db.ads.length}\n` +
            `👥 عدد المجموعات: ${db.groups.length}\n` +
            `⏰ التأخير بين الإعلانات: ${db.settings.autoPostDelay} دقائق\n\n` +
            'سيبدأ النشر تلقائياً في جميع المجموعات.',
            { parse_mode: 'Markdown' }
        );
        
    } else if (action === 'off' || action === 'إيقاف') {
        db.settings.autoPostEnabled = false;
        saveDB();
        await ctx.reply('⏸️ *تم إيقاف النشر التلقائي*', { parse_mode: 'Markdown' });
        
    } else {
        await ctx.reply(
            '*🔄 النشر التلقائي*\n\n' +
            '*الأوامر المتاحة:*\n' +
            '`/auto_post on` - تشغيل النشر التلقائي\n' +
            '`/auto_post off` - إيقاف النشر التلقائي\n' +
            '`/auto_post status` - عرض الحالة الحالية\n\n' +
            '*الحالة الحالية:* ' + (db.settings.autoPostEnabled ? '✅ مفعل' : '❌ معطل'),
            { parse_mode: 'Markdown' }
        );
    }
});

// 💬 أمر /replies - إدارة الردود
bot.command('replies', async (ctx) => {
    await ctx.reply(
        '*💬 إدارة الردود التلقائية*\n\n' +
        '*الأوامر المتاحة:*\n' +
        '`/replies private add` - إضافة رد للخاص\n' +
        '`/replies groups add` - إضافة رد للمجموعات\n' +
        '`/replies list` - عرض جميع الردود\n' +
        '`/replies on` - تفعيل الردود\n' +
        '`/replies off` - تعطيل الردود\n\n' +
        '*الحالة الحالية:* ' + (db.settings.repliesEnabled ? '✅ مفعل' : '❌ معطل'),
        { parse_mode: 'Markdown' }
    );
});

// 📈 أمر /stats - الإحصائيات
bot.command('stats', async (ctx) => {
    const statsMessage = `
    *📈 إحصائيات النظام*

    *📊 الأرقام الرئيسية:*
    الإعلانات: ${db.ads.length}
    المجموعات: ${db.groups.length}
    الردود الخاصة: ${db.replies.private.length}
    الردود الجماعية: ${db.replies.groups.length}

    *🔗 الروابط المجمعة:*
    WhatsApp: ${db.links.whatsapp.length}
    Telegram: ${db.links.telegram.length}
    أخرى: ${db.links.other.length}

    *⚙️ الإعدادات النشطة:*
    النشر التلقائي: ${db.settings.autoPostEnabled ? '✅' : '❌'}
    الردود التلقائية: ${db.settings.repliesEnabled ? '✅' : '❌'}

    *💾 مساحة التخزين:*
    حجم الجلسات: ${getFolderSize('./data/sessions')} ملف
    حجم الوسائط: ${getFolderSize('./data/media')} ملف

    *🔄 آخر تحديث للبيانات:* ${new Date().toLocaleString()}
    `;

    await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
});

// دالة مساعدة لحجم المجلد
function getFolderSize(folderPath) {
    try {
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            return files.length;
        }
        return 0;
    } catch (error) {
        return 0;
    }
}

// ============= معالجة الروابط (للانضمام للمجموعات) =============
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // التحقق من روابط WhatsApp
    if (text.includes('chat.whatsapp.com')) {
        const links = text.split('\n')
            .map(link => link.trim())
            .filter(link => link.startsWith('https://chat.whatsapp.com/'));
        
        if (links.length > 0) {
            await ctx.reply(`🔍 وجدت ${links.length} رابط WhatsApp، جاري المعالجة...`);
            
            let successCount = 0;
            let failCount = 0;
            
            for (const link of links) {
                try {
                    const inviteCode = link.split('/').pop();
                    
                    // إضافة الرابط للقاعدة
                    db.links.whatsapp.push({
                        url: link,
                        code: inviteCode,
                        addedAt: new Date().toISOString(),
                        addedBy: ctx.from.id
                    });
                    
                    successCount++;
                    await ctx.reply(`✅ تم حفظ الرابط: \`${link}\``, { parse_mode: 'Markdown' });
                    
                } catch (error) {
                    failCount++;
                    await ctx.reply(`❌ خطأ في الرابط: ${link}`);
                }
            }
            
            saveDB();
            
            await ctx.reply(
                `📊 *نتيجة المعالجة*\n\n` +
                `✅ نجح: ${successCount}\n` +
                `❌ فشل: ${failCount}\n` +
                `📝 المجموع: ${db.links.whatsapp.length} رابط`,
                { parse_mode: 'Markdown' }
            );
        }
    }
});

// ============= Express Routes =============
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        service: 'whatsapp-telegram-bot',
        whatsapp: isWhatsAppConnected ? 'connected' : 'disconnected',
        telegram: 'running',
        version: '2.0.0',
        time: new Date().toISOString(),
        endpoints: ['/health', '/status', '/qr']
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        whatsapp: isWhatsAppConnected,
        telegram: 'active'
    });
});

app.get('/status', (req, res) => {
    res.json({
        whatsapp: {
            connected: isWhatsAppConnected,
            qr_sent: qrCodeSent
        },
        database: {
            ads: db.ads.length,
            groups: db.groups.length,
            links: db.links.whatsapp.length + db.links.telegram.length + db.links.other.length
        },
        settings: db.settings
    });
});

// ============= Webhook Setup (لـ Render) =============
async function setupWebhook() {
    try {
        // في بيئة الإنتاج، استخدم Webhook
        if (process.env.NODE_ENV === 'production') {
            const webhookUrl = `https://whatsapp-bot-exj1.onrender.com/bot${process.env.BOT_TOKEN}`;
            
            // إعداد Webhook
            await bot.telegram.setWebhook(webhookUrl);
            
            // معالجة Webhook
            app.use(await bot.createWebhook({
                domain: 'whatsapp-bot-exj1.onrender.com',
                path: `/bot${process.env.BOT_TOKEN}`
            }));
            
            console.log(`🌐 Webhook configured: ${webhookUrl}`);
        } else {
            // التطوير المحلي: استخدم Polling
            await bot.launch();
            console.log('🤖 Bot running in polling mode (development)');
        }
    } catch (error) {
        console.error('❌ Error setting up bot:', error);
    }
}

// ============= بدء النظام =============
async function startServer() {
    try {
        // تحميل قاعدة البيانات
        loadDB();
        
        // بدء Express server
        app.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log('🚀 WHATSAPP TELEGRAM BOT v2.0');
            console.log(`📡 Server running on port: ${PORT}`);
            console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
            console.log('='.repeat(60));
            
            // التحقق من المتغيرات البيئية
            console.log('🔑 Environment Check:');
            console.log(process.env.BOT_TOKEN ? '✅ BOT_TOKEN: Set' : '❌ BOT_TOKEN: Missing');
            console.log(process.env.ADMIN_ID ? '✅ ADMIN_ID: Set' : '❌ ADMIN_ID: Missing');
            console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
            
            // إعداد Webhook
            setupWebhook();
            
            // تهيئة WhatsApp بعد 5 ثواني
            setTimeout(() => {
                console.log('\n🔧 Initializing WhatsApp Client...');
                initializeWhatsApp();
            }, 5000);
        });
        
    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
}

// ============= معالجة الإغلاق =============
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function shutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    if (whatsappClient) {
        whatsappClient.destroy();
        console.log('✅ WhatsApp client destroyed');
    }
    
    if (bot) {
        bot.stop(signal);
        console.log('✅ Telegram bot stopped');
    }
    
    saveDB();
    console.log('💾 Database saved');
    
    setTimeout(() => {
        console.log('👋 Shutdown complete');
        process.exit(0);
    }, 1000);
}

// ============= بدء التشغيل =============
startServer();
