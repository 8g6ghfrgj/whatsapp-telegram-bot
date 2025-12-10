require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs-extra');
const cron = require('node-cron');
const axios = require('axios');
const validUrl = require('valid-url');

// إنشاء مجلدات التخزين
const folders = ['data/sessions', 'data/media', 'data/qrcodes', 'data/database'];
folders.forEach(folder => fs.ensureDirSync(folder));

// إنشاء تطبيق Express
const app = express();
const PORT = process.env.PORT || 3000;

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
        autoPostDelay: 5, // دقائق
        repliesEnabled: true,
        autoPostEnabled: false
    },
    stats: {
        totalMessages: 0,
        totalGroups: 0,
        lastActivity: null
    }
};

// حفظ قاعدة البيانات
function saveDB() {
    fs.writeJsonSync('./data/database/db.json', db, { spaces: 2 });
}

// تحميل قاعدة البيانات
function loadDB() {
    try {
        const data = fs.readJsonSync('./data/database/db.json');
        Object.assign(db, data);
        console.log('✅ قاعدة البيانات تم تحميلها');
    } catch (error) {
        console.log('📁 إنشاء قاعدة بيانات جديدة...');
        saveDB();
    }
}

// ============= تهيئة WhatsApp Client =============
const whatsappClient = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-client",
        dataPath: "./data/sessions"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        executablePath: process.env.NODE_ENV === 'production' 
            ? '/usr/bin/google-chrome-stable'
            : undefined
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

// ============= تهيئة Telegram Bot =============
const bot = new Telegraf(process.env.BOT_TOKEN);

// ============= متغيرات النظام =============
let isWhatsAppConnected = false;
let isAutoPosting = false;
let currentQRCode = null;
let autoPostInterval = null;

// ============= لوحة المفاتيح =============
function getMainKeyboard() {
    return Markup.keyboard([
        ['📢 إدارة الإعلانات', '👥 إدارة المجموعات'],
        ['➕ الانضمام للقروبات', '🔄 النشر التلقائي'],
        ['💬 إدارة الردود', '⏸️ إيقاف النشر'],
        ['📊 حالة النظام', '🔄 إعادة الاتصال']
    ]).resize();
}

function getAdsKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('➕ إضافة إعلان', 'add_ad')],
        [Markup.button.callback('🗑️ حذف إعلان', 'delete_ad')],
        [Markup.button.callback('📋 عرض الإعلانات', 'list_ads')],
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')]
    ]);
}

function getGroupsKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔗 تجميع روابط', 'collect_links')],
        [Markup.button.callback('📋 عرض المجموعات', 'list_groups')],
        [Markup.button.callback('🧹 تنظيف المكرر', 'clean_duplicates')],
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')]
    ]);
}

