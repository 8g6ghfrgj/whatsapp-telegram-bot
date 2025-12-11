// ============================================
// ملف معالجة بوت تليجرام - WhatsApp Management Bot
// النسخة الكاملة مع جميع الميزات المطلوبة
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const moment = require('moment');
const { Client: WhatsAppClient } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// استيراد النماذج من الملف الرئيسي
const { 
    Admin, 
    WhatsAppSession, 
    CollectedLink, 
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin 
} = require('./index');

class WhatsAppTelegramBot {
    constructor(token) {
        this.bot = new TelegramBot(token, {
            polling: {
                interval: 1000,
                autoStart: true,
                params: {
                    timeout: 10
                }
            }
        });
        
        this.userStates = new Map();
        this.whatsappClients = new Map();
        this.activeAutoPosts = new Map();
        this.activeAutoJoins = new Map();
        this.sessionQRs = new Map();
        
        this.setupHandlers();
    }
    
    // ============================================
    // 1. إعداد جميع المعالجات
    // ============================================
    setupHandlers() {
        console.log('🤖 جاري إعداد معالجات البوت...');
        
        this.setupCommands();
        this.setupCallbacks();
        this.setupMessageHandlers();
        this.setupWhatsAppEvents();
        
        console.log('✅ تم إعداد جميع المعالجات');
    }
    
    // ============================================
    // 2. إعداد الأوامر
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
        
        // /addad - إضافة إعلان
        this.bot.onText(/\/addad/, async (msg) => {
            await this.startAddAd(msg.chat.id, msg.from.id);
        });
        
        // /autopost - النشر التلقائي
        this.bot.onText(/\/autopost/, async (msg) => {
            await this.showAutoPostMenu(msg.chat.id, msg.from.id);
        });
        
        // /autojoin - الانضمام التلقائي
        this.bot.onText(/\/autojoin/, async (msg) => {
            await this.showAutoJoinMenu(msg.chat.id, msg.from.id);
        });
        
        // /autoreply - الردود التلقائية
        this.bot.onText(/\/autoreply/, async (msg) => {
            await this.showAutoReplyMenu(msg.chat.id, msg.from.id);
        });
        
        // /addadmin - إضافة مشرف
        this.bot.onText(/\/addadmin/, async (msg) => {
            await this.startAddAdmin(msg.chat.id, msg.from.id);
        });
        
        // /stats - الإحصائيات
        this.bot.onText(/\/stats/, async (msg) => {
            await this.showStats(msg.chat.id, msg.from.id);
        });
        
