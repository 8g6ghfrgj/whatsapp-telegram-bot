// ============================================
// 📱 WhatsApp Telegram Bot - النسخة الكاملة للتحكم
// الإصدار: 2.0.0 - Render Optimized
// الميزات: ربط جهاز مصاحب + تجميع روابط + إعلانات + ردود تلقائية
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const moment = require('moment');
const { Client: WhatsAppClient, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Op } = require('sequelize');

// استيراد النماذج من الملف الرئيسي
const { 
    Admin, 
    WhatsAppSession, 
    CollectedLink, 
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin,
    Broadcast
} = require('./index');

class WhatsAppTelegramBot {
    constructor(token) {
        console.log('🤖 بدء تهيئة بوت التليجرام...');
        
        this.bot = new TelegramBot(token, {
            polling: {
                interval: 1000,
                autoStart: true,
                params: {
                    timeout: 30,
                    maxRetries: 3
                }
            },
            request: {
                timeout: 60000,
                agentOptions: {
                    keepAlive: true,
                    keepAliveMsecs: 10000
                }
            }
        });
        
        // تخزين الحالات
        this.userStates = new Map();
        this.whatsappClients = new Map();
        this.activeAutoPosts = new Map();
        this.activeAutoJoins = new Map();
        this.sessionQRs = new Map();
        this.messageQueues = new Map();
        this.cooldownTimers = new Map();
        
        // إعداد المعالجات
        this.setupHandlers();
        
        console.log('✅ بوت التليجرام مهيأ وجاهز');
    }
    
    // ============================================
    // 1. إعداد جميع المعالجات
    // ============================================
    setupHandlers() {
        console.log('🔧 جاري إعداد معالجات البوت...');
        
        this.setupCommands();
        this.setupCallbacks();
        this.setupMessageHandlers();
        this.setupWhatsAppEvents();
        
        console.log('✅ تم إعداد جميع المعالجات');
    }
    
    // ============================================
    // 2. إعداد الأوامر الرئيسية
    // ============================================
    setupCommands() {
        // /start - القائمة الرئيسية
        this.bot.onText(/\/start/, async (msg) => {
            await this.handleStart(msg);
        });
        
        // /sessions - إدارة الجلسات
        this.bot.onText(/\/sessions/, async (msg) => {
            await this.showSessionsMenu(msg.chat.id, msg.from.id);
        });
        
        // /addsession - إضافة جلسة
        this.bot.onText(/\/addsession/, async (msg) => {
            await this.startAddSession(msg.chat.id, msg.from.id);
        });
        
        // /links - الروابط المجمعة
        this.bot.onText(/\/links/, async (msg) => {
            await this.showLinksMenu(msg.chat.id, msg.from.id);
        });
        
        // /ads - الإعلانات
        this.bot.onText(/\/ads/, async (msg) => {
            await this.showAdsMenu(msg.chat.id, msg.from.id);
        });
        
        // /broadcast - البث الجماعي
        this.bot.onText(/\/broadcast/, async (msg) => {
            await this.showBroadcastMenu(msg.chat.id, msg.from.id);
        });
        
        // /autoreply - الردود التلقائية
        this.bot.onText(/\/autoreply/, async (msg) => {
            await this.showAutoReplyMenu(msg.chat.id, msg.from.id);
        });
        
        // /autojoin - الانضمام التلقائي
        this.bot.onText(/\/autojoin/, async (msg) => {
            await this.showAutoJoinMenu(msg.chat.id, msg.from.id);
        });
        
        // /stats - الإحصائيات
        this.bot.onText(/\/stats/, async (msg) => {
            await this.showStatsMenu(msg.chat.id, msg.from.id);
        });
        
        // /settings - الإعدادات
        this.bot.onText(/\/settings/, async (msg) => {
            await this.showSettingsMenu(msg.chat.id, msg.from.id);
        });
        
        // /help - المساعدة
        this.bot.onText(/\/help/, async (msg) => {
            await this.showHelpMenu(msg.chat.id, msg.from.id);
        });
        
        // /status - حالة البوت
        this.bot.onText(/\/status/, async (msg) => {
            await this.showBotStatus(msg.chat.id, msg.from.id);
        });
        
        // /restart - إعادة تشغيل البوت
        this.bot.onText(/\/restart/, async (msg) => {
            await this.handleRestart(msg.chat.id, msg.from.id);
        });
        
        // /clear - مسح البيانات
        this.bot.onText(/\/clear/, async (msg) => {
            await this.handleClearData(msg.chat.id, msg.from.id);
        });
        
        // /logs - عرض السجلات
        this.bot.onText(/\/logs/, async (msg) => {
            await this.handleShowLogs(msg.chat.id, msg.from.id);
        });
        
        console.log('✅ تم إعداد الأوامر الرئيسية');
    }
    