// ============= أحداث WhatsApp =============
whatsappClient.on('qr', async (qr) => {
    console.log('📱 QR Code received');
    
    const qrPath = `./data/qrcodes/qr-${Date.now()}.png`;
    await qrcode.toFile(qrPath, qr, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300
    });
    
    try {
        await bot.telegram.sendPhoto(process.env.ADMIN_ID, 
            { source: qrPath },
            {
                caption: '📱 *مسح QR Code للاتصال بـ WhatsApp*\n\n' +
                         '1. افتح WhatsApp على هاتفك\n' +
                         '2. اضغط على ☰ (القائمة)\n' +
                         '3. اختر "الأجهزة المرتبطة"\n' +
                         '4. اضغط على "ربط جهاز"\n' +
                         '5. مسح هذا الكود\n\n' +
                         '⏰ هذا الكود صالح لمدة 30 ثانية',
                parse_mode: 'Markdown'
            }
        );
        
        currentQRCode = qrPath;
        setTimeout(() => {
            if (fs.existsSync(qrPath)) {
                fs.unlinkSync(qrPath);
                currentQRCode = null;
            }
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error sending QR:', error);
    }
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp connected!');
    isWhatsAppConnected = true;
    
    bot.telegram.sendMessage(process.env.ADMIN_ID,
        '✅ *تم الاتصال بحساب WhatsApp بنجاح!*\n' +
        'يمكنك الآن استخدام جميع الميزات.',
        { parse_mode: 'Markdown' }
    );
});

whatsappClient.on('disconnected', (reason) => {
    console.log('❌ WhatsApp disconnected:', reason);
    isWhatsAppConnected = false;
    isAutoPosting = false;
    
    bot.telegram.sendMessage(process.env.ADMIN_ID,
        '❌ *تم فصل الاتصال بـ WhatsApp*\n' +
        `السبب: ${reason}\n` +
        'جاري محاولة إعادة الاتصال...',
        { parse_mode: 'Markdown' }
    );
});

// ============= أوامر Telegram Bot =============

// بدء البوت
bot.start(async (ctx) => {
    const welcome = `
    👋 *مرحباً بك في بوت إدارة WhatsApp!*
    
    *🔧 الميزات المتاحة:*
    
    📢 *إدارة الإعلانات*
    - إضافة/حذف/عرض الإعلانات
    
    👥 *إدارة المجموعات*
    - تجميع روابط المجموعات
    - عرض وإدارة المجموعات
    
    ➕ *الانضمام للقروبات*
    - الانضمام التلقائي لمجموعات WhatsApp
    
    🔄 *النشر التلقائي*
    - نشر الإعلانات في جميع المجموعات
    - تكرار النشر تلقائياً
    
    💬 *إدارة الردود*
    - ردود تلقائية في الخاص والمجموعات
    
    📊 *حالة النظام:* ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
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
    await ctx.reply(
        '📢 *قسم إدارة الإعلانات*\n\n' +
        'اختر الإجراء المطلوب:',
        { parse_mode: 'Markdown', ...getAdsKeyboard() }
    );
});

// إدارة المجموعات
bot.hears('👥 إدارة المجموعات', async (ctx) => {
    await ctx.reply(
        '👥 *قسم إدارة المجموعات*\n\n' +
        'اختر الإجراء المطلوب:',
        { parse_mode: 'Markdown', ...getGroupsKeyboard() }
    );
});

// الانضمام للقروبات
bot.hears('➕ الانضمام للقروبات', async (ctx) => {
    await ctx.reply(
        '➕ *الانضمام لمجموعات WhatsApp*\n\n' +
        'أرسل روابط المجموعات (واحد لكل سطر):\n' +
        'مثال:\n' +
        'https://chat.whatsapp.com/xxxxxxxxxxx\n' +
        'https://chat.whatsapp.com/yyyyyyyyyyy\n\n' +
        'سيتم الانضمام تلقائياً للمجموعات الصالحة.',
        { parse_mode: 'Markdown' }
    );
});

// النشر التلقائي
bot.hears('🔄 النشر التلقائي', async (ctx) => {
    if (!isWhatsAppConnected) {
        return ctx.reply('❌ لم يتم الاتصال بـ WhatsApp بعد!');
    }
    
    if (db.ads.length === 0) {
        return ctx.reply('❌ لا توجد إعلانات مضافة! أضف إعلانات أولاً.');
    }
    
    if (db.groups.length === 0) {
        return ctx.reply('❌ لا توجد مجموعات! قم بتجميع المجموعات أولاً.');
    }
    
    isAutoPosting = true;
    startAutoPosting();
    
    await ctx.reply(
        '✅ *تم تشغيل النشر التلقائي*\n\n' +
        `📊 عدد الإعلانات: ${db.ads.length}\n` +
        `👥 عدد المجموعات: ${db.groups.length}\n` +
        `⏰ التأخير: ${db.settings.autoPostDelay} دقيقة\n\n` +
        'سيبدأ النشر الآن...',
        { parse_mode: 'Markdown' }
    );
});

// إيقاف النشر
bot.hears('⏸️ إيقاف النشر', async (ctx) => {
    if (!isAutoPosting) {
        return ctx.reply('❌ النشر التلقائي غير مفعل حالياً!');
    }
    
    isAutoPosting = false;
    if (autoPostInterval) {
        clearInterval(autoPostInterval);
        autoPostInterval = null;
    }
    
    await ctx.reply(
        '⏸️ *تم إيقاف النشر التلقائي*',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

// إدارة الردود
bot.hears('💬 إدارة الردود', async (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💬 إضافة رد خاص', 'add_private_reply')],
        [Markup.button.callback('👥 إضافة رد جماعي', 'add_group_reply')],
        [Markup.button.callback('📋 عرض الردود', 'list_replies')],
        [Markup.button.callback('✅/❌ تفعيل/تعطيل', 'toggle_replies')],
        [Markup.button.callback('🏠 الرئيسية', 'main_menu')]
    ]);
    
    await ctx.reply(
        '💬 *قسم إدارة الردود*\n\n' +
        `الحالة: ${db.settings.repliesEnabled ? '✅ مفعل' : '❌ معطل'}\n` +
        `الردود الخاصة: ${db.replies.private.length}\n` +
        `الردود الجماعية: ${db.replies.groups.length}`,
        { parse_mode: 'Markdown', ...keyboard }
    );
});

// حالة النظام
bot.hears('📊 حالة النظام', async (ctx) => {
    const status = `
    📊 *حالة النظام*
    
    🔗 *واتساب:* ${isWhatsAppConnected ? '✅ متصل' : '❌ غير متصل'}
    📢 *النشر:* ${isAutoPosting ? '✅ مفعل' : '❌ معطل'}
    💬 *الردود:* ${db.settings.repliesEnabled ? '✅ مفعل' : '❌ معطل'}
    
    📈 *الإحصائيات:*
    📢 الإعلانات: ${db.ads.length}
    👥 المجموعات: ${db.groups.length}
    💬 ردود الخاصة: ${db.replies.private.length}
    💬 ردود المجموعات: ${db.replies.groups.length}
    
    🔗 *الروابط:*
    WhatsApp: ${db.links.whatsapp.length}
    Telegram: ${db.links.telegram.length}
    أخرى: ${db.links.other.length}
    `;
    
    await ctx.reply(status, { parse_mode: 'Markdown' });
});

// إعادة الاتصال
bot.hears('🔄 إعادة الاتصال', async (ctx) => {
    if (isWhatsAppConnected) {
        return ctx.reply('✅ أنت متصل بالفعل بـ WhatsApp!');
    }
    
    await ctx.reply('🔄 جاري محاولة إعادة الاتصال...');
    whatsappClient.initialize();
});

// ============= معالجة الأوامر التفاعلية =============
bot.action('main_menu', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.reply('العودة للقائمة الرئيسية:', getMainKeyboard());
});

bot.action('add_ad', async (ctx) => {
    await ctx.reply('أرسل نص الإعلان الذي تريد إضافته:');
    // هنا يمكنك إضافة حالة للمستخدم
});

bot.action('collect_links', async (ctx) => {
    if (!isWhatsAppConnected) {
        return ctx.answerCbQuery('❌ ليس متصل بـ WhatsApp!');
    }
    
    await ctx.answerCbQuery('جاري تجميع الروابط...');
    
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
        
        await ctx.reply(`✅ تم تجميع ${groups.length} مجموعة`);
        
    } catch (error) {
        await ctx.reply(`❌ خطأ: ${error.message}`);
    }
});

// ============= النشر التلقائي =============
function startAutoPosting() {
    if (!isAutoPosting || !isWhatsAppConnected) return;
    
    let adIndex = 0;
    let groupIndex = 0;
    
    async function postAd() {
        if (!isAutoPosting || !isWhatsAppConnected) return;
        
        if (adIndex >= db.ads.length) adIndex = 0;
        if (groupIndex >= db.groups.length) groupIndex = 0;
        
        const ad = db.ads[adIndex];
        const group = db.groups[groupIndex];
        
        try {
            await whatsappClient.sendMessage(group.id, ad.content);
            console.log(`📤 نشر الإعلان ${adIndex + 1} في ${group.name}`);
            
            groupIndex++;
            if (groupIndex >= db.groups.length) {
                groupIndex = 0;
                adIndex++;
                
                if (adIndex >= db.ads.length) {
                    adIndex = 0;
                    bot.telegram.sendMessage(
                        process.env.ADMIN_ID,
                        '✅ اكتملت دورة النشر، جاري البدء بدورة جديدة...'
                    );
                }
            }
        } catch (error) {
            console.error('❌ خطأ في النشر:', error);
            groupIndex++;
        }
        
        if (isAutoPosting) {
            autoPostInterval = setTimeout(
                postAd, 
                db.settings.autoPostDelay * 60 * 1000
            );
        }
    }
    
    postAd();
}

// ============= معالجة الروابط =============
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // معالجة روابط WhatsApp
    if (text.includes('chat.whatsapp.com')) {
        const links = text.split('\n')
            .map(link => link.trim())
            .filter(link => link.startsWith('https://chat.whatsapp.com/'));
        
        if (links.length > 0) {
            await ctx.reply(`🔍 وجدت ${links.length} رابط، جاري المعالجة...`);
            
            for (const link of links) {
                try {
                    const inviteCode = link.split('/').pop();
                    
                    db.links.whatsapp.push({
                        url: link,
                        code: inviteCode,
                        addedAt: new Date().toISOString()
                    });
                    
                    await ctx.reply(`✅ تم حفظ الرابط: ${link}`);
                    
                } catch (error) {
                    await ctx.reply(`❌ خطأ في الرابط: ${link}`);
                }
            }
            
            saveDB();
        }
    }
    
    // معالجة إضافة إعلان
    if (ctx.session && ctx.session.waitingForAd) {
        db.ads.push({
            id: Date.now(),
            content: text,
            addedBy: ctx.from.id,
            addedAt: new Date().toISOString()
        });
        
        saveDB();
        delete ctx.session.waitingForAd;
        
        await ctx.reply('✅ تم إضافة الإعلان بنجاح!');
    }
});

// ============= بدء التشغيل =============
async function startBot() {
    try {
        // تحميل قاعدة البيانات
        loadDB();
        
        // خادم Express
        app.use(express.static('data/qrcodes'));
        
        app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                whatsapp: isWhatsAppConnected,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        });
        
        app.listen(PORT, () => {
            console.log(`🌐 الخادم يعمل على المنفذ ${PORT}`);
        });
        
        // تشغيل بوت Telegram
        await bot.launch();
        console.log('🤖 بوت Telegram يعمل بنجاح!');
        
        // تهيئة WhatsApp
        whatsappClient.initialize();
        
        console.log('🚀 النظام يعمل بنجاح!');
        
    } catch (error) {
        console.error('❌ خطأ في بدء التشغيل:', error);
        process.exit(1);
    }
}

// ============= إغلاق نظيف =============
process.once('SIGINT', () => {
    console.log('🛑 إغلاق النظام...');
    bot.stop('SIGINT');
    if (whatsappClient) {
        whatsappClient.destroy();
    }
    process.exit();
});

process.once('SIGTERM', () => {
    console.log('🛑 إغلاق النظام...');
    bot.stop('SIGTERM');
    if (whatsappClient) {
        whatsappClient.destroy();
    }
    process.exit();
});

// بدء النظام
startBot();