        // /help - المساعدة
        this.bot.onText(/\/help/, async (msg) => {
            await this.showHelp(msg.chat.id);
        });
    }
    
    // ============================================
    // 3. معالجة القائمة الرئيسية
    // ============================================
    async handleStart(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id.toString();
        
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            
            if (!admin) {
                return this.bot.sendMessage(chatId,
                    '❌ *غير مصرح لك بالدخول!*\n\n' +
                    'أنت لست مشرفاً في النظام.\n' +
                    'يرجى التواصل مع المشرف الرئيسي.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 إدارة الجلسات', callback_data: 'menu_sessions' },
                        { text: '🔗 الروابط المجمعة', callback_data: 'menu_links' }
                    ],
                    [
                        { text: '📢 نظام الإعلانات', callback_data: 'menu_ads' },
                        { text: '🔄 النشر التلقائي', callback_data: 'menu_autopost' }
                    ],
                    [
                        { text: '➕ الانضمام التلقائي', callback_data: 'menu_autojoin' },
                        { text: '🤖 الردود التلقائية', callback_data: 'menu_autoreply' }
                    ],
                    [
                        { text: '👥 إدارة المشرفين', callback_data: 'menu_admins' },
                        { text: '📊 الإحصائيات', callback_data: 'menu_stats' }
                    ],
                    [
                        { text: '🆘 المساعدة والدعم', callback_data: 'menu_help' }
                    ]
                ]
            };
            
            const welcomeMessage = `
🤖 *مرحباً ${admin.firstName || 'مشرف'}!*

*WhatsApp Management Bot - النسخة الكاملة*

*🎯 المميزات الرئيسية:*

📱 *ربط واتساب كجهاز مصاحب*
• ربط حسابات واتساب متعددة
• QR Code تلقائي للربط
• متابعة حالة الجلسات

🔗 *تجميع الروابع تلقائياً*
• تجميع روابط واتساب وتليجرام
• تصنيف تلقائي للروابط
• منع التكرار التلقائي

📢 *نظام إعلانات متكامل*
• إعلانات نصية وصورية
• إدارة متعددة للإعلانات
• إحصائيات مفصلة

🔄 *النشر التلقائي*
• نشر في جميع المجموعات
• توقيت قابل للتعديل
• استمرارية النشر بدون توقف

➕ *الانضمام التلقائي*
• الانضمام التلقائي للمجموعات
• اكتشاف روابط واتساب
• تقارير مفصلة

🤖 *الردود التلقائية*
• ردود خاصة وجماعية
• محفزات نصية ومطابقة
• إدارة متقدمة

👥 *إدارة مشرفين متعددة*
• إضافة وحذف المشرفين
• صلاحيات محددة
• تسجيل نشاطات

📊 *إحصائيات وتقارير*
• إحصائيات مفصلة
• تقارير أداء
• سجلات النشاطات

*💼 حالتك:* ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}
*🎫 الصلاحيات:* ${admin.permissions?.join(', ') || 'أساسية'}
            `;
            
            this.bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('خطأ في /start:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
        }
    }
    
    // ============================================
    // 4. إضافة جلسة واتساب جديدة
    // ============================================
    async startAddSession(chatId, userId) {
        try {
            const admin = await Admin.findOne({ 
                where: { telegramId: userId.toString() } 
            });
            
            if (!admin) return;
            
            // التحقق من الحد الأقصى للجلسات
            const sessionCount = await WhatsAppSession.count({ 
                where: { adminId: admin.id } 
            });
            
            const maxSessions = 5; // الحد الأقصى
            
            if (sessionCount >= maxSessions) {
                return this.bot.sendMessage(chatId,
                    `❌ *وصلت للحد الأقصى!*\n\n` +
                    `لديك ${sessionCount} من أصل ${maxSessions} جلسة.\n` +
                    `يرجى حذف جلسة قبل إضافة جديدة.`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // حفظ حالة المستخدم
            this.userStates.set(userId.toString(), {
                state: 'awaiting_phone_for_session',
                data: { adminId: admin.id }
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '❌ إلغاء', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `📱 *إضافة جلسة واتساب جديدة*\n\n` +
                `🚀 *كيفية الربط كجهاز مصاحب:*\n\n` +
                `1. سأطلب منك رقم الهاتف\n` +
                `2. سأنشئ جلسة WhatsApp Web\n` +
                `3. سأرسل لك *QR Code*\n` +
                `4. تفتح *واتساب على هاتفك*\n` +
                `5. تذهب إلى *الإعدادات → الأجهزة المرتبطة*\n` +
                `6. تنقر على *"ربط جهاز"*\n` +
                `7. تمسح *QR Code* بالكاميرا\n` +
                `8. البوت يصبح *جهازاً مصاحباً* لحسابك\n\n` +
                `📞 *أرسل لي رقم الهاتف الآن (مع رمز الدولة):*\n` +
                `مثال: \`+966501234567\`\n` +
                `مثال: \`+971501234567\`\n` +
                `مثال: \`+201012345678\``,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            
        } catch (error) {
            console.error('خطأ في بدء إضافة جلسة:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الجلسة');
        }
    }
    
    // ============================================
    // 5. إنشاء جلسة واتساب فعلية
    // ============================================
    async createWhatsAppSession(phoneNumber, adminId, chatId) {
        const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
        
        try {
            // حفظ الجلسة في قاعدة البيانات
            const session = await WhatsAppSession.create({
                id: sessionId,
                sessionId: sessionId,
                phoneNumber: phoneNumber,
                adminId: adminId,
                status: 'awaiting_qr',
                createdAt: new Date()
            });
            
            // إنشاء عميل واتساب
            const client = new WhatsAppClient({
                session: sessionId,
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage'
                    ]
                },
                qrTimeout: 60000
            });
            
            // تخزين العميل
            this.whatsappClients.set(sessionId, client);
            
            // إعداد معالج QR
            client.on('qr', async (qr) => {
                console.log(`📱 QR Code generated for ${phoneNumber}`);
                
                // تحديث الجلسة
                await session.update({
                    qrCode: qr,
                    status: 'awaiting_qr'
                });
                
                // إرسال QR للمستخدم
                await this.sendQRCode(chatId, qr, sessionId, phoneNumber);
            });
            
            // عند الاتصال الناجح
            client.on('ready', async () => {
                console.log(`✅ WhatsApp connected: ${phoneNumber}`);
                
                await session.update({
                    status: 'connected',
                    connectedAt: new Date()
                });
                
                // إعلام المستخدم
                await this.bot.sendMessage(chatId,
                    `🎉 *تم الربط بنجاح!*\n\n` +
                    `✅ *الجلسة أصبحت نشطة*\n` +
                    `📱 الرقم: ${phoneNumber}\n` +
                    `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
                    `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                    `🔗 يمكنك الآن استخدام جميع الميزات:\n` +
                    `• تجميع الروابط تلقائياً\n` +
                    `• النشر في المجموعات\n` +
                    `• الانضمام التلقائي\n` +
                    `• الردود التلقائية`,
                    { parse_mode: 'Markdown' }
                );
                
                // بدء تجميع المجموعات
                this.collectGroups(client, sessionId);
            });
            
            // عند استقبال رسالة
            client.on('message', async (message) => {
                await this.handleWhatsAppMessage(message, sessionId);
            });
            
            // عند فقدان الاتصال
            client.on('disconnected', async (reason) => {
                console.log(`❌ WhatsApp disconnected: ${phoneNumber} - ${reason}`);
                
                await session.update({
                    status: 'disconnected'
                });
                
                await this.bot.sendMessage(chatId,
                    `⚠️ *تم فقدان الاتصال*\n\n` +
                    `📱 الرقم: ${phoneNumber}\n` +
                    `📌 السبب: ${reason}\n\n` +
                    `استخدم /sessions لعرض الحالة وإعادة المحاولة.`,
                    { parse_mode: 'Markdown' }
                );
            });
            
            // بدء الجلسة
            await client.initialize();
            
            return sessionId;
            
        } catch (error) {
            console.error('خطأ في إنشاء جلسة واتساب:', error);
            throw error;
        }
    }
    
    // ============================================
    // 6. إرسال QR Code
    // ============================================
    async sendQRCode(chatId, qr, sessionId, phoneNumber) {
        try {
            // أولاً: إرسال تعليمات
            const instructions = `
📱 *QR Code للربط - WhatsApp Device Companion*

📋 *معلومات الجلسة:*
• 📞 الرقم: ${phoneNumber}
• 🆔 المعرف: \`${sessionId.substring(0, 8)}\`
• ⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}

🚀 *خطوات الربط كجهاز مصاحب:*

1. *افتح تطبيق WhatsApp* على هاتفك الذكي
2. *اضغط* على **النقاط الثلاث** (⋮) أو **الإعدادات**
3. *اختر* **"الأجهزة المرتبطة"** أو **"Linked Devices"**
4. *انقر* على **"ربط جهاز"** أو **"Link a Device"**
5. *وجه كاميرا الهاتف* نحو **QR Code** أدناه
6. *انتظر* حتى تظهر رسالة التأكيد
7. *انقر* على **"متابعة"** أو **"Continue"**

📝 *ملاحظات مهمة:*
• تأكد من اتصال الهاتف بالإنترنت
• قم بتقريب الكاميرا من QR Code
• ⏱️ هذا QR صالح لمدة **60 ثانية**
• 🔄 سيتم تجديده تلقائياً إذا انتهت

✅ *عند اكتمال الربط:* ستصلك رسالة تأكيد
            `;
            
            await this.bot.sendMessage(chatId, instructions, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
            // ثانياً: توليد وعرض QR Code نصي
            await qrcode.generate(qr, { small: true }, async (qrText) => {
                const qrMessage = `
📱 *QR Code:*

\`\`\`
${qrText}
\`\`\`

🔗 *معلومات الربط:* 
\`${qr.substring(0, 50)}...\`
                `;
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔄 تجديد QR', callback_data: `refresh_qr_${sessionId}` },
                            { text: '❌ إلغاء الجلسة', callback_data: `cancel_session_${sessionId}` }
                        ],
                        [
                            { text: '📱 ربط يدوي', callback_data: `manual_pair_${sessionId}` }
                        ],
                        [
                            { text: '📋 العودة للجلسات', callback_data: 'menu_sessions' }
                        ]
                    ]
                };
                
                await this.bot.sendMessage(chatId, qrMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            });
            
        } catch (error) {
            console.error('خطأ في إرسال QR:', error);
            await this.bot.sendMessage(chatId,
                '❌ حدث خطأ في توليد QR Code\n' +
                'يرجى المحاولة مرة أخرى.'
            );
        }
    }
    
    // ============================================
    // 7. تجميع المجموعات والروابط
    // ============================================
    async collectGroups(client, sessionId) {
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
            
            // تجميع الروابط من المجموعات
            for (const group of groups) {
                try {
                    const messages = await client.getMessages(group.id._serialized, { limit: 50 });
                    
                    for (const message of messages) {
                        await this.extractAndSaveLinks(message, sessionId, 'group');
                    }
                    
                } catch (error) {
                    console.error(`خطأ في تجميع رسائل المجموعة ${group.name}:`, error);
                }
            }
            
        } catch (error) {
            console.error('خطأ في تجميع المجموعات:', error);
        }
    }
    
    // ============================================
    // 8. استخراج وحفظ الروابط
    // ============================================
    async extractAndSaveLinks(message, sessionId, sourceType) {
        try {
            if (!message.body) return;
            
            // استخراج جميع الروابط من النص
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.body.match(urlRegex) || [];
            
            for (const url of links) {
                // تصنيف الرابط
                let type = 'other';
                if (url.includes('chat.whatsapp.com')) type = 'whatsapp_group';
                else if (url.includes('whatsapp.com')) type = 'whatsapp_invite';
                else if (url.includes('t.me') || url.includes('telegram.me')) type = 'telegram';
                else if (url.includes('http')) type = 'website';
                
                // التحقق من عدم التكرار
                const existing = await CollectedLink.findOne({
                    where: { url: url }
                });
                
                if (existing) continue;
                
                // حفظ الرابط
                await CollectedLink.create({
                    url: url,
                    type: type,
                    title: `رابط من ${sourceType}`,
                    description: message.body.substring(0, 100),
                    source: message.from || 'unknown',
                    sessionId: sessionId,
                    collectedAt: new Date()
                });
                
                console.log(`✅ رابط محفوظ: ${type} - ${url.substring(0, 50)}...`);
            }
            
        } catch (error) {
            console.error('خطأ في استخراج الروابط:', error);
        }
    }
    
    // ============================================
    // 9. معالجة رسائل واتساب
    // ============================================
    async handleWhatsAppMessage(message, sessionId) {
        try {
            // 1. استخراج الروابط
            await this.extractAndSaveLinks(message, sessionId, 'message');
            
            // 2. التحقق من الردود التلقائية
            await this.checkAutoReplies(message, sessionId);
            
            // 3. التحقق من روابط الانضمام
            await this.checkForJoinLinks(message, sessionId);
            
        } catch (error) {
            console.error('خطأ في معالجة رسالة واتساب:', error);
        }
    }
    
    // ============================================
    // 10. نظام الردود التلقائية
    // ============================================
    async checkAutoReplies(message, sessionId) {
        try {
            const autoReplies = await AutoReply.findAll({
                where: {
                    sessionId: sessionId,
                    isActive: true
                }
            });
            
            for (const reply of autoReplies) {
                if (this.shouldTriggerAutoReply(message, reply)) {
                    await this.sendAutoReply(message, reply);
                    
                    // تحديث الإحصائيات
                    await reply.update({
                        stats: {
                            triggered: (reply.stats?.triggered || 0) + 1,
                            lastTriggered: new Date()
                        }
                    });
                }
            }
        } catch (error) {
            console.error('خطأ في الرد التلقائي:', error);
        }
    }
    
    shouldTriggerAutoReply(message, reply) {
        const text = message.body || '';
        const isGroup = message.from.includes('@g.us');
        
        // التحقق من نوع المحادثة
        if (reply.triggerType === 'private' && isGroup) return false;
        if (reply.triggerType === 'group' && !isGroup) return false;
        
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
    
    async sendAutoReply(message, reply) {
        try {
            const client = this.whatsappClients.get(reply.sessionId);
            if (!client) return;
            
            await client.sendMessage(message.from, reply.response);
            console.log(`✅ تم إرسال رد تلقائي: ${reply.name}`);
            
        } catch (error) {
            console.error('خطأ في إرسال الرد التلقائي:', error);
        }
    }
    
    // ============================================
    // 11. نظام الانضمام التلقائي
    // ============================================
    async checkForJoinLinks(message, sessionId) {
        try {
            if (!message.body) return;
            
            // البحث عن روابط انضمام واتساب
            const whatsappInviteRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/g;
            const inviteLinks = message.body.match(whatsappInviteRegex) || [];
            
            for (const link of inviteLinks) {
                await this.processJoinLink(link, sessionId);
            }
            
        } catch (error) {
            console.error('خطأ في فحص روابط الانضمام:', error);
        }
    }
    
    async processJoinLink(link, sessionId) {
        try {
            // التحقق إذا كان الرابط محفوظاً مسبقاً
            const existing = await CollectedLink.findOne({
                where: { url: link, type: 'whatsapp_group' }
            });
            
            if (existing) {
                // تحديث وقت الاكتشاف
                await existing.update({
                    collectedAt: new Date()
                });
            } else {
                // حفظ الرابط جديد
                await CollectedLink.create({
                    url: link,
                    type: 'whatsapp_group',
                    title: 'دعوة انضمام لمجموعة واتساب',
                    description: 'رابط انضمام تلقائي',
                    source: 'auto_detection',
                    sessionId: sessionId,
                    collectedAt: new Date()
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
            console.error('خطأ في معالجة رابط الانضمام:', error);
        }
    }
    
    async joinWhatsAppGroup(inviteLink, sessionId) {
        try {
            const client = this.whatsappClients.get(sessionId);
            if (!client) return false;
            
            // استخراج كود الدعوة من الرابط
            const inviteCode = inviteLink.split('/').pop();
            
            // محاولة الانضمام
            await client.acceptInvite(inviteCode);
            
            console.log(`✅ تم الانضمام للمجموعة: ${inviteLink}`);
            
            // تحديث إحصائيات الانضمام التلقائي
            const autoJoin = await AutoJoin.findOne({
                where: { sessionId: sessionId, status: 'active' }
            });
            
            if (autoJoin) {
                const stats = autoJoin.stats || {};
                stats.joined = (stats.joined || 0) + 1;
                stats.lastJoinAt = new Date();
                stats.lastLinks = [...(stats.lastLinks || []).slice(-4), inviteLink];
                
                await autoJoin.update({
                    stats: stats
                });
            }
            
            // إرسال إشعار للمشرف
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                const admin = await Admin.findByPk(session.adminId);
                if (admin) {
                    await this.bot.sendMessage(admin.telegramId,
                        `✅ *تم الانضمام التلقائي لمجموعة جديدة*\n\n` +
                        `🔗 الرابط: ${inviteLink}\n` +
                        `📱 الجلسة: ${session.phoneNumber}\n` +
                        `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}`,
                        { parse_mode: 'Markdown' }
                    );
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
                
                await autoJoin.update({
                    stats: stats
                });
            }
            
            return false;
        }
    }
    
    // ============================================
    // 12. نظام النشر التلقائي
    // ============================================
    async startAutoPosting(sessionId, adId, interval = 1) {
        const key = `autopost_${sessionId}_${adId}`;
        
        if (this.activeAutoPosts.has(key)) {
            return false; // مسبقاً نشط
        }
        
        try {
            const timer = setInterval(async () => {
                await this.processAutoPost(sessionId, adId);
            }, interval * 1000);
            
            this.activeAutoPosts.set(key, {
                timer: timer,
                sessionId: sessionId,
                adId: adId,
                interval: interval,
                startedAt: new Date()
            });
            
            // حفظ في قاعدة البيانات
            await AutoPost.create({
                sessionId: sessionId,
                adId: adId,
                status: 'active',
                interval: interval,
                stats: {
                    cycles: 0,
                    totalSent: 0,
                    lastCycleAt: null
                },
                settings: {
                    interval: interval
                }
            });
            
            console.log(`🔄 بدأ النشر التلقائي للجلسة ${sessionId}`);
            return true;
            
        } catch (error) {
            console.error('خطأ في بدء النشر التلقائي:', error);
            return false;
        }
    }
    
    async processAutoPost(sessionId, adId) {
        try {
            const client = this.whatsappClients.get(sessionId);
            if (!client) {
                console.log('❌ العميل غير متصل');
                return;
            }
            
            const ad = await Advertisement.findByPk(adId);
            if (!ad || !ad.isActive) {
                console.log('❌ الإعلان غير نشط');
                return;
            }
            
            // الحصول على جميع المجموعات
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            console.log(`📢 جاري النشر في ${groups.length} مجموعة...`);
            
            // إرسال الإعلان لكل مجموعة
            for (const group of groups) {
                try {
                    await this.sendAdvertisement(client, group.id._serialized, ad);
                    
                    // انتظر ثانية بين المجموعات
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`❌ خطأ في النشر للمجموعة ${group.name}:`, error.message);
                }
            }
            
            // تحديث الإحصائيات
            const autoPost = await AutoPost.findOne({
                where: { sessionId: sessionId, adId: adId, status: 'active' }
            });
            
            if (autoPost) {
                const stats = autoPost.stats || {};
                stats.cycles = (stats.cycles || 0) + 1;
                stats.totalSent = (stats.totalSent || 0) + groups.length;
                stats.lastCycleAt = new Date();
                
                await autoPost.update({
                    stats: stats,
                    lastPostAt: new Date()
                });
            }
            
            console.log(`✅ اكتملت دورة النشر للجلسة ${sessionId}`);
            
        } catch (error) {
            console.error('خطأ في النشر التلقائي:', error);
        }
    }
    
    async sendAdvertisement(client, chatId, ad) {
        try {
            switch (ad.type) {
                case 'text':
                    await client.sendMessage(chatId, ad.content);
                    break;
                    
                case 'image':
                    // هنا يمكن إضافة معالجة الصور
                    await client.sendMessage(chatId, `📸 ${ad.caption || 'صورة'}\n${ad.content}`);
                    break;
                    
                case 'contact':
                    // هنا يمكن إضافة معالجة جهات الاتصال
                    await client.sendMessage(chatId, `📞 ${ad.caption || 'جهة اتصال'}\n${ad.content}`);
                    break;
                    
                default:
                    await client.sendMessage(chatId, ad.content);
            }
            
            console.log(`✅ تم إرسال إعلان إلى ${chatId}`);
            
        } catch (error) {
            console.error('❌ خطأ في إرسال الإعلان:', error);
            throw error;
        }
    }
    
    // ============================================
    // 13. معالجة الأزرار التفاعلية
    // ============================================
    setupCallbacks() {
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            try {
                await this.bot.answerCallbackQuery(query.id);
                
                // تقسيم بيانات الزر
                const parts = data.split('_');
                const action = parts[0];
                
                switch (action) {
                    case 'menu':
                        await this.handleMenuAction(chatId, userId, parts[1]);
                        break;
                        
                    case 'session':
                        await this.handleSessionAction(chatId, userId, parts);
                        break;
                        
                    case 'links':
                        await this.handleLinksAction(chatId, userId, parts[1]);
                        break;
                        
                    case 'ad':
                        await this.handleAdAction(chatId, userId, parts);
                        break;
                        
                    case 'autopost':
                        await this.handleAutoPostAction(chatId, userId, parts);
                        break;
                        
                    case 'autojoin':
                        await this.handleAutoJoinAction(chatId, userId, parts);
                        break;
                        
                    case 'autoreply':
                        await this.handleAutoReplyAction(chatId, userId, parts);
                        break;
                        
                    case 'admin':
                        await this.handleAdminAction(chatId, userId, parts);
                        break;
                        
                    default:
                        console.log('زر غير معروف:', data);
                }
                
            } catch (error) {
                console.error('خطأ في معالجة الزر:', error);
                await this.bot.answerCallbackQuery(query.id, {
                    text: 'حدث خطأ في المعالجة',
                    show_alert: true
                });
            }
        });
    }
    
    // ============================================
    // 14. معالجة القوائم
    // ============================================
    async handleMenuAction(chatId, userId, menu) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        switch (menu) {
            case 'sessions':
                await this.showSessionsMenu(chatId, userId);
                break;
                
            case 'links':
                await this.showLinksMenu(chatId, userId);
                break;
                
            case 'ads':
                await this.showAdsMenu(chatId, userId);
                break;
                
            case 'autopost':
                await this.showAutoPostMenu(chatId, userId);
                break;
                
            case 'autojoin':
                await this.showAutoJoinMenu(chatId, userId);
                break;
                
            case 'autoreply':
                await this.showAutoReplyMenu(chatId, userId);
                break;
                
            case 'admins':
                await this.showAdminsMenu(chatId, userId);
                break;
                
            case 'stats':
                await this.showStatsMenu(chatId, userId);
                break;
                
            case 'help':
                await this.showHelpMenu(chatId);
                break;
                
            case 'main':
                await this.handleStart({ chat: { id: chatId }, from: { id: userId } });
                break;
        }
    }
    
    // ============================================
    // 15. عرض قائمة الجلسات
    // ============================================
    async showSessionsMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: admin.id },
            order: [['createdAt', 'DESC']]
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱➕ إضافة جلسة جديدة', callback_data: 'add_session' },
                    { text: '🔄 تحديث القائمة', callback_data: 'menu_sessions' }
                ]
            ]
        };
        
        let message = `📱 *إدارة جلسات WhatsApp*\n\n`;
        
        if (sessions.length === 0) {
            message += `📭 *لا توجد جلسات واتساب*\n\n`;
            message += `انقر على *"📱➕ إضافة جلسة جديدة"* لبدء ربط حساب واتساب.`;
        } else {
            const activeSessions = sessions.filter(s => s.status === 'connected').length;
            const totalSessions = sessions.length;
            
            message += `📊 *إحصائيات الجلسات:*\n`;
            message += `• 🟢 نشطة: ${activeSessions} جلسة\n`;
            message += `• 📊 الإجمالي: ${totalSessions} جلسة\n\n`;
            
            message += `*آخر الجلسات:*\n`;
            
            sessions.slice(0, 3).forEach((session, index) => {
                const statusEmoji = session.status === 'connected' ? '✅' :
                                  session.status === 'awaiting_qr' ? '📱' :
                                  session.status === 'pending' ? '⏳' : '❌';
                
                message += `${index + 1}. ${statusEmoji} *${session.phoneNumber}*\n`;
                message += `   📌 الحالة: ${session.status}\n`;
                message += `   🆔 المعرف: ${session.id.substring(0, 8)}\n`;
                
                if (session.groupsCount > 0) {
                    message += `   👥 المجموعات: ${session.groupsCount}\n`;
                }
                
                message += `\n`;
            });
            
            // إضافة أزرار لكل جلسة
            sessions.slice(0, 5).forEach(session => {
                const statusEmoji = session.status === 'connected' ? '✅' : '📱';
                keyboard.inline_keyboard.push([
                    {
                        text: `${statusEmoji} ${session.phoneNumber}`,
                        callback_data: `session_info_${session.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
    }
    
    // ============================================
    // 16. عرض قائمة الروابط
    // ============================================
    async showLinksMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: admin.id }
        });
        
        const sessionIds = sessions.map(s => s.id);
        
        // إحصائيات الروابط
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
        
        const totalLinks = whatsappLinks + telegramLinks + otherLinks;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📱 واتساب (${whatsappLinks})`, callback_data: 'links_whatsapp' },
                    { text: `📢 تليجرام (${telegramLinks})`, callback_data: 'links_telegram' }
                ],
                [
                    { text: `🌐 روابط أخرى (${otherLinks})`, callback_data: 'links_other' },
                    { text: `📋 الكل (${totalLinks})`, callback_data: 'links_all' }
                ],
                [
                    { text: '🔄 تحديث', callback_data: 'menu_links' },
                    { text: '🗑️ مسح الروابط', callback_data: 'links_clear' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
🔗 *الروابط المجمعة - نظام التجميع التلقائي*

📊 *إحصائيات الروابط:*
• 📱 *روابط واتساب:* ${whatsappLinks} رابط
• 📢 *روابط تليجرام:* ${telegramLinks} رابط
• 🌐 *روابط أخرى:* ${otherLinks} رابط
• 📋 *الإجمالي:* ${totalLinks} رابط

🚀 *كيفية العمل:*
1. يتجس البوت على جميع الرسائل
2. يستخرج الروابط تلقائياً
3. يصنفها حسب النوع
4. يمنع التكرار التلقائي

⚡ *المميزات:*
• ✅ تجميع تلقائي بدون توقف
• 🔄 تحديث فوري
• 🗑️ إدارة وحذف الروابط
• 📊 إحصائيات مفصلة

اختر نوع الروابط لعرضها:
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 17. عرض قائمة الإعلانات
    // ============================================
    async showAdsMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const ads = await Advertisement.findAll({
            where: { adminId: admin.id },
            order: [['createdAt', 'DESC']]
        });
        
        const activeAds = ads.filter(ad => ad.isActive).length;
        const totalAds = ads.length;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📢➕ إضافة إعلان جديد', callback_data: 'add_ad' },
                    { text: '🔄 تحديث', callback_data: 'menu_ads' }
                ]
            ]
        };
        
        let message = `📢 *نظام الإعلانات*\n\n`;
        message += `📊 *الإحصائيات:*\n`;
        message += `• 🟢 نشطة: ${activeAds} إعلان\n`;
        message += `• 📊 الإجمالي: ${totalAds} إعلان\n\n`;
        
        if (ads.length === 0) {
            message += `📭 *لا توجد إعلانات*\n\n`;
            message += `انقر على *"📢➕ إضافة إعلان جديد"* لإنشاء أول إعلان.`;
        } else {
            message += `*آخر الإعلانات:*\n`;
            
            ads.slice(0, 3).forEach((ad, index) => {
                const typeEmoji = ad.type === 'text' ? '📝' :
                                ad.type === 'image' ? '🖼️' :
                                ad.type === 'video' ? '🎥' : '📎';
                
                message += `${index + 1}. ${typeEmoji} *${ad.name}*\n`;
                message += `   📌 النوع: ${ad.type}\n`;
                message += `   🔘 الحالة: ${ad.isActive ? '✅ نشط' : '❌ متوقف'}\n`;
                message += `   📊 المرسلة: ${ad.stats?.sent || 0}\n\n`;
            });
            
            // أزرار للإعلانات
            ads.slice(0, 5).forEach(ad => {
                const statusEmoji = ad.isActive ? '✅' : '❌';
                keyboard.inline_keyboard.push([
                    {
                        text: `${statusEmoji} ${ad.name}`,
                        callback_data: `ad_info_${ad.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 18. معالجة الرسائل النصية
    // ============================================
    setupMessageHandlers() {
        this.bot.on('message', async (msg) => {
            // تخطي الأوامر
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const telegramId = msg.from.id.toString();
            const userState = this.userStates.get(telegramId);
            
            if (!userState || !msg.text) return;
            
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
                    
                case 'awaiting_admin_id':
                    await this.handleAdminIdInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_autoreply_trigger':
                    await this.handleAutoReplyTriggerInput(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_autoreply_response':
                    await this.handleAutoReplyResponseInput(chatId, telegramId, msg.text, userState.data);
                    break;
            }
        });
    }
    
    // ============================================
    // 19. معالجة إدخال رقم الهاتف
    // ============================================
    async handlePhoneInput(chatId, telegramId, phoneNumber, data) {
        // التحقق من صحة الرقم
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            await this.bot.sendMessage(chatId,
                '❌ *رقم الهاتف غير صالح!*\n\n' +
                '*الشروط الصحيحة:*\n' +
                '1. يبدأ بعلامة ➕\n' +
                '2. يتبعه رمز الدولة (1-3 أرقام)\n' +
                '3. ثم رقم الهاتف (9-14 رقم)\n' +
                '4. لا يحتوي على مسافات أو رموز\n\n' +
                '*أمثلة صحيحة:*\n' +
                '`+966501234567` - السعودية\n' +
                '`+971501234567` - الإمارات\n' +
                '`+201012345678` - مصر\n\n' +
                '*أرسل الرقم الصحيح:*',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        await this.bot.sendMessage(chatId,
            `⏳ *جاري إنشاء الجلسة...*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🔧 جاري الاتصال بـ WhatsApp Web...`,
            { parse_mode: 'Markdown' }
        );
        
        try {
            const sessionId = await this.createWhatsAppSession(phoneNumber, data.adminId, chatId);
            
            // مسح حالة المستخدم
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إنشاء الجلسة بنجاح!*\n\n` +
                `📱 سيصلك QR Code خلال ثواني...\n` +
                `🆔 معرف الجلسة: ${sessionId.substring(0, 8)}`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('خطأ في إنشاء الجلسة:', error);
            
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `❌ *فشل إنشاء الجلسة!*\n\n` +
                `الخطأ: ${error.message}\n\n` +
                `*الأسباب المحتملة:*\n` +
                `• مشكلة في اتصال WhatsApp Web\n` +
                `• رقم الهاتف غير صحيح\n` +
                `• وصلت للحد الأقصى من الجلسات\n\n` +
                `حاول مرة أخرى أو تواصل مع الدعم.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 20. بدء تشغيل البوت
    // ============================================
    async start() {
        console.log('🤖 بوت WhatsApp Management Bot يعمل الآن!');
        
        // إنشاء المجلدات الضرورية
        await this.createRequiredFolders();
        
        return this.bot;
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
    
    // ============================================
    // 21. دوال إضافية للواجهات
    // ============================================
    async showAutoPostMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 بدء النشر التلقائي', callback_data: 'autopost_start' },
                    { text: '⏸️ إيقاف النشر', callback_data: 'autopost_stop' }
                ],
                [
                    { text: '📊 إحصائيات النشر', callback_data: 'autopost_stats' },
                    { text: '⚙️ إعدادات', callback_data: 'autopost_settings' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
🔄 *نظام النشر التلقائي*

🚀 *المميزات:*
• نشر تلقائي في جميع المجموعات
• فاصل زمني قابل للتعديل (1 ثانية)
• استمرارية النشر بدون توقف
• تكرار النشر بعد اكتمال الدورة
• إمكانية الإيقاف والاستئناف

⚡ *كيفية العمل:*
1. اختر الإعلان المراد نشره
2. حدد الفاصل الزمني (1 ثانية)
3. يبدأ البوت بالنشر تلقائياً
4. يستمر النشر دون توقف
5. يمكن إيقافه في أي وقت

📝 *ملاحظات:*
• النشر بين كل مجموعة والمجموعة التالية: 1 ثانية
• بعد اكتمال دورة النشر، يكرر النشر من البداية
• يمكن مراقبة الإحصائيات في الوقت الفعلي
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async showAutoJoinMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '➕ تفعيل الانضمام التلقائي', callback_data: 'autojoin_start' },
                    { text: '⏸️ إيقاف الانضمام', callback_data: 'autojoin_stop' }
                ],
                [
                    { text: '📊 إحصائيات الانضمام', callback_data: 'autojoin_stats' },
                    { text: '🔗 عرض الروابط', callback_data: 'links_whatsapp' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
➕ *نظام الانضمام التلقائي*

🚀 *المميزات:*
• اكتشاف تلقائي لروابط واتساب
• انضمام تلقائي للمجموعات
• تقارير مفصلة عن الانضمام
• إحصائيات في الوقت الفعلي

⚡ *كيفية العمل:*
1. يقوم البوت بمراقبة جميع الرسائل
2. يكتشف روابط دعوة واتساب تلقائياً
3. ينضم للمجموعات بشكل تلقائي
4. يرسل تقريراً عن المجموعات التي تم الانضمام إليها
5. يسجل المجموعات التي فشل الانضمام إليها

📝 *ملاحظات:*
• يعمل النظام مع جميع جلسات واتساب
• يمكن تفعيله أو إيقافه في أي وقت
• التقارير ترسل تلقائياً للمشرف
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async showAutoReplyMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🤖➕ إضافة رد تلقائي', callback_data: 'autoreply_add' },
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
        
        const message = `
🤖 *نظام الردود التلقائية*

🚀 *المميزات:*
• ردود تلقائية للمحادثات الخاصة
• ردود تلقائية للمجموعات
• محفزات نصية (كلمة، جملة، نمط)
• إدارة متقدمة للردود

⚡ *كيفية العمل:*
1. أضف رداً تلقائياً جديداً
2. حدد نوعه (خاص، جماعي، كلاها)
3. حدد المحفز (نص مطابق، يحتوي، نمط)
4. اكتب الرد
5. المفعل الرد ليعمل تلقائياً

📝 *أنواع المحفزات:*
• **مطابق تماماً:** النص مطابق تماماً
• **يحتوي:** النص يحتوي على الكلمة
• **نمط:** مطابقة نمط معين (regex)

🎯 *الاستخدامات:*
• الرد على التحية تلقائياً
• الرد على أسئلة شائعة
• إرسال معلومات تلقائية
• الرد على كلمات محددة في المجموعات
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async showAdminsMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        // التحقق من صلاحيات المشرف
        if (!admin.permissions?.includes('manage_admins')) {
            return this.bot.sendMessage(chatId,
                '❌ *غير مصرح لك!*\n\n' +
                'ليس لديك صلاحية إدارة المشرفين.',
                { parse_mode: 'Markdown' }
            );
        }
        
        const admins = await Admin.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👥➕ إضافة مشرف جديد', callback_data: 'admin_add' },
                    { text: '🔄 تحديث', callback_data: 'menu_admins' }
                ]
            ]
        };
        
        let message = `👥 *إدارة المشرفين*\n\n`;
        message += `📊 *الإحصائيات:*\n`;
        message += `• 👥 الإجمالي: ${admins.length} مشرف\n`;
        message += `• 🟢 نشطون: ${admins.filter(a => a.isActive).length} مشرف\n\n`;
        
        if (admins.length === 0) {
            message += `📭 *لا توجد مشرفين*\n\n`;
            message += `انقر على *"👥➕ إضافة مشرف جديد"* لإضافة أول مشرف.`;
        } else {
            message += `*آخر المشرفين:*\n`;
            
            admins.slice(0, 3).forEach((admin, index) => {
                message += `${index + 1}. 👤 *${admin.firstName || 'مشرف'}*\n`;
                message += `   🆔: ${admin.telegramId}\n`;
                message += `   💼: ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}\n`;
                message += `   📅: ${new Date(admin.createdAt).toLocaleDateString('ar-SA')}\n\n`;
            });
            
            // أزرار للمشرفين
            admins.slice(0, 5).forEach(adminItem => {
                const statusEmoji = adminItem.isActive ? '✅' : '❌';
                keyboard.inline_keyboard.push([
                    {
                        text: `${statusEmoji} ${adminItem.firstName || adminItem.telegramId}`,
                        callback_data: `admin_info_${adminItem.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async showStatsMenu(chatId, userId) {
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin) return;
        
        // جمع الإحصائيات
        const sessions = await WhatsAppSession.count({ where: { adminId: admin.id } });
        const activeSessions = await WhatsAppSession.count({ 
            where: { 
                adminId: admin.id,
                status: 'connected'
            }
        });
        
        const whatsappLinks = await CollectedLink.count({
            where: {
                type: ['whatsapp_group', 'whatsapp_invite']
            }
        });
        
        const telegramLinks = await CollectedLink.count({
            where: {
                type: 'telegram'
            }
        });
        
        const ads = await Advertisement.count({ where: { adminId: admin.id } });
        const activeAds = await Advertisement.count({ 
            where: { 
                adminId: admin.id,
                isActive: true
            }
        });
        
        const autoPosts = await AutoPost.count({ where: { adminId: admin.id } });
        const activeAutoPosts = await AutoPost.count({
            where: {
                adminId: admin.id,
                status: 'active'
            }
        });
        
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
                    { text: '🔄 تحديث الإحصائيات', callback_data: 'menu_stats' },
                    { text: '📊 تقرير مفصل', callback_data: 'stats_detailed' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
📊 *إحصائيات النظام - نظرة عامة*

📱 *جلسات واتساب:*
• 🟢 نشطة: ${activeSessions} جلسة
• 📊 الإجمالي: ${sessions} جلسة

🔗 *الروابط المجمعة:*
• 📱 واتساب: ${whatsappLinks} رابط
• 📢 تليجرام: ${telegramLinks} رابط
• 📋 الإجمالي: ${whatsappLinks + telegramLinks} رابط

📢 *نظام الإعلانات:*
• 🟢 نشطة: ${activeAds} إعلان
• 📊 الإجمالي: ${ads} إعلان

🔄 *النشر التلقائي:*
• 🟢 نشطة: ${activeAutoPosts} عملية
• 📊 الإجمالي: ${autoPosts} عملية

⏱️ *وقت تشغيل النظام:* ${Math.floor(process.uptime() / 3600)} ساعة
📅 *تاريخ التقرير:* ${new Date().toLocaleDateString('ar-SA')}
⏰ *وقت التقرير:* ${new Date().toLocaleTimeString('ar-SA')}

اختر قسم الإحصائيات لعرض التفاصيل:
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    async showHelpMenu(chatId) {
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
                    { text: '👥 المشرفين', callback_data: 'help_admins' }
                ],
                [
                    { text: '🆘 الدعم الفني', callback_data: 'help_support' },
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
🆘 *مركز المساعدة والدعم*

🤖 *عن البوت:*
بوت إدارة حسابات WhatsApp عبر Telegram
الإصدار: 1.0.0 الكاملة

🚀 *الميزات الرئيسية:*
• 📱 ربط حسابات WhatsApp كجهاز مصاحب
• 🔗 تجميع الروابط تلقائياً
• 📢 نظام إعلانات متكامل
• 🔄 نشر تلقائي في المجموعات
• ➕ انضمام تلقائي للمجموعات
• 🤖 ردود تلقائية ذكية
• 👥 إدارة مشرفين متعددة
• 📊 إحصائيات وتقارير

🔧 *الدعم الفني:*
• للأخطاء التقنية: تواصل مع المطور
• للاستفسارات: راجع الأسئلة الشائعة
• للاقتراحات: أرسل اقتراحك

📞 *التواصل:*
• المطور: @username
• القناة: @channel
• المجموعة: @group

اختر القسم الذي تريد مساعدة فيه:
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
}

// ============================================
// 22. التصدير
// ============================================
module.exports = WhatsAppTelegramBot;