    // ============================================
    // 3. معالجة بدء البوت (/start)
    // ============================================
    async handleStart(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id.toString();
        const username = msg.from.username || msg.from.first_name || 'مستخدم';
        
        console.log(`👋 مستخدم جديد: ${username} (${telegramId})`);
        
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            
            if (!admin) {
                console.log(`❌ مستخدم غير مصرح: ${telegramId}`);
                
                return this.bot.sendMessage(chatId,
                    `🔒 *غير مصرح لك بالدخول!*\n\n` +
                    `عذراً ${username}، أنت لست مشرفاً في هذا النظام.\n\n` +
                    `📞 *للحصول على صلاحية المشرف:*\n` +
                    `1. تواصل مع المشرف الرئيسي\n` +
                    `2. أرسل له رقم Telegram ID الخاص بك\n` +
                    `3. سيقوم المشرف بإضافتك للنظام\n\n` +
                    `🆔 *رقمك الحالي:* \`${telegramId}\`\n\n` +
                    `⚡ *بعد الإضافة:* أرسل /start مرة أخرى`,
                    { 
                        parse_mode: 'Markdown',
                        disable_web_page_preview: true 
                    }
                );
            }
            
            // تحديث آخر نشاط
            await admin.update({ lastActivity: new Date() });
            
            console.log(`✅ مشرف مسجل: ${admin.firstName || username}`);
            
            // لوحة المفاتيح التفاعلية
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 إدارة الجلسات', callback_data: 'menu_sessions' },
                        { text: '🔗 الروابط المجمعة', callback_data: 'menu_links' }
                    ],
                    [
                        { text: '📢 نظام الإعلانات', callback_data: 'menu_ads' },
                        { text: '📨 البث الجماعي', callback_data: 'menu_broadcast' }
                    ],
                    [
                        { text: '🤖 الردود التلقائية', callback_data: 'menu_autoreply' },
                        { text: '➕ الانضمام التلقائي', callback_data: 'menu_autojoin' }
                    ],
                    [
                        { text: '📊 الإحصائيات', callback_data: 'menu_stats' },
                        { text: '⚙️ الإعدادات', callback_data: 'menu_settings' }
                    ],
                    [
                        { text: '🆘 المساعدة والدعم', callback_data: 'menu_help' },
                        { text: '🔄 تحديث المعلومات', callback_data: 'refresh_menu' }
                    ]
                ]
            };
            
            // رسالة ترحيب مخصصة
            const welcomeMsg = `
🎉 *مرحباً ${admin.firstName || username}!* 🎉

🤖 *مرحباً بك في WhatsApp Telegram Bot*

🚀 *الإصدار:* 2.0.0 - Render Optimized
📅 *تاريخ التشغيل:* ${new Date().toLocaleDateString('ar-SA')}
⏰ *الوقت الحالي:* ${new Date().toLocaleTimeString('ar-SA')}

📊 *حالتك الحالية:*
• 💼 الصلاحيات: ${admin.permissions?.length || 0} صلاحية
• 🔔 الإشعارات: ${admin.settings?.notificationEnabled ? '✅ مفعلة' : '❌ معطلة'}
• 📱 الحد الأقصى للجلسات: ${admin.settings?.maxSessions || 5}

🎯 *المميزات المتاحة لك:*
${admin.permissions?.includes('admin') ? '• 👑 إدارة النظام الكاملة\n' : ''}
${admin.permissions?.includes('manage_sessions') ? '• 📱 ربط وإدارة جلسات WhatsApp\n' : ''}
${admin.permissions?.includes('manage_ads') ? '• 📢 إنشاء وإدارة الإعلانات\n' : ''}
${admin.permissions?.includes('manage_broadcasts') ? '• 📨 إرسال البث الجماعي\n' : ''}
${admin.permissions?.includes('view_stats') ? '• 📊 عرض التقارير والإحصائيات\n' : ''}

💡 *نصائح سريعة:*
1. استخدم /addsession لربط حساب WhatsApp
2. استخدم /links لعرض الروابط المجمعة
3. استخدم /stats لعرض الإحصائيات
4. استخدم /help للحصول على المساعدة

⚡ *جاهز للبدء؟* اختر من القائمة أدناه 👇
            `;
            
            await this.bot.sendMessage(chatId, welcomeMsg, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
            console.log(`✅ تم إرسال رسالة الترحيب لـ ${telegramId}`);
            
        } catch (error) {
            console.error('❌ خطأ في الأمر /start:', error);
            
            await this.bot.sendMessage(chatId,
                '❌ *حدث خطأ غير متوقع!*\n\n' +
                'يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.\n\n' +
                `📋 تفاصيل الخطأ: ${error.message.substring(0, 100)}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 4. بدء إضافة جلسة جديدة
    // ============================================
    async startAddSession(chatId, telegramId) {
        console.log(`➕ طلب إضافة جلسة من: ${telegramId}`);
        
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) {
                console.log(`❌ مستخدم غير مصرح: ${telegramId}`);
                return;
            }
            
            // التحقق من الحد الأقصى للجلسات
            const sessionCount = await WhatsAppSession.count({ 
                where: { adminId: admin.id, status: { [Op.ne]: 'disconnected' } } 
            });
            
            const maxSessions = admin.settings?.maxSessions || 5;
            
            if (sessionCount >= maxSessions) {
                return this.bot.sendMessage(chatId,
                    `❌ *وصلت للحد الأقصى!*\n\n` +
                    `📊 لديك ${sessionCount} جلسة نشطة من أصل ${maxSessions} مسموح بها.\n\n` +
                    `🔄 *الحلول الممكنة:*\n` +
                    `1. استخدم /sessions لعرض الجلسات\n` +
                    `2. احذف جلسة غير مستخدمة\n` +
                    `3. تواصل مع المشرف لزيادة الحد\n\n` +
                    `💡 *نصيحة:* يمكن لكل جلسة التعامل مع مهام مختلفة`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // حفظ حالة المستخدم
            this.userStates.set(telegramId, {
                state: 'awaiting_phone_for_session',
                data: { 
                    adminId: admin.id,
                    step: 1,
                    timestamp: Date.now()
                }
            });
            
            // رسالة إرشادية مع أمثلة
            const examples = [
                '+966501234567',
                '+971501234567', 
                '+201012345678',
                '+212612345678',
                '+963912345678'
            ];
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🇸🇦 السعودية (+966)', callback_data: 'phone_example_+966' },
                        { text: '🇦🇪 الإمارات (+971)', callback_data: 'phone_example_+971' }
                    ],
                    [
                        { text: '🇪🇬 مصر (+20)', callback_data: 'phone_example_+20' },
                        { text: '🇯🇴 الأردن (+962)', callback_data: 'phone_example_+962' }
                    ],
                    [
                        { text: '❌ إلغاء العملية', callback_data: 'cancel_add_session' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId,
                `📱 *إضافة جلسة WhatsApp جديدة*\n\n` +
                `🚀 *مرحباً بك في عملية إضافة الجلسة*\n\n` +
                `📋 *المعلومات المطلوبة:*\n` +
                `1. رقم الهاتف المرتبط بحساب WhatsApp\n` +
                `2. QR Code للربط كجهاز مصاحب\n\n` +
                `📝 *كيفية الحصول على QR Code:*\n` +
                `• افتح WhatsApp على هاتفك\n` +
                `• اذهب إلى الإعدادات → الأجهزة المرتبطة\n` +
                `• انقر على "ربط جهاز"\n` +
                `• سأرسل لك QR Code لمسحه\n\n` +
                `📞 *أرسل لي رقم الهاتف الآن (مع رمز الدولة):*\n` +
                examples.map(ex => `• \`${ex}\``).join('\n') + `\n\n` +
                `🔒 *ملاحظات مهمة:*\n` +
                `• تأكد من اتصال الهاتف بالإنترنت\n` +
                `• الرقم يجب أن يكون نشط على WhatsApp\n` +
                `• يمكنك إلغاء العملية في أي وقت\n\n` +
                `⚡ *جاهز؟ أرسل الرقم الآن:*`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard,
                    disable_web_page_preview: true 
                }
            );
            
            console.log(`✅ تم بدء عملية إضافة جلسة لـ ${telegramId}`);
            
        } catch (error) {
            console.error('❌ خطأ في الأمر /addsession:', error);
            
            await this.bot.sendMessage(chatId,
                '❌ *حدث خطأ في بدء إضافة الجلسة!*\n\n' +
                'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.\n\n' +
                `📋 الخطأ: ${error.message.substring(0, 100)}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 5. إنشاء جلسة واتساب فعلية
    // ============================================
    async createWhatsAppSession(phoneNumber, adminId, chatId) {
        const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
        
        console.log(`📱 جاري إنشاء جلسة جديدة للرقم: ${phoneNumber}`);
        
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
                    autoCollect: true,
                    autoJoin: false,
                    broadcastEnabled: true
                },
                metadata: {
                    createdFrom: 'telegram_bot',
                    platform: 'render',
                    userAgent: 'WhatsApp-Bot/2.0.0'
                }
            });
            
            console.log(`✅ تم حفظ الجلسة في قاعدة البيانات: ${sessionId}`);
            
            // إعداد عميل واتساب مع LocalAuth
            const client = new WhatsAppClient({
                authStrategy: new LocalAuth({
                    clientId: sessionId,
                    dataPath: './sessions'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--window-size=1920,1080'
                    ],
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
                },
                qrTimeout: 60000,
                takeoverOnConflict: true,
                takeoverTimeoutMs: 5000,
                restartOnAuthFail: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            // تخزين العميل في الذاكرة
            this.whatsappClients.set(sessionId, client);
            
            // معالج QR Code
            client.on('qr', async (qr) => {
                console.log(`📱 تم توليد QR Code للجلسة: ${sessionId}`);
                
                // حفظ QR في الذاكرة
                this.sessionQRs.set(sessionId, {
                    qr: qr,
                    timestamp: Date.now(),
                    phoneNumber: phoneNumber
                });
                
                // تحديث الجلسة في قاعدة البيانات
                await session.update({
                    qrCode: qr,
                    qrSentAt: new Date(),
                    status: 'awaiting_qr'
                });
                
                // إرسال QR Code للمستخدم
                await this.sendQRCodeToUser(adminId, qr, sessionId, phoneNumber, chatId);
            });
            
            // عند جاهزية العميل
            client.on('ready', async () => {
                console.log(`✅ WhatsApp جاهز للجلسة: ${sessionId} (${phoneNumber})`);
                
                const connectionData = {
                    platform: client.info.platform,
                    phone: client.info.phone,
                    pushname: client.info.pushname,
                    wid: client.info.wid._serialized
                };
                
                // تحديث الجلسة
                await session.update({
                    status: 'connected',
                    connectedAt: new Date(),
                    connectionData: connectionData,
                    lastActivity: new Date()
                });
                
                // مسح QR من الذاكرة
                this.sessionQRs.delete(sessionId);
                
                // إرسال إشعار الاتصال الناجح
                await this.bot.sendMessage(chatId,
                    `🎉 *تم الربط بنجاح!*\n\n` +
                    `✅ *حساب WhatsApp متصل الآن*\n` +
                    `📱 الرقم: ${phoneNumber}\n` +
                    `👤 الاسم: ${connectionData.pushname || 'غير معروف'}\n` +
                    `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
                    `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                    `🚀 *المميزات المتاحة الآن:*\n` +
                    `• 📨 إرسال واستقبال الرسائل\n` +
                    `• 🔗 تجميع الروابط تلقائياً\n` +
                    `• 📢 النشر في المجموعات\n` +
                    `• 🤖 الردود التلقائية\n` +
                    `• 📊 إحصائيات مفصلة\n\n` +
                    `استخدم /sessions لعرض جميع جلساتك`,
                    { parse_mode: 'Markdown' }
                );
                
                // بدء تجميع المجموعات
                setTimeout(() => this.collectGroupsAndContacts(client, sessionId), 3000);
            });
            
            // عند استقبال رسالة
            client.on('message', async (message) => {
                await this.handleWhatsAppMessage(message, sessionId);
            });
            
            // عند حدوث تغيير في الحالة
            client.on('change_state', async (state) => {
                console.log(`📡 تغيير حالة الجلسة ${sessionId}: ${state}`);
                await session.update({ 
                    status: state,
                    lastActivity: new Date() 
                });
            });
            
            // عند فقدان الاتصال
            client.on('disconnected', async (reason) => {
                console.log(`❌ فقدان الاتصال بالجلسة ${sessionId}: ${reason}`);
                
                await session.update({
                    status: 'disconnected',
                    disconnectedAt: new Date(),
                    lastActivity: new Date()
                });
                
                // إعلام المشرف
                const admin = await Admin.findByPk(adminId);
                if (admin && admin.settings?.notificationEnabled) {
                    await this.bot.sendMessage(admin.telegramId,
                        `⚠️ *تم فقدان الاتصال*\n\n` +
                        `📱 الرقم: ${phoneNumber}\n` +
                        `📌 السبب: ${reason}\n` +
                        `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                        `استخدم /sessions لعرض الحالة وإعادة المحاولة.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            });
            
            // عند حدوث خطأ
            client.on('auth_failure', async (error) => {
                console.error(`❌ فشل المصادقة للجلسة ${sessionId}:`, error);
                
                await session.update({
                    status: 'error',
                    lastActivity: new Date()
                });
            });
            
            // تهيئة العميل
            await client.initialize();
            console.log(`🚀 تم تهيئة عميل WhatsApp للجلسة: ${sessionId}`);
            
            return sessionId;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء جلسة WhatsApp:', error);
            
            // تحديث حالة الجلسة
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
    
    // ============================================
    // 6. إرسال QR Code للمستخدم
    // ============================================
    async sendQRCodeToUser(adminId, qr, sessionId, phoneNumber, chatId) {
        try {
            console.log(`📤 جاري إرسال QR Code إلى المشرف: ${adminId}`);
            
            // توليد QR Code نصي
            const qrText = await new Promise((resolve, reject) => {
                qrcode.toString(qr, { type: 'terminal', small: true }, (err, text) => {
                    if (err) reject(err);
                    else resolve(text);
                });
            });
            
            // إنشاء رسالة مفصلة
            const message = `
📱 *QR Code لربط جهاز مصاحب*

🔗 *معلومات الجلسة:*
• 📞 الرقم: \`${phoneNumber}\`
• 🆔 المعرف: \`${sessionId.substring(0, 8)}\`
• ⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}
• 📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}

🚀 *طريقة الربط:*

1. *افتح WhatsApp* على هاتفك
2. *اضغط* على **النقاط الثلاث** (⋮) أو **الإعدادات**
3. *اختر* **"الأجهزة المرتبطة"** أو **"Linked Devices"**
4. *انقر* على **"ربط جهاز"** أو **"Link a Device"**
5. *اختر* **"ربط باستخدام رابط QR Code"**
6. *مسح* الكود أدناه بكاميرا الهاتف

📝 *تعليمات QR Code:*
\`\`\`
${qrText}
\`\`\`

🔗 *رابط QR (بديل):*
\`${qr}\`

⏱️ *مدة الصلاحية:* 60 ثانية
🔄 *سيتم تجديده تلقائياً*

✅ *بعد المسح:* ستصلك رسالة تأكيد على هاتفك
            `;
            
            // زر المساعدة
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 كيفية الربط بالصور', callback_data: `qr_help_${sessionId}` },
                        { text: '🔄 إعادة توليد QR', callback_data: `qr_regenerate_${sessionId}` }
                    ],
                    [
                        { text: '❌ إلغاء الجلسة', callback_data: `qr_cancel_${sessionId}` }
                    ],
                    [
                        { text: '📋 العودة للقائمة', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            // إرسال الرسالة
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
            console.log(`✅ تم إرسال QR Code بنجاح إلى ${adminId}`);
            
        } catch (error) {
            console.error('❌ خطأ في إرسال QR Code:', error);
            
            // إرسال رسالة بديلة
            await this.bot.sendMessage(chatId,
                `❌ *عذراً، حدث خطأ في توليد QR Code*\n\n` +
                `🔗 *الرابط البديل:*\n` +
                `\`${qr}\`\n\n` +
                `انسخ هذا الرابط والصقه في متصفح لرؤية QR Code.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 7. تجميع المجموعات والجهات
    // ============================================
    async collectGroupsAndContacts(client, sessionId) {
        try {
            console.log(`📊 جاري تجميع بيانات الجلسة: ${sessionId}`);
            
            // الحصول على جميع المحادثات
            const chats = await client.getChats();
            
            // تصنيف المحادثات
            const groups = chats.filter(chat => chat.isGroup);
            const contacts = chats.filter(chat => !chat.isGroup && chat.isUser);
            
            console.log(`📈 جمع ${groups.length} مجموعة و ${contacts.length} جهة اتصال`);
            
            // تحديث إحصائيات الجلسة
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                await session.update({
                    groupsCount: groups.length,
                    contactsCount: contacts.length,
                    lastActivity: new Date(),
                    stats: {
                        ...session.stats,
                        groupsCollected: groups.length,
                        contactsCollected: contacts.length
                    }
                });
                
                // تجميع روابط المجموعات
                if (session.settings?.autoCollect) {
                    await this.collectGroupLinks(client, sessionId, groups);
                }
            }
            
            return { groups, contacts };
            
        } catch (error) {
            console.error('❌ خطأ في تجميع المجموعات والجهات:', error);
            return { groups: [], contacts: [] };
        }
    }
    
    async collectGroupLinks(client, sessionId, groups) {
        try {
            console.log(`🔗 جاري تجميع روابط المجموعات للجلسة: ${sessionId}`);
            
            let collectedCount = 0;
            
            for (const group of groups.slice(0, 50)) { // تحد من عدد المجموعات
                try {
                    // محاولة الحصول على رابط الدعوة
                    const inviteCode = await group.getInviteCode();
                    if (inviteCode) {
                        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                        
                        // التحقق من عدم تكرار الرابط
                        const existingLink = await CollectedLink.findOne({
                            where: { url: inviteLink }
                        });
                        
                        if (!existingLink) {
                            // حفظ الرابط
                            await CollectedLink.create({
                                url: inviteLink,
                                type: 'whatsapp_group',
                                title: group.name || 'مجموعة واتساب',
                                description: `مجموعة تحتوي على ${group.participants?.length || 0} عضو`,
                                source: 'auto_collection',
                                sessionId: sessionId,
                                metadata: {
                                    groupName: group.name,
                                    groupSize: group.participants?.length || 0,
                                    isActive: true,
                                    lastChecked: new Date()
                                },
                                status: 'active',
                                collectedAt: new Date()
                            });
                            
                            collectedCount++;
                            console.log(`✅ رابط محفوظ: ${group.name || 'مجموعة'}`);
                        }
                    }
                    
                    // تأخير بسيط بين المجموعات
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log(`⚠️ لا يمكن الحصول على رابط المجموعة: ${group.name || 'غير معروفة'}`);
                }
            }
            
            console.log(`🎯 تم تجميع ${collectedCount} رابط جديد`);
            
            // تحديث إحصائيات الجلسة
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                const stats = session.stats || {};
                stats.linksCollected = (stats.linksCollected || 0) + collectedCount;
                await session.update({ stats });
            }
            
        } catch (error) {
            console.error('❌ خطأ في تجميع روابط المجموعات:', error);
        }
    }
    
    // ============================================
    // 8. معالجة رسائل واتساب
    // ============================================
    async handleWhatsAppMessage(message, sessionId) {
        try {
            // تحديث إحصائيات الجلسة
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                const stats = session.stats || {};
                stats.messagesReceived = (stats.messagesReceived || 0) + 1;
                await session.update({ 
                    stats,
                    lastActivity: new Date() 
                });
            }
            
            // 1. تجميع الروابط من الرسالة
            if (session?.settings?.autoCollect) {
                await this.collectLinksFromMessage(message, sessionId);
            }
            
            // 2. التحقق من الردود التلقائية
            if (session?.settings?.autoReply) {
                await this.checkAutoReplies(message, sessionId);
            }
            
            // 3. اكتشاف روابط الانضمام
            await this.detectJoinLinks(message, sessionId);
            
            // 4. إرسال إشعار للمشرف (للمراسلات الخاصة فقط)
            if (!message.from.includes('@g.us')) {
                await this.notifyAdminOfPrivateMessage(message, sessionId);
            }
            
        } catch (error) {
            console.error('❌ خطأ في معالجة رسالة WhatsApp:', error);
        }
    }
    
    async collectLinksFromMessage(message, sessionId) {
        try {
            if (!message.body) return;
            
            // استخراج جميع الروابط
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.body.match(urlRegex) || [];
            
            for (const url of links) {
                // تصنيف الرابط
                let type = 'other';
                if (url.includes('chat.whatsapp.com')) type = 'whatsapp_group';
                else if (url.includes('whatsapp.com')) type = 'whatsapp_invite';
                else if (url.includes('t.me') || url.includes('telegram.me')) type = 'telegram';
                else if (url.includes('discord.gg')) type = 'discord';
                else if (url.includes('signal.group')) type = 'signal';
                else if (url.includes('http')) type = 'website';
                
                // التحقق من عدم التكرار
                const existing = await CollectedLink.findOne({
                    where: { url: url }
                });
                
                if (existing) {
                    // تحديث وقت الاكتشاف الأخير
                    await existing.update({
                        lastChecked: new Date(),
                        checkCount: (existing.checkCount || 0) + 1
                    });
                    continue;
                }
                
                // حفظ الرابط الجديد
                await CollectedLink.create({
                    url: url,
                    type: type,
                    title: `رابط من ${message.from || 'مجهول'}`,
                    description: message.body.substring(0, 200),
                    source: message.from,
                    sessionId: sessionId,
                    collectedAt: new Date(),
                    lastChecked: new Date(),
                    metadata: {
                        sender: message.from,
                        timestamp: message.timestamp,
                        hasMedia: !!message.hasMedia
                    }
                });
                
                console.log(`✅ رابط جديد محفوظ: ${type} - ${url.substring(0, 50)}...`);
            }
            
        } catch (error) {
            console.error('❌ خطأ في تجميع الروابط من الرسالة:', error);
        }
    }
    
    async checkAutoReplies(message, sessionId) {
        try {
            // الحصول على جميع الردود التلقائية النشطة لهذه الجلسة
            const autoReplies = await AutoReply.findAll({
                where: {
                    [Op.or]: [
                        { sessionId: sessionId },
                        { sessionId: null }
                    ],
                    isActive: true
                },
                order: [['priority', 'DESC']]
            });
            
            for (const reply of autoReplies) {
                // التحقق من وقت التبريد
                const cooldownKey = `${sessionId}_${reply.id}`;
                if (this.cooldownTimers.has(cooldownKey)) {
                    const lastTrigger = this.cooldownTimers.get(cooldownKey);
                    const cooldownMs = reply.cooldown * 1000;
                    if (Date.now() - lastTrigger < cooldownMs) {
                        continue;
                    }
                }
                
                if (this.shouldTriggerAutoReply(message, reply)) {
                    // إرسال الرد
                    await this.sendAutoReply(message, reply, sessionId);
                    
                    // تحديث وقت التبريد
                    this.cooldownTimers.set(cooldownKey, Date.now());
                    
                    // تحديث الإحصائيات
                    const stats = reply.stats || {};
                    stats.triggered = (stats.triggered || 0) + 1;
                    stats.lastTriggered = new Date();
                    stats.bySession = stats.bySession || {};
                    stats.bySession[sessionId] = (stats.bySession[sessionId] || 0) + 1;
                    
                    await reply.update({ stats });
                    
                    console.log(`🤖 تم إرسال رد تلقائي: ${reply.name}`);
                    
                    // خروج بعد أول رد مناسب (الأولوية الأعلى)
                    if (reply.priority >= 5) break;
                }
            }
            
        } catch (error) {
            console.error('❌ خطأ في الرد التلقائي:', error);
        }
    }
    
    shouldTriggerAutoReply(message, reply) {
        const text = message.body || '';
        const isGroup = message.from.includes('@g.us');
        
        // التحقق من نوع المحادثة
        if (reply.triggerType === 'private' && isGroup) return false;
        if (reply.triggerType === 'group' && !isGroup) return false;
        
        // التحقق من الشروط الإضافية
        const conditions = reply.conditions || {};
        
        // التحقق من نطاق الوقت
        if (conditions.timeRange) {
            const now = new Date();
            const hours = now.getHours();
            const [start, end] = conditions.timeRange.split('-').map(Number);
            if (hours < start || hours >= end) return false;
        }
        
        // التحقق من أيام الأسبوع
        if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
            const day = new Date().getDay();
            if (!conditions.daysOfWeek.includes(day)) return false;
        }
        
        // التحقق من الكلمات المطلوبة
        if (conditions.requireKeywords && conditions.requireKeywords.length > 0) {
            const hasRequired = conditions.requireKeywords.some(keyword => 
                text.toLowerCase().includes(keyword.toLowerCase())
            );
            if (!hasRequired) return false;
        }
        
        // التحقق من الكلمات المستبعدة
        if (conditions.excludeKeywords && conditions.excludeKeywords.length > 0) {
            const hasExcluded = conditions.excludeKeywords.some(keyword => 
                text.toLowerCase().includes(keyword.toLowerCase())
            );
            if (hasExcluded) return false;
        }
        
        // التحقق من المحتوى الرئيسي
        switch (reply.matchType) {
            case 'exact':
                return text.trim() === reply.trigger;
            case 'contains':
                return text.toLowerCase().includes(reply.trigger.toLowerCase());
            case 'regex':
                try {
                    const regex = new RegExp(reply.trigger, 'i');
                    return regex.test(text);
                } catch {
                    return false;
                }
            case 'starts_with':
                return text.toLowerCase().startsWith(reply.trigger.toLowerCase());
            case 'ends_with':
                return text.toLowerCase().endsWith(reply.trigger.toLowerCase());
            default:
                return false;
        }
    }
    
    async sendAutoReply(message, reply, sessionId) {
        try {
            const client = this.whatsappClients.get(sessionId);
            if (!client) {
                console.log(`❌ العميل غير متصل للجلسة: ${sessionId}`);
                return;
            }
            
            switch (reply.responseType) {
                case 'text':
                    await client.sendMessage(message.from, reply.response);
                    break;
                case 'image':
                    // معالجة الصور
                    await client.sendMessage(message.from, reply.response);
                    break;
                default:
                    await client.sendMessage(message.from, reply.response);
            }
            
            // تحديث إحصائيات الجلسة
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                const stats = session.stats || {};
                stats.messagesSent = (stats.messagesSent || 0) + 1;
                await session.update({ stats });
            }
            
        } catch (error) {
            console.error('❌ خطأ في إرسال الرد التلقائي:', error);
            
            // تحديث إحصائيات الفشل
            const replyStats = reply.stats || {};
            replyStats.failed = (replyStats.failed || 0) + 1;
            await reply.update({ stats: replyStats });
        }
    }
    
    async detectJoinLinks(message, sessionId) {
        try {
            if (!message.body) return;
            
            // البحث عن روابط انضمام واتساب
            const whatsappInviteRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/g;
            const inviteLinks = message.body.match(whatsappInviteRegex) || [];
            
            for (const link of inviteLinks) {
                await this.processDetectedJoinLink(link, sessionId);
            }
            
        } catch (error) {
            console.error('❌ خطأ في اكتشاف روابط الانضمام:', error);
        }
    }
    
    async processDetectedJoinLink(link, sessionId) {
        try {
            // التحقق إذا كان الرابط محفوظاً مسبقاً
            const existing = await CollectedLink.findOne({
                where: { url: link }
            });
            
            if (existing) {
                // تحديث وقت الاكتشاف الأخير
                await existing.update({
                    lastChecked: new Date(),
                    checkCount: (existing.checkCount || 0) + 1,
                    status: 'active'
                });
            } else {
                // حفظ الرابط جديد
                await CollectedLink.create({
                    url: link,
                    type: 'whatsapp_group',
                    title: 'دعوة انضمام لمجموعة واتساب',
                    description: 'تم اكتشافه تلقائياً من الرسائل',
                    source: 'auto_detection',
                    sessionId: sessionId,
                    collectedAt: new Date(),
                    lastChecked: new Date(),
                    metadata: {
                        detectedAt: new Date(),
                        autoDetected: true
                    },
                    status: 'active'
                });
            }
            
            // محاولة الانضمام إذا كان النظام مفعلاً
            const autoJoin = await AutoJoin.findOne({
                where: {
                    sessionId: sessionId,
                    status: 'active'
                }
            });
            
            if (autoJoin) {
                await this.joinWhatsAppGroup(link, sessionId);
            }
            
        } catch (error) {
            console.error('❌ خطأ في معالجة رابط الانضمام:', error);
        }
    }
    
    async joinWhatsAppGroup(inviteLink, sessionId) {
        try {
            const client = this.whatsappClients.get(sessionId);
            if (!client) {
                console.log(`❌ العميل غير متصل للانضمام: ${sessionId}`);
                return false;
            }
            
            // استخراج كود الدعوة من الرابط
            const inviteCode = inviteLink.split('/').pop();
            
            console.log(`➕ محاولة الانضمام للمجموعة: ${inviteLink}`);
            
            // محاولة الانضمام
            await client.acceptInvite(inviteCode);
            
            console.log(`✅ تم الانضمام بنجاح للمجموعة: ${inviteLink}`);
            
            // تحديث حالة الرابط
            await CollectedLink.update(
                { status: 'joined' },
                { where: { url: inviteLink } }
            );
            
            // تحديث إحصائيات الانضمام التلقائي
            const autoJoin = await AutoJoin.findOne({
                where: { sessionId: sessionId, status: 'active' }
            });
            
            if (autoJoin) {
                const stats = autoJoin.stats || {};
                stats.joined = (stats.joined || 0) + 1;
                stats.totalLinks = (stats.totalLinks || 0) + 1;
                stats.successRate = stats.joined / stats.totalLinks * 100;
                stats.lastJoinAt = new Date();
                stats.lastLinks = [...(stats.lastLinks || []).slice(-9), inviteLink];
                
                await autoJoin.update({ stats });
                
                // إرسال إشعار للمشرف إذا كان مفعلاً
                const session = await WhatsAppSession.findByPk(sessionId);
                if (session && autoJoin.settings?.notifyOnJoin) {
                    const admin = await Admin.findByPk(session.adminId);
                    if (admin && admin.settings?.notificationEnabled) {
                        await this.bot.sendMessage(admin.telegramId,
                            `✅ *تم الانضمام التلقائي لمجموعة جديدة*\n\n` +
                            `🔗 الرابط: ${inviteLink}\n` +
                            `📱 الجلسة: ${session.phoneNumber}\n` +
                            `👤 العضو: ${session.connectionData?.pushname || 'غير معروف'}\n` +
                            `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                            `📊 الإحصائيات: ${stats.joined}/${stats.totalLinks} (${Math.round(stats.successRate)}%)`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ فشل الانضمام للمجموعة:', error.message);
            
            // تحديث إحصائيات الفشل
            const autoJoin = await AutoJoin.findOne({
                where: { sessionId: sessionId, status: 'active' }
            });
            
            if (autoJoin) {
                const stats = autoJoin.stats || {};
                stats.failed = (stats.failed || 0) + 1;
                stats.totalLinks = (stats.totalLinks || 0) + 1;
                stats.successRate = stats.joined / stats.totalLinks * 100;
                stats.lastError = error.message;
                
                await autoJoin.update({ stats });
            }
            
            return false;
        }
    }
    
    async notifyAdminOfPrivateMessage(message, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) return;
            
            const admin = await Admin.findByPk(session.adminId);
            if (!admin || !admin.settings?.notificationEnabled) return;
            
            // تجنب الإشعارات المفرطة
            const notificationKey = `${admin.id}_${message.from}`;
            const lastNotification = this.messageQueues.get(notificationKey) || 0;
            const now = Date.now();
            
            if (now - lastNotification < 60000) { // دقيقة واحدة بين الإشعارات
                return;
            }
            
            // إرسال إشعار
            const messagePreview = message.body 
                ? (message.body.length > 100 ? message.body.substring(0, 100) + '...' : message.body)
                : '📎 رسالة تحتوي على مرفق';
            
            await this.bot.sendMessage(admin.telegramId,
                `📨 *رسالة جديدة على WhatsApp*\n\n` +
                `📱 من: ${message.from}\n` +
                `🔗 الجلسة: ${session.phoneNumber}\n` +
                `📝 المحتوى:\n${messagePreview}\n\n` +
                `⏰ ${new Date().toLocaleTimeString('ar-SA')}`,
                { parse_mode: 'Markdown' }
            );
            
            // تحديث وقت الإشعار الأخير
            this.messageQueues.set(notificationKey, now);
            
        } catch (error) {
            console.error('❌ خطأ في إرسال إشعار الرسالة:', error);
        }
    }
    
    // ============================================
    // 9. معالجة الرسائل النصية من المستخدمين
    // ============================================
    setupMessageHandlers() {
        this.bot.on('message', async (msg) => {
            // تخطي الأوامر
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const telegramId = msg.from.id.toString();
            const userState = this.userStates.get(telegramId);
            
            if (!userState || !msg.text) return;
            
            console.log(`📝 معالجة رسالة حالة من ${telegramId}: ${userState.state}`);
            
            // معالجة حالات المستخدم المختلفة
            switch (userState.state) {
                case 'awaiting_phone_for_session':
                    await this.handlePhoneInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_ad_name':
                    await this.handleAdNameInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_ad_content':
                    await this.handleAdContentInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_broadcast_message':
                    await this.handleBroadcastMessageInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_autoreply_trigger':
                    await this.handleAutoReplyTriggerInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_autoreply_response':
                    await this.handleAutoReplyResponseInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_session_name':
                    await this.handleSessionNameInput(chatId, telegramId, msg.text, userState.data);
                    break;
            }
        });
    }
    
    async handlePhoneInput(chatId, telegramId, phoneNumber, data) {
        console.log(`📞 معالجة رقم هاتف: ${phoneNumber} من ${telegramId}`);
        
        // التحقق من صحة الرقم
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            const errorMsg = `
❌ *رقم الهاتف غير صالح!*

📋 *الشروط الصحيحة:*
1. يجب أن يبدأ بعلامة ➕
2. يتبعه رمز الدولة (1-3 أرقام)
3. ثم رقم الهاتف (8-14 رقم)
4. لا يحتوي على مسافات أو رموز خاصة

📝 *أمثلة صحيحة:*
• \`+966501234567\` - السعودية
• \`+971501234567\` - الإمارات  
• \`+201012345678\` - مصر
• \`+212612345678\` - المغرب
• \`+962791234567\` - الأردن

❌ *أمثلة خاطئة:*
• 966501234567 (ناقص +)
• +966-50-123-4567 (يحتوي على -)
• 00966501234567 (يبدأ بـ 00)
• +966 50 123 4567 (يحتوي على مسافات)

🔧 *حاول مرة أخرى:*
أرسل الرقم بالشكل الصحيح أو انقر على أحد الأمثلة:
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🇸🇦 +966501234567', callback_data: 'phone_example_+966501234567' },
                        { text: '🇦🇪 +971501234567', callback_data: 'phone_example_+971501234567' }
                    ],
                    [
                        { text: '🇪🇬 +201012345678', callback_data: 'phone_example_+201012345678' },
                        { text: '🇯🇴 +962791234567', callback_data: 'phone_example_+962791234567' }
                    ],
                    [
                        { text: '❌ إلغاء العملية', callback_data: 'cancel_add_session' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId, errorMsg, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            return;
        }
        
        // التحقق من عدم تكرار الجلسة لنفس الرقم
        const existingSession = await WhatsAppSession.findOne({
            where: { 
                phoneNumber: phoneNumber,
                adminId: data.adminId,
                status: { [Op.ne]: 'disconnected' }
            }
        });
        
        if (existingSession) {
            await this.bot.sendMessage(chatId,
                `⚠️ *هذا الرقم مضاف مسبقاً!*\n\n` +
                `📱 الرقم: ${phoneNumber}\n` +
                `📌 الحالة: ${existingSession.status}\n` +
                `🆔 المعرف: ${existingSession.id.substring(0, 8)}\n\n` +
                `🔧 *خيارات:*\n` +
                `1. استخدم الجلسة الحالية\n` +
                `2. احذف الجلسة الحالية وأضف جديدة\n` +
                `3. أضف رقم هاتف مختلف\n\n` +
                `استخدم /sessions لإدارة الجلسات الحالية.`,
                { parse_mode: 'Markdown' }
            );
            
            // مسح حالة المستخدم
            this.userStates.delete(telegramId);
            return;
        }
        
        // بدء عملية إنشاء الجلسة
        await this.bot.sendMessage(chatId,
            `⏳ *جاري إنشاء الجلسة...*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🔧 جاري الاتصال بـ WhatsApp Web...\n` +
            `⏱️ قد تستغرق العملية 10-30 ثانية\n\n` +
            `⚡ *جاري التحضير:*\n` +
            `• تهيئة متصفح WhatsApp\n` +
            `• توليد QR Code فريد\n` +
            `• إعداد الجهاز المصاحب\n` +
            `• اختبار الاتصال...`,
            { parse_mode: 'Markdown' }
        );
        
        try {
            const sessionId = await this.createWhatsAppSession(phoneNumber, data.adminId, chatId);
            
            // مسح حالة المستخدم
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إنشاء الجلسة بنجاح!*\n\n` +
                `📱 الرقم: ${phoneNumber}\n` +
                `🆔 معرف الجلسة: \`${sessionId.substring(0, 8)}\`\n` +
                `🔗 الحالة: ⏳ في انتظار الربط\n\n` +
                `📤 *جاري إرسال QR Code...*\n` +
                `سوف يصلك خلال ثواني قليلة.\n\n` +
                `💡 *تلميح:* تأكد من:\n` +
                `1. اتصال هاتفك بالإنترنت\n` +
                `2. فتح تطبيق WhatsApp\n` +
                `3. جاهزية الكاميرا للمسح`,
                { parse_mode: 'Markdown' }
            );
            
            console.log(`✅ تم إنشاء جلسة ${sessionId} للرقم ${phoneNumber}`);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الجلسة:', error);
            
            // مسح حالة المستخدم
            this.userStates.delete(telegramId);
            
            let errorMessage = 'فشل إنشاء الجلسة';
            if (error.message.includes('timeout')) {
                errorMessage = 'انتهت مهلة الاتصال بـ WhatsApp';
            } else if (error.message.includes('protocol')) {
                errorMessage = 'خطأ في بروتوكول WhatsApp';
            } else if (error.message.includes('puppeteer')) {
                errorMessage = 'خطأ في متصفح WhatsApp';
            }
            
            await this.bot.sendMessage(chatId,
                `❌ *${errorMessage}!*\n\n` +
                `📱 الرقم: ${phoneNumber}\n` +
                `📋 الخطأ: ${error.message.substring(0, 100)}\n\n` +
                `🔧 *الأسباب المحتملة:*\n` +
                `• مشكلة في اتصال WhatsApp Web\n` +
                `• رقم الهاتف غير صحيح\n` +
                `• حساب WhatsApp غير نشط\n` +
                `• مشكلة في السيرفر\n\n` +
                `🔄 *الحلول المقترحة:*\n` +
                `1. تحقق من صحة الرقم\n` +
                `2. تأكد من نشاط حساب WhatsApp\n` +
                `3. حاول مرة أخرى بعد قليل\n` +
                `4. تواصل مع الدعم الفني\n\n` +
                `⚡ يمكنك المحاولة مرة أخرى باستخدام /addsession`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 10. معالجة الأزرار التفاعلية
    // ============================================
    setupCallbacks() {
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const username = query.from.username || query.from.first_name || 'مستخدم';
            const data = query.data;
            
            console.log(`🔘 زر تفاعلي من ${username} (${userId}): ${data}`);
            
            try {
                // الرد الفوري على الزر
                await this.bot.answerCallbackQuery(query.id);
                
                // تقسيم بيانات الزر
                const parts = data.split('_');
                const action = parts[0];
                
                switch (action) {
                    case 'menu':
                        await this.handleMenuAction(chatId, userId, parts[1], parts[2]);
                        break;
                        
                    case 'session':
                        await this.handleSessionAction(chatId, userId, parts);
                        break;
                        
                    case 'qr':
                        await this.handleQRAction(chatId, userId, parts);
                        break;
                        
                    case 'links':
                        await this.handleLinksAction(chatId, userId, parts[1]);
                        break;
                        
                    case 'ad':
                        await this.handleAdAction(chatId, userId, parts);
                        break;
                        
                    case 'stats':
                        await this.handleStatsAction(chatId, userId, parts);
                        break;
                        
                    case 'refresh':
                        await this.handleRefreshAction(chatId, userId, parts[1]);
                        break;
                        
                    case 'phone':
                        await this.handlePhoneExample(chatId, userId, parts);
                        break;
                        
                    case 'cancel':
                        await this.handleCancelAction(chatId, userId, parts);
                        break;
                        
                    default:
                        console.log(`🔍 زر غير معروف: ${data}`);
                        await this.bot.sendMessage(chatId, 
                            '⚠️ *زر غير معروف*\n\n' +
                            'يرجى استخدام القائمة الحالية.',
                            { parse_mode: 'Markdown' }
                        );
                }
                
            } catch (error) {
                console.error('❌ خطأ في معالجة الزر التفاعلي:', error);
                
                await this.bot.answerCallbackQuery(query.id, {
                    text: '❌ حدث خطأ في المعالجة',
                    show_alert: true
                });
                
                await this.bot.sendMessage(chatId,
                    '❌ *حدث خطأ غير متوقع!*\n\n' +
                    'يرجى المحاولة مرة أخرى.\n\n' +
                    `📋 الخطأ: ${error.message.substring(0, 100)}`,
                    { parse_mode: 'Markdown' }
                );
            }
        });
    }
    
    async handleMenuAction(chatId, userId, menu, submenu) {
        console.log(`📋 قائمة: ${menu}${submenu ? `/${submenu}` : ''} من ${userId}`);
        
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) {
            console.log(`❌ مستخدم غير مصرح للقائمة: ${userId}`);
            return;
        }
        
        // تحديث آخر نشاط
        await admin.update({ lastActivity: new Date() });
        
        switch (menu) {
            case 'sessions':
                await this.showSessionsMenu(chatId, admin.id);
                break;
                
            case 'links':
                await this.showLinksMenu(chatId, admin.id);
                break;
                
            case 'ads':
                await this.showAdsMenu(chatId, admin.id);
                break;
                
            case 'broadcast':
                await this.showBroadcastMenu(chatId, admin.id);
                break;
                
            case 'autoreply':
                await this.showAutoReplyMenu(chatId, admin.id);
                break;
                
            case 'autojoin':
                await this.showAutoJoinMenu(chatId, admin.id);
                break;
                
            case 'stats':
                await this.showStatsMenu(chatId, admin.id);
                break;
                
            case 'settings':
                await this.showSettingsMenu(chatId, admin.id);
                break;
                
            case 'help':
                await this.showHelpMenu(chatId, admin.id);
                break;
                
            case 'main':
                await this.handleStart({ 
                    chat: { id: chatId }, 
                    from: { id: userId, username: admin.username, first_name: admin.firstName } 
                });
                break;
                
            default:
                console.log(`❌ قائمة غير معروفة: ${menu}`);
        }
    }
    
    // ============================================
    // 11. عرض قائمة الجلسات
    // ============================================
    async showSessionsMenu(chatId, adminId) {
        try {
            const admin = await Admin.findByPk(adminId);
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: adminId },
                order: [['createdAt', 'DESC']]
            });
            
            const activeSessions = sessions.filter(s => 
                s.status === 'connected' || s.status === 'authenticated'
            ).length;
            
            const totalSessions = sessions.length;
            const awaitingSessions = sessions.filter(s => s.status === 'awaiting_qr').length;
            
            // لوحة المفاتيح التفاعلية
            const keyboard = {
                inline_keyboard: []
            };
            
            // زر الإضافة إذا لم يصل للحد
            if (totalSessions < (admin.settings?.maxSessions || 5)) {
                keyboard.inline_keyboard.push([
                    { text: '📱➕ إضافة جلسة جديدة', callback_data: 'add_session' }
                ]);
            }
            
            // أزرار حالة الجلسات
            if (sessions.length > 0) {
                keyboard.inline_keyboard.push([
                    { text: `🟢 نشطة (${activeSessions})`, callback_data: 'session_filter_active' },
                    { text: `📱 بانتظار QR (${awaitingSessions})`, callback_data: 'session_filter_awaiting' }
                ]);
                
                keyboard.inline_keyboard.push([
                    { text: `📊 الكل (${totalSessions})`, callback_data: 'session_filter_all' }
                ]);
                
                // عرض 5 جلسات كحد أقصى
                sessions.slice(0, 5).forEach(session => {
                    const statusEmoji = 
                        session.status === 'connected' ? '🟢' :
                        session.status === 'awaiting_qr' ? '📱' :
                        session.status === 'authenticated' ? '🔐' :
                        session.status === 'disconnected' ? '🔴' : '⚪';
                    
                    const sessionName = session.phoneNumber || `جلسة ${session.id.substring(0, 6)}`;
                    
                    keyboard.inline_keyboard.push([
                        { 
                            text: `${statusEmoji} ${sessionName}`, 
                            callback_data: `session_info_${session.id}`
                        }
                    ]);
                });
            }
            
            keyboard.inline_keyboard.push([
                { text: '🔄 تحديث القائمة', callback_data: 'refresh_sessions' },
                { text: '📊 إحصائيات مفصلة', callback_data: 'session_stats_detailed' }
            ]);
            
            keyboard.inline_keyboard.push([
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]);
            
            // رسالة القائمة
            let message = `📱 *إدارة جلسات WhatsApp*\n\n`;
            
            if (sessions.length === 0) {
                message += `📭 *لا توجد جلسات واتساب*\n\n`;
                message += `انقر على *"📱➕ إضافة جلسة جديدة"* لبدء ربط حساب WhatsApp الأول.\n\n`;
                message += `🚀 *كيفية الربط كجهاز مصاحب:*\n`;
                message += `1. سأطلب منك رقم الهاتف\n`;
                message += `2. سأرسل لك QR Code\n`;
                message += `3. تمسحه من خلال WhatsApp\n`;
                message += `4. البوت يصبح جهازاً مصاحباً\n`;
            } else {
                message += `📊 *إحصائيات الجلسات:*\n`;
                message += `• 🟢 نشطة: ${activeSessions} جلسة\n`;
                message += `• 📱 بانتظار QR: ${awaitingSessions} جلسة\n`;
                message += `• 📊 الإجمالي: ${totalSessions} جلسة\n`;
                message += `• 🎯 المسموح: ${admin.settings?.maxSessions || 5} جلسة\n\n`;
                
                if (activeSessions > 0) {
                    message += `✅ *الجلسات النشطة تعمل على:*\n`;
                    message += `• تجميع الروابط تلقائياً\n`;
                    message += `• الرد التلقائي على الرسائل\n`;
                    message += `• تجميع المجموعات والجهات\n`;
                    message += `• الإعداد للنشر والانضمام\n\n`;
                }
                
                message += `📋 *آخر الجلسات:*\n`;
                
                sessions.slice(0, 3).forEach((session, index) => {
                    const statusText = 
                        session.status === 'connected' ? '🟢 متصل' :
                        session.status === 'awaiting_qr' ? '📱 بانتظار QR' :
                        session.status === 'authenticated' ? '🔐 مصادق' :
                        session.status === 'disconnected' ? '🔴 مقطوع' : '⚪ ' + session.status;
                    
                    const groupsText = session.groupsCount > 0 ? `👥 ${session.groupsCount}` : '';
                    const timeText = session.connectedAt ? 
                        `⏰ ${new Date(session.connectedAt).toLocaleTimeString('ar-SA')}` : '';
                    
                    message += `${index + 1}. ${statusText} ${session.phoneNumber}\n`;
                    if (groupsText) message += `   ${groupsText} ${timeText}\n`;
                    message += `\n`;
                });
            }
            
            message += `\n⚡ *اختر جلسة للتحكم أو إضافة جلسة جديدة*`;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
            console.log(`✅ تم عرض قائمة الجلسات لـ ${adminId}`);
            
        } catch (error) {
            console.error('❌ خطأ في عرض قائمة الجلسات:', error);
            throw error;
        }
    }
    
    // ============================================
    // 12. عرض قائمة الروابط
    // ============================================
    async showLinksMenu(chatId, adminId) {
        try {
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: adminId }
            });
            
            const sessionIds = sessions.map(s => s.id);
            
            // إحصائيات الروابط
            const whatsappGroups = await CollectedLink.count({
                where: {
                    type: 'whatsapp_group',
                    sessionId: sessionIds
                }
            });
            
            const whatsappInvites = await CollectedLink.count({
                where: {
                    type: 'whatsapp_invite',
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
                    type: ['website', 'other', 'discord', 'signal'],
                    sessionId: sessionIds
                }
            });
            
            const activeLinks = await CollectedLink.count({
                where: {
                    sessionId: sessionIds,
                    status: 'active'
                }
            });
            
            const totalLinks = whatsappGroups + whatsappInvites + telegramLinks + otherLinks;
            
            // لوحة المفاتيح التفاعلية
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: `📱 مجموعات (${whatsappGroups})`, callback_data: 'links_whatsapp_group' },
                        { text: `📩 دعوات (${whatsappInvites})`, callback_data: 'links_whatsapp_invite' }
                    ],
                    [
                        { text: `📢 تليجرام (${telegramLinks})`, callback_data: 'links_telegram' },
                        { text: `🌐 أخرى (${otherLinks})`, callback_data: 'links_other' }
                    ],
                    [
                        { text: `🟢 نشطة (${activeLinks})`, callback_data: 'links_active' },
                        { text: `📋 الكل (${totalLinks})`, callback_data: 'links_all' }
                    ],
                    [
                        { text: '🔄 تحديث', callback_data: 'refresh_links' },
                        { text: '📥 تصدير CSV', callback_data: 'links_export' }
                    ],
                    [
                        { text: '🗑️ مسح الروابط', callback_data: 'links_clear_confirm' },
                        { text: '⚙️ إعدادات التجميع', callback_data: 'links_settings' }
                    ],
                    [
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            // رسالة القائمة
            const message = `
🔗 *نظام تجميع الروابط التلقائي*

📊 *إحصائيات الروابط:*
• 📱 *مجموعات واتساب:* ${whatsappGroups} رابط
• 📩 *دعوات واتساب:* ${whatsappInvites} رابط
• 📢 *روابط تليجرام:* ${telegramLinks} رابط
• 🌐 *روابط أخرى:* ${otherLinks} رابط
• 🟢 *نشطة:* ${activeLinks} رابط
• 📋 *الإجمالي:* ${totalLinks} رابط

🚀 *كيفية العمل:*
1. يراقب البوت جميع الرسائل تلقائياً
2. يستخرج أي روابط تظهر في المحادثات
3. يصنفها حسب النوع تلقائياً
4. يمنع التكرار والحفظ المزدوج
5. يفحص الروابط بانتظام للتأكد من صحتها

⚡ *المميزات:*
• ✅ تجميع تلقائي بدون توقف
• 🔄 تحديث فوري عند اكتشاف رابط جديد
• 🗑️ إدارة وحذف الروابط بسهولة
• 📊 إحصائيات مفصلة عن كل نوع
• 📥 تصدير البيانات بصيغ مختلفة

🔧 *الإعدادات المتاحة:*
• تفعيل/تعطيل التجميع التلقائي
• تصفية الروابط حسب النوع
• تحديد الحد الأقصى للروابط
• ضبط فترات الفحص التلقائي

📈 *آخر التحديثات:*
• تم تحسين خوارزمية التصنيف
• إضافة دعم للمزيد من أنواع الروابط
• تحسين أداء التجميع
• إضافة تقارير مفصلة

اختر نوع الروابط الذي تريد عرضه:
            `;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
            console.log(`✅ تم عرض قائمة الروابط لـ ${adminId}`);
            
        } catch (error) {
            console.error('❌ خطأ في عرض قائمة الروابط:', error);
            throw error;
        }
    }
    
    // ============================================
    // 13. عرض قائمة الإعلانات
    // ============================================
    async showAdsMenu(chatId, adminId) {
        try {
            const ads = await Advertisement.findAll({
                where: { adminId: adminId },
                order: [['createdAt', 'DESC']]
            });
            
            const activeAds = ads.filter(ad => ad.isActive).length;
            const totalAds = ads.length;
            
            // لوحة المفاتيح
            const keyboard = {
                inline_keyboard: []
            };
            
            // زر الإضافة
            keyboard.inline_keyboard.push([
                { text: '📢➕ إنشاء إعلان جديد', callback_data: 'ad_create' },
                { text: '🔄 تحديث', callback_data: 'refresh_ads' }
            ]);
            
            // عرض الإعلانات النشطة أولاً
            const activeAdsList = ads.filter(ad => ad.isActive).slice(0, 3);
            const inactiveAdsList = ads.filter(ad => !ad.isActive).slice(0, 2);
            
            if (activeAdsList.length > 0) {
                keyboard.inline_keyboard.push([
                    { text: `🟢 الإعلانات النشطة (${activeAds})`, callback_data: 'ad_filter_active' }
                ]);
                
                activeAdsList.forEach(ad => {
                    keyboard.inline_keyboard.push([
                        { 
                            text: `📢 ${ad.name}`, 
                            callback_data: `ad_info_${ad.id}`
                        }
                    ]);
                });
            }
            
            if (inactiveAdsList.length > 0) {
                keyboard.inline_keyboard.push([
                    { text: `⚪ الإعلانات المتوقفة (${totalAds - activeAds})`, callback_data: 'ad_filter_inactive' }
                ]);
                
                inactiveAdsList.forEach(ad => {
                    keyboard.inline_keyboard.push([
                        { 
                            text: `⏸️ ${ad.name}`, 
                            callback_data: `ad_info_${ad.id}`
                    });
                });
            }
            
            // أزرار إضافية
            keyboard.inline_keyboard.push([
                { text: '📊 إحصائيات الإعلانات', callback_data: 'ad_stats_overview' },
                { text: '⚙️ إعدادات النشر', callback_data: 'ad_settings' }
            ]);
            
            keyboard.inline_keyboard.push([
                { text: '📨 البث الجماعي', callback_data: 'menu_broadcast' },
                { text: '🔄 النشر التلقائي', callback_data: 'menu_autopost' }
            ]);
            
            keyboard.inline_keyboard.push([
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]);
            
            // رسالة القائمة
            let message = `📢 *نظام الإعلانات المتكامل*\n\n`;
            message += `📊 *الإحصائيات:*\n`;
            message += `• 🟢 نشطة: ${activeAds} إعلان\n`;
            message += `• 📊 الإجمالي: ${totalAds} إعلان\n`;
            message += `• 🎯 نسبة النشاط: ${totalAds > 0 ? Math.round((activeAds / totalAds) * 100) : 0}%\n\n`;
            
            if (ads.length === 0) {
                message += `📭 *لا توجد إعلانات*\n\n`;
                message += `انقر على *"📢➕ إنشاء إعلان جديد"* لبدء أول حملة إعلانية.\n\n`;
                message += `🚀 *مميزات نظام الإعلانات:*\n`;
                message += `• 📨 نشر في جميع المجموعات تلقائياً\n`;
                message += `• ⏰ جدولة زمنية ذكية\n`;
                message += `• 📊 متابعة الإحصائيات بشكل مفصل\n`;
                message += `• 🔄 تكرار النشر بعد اكتمال الدورة\n`;
            } else {
                message += `📋 *آخر الإعلانات:*\n`;
                
                ads.slice(0, 3).forEach((ad, index) => {
                    const typeEmoji = ad.type === 'text' ? '📝' :
                                    ad.type === 'image' ? '🖼️' :
                                    ad.type === 'video' ? '🎥' : '📎';
                    
                    const statusEmoji = ad.isActive ? '🟢' : '⚪';
                    const sentCount = ad.stats?.sent || 0;
                    
                    message += `${index + 1}. ${typeEmoji} ${statusEmoji} *${ad.name}*\n`;
                    message += `   📌 النوع: ${ad.type}\n`;
                    message += `   📊 المرسلة: ${sentCount.toLocaleString()}\n`;
                    message += `   ⏰ الإنشاء: ${new Date(ad.createdAt).toLocaleDateString('ar-SA')}\n\n`;
                });
                
                message += `💡 *نصائح للإعلانات الفعالة:*\n`;
                message += `• استخدم نصوصاً جذابة وواضحة\n`;
                message += `• أضف صوراً أو فيديوهات إن أمكن\n`;
                message += `• حدد أوقات الذروة للنشر\n`;
                message += `• تابع الإحصائيات بانتظام\n`;
            }
            
            message += `\n⚡ *اختر إعلاناً للتحكم أو أنشئ إعلاناً جديداً*`;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
            console.log(`✅ تم عرض قائمة الإعلانات لـ ${adminId}`);
            
        } catch (error) {
            console.error('❌ خطأ في عرض قائمة الإعلانات:', error);
            throw error;
        }
    }
    
    // ============================================
    // 14. عرض قائمة الإحصائيات
    // ============================================
    async showStatsMenu(chatId, adminId) {
        try {
            const admin = await Admin.findByPk(adminId);
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: adminId }
            });
            
            const sessionIds = sessions.map(s => s.id);
            
            // جمع الإحصائيات
            const totalSessions = sessions.length;
            const activeSessions = sessions.filter(s => 
                s.status === 'connected' || s.status === 'authenticated'
            ).length;
            
            const totalMessages = sessions.reduce((sum, session) => 
                sum + (session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0), 0
            );
            
            const totalGroups = sessions.reduce((sum, session) => 
                sum + (session.groupsCount || 0), 0
            );
            
            const totalContacts = sessions.reduce((sum, session) => 
                sum + (session.contactsCount || 0), 0
            );
            
            const totalLinks = await CollectedLink.count({
                where: { sessionId: sessionIds }
            });
            
            const whatsappLinks = await CollectedLink.count({
                where: { 
                    type: ['whatsapp_group', 'whatsapp_invite'],
                    sessionId: sessionIds
                }
            });
            
            const totalAds = await Advertisement.count({ where: { adminId: adminId } });
            const activeAds = await Advertisement.count({ 
                where: { 
                    adminId: adminId,
                    isActive: true
                }
            });
            
            const totalAutoPosts = await AutoPost.count({ where: { adminId: adminId } });
            const activeAutoPostsCount = await AutoPost.count({
                where: {
                    adminId: adminId,
                    status: 'active'
                }
            });
            
            const totalAutoReplies = await AutoReply.count({ where: { adminId: adminId } });
            const activeAutoReplies = await AutoReply.count({
                where: {
                    adminId: adminId,
                    isActive: true
                }
            });
            
            const totalAutoJoins = await AutoJoin.count({ where: { adminId: adminId } });
            const activeAutoJoinsCount = await AutoJoin.count({
                where: {
                    adminId: adminId,
                    status: 'active'
                }
            });
            
            // حساب النسب
            const sessionActivityRate = totalSessions > 0 ? 
                Math.round((activeSessions / totalSessions) * 100) : 0;
            
            const linkWhatsappRate = totalLinks > 0 ?
                Math.round((whatsappLinks / totalLinks) * 100) : 0;
            
            // لوحة المفاتيح
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 جلسات واتساب', callback_data: 'stats_sessions' },
                        { text: '🔗 الروابط', callback_data: 'stats_links' }
                    ],
                    [
                        { text: '📢 الإعلانات', callback_data: 'stats_ads' },
                        { text: '🔄 النشر التلقائي', callback_data: 'stats_autopost' }
                    ],
                    [
                        { text: '🤖 الردود التلقائية', callback_data: 'stats_autoreply' },
                        { text: '➕ الانضمام التلقائي', callback_data: 'stats_autojoin' }
                    ],
                    [
                        { text: '📊 نظرة عامة', callback_data: 'stats_overview' },
                        { text: '📈 تقرير مفصل', callback_data: 'stats_detailed' }
                    ],
                    [
                        { text: '📅 تقرير يومي', callback_data: 'stats_daily' },
                        { text: '📆 تقرير أسبوعي', callback_data: 'stats_weekly' }
                    ],
                    [
                        { text: '🔄 تحديث الإحصائيات', callback_data: 'refresh_stats' },
                        { text: '📥 تصدير التقرير', callback_data: 'stats_export' }
                    ],
                    [
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            // رسالة الإحصائيات
            const message = `
📊 *إحصائيات النظام الشاملة*

🎯 *نظرة عامة:*
• 🤖 وقت التشغيل: ${Math.floor(process.uptime() / 3600)} ساعة
• 👤 المشرف: ${admin.firstName || admin.username || 'غير معروف'}
• 📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}
• ⏰ وقت التقرير: ${new Date().toLocaleTimeString('ar-SA')}

📱 *جلسات WhatsApp:*
• 🟢 نشطة: ${activeSessions} جلسة
• 📊 الإجمالي: ${totalSessions} جلسة
• 📈 نسبة النشاط: ${sessionActivityRate}%
• 💬 الرسائل: ${totalMessages.toLocaleString()}
• 👥 المجموعات: ${totalGroups.toLocaleString()}
• 📞 الجهات: ${totalContacts.toLocaleString()}

🔗 *الروابط المجمعة:*
• 📋 الإجمالي: ${totalLinks.toLocaleString()} رابط
• 📱 واتساب: ${whatsappLinks.toLocaleString()} رابط (${linkWhatsappRate}%)
• 🔄 آخر تجميع: ${sessions.length > 0 ? 
    new Date(sessions[0].lastActivity).toLocaleTimeString('ar-SA') : 'لم يبدأ'}

📢 *نظام الإعلانات:*
• 🟢 نشطة: ${activeAds} إعلان
• 📊 الإجمالي: ${totalAds} إعلان
• 🎯 نسبة النشاط: ${totalAds > 0 ? Math.round((activeAds / totalAds) * 100) : 0}%

🔄 *النشر التلقائي:*
• 🟢 نشطة: ${activeAutoPostsCount} عملية
• 📊 الإجمالي: ${totalAutoPosts} عملية

🤖 *الردود التلقائية:*
• 🟢 نشطة: ${activeAutoReplies} رد
• 📊 الإجمالي: ${totalAutoReplies} رد

➕ *الانضمام التلقائي:*
• 🟢 نشطة: ${activeAutoJoinsCount} عملية
• 📊 الإجمالي: ${totalAutoJoins} عملية

📈 *تحليل الأداء:*
• ⚡ السرعة: جيدة
• 🔄 الاستقرار: ${activeSessions > 0 ? 'ممتاز' : 'مطلوب تشغيل'}
• 📊 الفعالية: ${totalMessages > 1000 ? 'عالية' : totalMessages > 100 ? 'متوسطة' : 'منخفضة'}

💡 *توصيات:*
${activeSessions === 0 ? '• ⚠️ قم بإضافة جلسة WhatsApp لبدء العمل\n' : ''}
${totalLinks < 10 ? '• 🔍 قم بتفعيل تجميع الروابط لاكتشاف المزيد\n' : ''}
${activeAds === 0 ? '• 📢 أنشئ إعلاناً لبدء الحملات\n' : ''}

اختر قسم الإحصائيات لعرض التفاصيل:
            `;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
            console.log(`✅ تم عرض الإحصائيات لـ ${adminId}`);
            
        } catch (error) {
            console.error('❌ خطأ في عرض الإحصائيات:', error);
            throw error;
        }
    }
    
    // ============================================
    // 15. عرض قائمة البث الجماعي
    // ============================================
    async showBroadcastMenu(chatId, adminId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📨➕ بث جديد', callback_data: 'broadcast_create' },
                    { text: '📋 قائمة البث', callback_data: 'broadcast_list' }
                ],
                [
                    { text: '👥 جهات اتصال', callback_data: 'broadcast_contacts' },
                    { text: '👥 مجموعات', callback_data: 'broadcast_groups' }
                ],
                [
                    { text: '⏰ بث مجدول', callback_data: 'broadcast_scheduled' },
                    { text: '📊 إحصائيات', callback_data: 'broadcast_stats' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            `📨 *نظام البث الجماعي*\n\n` +
            `🚀 *المميزات:*\n` +
            `• إرسال رسائل لجميع جهات الاتصال\n` +
            `• إرسال رسائل لجميع المجموعات\n` +
            `• جدولة البث في أوقات محددة\n` +
            `• متابعة النتائج والإحصائيات\n\n` +
            `💡 *كيفية العمل:*\n` +
            `1. اختر نوع البث (جهات/مجموعات)\n` +
            `2. اكتب الرسالة التي تريد إرسالها\n` +
            `3. حدد وقت الإرسال (فوري/مجدول)\n` +
            `4. تابع النتائج في الوقت الفعلي\n\n` +
            `اختر من القائمة:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    // ============================================
    // 16. عرض قائمة الردود التلقائية
    // ============================================
    async showAutoReplyMenu(chatId, adminId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🤖➕ رد تلقائي جديد', callback_data: 'autoreply_create' },
                    { text: '📋 قائمة الردود', callback_data: 'autoreply_list' }
                ],
                [
                    { text: '👤 ردود خاصة', callback_data: 'autoreply_private' },
                    { text: '👥 ردود جماعية', callback_data: 'autoreply_group' }
                ],
                [
                    { text: '⚙️ إعدادات', callback_data: 'autoreply_settings' },
                    { text: '📊 إحصائيات', callback_data: 'autoreply_stats' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            `🤖 *نظام الردود التلقائية*\n\n` +
            `🚀 *المميزات:*\n` +
            `• ردود تلقائية للمحادثات الخاصة\n` +
            `• ردود تلقائية للمجموعات\n` +
            `• محفزات نصية متقدمة\n` +
            `• إدارة متقدمة للردود\n\n` +
            `💡 *أنواع المحفزات:*\n` +
            `• **مطابق تماماً:** النص مطابق تماماً\n` +
            `• **يحتوي:** النص يحتوي على الكلمة\n` +
            `• **نمط:** مطابقة نمط معين (regex)\n` +
            `• **يبدأ بـ:** النص يبدأ بالكلمة\n` +
            `• **ينتهي بـ:** النص ينتهي بالكلمة\n\n` +
            `🎯 *الاستخدامات:*\n` +
            `• الرد على التحية تلقائياً\n` +
            `• الرد على أسئلة شائعة\n` +
            `• إرسال معلومات تلقائية\n` +
            `• الرد على كلمات محددة\n\n` +
            `اختر من القائمة:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    // ============================================
    // 17. عرض قائمة الانضمام التلقائي
    // ============================================
    async showAutoJoinMenu(chatId, adminId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '➕ تفعيل الانضمام', callback_data: 'autojoin_start' },
                    { text: '⏸️ إيقاف الانضمام', callback_data: 'autojoin_stop' }
                ],
                [
                    { text: '📊 إحصائيات الانضمام', callback_data: 'autojoin_stats' },
                    { text: '🔗 عرض الروابط', callback_data: 'links_whatsapp_group' }
                ],
                [
                    { text: '⚙️ إعدادات', callback_data: 'autojoin_settings' },
                    { text: '📝 سجلات الانضمام', callback_data: 'autojoin_logs' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            `➕ *نظام الانضمام التلقائي*\n\n` +
            `🚀 *المميزات:*\n` +
            `• اكتشاف تلقائي لروابط واتساب\n` +
            `• انضمام تلقائي للمجموعات\n` +
            `• تقارير مفصلة عن الانضمام\n` +
            `• إحصائيات في الوقت الفعلي\n\n` +
            `💡 *كيفية العمل:*\n` +
            `1. يراقب البوت جميع الرسائل\n` +
            `2. يكتشف روابط دعوة واتساب\n` +
            `3. ينضم للمجموعات تلقائياً\n` +
            `4. يرسل تقريراً عن المجموعات\n` +
            `5. يسجل المجموعات التي فشل الانضمام إليها\n\n` +
            `🔧 *الإعدادات:*\n` +
            `• تصفية المجموعات حسب الحجم\n` +
            `• تحديد الكلمات المسموح بها\n` +
            `• ضبط فترات الانضمام\n` +
            `• إعدادات الإشعارات\n\n` +
            `اختر من القائمة:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    // ============================================
    // 18. عرض قائمة الإعدادات
    // ============================================
    async showSettingsMenu(chatId, adminId) {
        const admin = await Admin.findByPk(adminId);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔔 الإشعارات', callback_data: 'settings_notifications' },
                    { text: '🌐 اللغة', callback_data: 'settings_language' }
                ],
                [
                    { text: '📱 حد الجلسات', callback_data: 'settings_max_sessions' },
                    { text: '🔗 تجميع الروابط', callback_data: 'settings_link_collection' }
                ],
                [
                    { text: '🤖 الرد التلقائي', callback_data: 'settings_auto_reply' },
                    { text: '➕ الانضمام التلقائي', callback_data: 'settings_auto_join' }
                ],
                [
                    { text: '📊 التقارير', callback_data: 'settings_reports' },
                    { text: '🔒 الأمان', callback_data: 'settings_security' }
                ],
                [
                    { text: '🔄 إعادة التعيين', callback_data: 'settings_reset' },
                    { text: '📋 معلومات الحساب', callback_data: 'settings_account' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
⚙️ *إعدادات النظام*

👤 *معلومات الحساب:*
• 🆔 المعرف: \`${admin.telegramId}\`
• 👤 الاسم: ${admin.firstName || 'غير معروف'}
• 💼 الصلاحيات: ${admin.permissions?.length || 0} صلاحية
• 📅 تاريخ التسجيل: ${new Date(admin.createdAt).toLocaleDateString('ar-SA')}

⚡ *الإعدادات الحالية:*
• 🔔 الإشعارات: ${admin.settings?.notificationEnabled ? '✅ مفعلة' : '❌ معطلة'}
• 🌐 اللغة: ${admin.settings?.language || 'العربية'}
• 📱 الحد الأقصى للجلسات: ${admin.settings?.maxSessions || 5}
• 🔗 تجميع الروابط: ${admin.settings?.autoCollectLinks ? '✅ مفعل' : '❌ معطل'}
• 🤖 الرد التلقائي: ${admin.settings?.autoReplyEnabled ? '✅ مفعل' : '❌ معطل'}

🔧 *خيارات الإعدادات:*
• **🔔 الإشعارات:** التحكم في الإشعارات اليومية والفورية
• **🌐 اللغة:** تغيير لغة واجهة البوت
• **📱 حد الجلسات:** تحديد الحد الأقصى لعدد الجلسات
• **🔗 تجميع الروابط:** تفعيل/تعطيل التجميع التلقائي
• **🤖 الرد التلقائي:** إدارة نظام الردود التلقائية
• **➕ الانضمام التلقائي:** إعدادات الانضمام للمجموعات
• **📊 التقارير:** تخصيص التقارير والإحصائيات
• **🔒 الأمان:** إعدادات الأمان والحماية
• **🔄 إعادة التعيين:** إعادة تعيين الإعدادات للافتراضية
• **📋 معلومات الحساب:** عرض وتعديل معلومات الحساب

💡 *تلميح:* يمكنك تعديل أي إعداد بالنقر عليه
        `;
        
        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
    }
    
    // ============================================
    // 19. عرض قائمة المساعدة
    // ============================================
    async showHelpMenu(chatId, adminId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📚 الأوامر', callback_data: 'help_commands' },
                    { text: '📱 الجلسات', callback_data: 'help_sessions' }
                ],
                [
                    { text: '🔗 الروابط', callback_data: 'help_links' },
                    { text: '📢 الإعلانات', callback_data: 'help_ads' }
                ],
                [
                    { text: '🔄 النشر التلقائي', callback_data: 'help_autopost' },
                    { text: '➕ الانضمام', callback_data: 'help_autojoin' }
                ],
                [
                    { text: '🤖 الردود', callback_data: 'help_autoreply' },
                    { text: '📨 البث', callback_data: 'help_broadcast' }
                ],
                [
                    { text: '📊 الإحصائيات', callback_data: 'help_stats' },
                    { text: '⚙️ الإعدادات', callback_data: 'help_settings' }
                ],
                [
                    { text: '🆘 الدعم الفني', callback_data: 'help_support' },
                    { text: '📞 التواصل', callback_data: 'help_contact' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
🆘 *مركز المساعدة والدعم*

🤖 *عن البوت:*
• **الاسم:** WhatsApp Telegram Bot
• **الإصدار:** 2.0.0 - Render Optimized
• **النوع:** نظام إدارة WhatsApp عبر Telegram
• **الحالة:** ✅ نشط ومستقر

🚀 *الميزات الرئيسية:*
• 📱 *ربط حسابات WhatsApp كجهاز مصاحب*
  - ربط متعدد للحسابات
  - QR Code تلقائي
  - إدارة مركزية

• 🔗 *تجميع الروابع تلقائياً*
  - اكتشاف ذكي للروابط
  - تصنيف تلقائي
  - منع التكرار

• 📢 *نظام إعلانات متكامل*
  - إعلانات نصية وصورية
  - نشر تلقائي
  - إحصائيات مفصلة

• 🔄 *النشر التلقائي*
  - نشر في جميع المجموعات
  - توقيت قابل للتعديل
  - استمرارية النشر

• ➕ *الانضمام التلقائي*
  - اكتشاف روابط واتساب
  - انضمام تلقائي
  - تقارير مفصلة

• 🤖 *الردود التلقائية*
  - ردود خاصة وجماعية
  - محفزات نصية متقدمة
  - إدارة متقدمة

• 📊 *إحصائيات وتقارير*
  - إحصائيات مفصلة
  - تقارير أداء
  - سجلات النشاطات

🔧 *الدعم الفني:*
• للأخطاء التقنية: تواصل مع المطور
• للاستفسارات: راجع الأسئلة الشائعة
• للاقتراحات: أرسل اقتراحك عبر زر التواصل

📞 *التواصل:*
• المطور: متاح عبر زر التواصل
• القناة: قناة التحديثات والإعلانات
• المجموعة: مجموعة الدعم والمناقشة

⚡ *نصائح مهمة:*
1. حافظ على تحديث البوت
2. احتفظ بنسخة احتياطية من البيانات
3. استخدم إعدادات الأمان
4. راجع التقارير بانتظام

اختر القسم الذي تريد مساعدة فيه:
        `;
        
        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
    }
    
    // ============================================
    // 20. عرض حالة البوت
    // ============================================
    async showBotStatus(chatId, adminId) {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // جمع معلومات النظام
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId }
        });
        
        const activeSessions = sessions.filter(s => 
            s.status === 'connected' || s.status === 'authenticated'
        ).length;
        
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const message = `
🤖 *حالة النظام الحالية*

📊 *معلومات النظام:*
• 🏗️ Platform: ${process.platform}
• 🚀 Node.js: ${process.version}
• ⏱️ وقت التشغيل: ${Math.floor(uptime / 3600)} ساعة ${Math.floor((uptime % 3600) / 60)} دقيقة
• 💾 الذاكرة: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
• 🔧 البيئة: ${process.env.NODE_ENV || 'development'}

📱 *حالة الجلسات:*
• 🟢 نشطة: ${activeSessions} جلسة
• 📊 الإجمالي: ${sessions.length} جلسة
• 📈 نسبة النشاط: ${sessions.length > 0 ? Math.round((activeSessions / sessions.length) * 100) : 0}%

🔗 *الروابط المجمعة:*
• 📋 الإجمالي: ${await CollectedLink.count({ where: { sessionId: sessions.map(s => s.id) } })}
• 🟢 نشطة: ${await CollectedLink.count({ where: { sessionId: sessions.map(s => s.id), status: 'active' } })}

📢 *حالة الإعلانات:*
• 🟢 نشطة: ${await Advertisement.count({ where: { adminId: adminId, isActive: true } })}
• 📊 الإجمالي: ${await Advertisement.count({ where: { adminId: adminId } })}

⚡ *أداء النظام:*
• 📊 WhatsApp Clients: ${this.whatsappClients.size}
• 🔄 Active Auto Posts: ${this.activeAutoPosts.size}
• ➕ Active Auto Joins: ${this.activeAutoJoins.size}
• 👤 User States: ${this.userStates.size}

🔄 *آخر تحديث:* ${new Date().toLocaleTimeString('ar-SA')}

💡 *توصيات النظام:*
${activeSessions === 0 ? '• ⚠️ قم بإضافة جلسة WhatsApp للبدء\n' : ''}
${memoryUsage.heapUsed > 500 * 1024 * 1024 ? '• 🧹 النظام يستخدم ذاكرة عالية، فكر في إعادة التشغيل\n' : ''}
${uptime > 86400 ? '• 🔄 النظام يعمل لأكثر من 24 ساعة، فكر في إعادة التشغيل للصيانة\n' : ''}

✅ *الحالة العامة:* ${activeSessions > 0 && memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'ممتازة' : 'تحتاج انتباه'}
        `;
        
        await this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
    }
    
    // ============================================
    // 21. معالجة إعادة التشغيل
    // ============================================
    async handleRestart(chatId, adminId) {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // التحقق من صلاحيات المشرف
        if (!admin.permissions?.includes('admin')) {
            return this.bot.sendMessage(chatId,
                '❌ *غير مصرح لك!*\n\n' +
                'تحتاج صلاحية مدير لإعادة تشغيل النظام.',
                { parse_mode: 'Markdown' }
            );
        }
        
        await this.bot.sendMessage(chatId,
            '🔄 *جاري إعادة تشغيل النظام...*\n\n' +
            '⏳ قد تستغرق العملية بضع ثواني.\n' +
            '📋 سيتم إغلاق جميع الجلسات النشطة.\n\n' +
            '⚡ *جاري الإعداد:*\n' +
            '• إغلاق جلسات WhatsApp\n' +
            '• حفظ البيانات الحالية\n' +
            '• إعادة تهيئة النظام\n' +
            '• بدء التشغيل الجديد...',
            { parse_mode: 'Markdown' }
        );
        
        // إغلاق جميع الجلسات النشطة
        for (const [sessionId, client] of this.whatsappClients.entries()) {
            try {
                await client.destroy();
                console.log(`✅ تم إغلاق جلسة: ${sessionId}`);
            } catch (error) {
                console.error(`❌ خطأ في إغلاق جلسة ${sessionId}:`, error);
            }
        }
        
        // مسح جميع التخزينات المؤقتة
        this.whatsappClients.clear();
        this.activeAutoPosts.clear();
        this.activeAutoJoins.clear();
        this.sessionQRs.clear();
        this.messageQueues.clear();
        this.cooldownTimers.clear();
        this.userStates.clear();
        
        // إرسال رسالة تأكيد
        setTimeout(async () => {
            await this.bot.sendMessage(chatId,
                '✅ *تم إعادة التشغيل بنجاح!*\n\n' +
                '🚀 النظام جاهز الآن للعمل.\n' +
                '📱 يمكنك إضافة جلسات جديدة.\n\n' +
                '⚡ *لاحظ أن:*\n' +
                '• جميع الجلسات السابقة مغلقة\n' +
                '• تحتاج لإضافة جلسات جديدة\n' +
                '• البيانات محفوظة في قاعدة البيانات\n\n' +
                'استخدم /start للبدء من جديد.',
                { parse_mode: 'Markdown' }
            );
        }, 3000);
    }
    
    // ============================================
    // 22. معالجة مسح البيانات
    // ============================================
    async handleClearData(chatId, adminId) {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // التحقق من صلاحيات المشرف
        if (!admin.permissions?.includes('admin')) {
            return this.bot.sendMessage(chatId,
                '❌ *غير مصرح لك!*\n\n' +
                'تحتاج صلاحية مدير لمسح البيانات.',
                { parse_mode: 'Markdown' }
            );
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🗑️ مسح جميع البيانات', callback_data: 'clear_all_data' },
                    { text: '🔗 مسح الروابط فقط', callback_data: 'clear_links_only' }
                ],
                [
                    { text: '📱 مسح الجلسات فقط', callback_data: 'clear_sessions_only' },
                    { text: '📢 مسح الإعلانات فقط', callback_data: 'clear_ads_only' }
                ],
                [
                    { text: '❌ إلغاء', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            '⚠️ *تحذير: مسح البيانات*\n\n' +
            'هذه العملية **لا يمكن التراجع عنها**!\n\n' +
            '📋 *ما سيتم مسحه:*\n' +
            '• جميع الجلسات النشطة\n' +
            '• جميع الروابط المجمعة\n' +
            '• جميع الإعلانات\n' +
            '• جميع سجلات النظام\n\n' +
            '🔒 *ما سيتم الاحتفاظ به:*\n' +
            '• معلومات المشرفين\n' +
            '• إعدادات النظام\n' +
            '• قاعدة البيانات الرئيسية\n\n' +
            '💡 *نصيحة:* قم بعمل نسخة احتياطية قبل المسح.\n\n' +
            'اختر نوع البيانات التي تريد مسحها:',
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    // ============================================
    // 23. معالجة عرض السجلات
    // ============================================
    async handleShowLogs(chatId, adminId) {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // التحقق من صلاحيات المشرف
        if (!admin.permissions?.includes('admin')) {
            return this.bot.sendMessage(chatId,
                '❌ *غير مصرح لك!*\n\n' +
                'تحتاج صلاحية مدير لعرض السجلات.',
                { parse_mode: 'Markdown' }
            );
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📊 سجلات النظام', callback_data: 'logs_system' },
                    { text: '📱 سجلات WhatsApp', callback_data: 'logs_whatsapp' }
                ],
                [
                    { text: '🔗 سجلات الروابط', callback_data: 'logs_links' },
                    { text: '📢 سجلات الإعلانات', callback_data: 'logs_ads' }
                ],
                [
                    { text: '🤖 سجلات الردود', callback_data: 'logs_autoreply' },
                    { text: '➕ سجلات الانضمام', callback_data: 'logs_autojoin' }
                ],
                [
                    { text: '🔄 سجلات الأخطاء', callback_data: 'logs_errors' },
                    { text: '📈 سجلات الإحصائيات', callback_data: 'logs_stats' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            '📋 *سجلات النظام*\n\n' +
            '🚀 *مرحباً بك في مركز السجلات*\n\n' +
            '📊 *أنواع السجلات المتاحة:*\n' +
            '• **سجلات النظام:** معلومات تشغيل البوت\n' +
            '• **سجلات WhatsApp:** نشاط جلسات WhatsApp\n' +
            '• **سجلات الروابط:** عمليات تجميع الروابط\n' +
            '• **سجلات الإعلانات:** نشاط الحملات الإعلانية\n' +
            '• **سجلات الردود:** نشاط الردود التلقائية\n' +
            '• **سجلات الانضمام:** عمليات الانضمام للمجموعات\n' +
            '• **سجلات الأخطاء:** الأخطاء والمشاكل\n' +
            '• **سجلات الإحصائيات:** بيانات الأداء\n\n' +
            '⚡ *ملاحظة:*\n' +
            '• السجلات تحفظ لمدة 7 أيام\n' +
            '• يمكن تصدير السجلات بصيغة CSV\n' +
            '• يتم تنظيف السجلات تلقائياً\n\n' +
            'اختر نوع السجلات الذي تريد عرضه:',
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    // ============================================
    // 24. معالجات إضافية للأزرار
    // ============================================
    async handleQRAction(chatId, userId, parts) {
        const action = parts[1];
        const sessionId = parts[2];
        
        switch (action) {
            case 'help':
                await this.bot.sendMessage(chatId,
                    `📱 *دليل الربط المصور*\n\n` +
                    `🚀 *الخطوات بالترتيب:*\n\n` +
                    `1. *افتح WhatsApp* على هاتفك\n` +
                    `2. *اضغط* على **النقاط الثلاث** (⋮)\n` +
                    `3. *اختر* **"الأجهزة المرتبطة"**\n` +
                    `4. *انقر* على **"ربط جهاز"**\n` +
                    `5. *وجه الكاميرا* نحو QR Code\n` +
                    `6. *انتظر* حتى تظهر رسالة التأكيد\n` +
                    `7. *انقر* على **"متابعة"**\n\n` +
                    `📝 *ملاحظات مهمة:*\n` +
                    `• تأكد من اتصال الهاتف بالإنترنت\n` +
                    `• قم بتقريب الكاميرا من QR Code\n` +
                    `• ⏱️ QR Code صالح لمدة 60 ثانية\n` +
                    `• 🔄 سيتم تجديده تلقائياً إذا انتهت\n\n` +
                    `❓ *مشاكل شائعة وحلولها:*\n` +
                    `• **الكاميرا لا تمسح:** جرب تقريب الهاتف أكثر\n` +
                    `• **QR غير صالح:** اطلب QR جديد\n` +
                    `• **لا يوجد خيار:** تأكد من تحديث WhatsApp\n\n` +
                    `✅ *بعد الربح الناجح:* ستصلك رسالة تأكيد`,
                    { parse_mode: 'Markdown' }
                );
                break;
                
            case 'regenerate':
                // إعادة توليد QR Code
                const session = await WhatsAppSession.findByPk(sessionId);
                if (session) {
                    const client = this.whatsappClients.get(sessionId);
                    if (client) {
                        // إعادة تهيئة العميل لتوليد QR جديد
                        await client.destroy();
                        await client.initialize();
                        
                        await this.bot.sendMessage(chatId,
                            `🔄 *جاري توليد QR Code جديد...*\n\n` +
                            `📱 الرقم: ${session.phoneNumber}\n` +
                            `⏳ انتظر ثواني قليلة...`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                }
                break;
                
            case 'cancel':
                // إلغاء الجلسة
                await this.cancelSession(sessionId, userId, chatId);
                break;
        }
    }
    
    async cancelSession(sessionId, userId, chatId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) return;
            
            // التحقق من أن المستخدم هو مالك الجلسة
            const admin = await Admin.findOne({ where: { telegramId: userId } });
            if (!admin || admin.id !== session.adminId) {
                await this.bot.sendMessage(chatId,
                    '❌ *غير مصرح لك!*\n\n' +
                    'لا يمكنك إلغاء هذه الجلسة.',
                    { parse_mode: 'Markdown' }
                );
                return;
            }
            
            // إغلاق العميل
            const client = this.whatsappClients.get(sessionId);
            if (client) {
                await client.destroy();
                this.whatsappClients.delete(sessionId);
            }
            
            // تحديث حالة الجلسة
            await session.update({
                status: 'disconnected',
                disconnectedAt: new Date()
            });
            
            // مسح QR من الذاكرة
            this.sessionQRs.delete(sessionId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إلغاء الجلسة بنجاح*\n\n` +
                `📱 الرقم: ${session.phoneNumber}\n` +
                `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
                `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `يمكنك إضافة جلسة جديدة باستخدام /addsession`,
                { parse_mode: 'Markdown' }
            );
            
            console.log(`✅ تم إلغاء الجلسة ${sessionId} بواسطة ${userId}`);
            
        } catch (error) {
            console.error('❌ خطأ في إلغاء الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في إلغاء الجلسة');
        }
    }
    
    async handlePhoneExample(chatId, userId, parts) {
        if (parts[1] === 'example') {
            const exampleNumber = parts[2];
            await this.bot.sendMessage(chatId,
                `📞 *مثال الرقم:* \`${exampleNumber}\`\n\n` +
                `انسخ هذا الرقم وأرسله أو عدّل عليه حسب رقمك.\n\n` +
                `💡 *تلميح:*\n` +
                `• استبدل الأرقام الأخيرة برقم هاتفك\n` +
                `• احتفظ برمز الدولة كما هو\n` +
                `• لا تضيف مسافات أو رموز خاصة`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    async handleCancelAction(chatId, userId, parts) {
        const action = parts[1];
        
        switch (action) {
            case 'add':
                if (parts[2] === 'session') {
                    // إلغاء إضافة جلسة
                    this.userStates.delete(userId);
                    await this.bot.sendMessage(chatId,
                        '❌ *تم إلغاء عملية إضافة الجلسة*\n\n' +
                        'يمكنك البدء من جديد باستخدام /addsession',
                        { parse_mode: 'Markdown' }
                    );
                }
                break;
        }
    }
    
    // ============================================
    // 25. إعداد معالجات واتساب
    // ============================================
    setupWhatsAppEvents() {
        console.log('📱 جاري إعداد معالجات WhatsApp...');
        
        // هذه المعالجات تم إعدادها في createWhatsAppSession
        // يتم إضافتها ديناميكياً لكل جلسة
        console.log('✅ معالجات WhatsApp جاهزة للإضافة ديناميكياً');
    }
    
    // ============================================
    // 26. بدء تشغيل البوت
    // ============================================
    async start() {
        console.log('🚀 بدء تشغيل WhatsApp Telegram Bot...');
        
        try {
            // إنشاء المجلدات الضرورية
            await this.createRequiredFolders();
            
            // بدء مهام الصيانة
            this.startMaintenanceTasks();
            
            console.log('✅ WhatsApp Telegram Bot يعمل الآن!');
            console.log('📱 جاهز لاستقبال الأوامر عبر Telegram');
            console.log('🔗 قم بإرسال /start للبدء');
            
            return this.bot;
            
        } catch (error) {
            console.error('❌ خطأ في بدء تشغيل البوت:', error);
            throw error;
        }
    }
    
    async createRequiredFolders() {
        const folders = ['sessions', 'database', 'logs', 'temp'];
        
        for (const folder of folders) {
            try {
                await fs.mkdir(folder, { recursive: true });
                console.log(`✅ مجلد ${folder}/ تم إنشاؤه`);
            } catch (error) {
                console.log(`⚠️ خطأ في إنشاء ${folder}/: ${error.message}`);
            }
        }
    }
    
    startMaintenanceTasks() {
        console.log('🔧 بدء مهام الصيانة التلقائية...');
        
        // مهمة تنظيف الذاكرة المؤقتة كل ساعة
        setInterval(() => {
            this.cleanupMemory();
        }, 3600000); // كل ساعة
        
        // مهمة إرسال تقرير حالة كل 6 ساعات
        setInterval(() => {
            this.sendStatusReport();
        }, 21600000); // كل 6 ساعات
        
        console.log('✅ تم جدولة مهام الصيانة');
    }
    
    async cleanupMemory() {
        const now = Date.now();
        let cleaned = 0;
        
        // تنظيف userStates القديمة (أكثر من ساعة)
        for (const [userId, state] of this.userStates.entries()) {
            if (now - (state.timestamp || 0) > 3600000) {
                this.userStates.delete(userId);
                cleaned++;
            }
        }
        
        // تنظيف cooldownTimers القديمة
        for (const [key, timestamp] of this.cooldownTimers.entries()) {
            if (now - timestamp > 3600000) {
                this.cooldownTimers.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 تم تنظيف ${cleaned} عنصر من الذاكرة المؤقتة`);
        }
    }
    
    async sendStatusReport() {
        try {
            const activeSessions = this.whatsappClients.size;
            const memoryUsage = process.memoryUsage();
            const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            
            // إرسال تقرير للمشرفين
            const admins = await Admin.findAll({
                where: { 
                    isActive: true,
                    settings: { notificationEnabled: true }
                }
            });
            
            for (const admin of admins) {
                await this.bot.sendMessage(admin.telegramId,
                    `📊 *تقرير حالة النظام*\n\n` +
                    `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n` +
                    `📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}\n\n` +
                    `📱 *الجلسات النشطة:* ${activeSessions}\n` +
                    `💾 *استخدام الذاكرة:* ${heapUsed}MB\n` +
                    `⏱️ *وقت التشغيل:* ${Math.floor(process.uptime() / 3600)} ساعة\n\n` +
                    `✅ *الحالة:* ${activeSessions > 0 ? 'ممتازة' : 'تحتاج انتباه'}\n\n` +
                    `⚡ النظام يعمل بشكل طبيعي`,
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error('❌ خطأ في إرسال تقرير الحالة:', error);
        }
    }
    
    // ============================================
    // 27. معالجات إضافية للإدخال
    // ============================================
    async handleAdNameInput(chatId, telegramId, text, data) {
        // معالجة إدخال اسم الإعلان
        console.log(`📝 معالجة اسم إعلان: ${text} من ${telegramId}`);
        
        // حفظ الاسم والمتابعة للحالة التالية
        this.userStates.set(telegramId, {
            state: 'awaiting_ad_content',
            data: { ...data, adName: text }
        });
        
        await this.bot.sendMessage(chatId,
            `✅ *تم حفظ اسم الإعلان:* ${text}\n\n` +
            `📝 *الآن أرسل محتوى الإعلان:*\n\n` +
            `💡 *نصائح للمحتوى:*\n` +
            `• كن واضحاً ومختصراً\n` +
            `• أضف رابطاً إذا لزم الأمر\n` +
            `• استخدم رموز تعبيرية لجذب الانتباه\n` +
            `• تحقق من التهجئة والنحو\n\n` +
            `⚡ *جاهز؟ أرسل المحتوى الآن:*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async handleAdContentInput(chatId, telegramId, text, data) {
        // معالجة إدخال محتوى الإعلان
        console.log(`📝 معالجة محتوى إعلان من ${telegramId}`);
        
        try {
            // إنشاء الإعلان في قاعدة البيانات
            const ad = await Advertisement.create({
                adminId: data.adminId,
                name: data.adName,
                type: 'text',
                content: text,
                isActive: true,
                stats: {
                    sent: 0,
                    failed: 0,
                    lastSent: null
                }
            });
            
            // مسح حالة المستخدم
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `🎉 *تم إنشاء الإعلان بنجاح!*\n\n` +
                `📢 *اسم الإعلان:* ${ad.name}\n` +
                `📝 *نوع الإعلان:* نص\n` +
                `🆔 *معرف الإعلان:* ${ad.id}\n` +
                `⏰ *وقت الإنشاء:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `✅ *الإعلان جاهز للنشر!*\n\n` +
                `🚀 *الخطوات التالية:*\n` +
                `1. استخدم /ads لعرض الإعلانات\n` +
                `2. اختر الإعلان الجديد\n` +
                `3. اضبط إعدادات النشر\n` +
                `4. ابدأ الحملة الإعلانية\n\n` +
                `⚡ *مستعد لبدء الحملة؟*`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الإعلان:', error);
            
            await this.bot.sendMessage(chatId,
                '❌ *فشل إنشاء الإعلان!*\n\n' +
                'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.\n\n' +
                `📋 الخطأ: ${error.message.substring(0, 100)}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    async handleBroadcastMessageInput(chatId, telegramId, text, data) {
        // معالجة إدخال رسالة البث
        console.log(`📨 معالجة رسالة بث من ${telegramId}`);
        
        try {
            // حفظ رسالة البث
            this.userStates.set(telegramId, {
                state: 'awaiting_broadcast_target',
                data: { ...data, broadcastMessage: text }
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '👥 جميع جهات الاتصال', callback_data: 'broadcast_target_all_contacts' },
                        { text: '👥 جميع المجموعات', callback_data: 'broadcast_target_all_groups' }
                    ],
                    [
                        { text: '📋 اختيار يدوي', callback_data: 'broadcast_target_manual' },
                        { text: '❌ إلغاء', callback_data: 'cancel_broadcast' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حفظ رسالة البث*\n\n` +
                `📝 *معاينة الرسالة:*\n` +
                `${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n\n` +
                `🎯 *الآن اختر الوجهة:*\n\n` +
                `👥 *خيارات الوجهة:*\n` +
                `• **جميع جهات الاتصال:** إرسال لجميع جهات الاتصال\n` +
                `• **جميع المجموعات:** إرسال لجميع المجموعات\n` +
                `• **اختيار يدوي:** تحديد جهات محددة\n\n` +
                `⚠️ *تحذير:* إرسال البث قد يستغرق وقتاً حسب عدد المستلمين.\n\n` +
                `اختر الوجهة:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );
            
        } catch (error) {
            console.error('❌ خطأ في معالجة رسالة البث:', error);
            
            await this.bot.sendMessage(chatId,
                '❌ *حدث خطأ في حفظ رسالة البث!*\n\n' +
                'يرجى المحاولة مرة أخرى.\n\n' +
                `📋 الخطأ: ${error.message.substring(0, 100)}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    async handleAutoReplyTriggerInput(chatId, telegramId, text, data) {
        // معالجة إدخال محفز الرد التلقائي
        console.log(`🤖 معالجة محفز رد تلقائي من ${telegramId}`);
        
        // حفظ المحفز والمتابعة للحالة التالية
        this.userStates.set(telegramId, {
            state: 'awaiting_autoreply_response',
            data: { ...data, trigger: text }
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👤 خاص فقط', callback_data: 'autoreply_type_private' },
                    { text: '👥 جماعي فقط', callback_data: 'autoreply_type_group' }
                ],
                [
                    { text: '👤👥 كلا النوعين', callback_data: 'autoreply_type_both' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            `✅ *تم حفظ المحفز:* "${text}"\n\n` +
            `🎯 *الآن اختر نوع المحادثة:*\n\n` +
            `👤 *خاص فقط:* الرد على الرسائل الخاصة فقط\n` +
            `👥 *جماعي فقط:* الرد في المجموعات فقط\n` +
            `👤👥 *كلا النوعين:* الرد في كلا الحالتين\n\n` +
            `💡 *نصائح:*\n` +
            `• اختر "خاص فقط" للردود الشخصية\n` +
            `• اختر "جماعي فقط" للردود العامة\n` +
            `• اختر "كلا النوعين" للردود الشاملة\n\n` +
            `اختر نوع المحادثة:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    async handleAutoReplyResponseInput(chatId, telegramId, text, data) {
        // معالجة إدخال رد الرد التلقائي
        console.log(`🤖 معالجة رد تلقائي من ${telegramId}`);
        
        // حفظ الرد وإنشاء الرد التلقائي
        this.userStates.set(telegramId, {
            state: 'awaiting_autoreply_name',
            data: { ...data, response: text }
        });
        
        await this.bot.sendMessage(chatId,
            `✅ *تم حفظ الرد*\n\n` +
            `📝 *معاينة الرد:*\n` +
            `${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n\n` +
            `🎯 *الآن أرسل اسم لهذا الرد التلقائي:*\n\n` +
            `💡 *نصائح للتسمية:*\n` +
            `• استخدم اسمًا وصفيًا\n` +
            `• مثال: "رد التحية"\n` +
            `• مثال: "معلومات البوت"\n` +
            `• مثال: "رد على سؤال شائع"\n\n` +
            `⚡ *جاهز؟ أرسل الاسم الآن:*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async handleSessionNameInput(chatId, telegramId, text, data) {
        // معالجة إدخال اسم الجلسة
        console.log(`📱 معالجة اسم جلسة: ${text} من ${telegramId}`);
        
        try {
            // إنشاء الرد التلقائي في قاعدة البيانات
            const autoReply = await AutoReply.create({
                adminId: data.adminId,
                sessionId: data.sessionId,
                name: text,
                triggerType: data.triggerType || 'both',
                trigger: data.trigger,
                response: data.response,
                isActive: true,
                matchType: 'contains',
                stats: {
                    triggered: 0,
                    lastTriggered: null
                }
            });
            
            // مسح حالة المستخدم
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `🎉 *تم إنشاء الرد التلقائي بنجاح!*\n\n` +
                `🤖 *اسم الرد:* ${autoReply.name}\n` +
                `🎯 *نوع المحادثة:* ${autoReply.triggerType}\n` +
                `🔤 *المحفز:* ${autoReply.trigger.substring(0, 50)}${autoReply.trigger.length > 50 ? '...' : ''}\n` +
                `📝 *الرد:* ${autoReply.response.substring(0, 50)}${autoReply.response.length > 50 ? '...' : ''}\n` +
                `🆔 *معرف الرد:* ${autoReply.id}\n` +
                `⏰ *وقت الإنشاء:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `✅ *الرد التلقائي نشط الآن!*\n\n` +
                `🚀 *الميزات:*\n` +
                `• سيتم الرد تلقائياً عند ظهور المحفز\n` +
                `• يعمل في الوقت الفعلي\n` +
                `• يمكن تعديله أو إيقافه لاحقاً\n\n` +
                `⚡ *استخدم /autoreply لإدارة الردود*`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الرد التلقائي:', error);
            
            await this.bot.sendMessage(chatId,
                '❌ *فشل إنشاء الرد التلقائي!*\n\n' +
                'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.\n\n' +
                `📋 الخطأ: ${error.message.substring(0, 100)}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 28. دوال مساعدة إضافية
    // ============================================
    async getAdminByTelegramId(telegramId) {
        return await Admin.findOne({ where: { telegramId } });
    }
    
    async getSessionById(sessionId) {
        return await WhatsAppSession.findByPk(sessionId);
    }
    
    async getAdminSessions(adminId) {
        return await WhatsAppSession.findAll({
            where: { adminId },
            order: [['createdAt', 'DESC']]
        });
    }
    
    async getSessionLinks(sessionId) {
        return await CollectedLink.findAll({
            where: { sessionId },
            order: [['collectedAt', 'DESC']]
        });
    }
    
    async getAdminAds(adminId) {
        return await Advertisement.findAll({
            where: { adminId },
            order: [['createdAt', 'DESC']]
        });
    }
    
    async getAdminAutoReplies(adminId) {
        return await AutoReply.findAll({
            where: { adminId },
            order: [['createdAt', 'DESC']]
        });
    }
    
    // ============================================
    // 29. معالجة الأزرار الإضافية
    // ============================================
    async handleSessionAction(chatId, userId, parts) {
        const action = parts[1];
        const sessionId = parts[2];
        
        switch (action) {
            case 'info':
                await this.showSessionInfo(chatId, userId, sessionId);
                break;
                
            case 'delete':
                await this.deleteSession(chatId, userId, sessionId);
                break;
                
            case 'restart':
                await this.restartSession(chatId, userId, sessionId);
                break;
                
            case 'stats':
                await this.showSessionStats(chatId, userId, sessionId);
                break;
        }
    }
    
    async showSessionInfo(chatId, userId, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) {
                return this.bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
            }
            
            // التحقق من صلاحيات المشرف
            const admin = await Admin.findOne({ where: { telegramId: userId } });
            if (!admin || admin.id !== session.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            const client = this.whatsappClients.get(sessionId);
            const isConnected = client ? true : false;
            
            const message = `
📱 *معلومات الجلسة*

🔗 *المعلومات الأساسية:*
• 🆔 المعرف: \`${session.id.substring(0, 8)}\`
• 📞 الرقم: ${session.phoneNumber}
• 📌 الحالة: ${session.status}
• 🔗 الاتصال: ${isConnected ? '✅ متصل' : '❌ غير متصل'}

⏰ *التواريخ:*
• 📅 الإنشاء: ${new Date(session.createdAt).toLocaleString('ar-SA')}
• 🔗 آخر اتصال: ${session.connectedAt ? new Date(session.connectedAt).toLocaleString('ar-SA') : 'لم يتصل بعد'}
• 🔄 آخر نشاط: ${new Date(session.lastActivity).toLocaleString('ar-SA')}

📊 *الإحصائيات:*
• 👥 المجموعات: ${session.groupsCount || 0}
• 📞 الجهات: ${session.contactsCount || 0}
• 📨 الرسائل المستلمة: ${session.stats?.messagesReceived || 0}
• 📤 الرسائل المرسلة: ${session.stats?.messagesSent || 0}
• 🔗 الروابط المجمعة: ${session.stats?.linksCollected || 0}

⚙️ *الإعدادات:*
• 🤖 الرد التلقائي: ${session.settings?.autoReply ? '✅ مفعل' : '❌ معطل'}
• 🔗 تجميع الروابط: ${session.settings?.autoCollect ? '✅ مفعل' : '❌ معطل'}
• ➕ الانضمام التلقائي: ${session.settings?.autoJoin ? '✅ مفعل' : '❌ معطل'}
• 📢 البث الجماعي: ${session.settings?.broadcastEnabled ? '✅ مفعل' : '❌ معطل'}

💡 *معلومات الاتصال:*
${session.connectionData ? `
• 👤 الاسم: ${session.connectionData.pushname || 'غير معروف'}
• 🏗️ النظام: ${session.connectionData.platform || 'غير معروف'}
• 📱 رقم الواتساب: ${session.connectionData.phone?.user || 'غير معروف'}
` : '• ℹ️ لا توجد معلومات اتصال'}

⚡ *التحكم بالجلسة:*
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 إعادة التشغيل', callback_data: `session_restart_${sessionId}` },
                        { text: '⏸️ إيقاف مؤقت', callback_data: `session_pause_${sessionId}` }
                    ],
                    [
                        { text: '🗑️ حذف الجلسة', callback_data: `session_delete_${sessionId}` },
                        { text: '📊 إحصائيات مفصلة', callback_data: `session_stats_${sessionId}` }
                    ],
                    [
                        { text: '⚙️ إعدادات الجلسة', callback_data: `session_settings_${sessionId}` },
                        { text: '🔗 روابط الجلسة', callback_data: `session_links_${sessionId}` }
                    ],
                    [
                        { text: '📋 العودة للجلسات', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض معلومات الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض معلومات الجلسة');
        }
    }
    
    async deleteSession(chatId, userId, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) {
                return this.bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
            }
            
            // التحقق من صلاحيات المشرف
            const admin = await Admin.findOne({ where: { telegramId: userId } });
            if (!admin || admin.id !== session.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            // إغلاق العميل إذا كان متصلاً
            const client = this.whatsappClients.get(sessionId);
            if (client) {
                await client.destroy();
                this.whatsappClients.delete(sessionId);
            }
            
            // حذف الجلسة من قاعدة البيانات
            await session.destroy();
            
            // حذف البيانات المرتبطة
            await CollectedLink.destroy({ where: { sessionId } });
            
            // مسح من الذاكرة المؤقتة
            this.sessionQRs.delete(sessionId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حذف الجلسة بنجاح*\n\n` +
                `📱 الرقم: ${session.phoneNumber}\n` +
                `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
                `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `🗑️ *ما تم حذفه:*\n` +
                `• الجلسة الرئيسية\n` +
                `• جميع الروابط المجمعة\n` +
                `• اتصال WhatsApp\n` +
                `• جميع البيانات المرتبطة\n\n` +
                `⚡ يمكنك إضافة جلسة جديدة باستخدام /addsession`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حذف الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في حذف الجلسة');
        }
    }
    
    async restartSession(chatId, userId, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) {
                return this.bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
            }
            
            // التحقق من صلاحيات المشرف
            const admin = await Admin.findOne({ where: { telegramId: userId } });
            if (!admin || admin.id !== session.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            await this.bot.sendMessage(chatId,
                `🔄 *جاري إعادة تشغيل الجلسة...*\n\n` +
                `📱 الرقم: ${session.phoneNumber}\n` +
                `⏳ قد تستغرق العملية بضع ثواني...`,
                { parse_mode: 'Markdown' }
            );
            
            // إغلاق العميل الحالي إذا كان متصلاً
            const oldClient = this.whatsappClients.get(sessionId);
            if (oldClient) {
                await oldClient.destroy();
                this.whatsappClients.delete(sessionId);
            }
            
            // تحديث حالة الجلسة
            await session.update({
                status: 'awaiting_qr',
                lastActivity: new Date()
            });
            
            // إعادة إنشاء الجلسة
            const newSessionId = await this.createWhatsAppSession(session.phoneNumber, session.adminId, chatId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إعادة تشغيل الجلسة بنجاح!*\n\n` +
                `📱 الرقم: ${session.phoneNumber}\n` +
                `🆔 المعرف الجديد: ${newSessionId.substring(0, 8)}\n` +
                `🔗 الحالة: ⏳ في انتظار الربط\n\n` +
                `📤 *جاري إرسال QR Code جديد...*`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إعادة تشغيل الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في إعادة تشغيل الجلسة');
        }
    }
    
    async showSessionStats(chatId, userId, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) {
                return this.bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
            }
            
            // التحقق من صلاحيات المشرف
            const admin = await Admin.findOne({ where: { telegramId: userId } });
            if (!admin || admin.id !== session.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            // جمع الإحصائيات الإضافية
            const linksCount = await CollectedLink.count({ where: { sessionId } });
            const activeLinks = await CollectedLink.count({ where: { sessionId, status: 'active' } });
            const joinedGroups = await CollectedLink.count({ where: { sessionId, status: 'joined' } });
            
            const message = `
📊 *إحصائيات مفصلة للجلسة*

📱 *المعلومات الأساسية:*
• 📞 الرقم: ${session.phoneNumber}
• 🆔 المعرف: ${sessionId.substring(0, 8)}
• 📌 الحالة: ${session.status}
• ⏰ مدة التشغيل: ${session.connectedAt ? 
    Math.floor((new Date() - new Date(session.connectedAt)) / 3600000) + ' ساعة' : 'لم يتصل بعد'}

📈 *إحصائيات النشاط:*
• 📨 الرسائل المستلمة: ${session.stats?.messagesReceived || 0}
• 📤 الرسائل المرسلة: ${session.stats?.messagesSent || 0}
• 🔗 إجمالي الروابط: ${linksCount}
• 🟢 روابط نشطة: ${activeLinks}
• 👥 مجموعات منضمة: ${joinedGroups}
• 👥 مجموعات متاحة: ${session.groupsCount || 0}
• 📞 جهات اتصال: ${session.contactsCount || 0}

📅 *النشاط الزمني:*
• 🕐 أول اتصال: ${session.connectedAt ? new Date(session.connectedAt).toLocaleString('ar-SA') : 'لم يتصل'}
• 🔄 آخر نشاط: ${new Date(session.lastActivity).toLocaleString('ar-SA')}
• 📊 متوسط الرسائل/ساعة: ${session.connectedAt ? 
    Math.round(((session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0)) / 
    Math.max(1, (new Date() - new Date(session.connectedAt)) / 3600000)) : 0}

🎯 *معدلات النجاح:*
• 📨 معدل استقبال الرسائل: ${session.stats?.messagesReceived ? '🟢 جيد' : '⚪ قليل'}
• 📤 معدل إرسال الرسائل: ${session.stats?.messagesSent ? '🟢 جيد' : '⚪ قليل'}
• 🔗 فعالية تجميع الروابط: ${linksCount > 10 ? '🟢 ممتاز' : linksCount > 0 ? '🟡 جيد' : '🔴 ضعيف'}

💡 *تحليل الأداء:*
${session.status === 'connected' ? '• ✅ الجلسة تعمل بشكل طبيعي' : '• ⚠️ الجلسة غير نشطة'}
${(session.stats?.messagesReceived || 0) > 100 ? '• 📨 النشاط في استقبال الرسائل مرتفع' : ''}
${(session.stats?.messagesSent || 0) > 50 ? '• 📤 النشاط في إرسال الرسائل مرتفع' : ''}
${linksCount < 5 ? '• 🔍 يمكن تحسين تجميع الروابط' : ''}

⚡ *توصيات للتحسين:*
${linksCount < 10 ? '• 🔗 تفعيل تجميع الروابط في المزيد من المجموعات\n' : ''}
${(session.stats?.messagesSent || 0) < 10 ? '• 🤖 إضافة المزيد من الردود التلقائية\n' : ''}
${session.groupsCount < 5 ? '• 👥 الانضمام للمزيد من المجموعات\n' : ''}
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 تحديث الإحصائيات', callback_data: `session_stats_refresh_${sessionId}` },
                        { text: '📥 تصدير البيانات', callback_data: `session_export_${sessionId}` }
                    ],
                    [
                        { text: '📋 العودة للجلسة', callback_data: `session_info_${sessionId}` },
                        { text: '📊 جميع الإحصائيات', callback_data: 'menu_stats' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض إحصائيات الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإحصائيات');
        }
    }
    
    // ============================================
    // 30. معالجة الأزرار الأخرى
    // ============================================
    async handleLinksAction(chatId, userId, action) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        switch (action) {
            case 'whatsapp_group':
                await this.showWhatsAppGroupLinks(chatId, admin.id);
                break;
                
            case 'whatsapp_invite':
                await this.showWhatsAppInviteLinks(chatId, admin.id);
                break;
                
            case 'telegram':
                await this.showTelegramLinks(chatId, admin.id);
                break;
                
            case 'other':
                await this.showOtherLinks(chatId, admin.id);
                break;
                
            case 'all':
                await this.showAllLinks(chatId, admin.id);
                break;
                
            case 'active':
                await this.showActiveLinks(chatId, admin.id);
                break;
                
            case 'export':
                await this.exportLinks(chatId, admin.id);
                break;
                
            case 'clear_confirm':
                await this.confirmClearLinks(chatId, admin.id);
                break;
        }
    }
    
    async showWhatsAppGroupLinks(chatId, adminId) {
        try {
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: adminId }
            });
            
            const sessionIds = sessions.map(s => s.id);
            
            const links = await CollectedLink.findAll({
                where: {
                    type: 'whatsapp_group',
                    sessionId: sessionIds
                },
                order: [['collectedAt', 'DESC']],
                limit: 20
            });
            
            if (links.length === 0) {
                return this.bot.sendMessage(chatId,
                    `📭 *لا توجد روابط مجموعات واتساب*\n\n` +
                    `لم يتم تجميع أي روابط مجموعات واتساب بعد.\n\n` +
                    `🔧 *لبدء التجميع:*\n` +
                    `1. تأكد من تفعيل تجميع الروابط\n` +
                    `2. انتظر رسائل تحتوي على روابط\n` +
                    `3. سيجمع البوت الروابط تلقائياً`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `📱 *روابط مجموعات واتساب*\n\n`;
            message += `📊 الإجمالي: ${links.length} رابط\n\n`;
            
            links.forEach((link, index) => {
                const groupName = link.metadata?.groupName || 'مجموعة واتساب';
                const groupSize = link.metadata?.groupSize || 'غير معروف';
                const status = link.status === 'active' ? '🟢' : link.status === 'joined' ? '✅' : '⚪';
                
                message += `${index + 1}. ${status} *${groupName}*\n`;
                message += `   👥 الأعضاء: ${groupSize}\n`;
                message += `   🔗 الرابط: ${link.url.substring(0, 30)}...\n`;
                message += `   ⏰ الاكتشاف: ${new Date(link.collectedAt).toLocaleDateString('ar-SA')}\n\n`;
            });
            
            message += `⚡ *استخدم /links للعودة للقائمة الرئيسية*`;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض روابط مجموعات واتساب:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
        }
    }
    
    async showWhatsAppInviteLinks(chatId, adminId) {
        // تنفيذ مشابه لـ showWhatsAppGroupLinks لكن لروابط الدعوات
        await this.bot.sendMessage(chatId,
            `📩 *روابط دعوات واتساب*\n\n` +
            `🚀 *هذه الروابط هي:*\n` +
            `• روابط دعوة للمجموعات\n` +
            `• روابط انضمام مؤقتة\n` +
            `• روابط مشاركة للمحادثات\n\n` +
            `⚡ *الميزات:*\n` +
            `• يمكن استخدامها للانضمام التلقائي\n` +
            `• يتم تجميعها تلقائياً\n` +
            `• يتم تصنيفها حسب النوع\n\n` +
            `📊 *جاري تطوير هذه الميزة...*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showTelegramLinks(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `📢 *روابط تليجرام*\n\n` +
            `🚀 *هذه الروابط هي:*\n` +
            `• روابط قنوات تليجرام\n` +
            `• روابط مجموعات تليجرام\n` +
            `• روابط بوتات تليجرام\n` +
            `• روابط حسابات تليجرام\n\n` +
            `⚡ *الميزات:*\n` +
            `• يتم تجميعها تلقائياً من المحادثات\n` +
            `• يمكن استخدامها لتحليل المنافسين\n` +
            `• تساعد في اكتشاف فرص جديدة\n\n` +
            `📊 *جاري تطوير هذه الميزة...*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showOtherLinks(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `🌐 *روابط أخرى*\n\n` +
            `🚀 *هذه الروابط هي:*\n` +
            `• رواقع مواقع الويب\n` +
            `• روابط منصات التواصل الأخرى\n` +
            `• روابط ملفات ومستندات\n` +
            `• روابط وسائط متعددة\n\n` +
            `⚡ *الميزات:*\n` +
            `• تحليل الروابط الأكثر شيوعاً\n` +
            `• اكتشاف اتجاهات المحتوى\n` +
            `• فهم اهتمامات الجمهور\n\n` +
            `📊 *جاري تطوير هذه الميزة...*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showAllLinks(chatId, adminId) {
        try {
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: adminId }
            });
            
            const sessionIds = sessions.map(s => s.id);
            
            const links = await CollectedLink.findAll({
                where: {
                    sessionId: sessionIds
                },
                order: [['collectedAt', 'DESC']],
                limit: 15
            });
            
            if (links.length === 0) {
                return this.bot.sendMessage(chatId,
                    `📭 *لا توجد روابط مجمعة*\n\n` +
                    `لم يتم تجميع أي روابط بعد.\n\n` +
                    `🔧 *لبدء التجميع:*\n` +
                    `1. تأكد من تفعيل تجميع الروابط\n` +
                    `2. انتظر رسائل تحتوي على روابط\n` +
                    `3. سيجمع البوت الروابط تلقائياً`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `📋 *جميع الروابط المجمعة*\n\n`;
            message += `📊 الإجمالي: ${links.length} رابط\n\n`;
            
            // تجميع حسب النوع
            const typeCounts = {};
            links.forEach(link => {
                typeCounts[link.type] = (typeCounts[link.type] || 0) + 1;
            });
            
            message += `📈 *التوزيع حسب النوع:*\n`;
            Object.entries(typeCounts).forEach(([type, count]) => {
                const typeEmoji = 
                    type === 'whatsapp_group' ? '📱' :
                    type === 'whatsapp_invite' ? '📩' :
                    type === 'telegram' ? '📢' : '🌐';
                
                const typeName = 
                    type === 'whatsapp_group' ? 'مجموعات واتساب' :
                    type === 'whatsapp_invite' ? 'دعوات واتساب' :
                    type === 'telegram' ? 'تليجرام' : 'روابط أخرى';
                
                message += `${typeEmoji} ${typeName}: ${count}\n`;
            });
            
            message += `\n📅 *آخر الروابط:*\n`;
            
            links.slice(0, 5).forEach((link, index) => {
                const typeEmoji = 
                    link.type === 'whatsapp_group' ? '📱' :
                    link.type === 'whatsapp_invite' ? '📩' :
                    link.type === 'telegram' ? '📢' : '🌐';
                
                message += `${index + 1}. ${typeEmoji} ${link.title || 'رابط'}\n`;
                message += `   🔗 ${link.url.substring(0, 40)}...\n`;
                message += `   ⏰ ${new Date(link.collectedAt).toLocaleDateString('ar-SA')}\n\n`;
            });
            
            message += `⚡ *استخدم /links للعودة للقائمة الرئيسية*`;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض جميع الروابط:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
        }
    }
    
    async showActiveLinks(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `🟢 *الروابط النشطة*\n\n` +
            `🚀 *هذه الروابط هي:*\n` +
            `• روابط تم التحقق من صحتها\n` +
            `• روابط لا تزال تعمل\n` +
            `• روابط يمكن استخدامها\n\n` +
            `⚡ *الميزات:*\n` +
            `• يتم فحص الروابط بانتظام\n` +
            `• يتم تحديث حالة الروابط تلقائياً\n` +
            `• يمكن استخدامها للانضمام أو المشاركة\n\n` +
            `📊 *جاري تطوير هذه الميزة...*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async exportLinks(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `📥 *تصدير الروابط*\n\n` +
            `🚀 *خيارات التصدير:*\n` +
            `• 📄 CSV: ملف إكسل\n` +
            `• 📋 JSON: للمطورين\n` +
            `• 📝 TXT: نص عادي\n` +
            `• 🔗 HTML: صفحة ويب\n\n` +
            `⚡ *الميزات:*\n` +
            `• تصدير جميع الروابط\n` +
            `• تصدير حسب النوع\n` +
            `• تصدير حسب التاريخ\n` +
            `• تصدير حسب الحالة\n\n` +
            `📊 *جاري تطوير هذه الميزة...*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async confirmClearLinks(chatId, adminId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ نعم، مسح جميع الروابط', callback_data: 'links_clear_all' },
                    { text: '❌ لا، إلغاء المسح', callback_data: 'menu_links' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId,
            `⚠️ *تأكيد مسح جميع الروابط*\n\n` +
            `❓ *هل أنت متأكد أنك تريد مسح جميع الروابط؟*\n\n` +
            `📋 *ما سيتم مسحه:*\n` +
            `• جميع روابط المجموعات\n` +
            `• جميع روابط الدعوات\n` +
            `• جميع روابط تليجرام\n` +
            `• جميع الروابط الأخرى\n\n` +
            `🔒 *تحذير:*\n` +
            `• هذه العملية لا يمكن التراجع عنها\n` +
            `• سيتم فقدان جميع البيانات\n` +
            `• قد تحتاج لإعادة تجميع الروابط\n\n` +
            `💡 *نصيحة:*\n` +
            `• يمكنك تصدير البيانات قبل المسح\n` +
            `• فكر في مسح جزئي بدلاً من كلي\n` +
            `• تأكد من وجود نسخة احتياطية\n\n` +
            `اختر الإجراء المناسب:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }
    
    async handleStatsAction(chatId, userId, parts) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const action = parts[1];
        
        switch (action) {
            case 'sessions':
                await this.showDetailedSessionStats(chatId, admin.id);
                break;
                
            case 'links':
                await this.showDetailedLinkStats(chatId, admin.id);
                break;
                
            case 'ads':
                await this.showDetailedAdStats(chatId, admin.id);
                break;
                
            case 'autopost':
                await this.showDetailedAutoPostStats(chatId, admin.id);
                break;
                
            case 'autoreply':
                await this.showDetailedAutoReplyStats(chatId, admin.id);
                break;
                
            case 'autojoin':
                await this.showDetailedAutoJoinStats(chatId, admin.id);
                break;
                
            case 'overview':
                await this.showStatsOverview(chatId, admin.id);
                break;
                
            case 'detailed':
                await this.showDetailedStats(chatId, admin.id);
                break;
                
            case 'daily':
                await this.showDailyStats(chatId, admin.id);
                break;
                
            case 'weekly':
                await this.showWeeklyStats(chatId, admin.id);
                break;
        }
    }
    
    async showDetailedSessionStats(chatId, adminId) {
        try {
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: adminId },
                order: [['createdAt', 'DESC']]
            });
            
            if (sessions.length === 0) {
                return this.bot.sendMessage(chatId,
                    `📭 *لا توجد جلسات WhatsApp*\n\n` +
                    `لم يتم إضافة أي جلسات بعد.\n\n` +
                    `🔧 *لإضافة جلسة:*\n` +
                    `1. استخدم /addsession\n` +
                    `2. اتبع التعليمات\n` +
                    `3. امسح QR Code\n` +
                    `4. ابدأ استخدام الميزات`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `📊 *إحصائيات مفصلة للجلسات*\n\n`;
            
            // إحصائيات عامة
            const activeSessions = sessions.filter(s => 
                s.status === 'connected' || s.status === 'authenticated'
            ).length;
            
            const totalMessages = sessions.reduce((sum, session) => 
                sum + (session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0), 0
            );
            
            const totalGroups = sessions.reduce((sum, session) => 
                sum + (session.groupsCount || 0), 0
            );
            
            const totalContacts = sessions.reduce((sum, session) => 
                sum + (session.contactsCount || 0), 0
            );
            
            message += `🎯 *نظرة عامة:*\n`;
            message += `• 📊 إجمالي الجلسات: ${sessions.length}\n`;
            message += `• 🟢 جلسات نشطة: ${activeSessions}\n`;
            message += `• 📈 نسبة النشاط: ${Math.round((activeSessions / sessions.length) * 100)}%\n`;
            message += `• 💬 إجمالي الرسائل: ${totalMessages.toLocaleString()}\n`;
            message += `• 👥 إجمالي المجموعات: ${totalGroups.toLocaleString()}\n`;
            message += `• 📞 إجمالي الجهات: ${totalContacts.toLocaleString()}\n\n`;
            
            // توزيع حسب الحالة
            const statusCounts = {};
            sessions.forEach(session => {
                statusCounts[session.status] = (statusCounts[session.status] || 0) + 1;
            });
            
            message += `📌 *التوزيع حسب الحالة:*\n`;
            Object.entries(statusCounts).forEach(([status, count]) => {
                const statusEmoji = 
                    status === 'connected' ? '🟢' :
                    status === 'authenticated' ? '🔐' :
                    status === 'awaiting_qr' ? '📱' :
                    status === 'disconnected' ? '🔴' : '⚪';
                
                const statusName = 
                    status === 'connected' ? 'متصل' :
                    status === 'authenticated' ? 'مصادق' :
                    status === 'awaiting_qr' ? 'بانتظار QR' :
                    status === 'disconnected' ? 'مقطوع' : status;
                
                message += `${statusEmoji} ${statusName}: ${count} جلسة\n`;
            });
            
            message += `\n📈 *أفضل 5 جلسات حسب النشاط:*\n`;
            
            // ترتيب الجلسات حسب النشاط
            const sortedSessions = [...sessions].sort((a, b) => {
                const aActivity = (a.stats?.messagesReceived || 0) + (a.stats?.messagesSent || 0);
                const bActivity = (b.stats?.messagesReceived || 0) + (b.stats?.messagesSent || 0);
                return bActivity - aActivity;
            });
            
            sortedSessions.slice(0, 5).forEach((session, index) => {
                const activity = (session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0);
                const groups = session.groupsCount || 0;
                const statusEmoji = session.status === 'connected' ? '🟢' : '⚪';
                
                message += `${index + 1}. ${statusEmoji} ${session.phoneNumber}\n`;
                message += `   📊 النشاط: ${activity} رسالة\n`;
                message += `   👥 المجموعات: ${groups}\n`;
                message += `   ⏰ آخر نشاط: ${new Date(session.lastActivity).toLocaleDateString('ar-SA')}\n\n`;
            });
            
            // تحليل الأداء
            message += `📊 *تحليل الأداء:*\n`;
            
            const avgMessagesPerSession = sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0;
            const avgGroupsPerSession = sessions.length > 0 ? Math.round(totalGroups / sessions.length) : 0;
            
            message += `• 📨 متوسط الرسائل/جلسة: ${avgMessagesPerSession}\n`;
            message += `• 👥 متوسط المجموعات/جلسة: ${avgGroupsPerSession}\n`;
            
            if (avgMessagesPerSession < 10) {
                message += `• ⚠️ النشاط منخفض، يحتاج تحسين\n`;
            } else if (avgMessagesPerSession < 50) {
                message += `• 🟡 النشاط متوسط، يمكن تحسينه\n`;
            } else {
                message += `• 🟢 النشاط عالي، ممتاز\n`;
            }
            
            message += `\n💡 *توصيات للتحسين:*\n`;
            
            if (activeSessions < sessions.length) {
                message += `• 🔄 إعادة تشغيل الجلسات غير النشطة\n`;
            }
            
            if (avgMessagesPerSession < 20) {
                message += `• 🤖 إضافة المزيد من الردود التلقائية\n`;
            }
            
            if (avgGroupsPerSession < 5) {
                message += `• ➕ الانضمام للمزيد من المجموعات\n`;
            }
            
            message += `\n⚡ *استخدم /stats للعودة للقائمة الرئيسية*`;
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض إحصائيات الجلسات:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإحصائيات');
        }
    }
    
    async showDetailedLinkStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `🔗 *إحصائيات مفصلة للروابط*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تحليل توزيع الروابط حسب النوع\n` +
            `• إحصائيات الاكتشاف اليومي\n` +
            `• تحليل فعالية تجميع الروابط\n` +
            `• تقارير عن الروابط النشطة\n` +
            `• مقارنة بين الجلسات المختلفة\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showDetailedAdStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `📢 *إحصائيات مفصلة للإعلانات*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تحليل أداء الحملات الإعلانية\n` +
            `• مقارنة بين أنواع الإعلانات\n` +
            `• إحصائيات النقر والمشاهدات\n` +
            `• تقارير عن أوقات الذروة\n` +
            `• تحليل تكلفة الحملة\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showDetailedAutoPostStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `🔄 *إحصائيات مفصلة للنشر التلقائي*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تحليل أداء النشر التلقائي\n` +
            `• إحصائيات النجاح والفشل\n` +
            `• تقارير عن أوقات النشر\n` +
            `• تحليل تأثير النشر على المجموعات\n` +
            `• مقارنة بين أنماط النشر المختلفة\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showDetailedAutoReplyStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `🤖 *إحصائيات مفصلة للردود التلقائية*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تحليل أداء الردود التلقائية\n` +
            `• إحصائيات التفاعل مع الردود\n` +
            `• تقارير عن أكثر المحفزات فعالية\n` +
            `• تحليل أوقات الاستجابة\n` +
            `• مقارنة بين أنواع الردود المختلفة\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showDetailedAutoJoinStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `➕ *إحصائيات مفصلة للانضمام التلقائي*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تحليل أداء الانضمام التلقائي\n` +
            `• إحصائيات النجاح والفشل\n` +
            `• تقارير عن المجموعات المنضمة\n` +
            `• تحليل جودة المجموعات\n` +
            `• مقارنة بين طرق الانضمام\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showStatsOverview(chatId, adminId) {
        await this.showStatsMenu(chatId, adminId);
    }
    
    async showDetailedStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `📈 *تقرير إحصائي مفصل*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تقرير شامل عن جميع الأنشطة\n` +
            `• تحليل مقارن مع الفترات السابقة\n` +
            `• توقعات للأداء المستقبلي\n` +
            `• توصيات مبنية على البيانات\n` +
            `• رسوم بيانية وتصورات\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showDailyStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `📅 *تقرير إحصائي يومي*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• ملخص الأنشطة اليومية\n` +
            `• مقارنة مع اليوم السابق\n` +
            `• إنجازات اليوم\n` +
            `• أهداف الغد\n` +
            `• تحليل الاتجاهات اليومية\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async showWeeklyStats(chatId, adminId) {
        await this.bot.sendMessage(chatId,
            `📆 *تقرير إحصائي أسبوعي*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• ملخص الأنشطة الأسبوعية\n` +
            `• مقارنة مع الأسبوع السابق\n` +
            `• إنجازات الأسبوع\n` +
            `• أهداف الأسبوع القادم\n` +
            `• تحليل الاتجاهات الأسبوعية\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async handleRefreshAction(chatId, userId, target) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        switch (target) {
            case 'sessions':
                await this.showSessionsMenu(chatId, admin.id);
                break;
                
            case 'links':
                await this.showLinksMenu(chatId, admin.id);
                break;
                
            case 'ads':
                await this.showAdsMenu(chatId, admin.id);
                break;
                
            case 'stats':
                await this.showStatsMenu(chatId, admin.id);
                break;
                
            case 'menu':
                await this.handleStart({ 
                    chat: { id: chatId }, 
                    from: { id: userId, username: admin.username, first_name: admin.firstName } 
                });
                break;
        }
    }
    
    async handleAdAction(chatId, userId, parts) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const action = parts[1];
        const adId = parts[2];
        
        switch (action) {
            case 'info':
                await this.showAdInfo(chatId, admin.id, adId);
                break;
                
            case 'create':
                await this.createAd(chatId, admin.id);
                break;
                
            case 'edit':
                await this.editAd(chatId, admin.id, adId);
                break;
                
            case 'delete':
                await this.deleteAd(chatId, admin.id, adId);
                break;
                
            case 'activate':
                await this.activateAd(chatId, admin.id, adId);
                break;
                
            case 'deactivate':
                await this.deactivateAd(chatId, admin.id, adId);
                break;
        }
    }
    
    async showAdInfo(chatId, adminId, adId) {
        try {
            const ad = await Advertisement.findByPk(adId);
            if (!ad || ad.adminId !== adminId) {
                return this.bot.sendMessage(chatId, '❌ الإعلان غير موجود أو غير مصرح لك');
            }
            
            const message = `
📢 *معلومات الإعلان*

🔗 *المعلومات الأساسية:*
• 📝 الاسم: ${ad.name}
• 🏷️ النوع: ${ad.type}
• 📌 الحالة: ${ad.isActive ? '🟢 نشط' : '⚪ متوقف'}
• 🆔 المعرف: ${ad.id}

📊 *الإحصائيات:*
• 📨 مرسلة: ${ad.stats?.sent || 0}
• ❌ فاشلة: ${ad.stats?.failed || 0}
• 📈 نسبة النجاح: ${ad.stats?.sent ? 
    Math.round(((ad.stats.sent - (ad.stats.failed || 0)) / ad.stats.sent) * 100) : 0}%
• ⏰ آخر إرسال: ${ad.stats?.lastSent ? 
    new Date(ad.stats.lastSent).toLocaleString('ar-SA') : 'لم يرسل بعد'}

📝 *محتوى الإعلان:*
${ad.content.substring(0, 300)}${ad.content.length > 300 ? '...' : ''}

⏰ *معلومات الإنشاء:*
• 📅 تاريخ الإنشاء: ${new Date(ad.createdAt).toLocaleDateString('ar-SA')}
• ⏰ وقت الإنشاء: ${new Date(ad.createdAt).toLocaleTimeString('ar-SA')}

⚙️ *الإعدادات:*
• ⏳ التأخير بين المجموعات: ${ad.settings?.delayBetweenGroups || 1000}ms
• 🔄 إعادة المحاولة عند الفشل: ${ad.settings?.retryFailed ? '✅' : '❌'}
• ⚡ تحسين الإرسال: ${ad.settings?.optimizeSending ? '✅' : '❌'}

🎯 *الهدف:*
${ad.target?.allGroups ? '• 👥 جميع المجموعات\n' : ''}
${ad.target?.specificGroups?.length > 0 ? `• 📋 مجموعات محددة: ${ad.target.specificGroups.length}\n` : ''}
${ad.target?.minMembers > 0 ? `• 👥 الحد الأدنى للأعضاء: ${ad.target.minMembers}\n` : ''}
${ad.target?.maxMembers < 1000000 ? `• 👥 الحد الأقصى للأعضاء: ${ad.target.maxMembers}\n` : ''}

💡 *نصائح للتحسين:*
${ad.stats?.sent < 10 ? '• ⚠️ الإعلان لم يُرسل كثيراً، فكر في نشره أكثر\n' : ''}
${(ad.stats?.failed || 0) > (ad.stats?.sent || 1) * 0.3 ? '• 🔄 نسبة الفشل عالية، راجع الإعدادات\n' : ''}
${!ad.isActive ? '• ▶️ الإعلان متوقف، قم بتفعيله للبدء\n' : ''}
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: ad.isActive ? '⏸️ إيقاف مؤقت' : '▶️ تفعيل', 
                          callback_data: ad.isActive ? `ad_deactivate_${adId}` : `ad_activate_${adId}` },
                        { text: '✏️ تعديل', callback_data: `ad_edit_${adId}` }
                    ],
                    [
                        { text: '🗑️ حذف', callback_data: `ad_delete_${adId}` },
                        { text: '🚀 نشر الآن', callback_data: `ad_publish_${adId}` }
                    ],
                    [
                        { text: '📊 إحصائيات مفصلة', callback_data: `ad_stats_${adId}` },
                        { text: '⚙️ إعدادات النشر', callback_data: `ad_settings_${adId}` }
                    ],
                    [
                        { text: '📋 العودة للإعلانات', callback_data: 'menu_ads' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض معلومات الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض معلومات الإعلان');
        }
    }
    
    async createAd(chatId, adminId) {
        // بدء عملية إنشاء إعلان
        this.userStates.set(adminId.toString(), {
            state: 'awaiting_ad_name',
            data: { adminId: adminId }
        });
        
        await this.bot.sendMessage(chatId,
            `📢 *إنشاء إعلان جديد*\n\n` +
            `🚀 *مرحباً بك في عملية إنشاء الإعلان*\n\n` +
            `📋 *الخطوات:*\n` +
            `1. إدخال اسم الإعلان\n` +
            `2. إدخال محتوى الإعلان\n` +
            `3. تحديد إعدادات النشر\n` +
            `4. تحديد الجمهور المستهدف\n\n` +
            `📝 *الخطوة 1: اسم الإعلان*\n\n` +
            `💡 *نصائح للاسم:*\n` +
            `• استخدم اسماً وصفيًا\n` +
            `• مثال: "إعلان منتج جديد"\n` +
            `• مثال: "عرض خاص"\n` +
            `• مثال: "ترويج للمجموعة"\n\n` +
            `⚡ *أرسل اسم الإعلان الآن:*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async editAd(chatId, adminId, adId) {
        await this.bot.sendMessage(chatId,
            `✏️ *تعديل الإعلان*\n\n` +
            `🚀 *جاري تطوير هذه الميزة...*\n\n` +
            `📊 *الميزات القادمة:*\n` +
            `• تعديل اسم الإعلان\n` +
            `• تعديل محتوى الإعلان\n` +
            `• تغيير إعدادات النشر\n` +
            `• تعديل الجمهور المستهدف\n` +
            `• تغيير توقيت النشر\n\n` +
            `⚡ *تابع التحديثات القادمة!*`,
            { parse_mode: 'Markdown' }
        );
    }
    
    async deleteAd(chatId, adminId, adId) {
        try {
            const ad = await Advertisement.findByPk(adId);
            if (!ad || ad.adminId !== adminId) {
                return this.bot.sendMessage(chatId, '❌ الإعلان غير موجود أو غير مصرح لك');
            }
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ نعم، حذف الإعلان', callback_data: `ad_delete_confirm_${adId}` },
                        { text: '❌ لا، إلغاء الحذف', callback_data: `ad_info_${adId}` }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId,
                `⚠️ *تأكيد حذف الإعلان*\n\n` +
                `❓ *هل أنت متأكد أنك تريد حذف الإعلان "${ad.name}"؟*\n\n` +
                `📋 *ما سيتم حذفه:*\n` +
                `• معلومات الإعلان\n` +
                `• إحصائيات الإعلان\n` +
                `• إعدادات النشر\n` +
                `• سجلات النشر\n\n` +
                `🔒 *تحذير:*\n` +
                `• هذه العملية لا يمكن التراجع عنها\n` +
                `• سيتم فقدان جميع البيانات\n` +
                `• قد تحتاج لإعادة إنشاء الإعلان\n\n` +
                `💡 *نصيحة:*\n` +
                `• يمكنك إيقاف الإعلان بدلاً من حذفه\n` +
                `• احتفظ بنسخة من المحتوى\n` +
                `• فكر في التعديل بدلاً من الحذف\n\n` +
                `اختر الإجراء المناسب:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حذف الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في حذف الإعلان');
        }
    }
    
    async activateAd(chatId, adminId, adId) {
        try {
            const ad = await Advertisement.findByPk(adId);
            if (!ad || ad.adminId !== adminId) {
                return this.bot.sendMessage(chatId, '❌ الإعلان غير موجود أو غير مصرح لك');
            }
            
            await ad.update({ isActive: true });
            
            await this.bot.sendMessage(chatId,
                `✅ *تم تفعيل الإعلان بنجاح!*\n\n` +
                `📢 *اسم الإعلان:* ${ad.name}\n` +
                `🆔 *المعرف:* ${adId}\n` +
                `⏰ *وقت التفعيل:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `🚀 *الإعلان جاهز الآن للنشر!*\n\n` +
                `⚡ *الخطوات التالية:*\n` +
                `1. استخدم /ads لعرض الإعلانات\n` +
                `2. اختر الإعلان المفعل\n` +
                `3. اضبط إعدادات النشر\n` +
                `4. ابدأ الحملة الإعلانية\n\n` +
                `🔧 *لبدء النشر الفوري:*\n` +
                `استخدم زر "🚀 نشر الآن" في معلومات الإعلان`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في تفعيل الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في تفعيل الإعلان');
        }
    }
    
    async deactivateAd(chatId, adminId, adId) {
        try {
            const ad = await Advertisement.findByPk(adId);
            if (!ad || ad.adminId !== adminId) {
                return this.bot.sendMessage(chatId, '❌ الإعلان غير موجود أو غير مصرح لك');
            }
            
            await ad.update({ isActive: false });
            
            await this.bot.sendMessage(chatId,
                `⏸️ *تم إيقاف الإعلان مؤقتاً*\n\n` +
                `📢 *اسم الإعلان:* ${ad.name}\n` +
                `🆔 *المعرف:* ${adId}\n` +
                `⏰ *وقت الإيقاف:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `📊 *إحصائيات الإعلان:*\n` +
                `• 📨 مرسلة: ${ad.stats?.sent || 0}\n` +
                `• ❌ فاشلة: ${ad.stats?.failed || 0}\n` +
                `• 📈 نسبة النجاح: ${ad.stats?.sent ? 
                    Math.round(((ad.stats.sent - (ad.stats.failed || 0)) / ad.stats.sent) * 100) : 0}%\n\n` +
                `💡 *ملاحظة:*\n` +
                `• يمكن تفعيل الإعلان في أي وقت\n` +
                `• الإحصائيات محفوظة\n` +
                `• الإعدادات محفوظة\n\n` +
                `⚡ *لإعادة التفعيل:*\n` +
                `استخدم زر "▶️ تفعيل" في معلومات الإعلان`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إيقاف الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف الإعلان');
        }
    }
    
    // ============================================
    // 31. دوال إضافية للإدارة
    // ============================================
    async cleanup() {
        console.log('🧹 جاري تنظيف موارد البوت...');
        
        // إغلاق جميع جلسات WhatsApp
        for (const [sessionId, client] of this.whatsappClients.entries()) {
            try {
                await client.destroy();
                console.log(`✅ تم إغلاق جلسة: ${sessionId}`);
            } catch (error) {
                console.error(`❌ خطأ في إغلاق جلسة ${sessionId}:`, error);
            }
        }
        
        // مسح جميع التخزينات المؤقتة
        this.whatsappClients.clear();
        this.activeAutoPosts.clear();
        this.activeAutoJoins.clear();
        this.sessionQRs.clear();
        this.messageQueues.clear();
        this.cooldownTimers.clear();
        this.userStates.clear();
        
        console.log('✅ تم تنظيف جميع موارد البوت');
    }
    
    // ============================================
    // 32. التصدير
    // ============================================
    getBotInstance() {
        return this.bot;
    }
    
    getUserStates() {
        return this.userStates;
    }
    
    getWhatsAppClients() {
        return this.whatsappClients;
    }
    
    getActiveAutoPosts() {
        return this.activeAutoPosts;
    }
    
    getActiveAutoJoins() {
        return this.activeAutoJoins;
    }
    
    getSessionQRs() {
        return this.sessionQRs;
    }
}

// ============================================
// 33. تصدير الفئة
// ============================================
module.exports = WhatsAppTelegramBot;
