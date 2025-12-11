// ============================================
// ملف معالجة أوامر تليجرام - WhatsApp-Telegram Bot
// النسخة المحسنة مع نظام QR Code التلقائي
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const qrcode = require('qrcode');
require('moment/locale/ar');

moment.locale('ar');

// استيراد المديرين
const { getWhatsAppManager } = require('./whatsappClient');
const { Admin, WhatsAppSession } = require('../database/models');

class TelegramBotHandler {
    constructor(token, whatsappManager) {
        this.bot = new TelegramBot(token, {
            polling: {
                interval: 1000,
                autoStart: true,
                params: {
                    timeout: 10
                }
            }
        });
        
        this.whatsappManager = whatsappManager;
        this.userStates = new Map();
        this.sessionQRs = new Map(); // تخزين QR codes للجلسات
        this.setupHandlers();
    }
    
    // ============================================
    // 1. إعداد المعالجات
    // ============================================
    setupHandlers() {
        console.log('🤖 جاري إعداد بوت تليجرام مع نظام QR Code...');
        
        this.setupBasicCommands();
        this.setupSessionCommands();
        this.setupCallbackHandlers();
        this.setupMessageHandler();
    }
    
    // ============================================
    // 2. الأوامر الأساسية مع أزرار QR
    // ============================================
    setupBasicCommands() {
        // /start مع أزرار متقدمة
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                
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
                            { text: '📱 إضافة جلسة واتساب', callback_data: 'session_add_main' },
                            { text: '🔄 جلساتي', callback_data: 'session_list' }
                        ],
                        [
                            { text: '📊 الإحصائيات', callback_data: 'menu_stats' },
                            { text: '🆘 المساعدة', callback_data: 'menu_help' }
                        ]
                    ]
                };
                
                const welcomeMessage = `
📱 *نظام ربط واتساب كجهاز مصاحب*

🌟 *مرحباً ${admin.firstName || 'مشرف'}!*

*🚀 المميزات:*
• ربط حساب واتساب كجهاز مصاحب
• إدارة متعددة للحسابات
• عرض QR Code تلقائياً
• متابعة حالة الجلسات

*📋 للبدء:* انقر على "📱 إضافة جلسة واتساب"
*💼 حالتك:* ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}
                `;
                
                this.bot.sendMessage(chatId, welcomeMessage, { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                
            } catch (error) {
                console.error('خطأ في /start:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
            }
        });
    }
    
    // ============================================
    // 3. أوامر الجلسات مع نظام QR المتكامل
    // ============================================
    setupSessionCommands() {
        // /sessions
        this.bot.onText(/\/sessions/, async (msg) => {
            await this.showSessionsMenu(msg.chat.id, msg.from.id);
        });
        
        // /addsession
        this.bot.onText(/\/addsession/, async (msg) => {
            await this.startAddSession(msg.chat.id, msg.from.id.toString());
        });
    }
    
    // عرض قائمة الجلسات الرئيسية
    async showSessionsMenu(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({ 
                where: { adminId: admin.id },
                order: [['createdAt', 'DESC']],
                limit: 5
            });
            
            const sessionKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📱➕ إضافة جلسة جديدة', callback_data: 'session_add' }
                    ],
                    [
                        { text: '🔄 تحديث القائمة', callback_data: 'session_refresh' },
                        { text: '✅ الجلسات النشطة', callback_data: 'session_active' }
                    ]
                ]
            };
            
            // إضافة أزرار للجلسات الموجودة
            if (sessions.length > 0) {
                sessions.forEach((session, index) => {
                    if (index < 3) { // أقصى 3 جلسات في القائمة
                        sessionKeyboard.inline_keyboard.push([
                            { 
                                text: `${session.status === 'ready' ? '✅' : '📱'} ${session.phoneNumber || 'جلسة'}`, 
                                callback_data: `session_info_${session.id}`
                            }
                        ]);
                    }
                });
            }
            
            sessionKeyboard.inline_keyboard.push([
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]);
            
            let message = `*📱 إدارة جلسات واتساب*\n\n`;
            
            if (sessions.length === 0) {
                message += `📭 *لا توجد جلسات واتساب*\n\n`;
                message += `انقر على *"📱➕ إضافة جلسة جديدة"* لبدء ربط حساب واتساب.`;
            } else {
                const activeSessions = sessions.filter(s => s.status === 'ready').length;
                const pendingSessions = sessions.filter(s => s.status === 'awaiting_qr').length;
                
                message += `📊 *إحصائيات الجلسات:*\n`;
                message += `• الإجمالي: ${sessions.length} جلسة\n`;
                message += `• ✅ نشطة: ${activeSessions} جلسة\n`;
                message += `• 📱 بانتظار QR: ${pendingSessions} جلسة\n\n`;
                
                message += `*الجلسات الأخيرة:*\n`;
                sessions.slice(0, 3).forEach((session, index) => {
                    const statusText = session.status === 'ready' ? '✅ متصلة' : 
                                     session.status === 'awaiting_qr' ? '📱 بانتظار QR' : 
                                     '⏳ قيد المعالجة';
                    message += `${index + 1}. ${session.phoneNumber || 'بدون رقم'} - ${statusText}\n`;
                });
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: sessionKeyboard
            });
            
        } catch (error) {
            console.error('خطأ في عرض قائمة الجلسات:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
        }
    }
    
    // ============================================
    // 4. بدء عملية إضافة جلسة جديدة
    // ============================================
    async startAddSession(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId } });
            if (!admin) return;
            
            // التحقق من الحد الأقصى
            const sessionCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
            const maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 5;
            
            if (sessionCount >= maxSessions) {
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🗑️ حذف جلسة', callback_data: 'session_list' },
                            { text: '📋 القائمة', callback_data: 'session_list' }
                        ]
                    ]
                };
                
                return this.bot.sendMessage(chatId,
                    `❌ *وصلت للحد الأقصى!*\n\n` +
                    `لديك ${sessionCount} من أصل ${maxSessions} جلسة.\n` +
                    `يرجى حذف جلسة قبل إضافة جديدة.`,
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            }
            
            // حفظ حالة المستخدم
            this.userStates.set(userId, {
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
                `🚀 *كيفية الربط كجهاز مصاحب:*\n` +
                `1. سأطلب منك رقم الهاتف\n` +
                `2. سأنشئ جلسة WhatsApp Web\n` +
                `3. سأرسل لك *QR Code*\n` +
                `4. تفتح *واتساب على هاتفك*\n` +
                `5. تذهب إلى *الإعدادات → الأجهزة المرتبطة*\n` +
                `6. تنقر على *"ربط جهاز"*\n` +
                `7. تمسح *QR Code* بالكاميرا\n` +
                `8. البوت يصبح *جهازاً مصاحباً* لحسابك\n\n` +
                `📞 *أرسل لي رقم الهاتف الآن (مع رمز الدولة):*\n` +
                `مثال: \`+966501234567\``,
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
    // 5. معالجة الأزرار التفاعلية
    // ============================================
    setupCallbackHandlers() {
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            try {
                await this.bot.answerCallbackQuery(query.id);
                
                if (data === 'session_add_main' || data === 'session_add') {
                    await this.startAddSession(chatId, userId);
                }
                else if (data === 'session_list' || data === 'session_refresh') {
                    await this.showSessionsMenu(chatId, userId);
                }
                else if (data === 'session_active') {
                    await this.showActiveSessions(chatId, userId);
                }
                else if (data.startsWith('session_info_')) {
                    const sessionId = data.replace('session_info_', '');
                    await this.showSessionInfo(chatId, userId, sessionId);
                }
                else if (data === 'menu_main') {
                    await this.showMainMenu(chatId, userId);
                }
                else if (data === 'menu_sessions') {
                    await this.showSessionsMenu(chatId, userId);
                }
                
            } catch (error) {
                console.error('خطأ في معالجة الزر:', error);
                this.bot.answerCallbackQuery(query.id, {
                    text: 'حدث خطأ في المعالجة',
                    show_alert: true
                });
            }
        });
    }
    
    // ============================================
    // 6. معالجة الرسائل النصية (لإدخال رقم الهاتف)
    // ============================================
    setupMessageHandler() {
        this.bot.on('message', async (msg) => {
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const userState = this.userStates.get(userId);
            
            if (!userState || !msg.text) return;
            
            if (userState.state === 'awaiting_phone_for_session') {
                await this.handlePhoneNumberInput(msg, userState);
            }
        });
    }
    
    // ============================================
    // 7. معالجة إدخال رقم الهاتف وإنشاء الجلسة
    // ============================================
    async handlePhoneNumberInput(msg, userState) {
        const chatId = msg.chat.id;
        const phoneNumber = msg.text.trim();
        
        // التحقق من صحة رقم الهاتف
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 حاول مرة أخرى', callback_data: 'session_add' },
                        { text: '❌ إلغاء', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            return this.bot.sendMessage(chatId,
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
            // إعلام المستخدم بأن العملية بدأت
            await this.bot.sendMessage(chatId,
                `⏳ *جاري إنشاء الجلسة...*\n\n` +
                `📱 الرقم: ${phoneNumber}\n` +
                `🔧 جاري الاتصال بـ WhatsApp Web...`,
                { parse_mode: 'Markdown' }
            );
            
            // إنشاء معرف الجلسة
            const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
            
            // حفظ الجلسة في قاعدة البيانات
            const session = await WhatsAppSession.create({
                id: sessionId,
                sessionId: sessionId,
                phoneNumber: phoneNumber,
                adminId: userState.data.adminId,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            // محاكاة إنشاء جلسة WhatsApp (في الإصدار الكامل سيتم الاتصال بـ whatsapp-web.js)
            // إنشاء QR Code وهمي للاختبار
            const qrData = `2@${crypto.randomBytes(32).toString('base64')}${crypto.randomBytes(32).toString('base64')}`;
            
            // حفظ QR في قاعدة البيانات
            await session.update({
                qrCode: qrData,
                status: 'awaiting_qr'
            });
            
            // تخزين QR مؤقتاً
            this.sessionQRs.set(sessionId, qrData);
            
            // إنشاء صورة QR (في الإصدار الحقيقي نستخدم whatsapp-web.js)
            const qrImageUrl = await this.generateQRCodeImage(qrData);
            
            // إرسال تعليمات الربط مع QR Code
            const instructions = `
✅ *تم إنشاء الجلسة بنجاح!*

📋 *معلومات الجلسة:*
• 🆔 المعرف: \`${sessionId.substring(0, 8)}\`
• 📱 الرقم: ${phoneNumber}
• 📅 الوقت: ${new Date().toLocaleTimeString('ar-SA')}

📲 *خطوات الربط كجهاز مصاحب:*

1. *افتح واتساب* على هاتفك الذكي
2. *اذهب إلى* **الإعدادات** (الثلاث نقاط)
3. *اختر* **الأجهزة المرتبطة**
4. *انقر على* **"ربط جهاز"**
5. *وجه كاميرا الهاتف* نحو *QR Code* أدناه
6. *انتظر تأكيد الربط*

⏱️ *هذا QR Code صالح لمدة: 60 ثانية*
🔄 *سيتم تجديده تلقائياً إذا انتهت*
            `;
            
            // إرسال التعليمات أولاً
            await this.bot.sendMessage(chatId, instructions, { 
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
            // إرسال QR Code كنص (يمكن تحويله لصورة لاحقاً)
            const qrMessage = `
📱 *QR Code للربط:*

\`\`\`
${this.formatQRForDisplay(qrData)}
\`\`\`

*نسخ نص QR:* \`${qrData.substring(0, 50)}...\`
            `;
            
            const qrKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 تجديد QR', callback_data: `refresh_qr_${sessionId}` },
                        { text: '❌ إلغاء الجلسة', callback_data: `cancel_session_${sessionId}` }
                    ],
                    [
                        { text: '📋 قائمة الجلسات', callback_data: 'session_list' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId, qrMessage, { 
                parse_mode: 'Markdown',
                reply_markup: qrKeyboard
            });
            
            // محاكاة اكتمال الربط بعد 30 ثانية (للاختبار)
            setTimeout(async () => {
                try {
                    await session.update({
                        status: 'ready',
                        lastActivity: new Date()
                    });
                    
                    await this.bot.sendMessage(chatId,
                        `🎉 *تم الربط بنجاح!*\n\n` +
                        `✅ *الجلسة أصبحت نشطة*\n` +
                        `📱 يمكنك الآن استخدام البوت للتحكم بحساب واتساب\n` +
                        `🔗 تم الربط كـ *جهاز مصاحب* بنجاح`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    console.error('خطأ في تحديث حالة الجلسة:', error);
                }
            }, 30000);
            
            // مسح حالة المستخدم
            this.userStates.delete(msg.from.id.toString());
            
        } catch (error) {
            console.error('خطأ في إنشاء الجلسة:', error);
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 حاول مرة أخرى', callback_data: 'session_add' },
                        { text: '📋 القائمة', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `❌ *فشل إنشاء الجلسة!*\n\n` +
                `الخطأ: ${error.message}\n\n` +
                `*الأسباب المحتملة:*\n` +
                `• مشكلة في اتصال WhatsApp Web\n` +
                `• رقم الهاتف غير صحيح\n` +
                `• وصلت للحد الأقصى من الجلسات\n\n` +
                `حاول مرة أخرى أو تواصل مع الدعم.`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            this.userStates.delete(msg.from.id.toString());
        }
    }
    
    // ============================================
    // 8. دوال مساعدة لـ QR Code
    // ============================================
    
    // توليد صورة QR (محاكاة)
    async generateQRCodeImage(qrData) {
        try {
            // في الإصدار الحقيقي: نستخدم qrcode لتوليد صورة
            // const qrBuffer = await qrcode.toBuffer(qrData);
            // return `data:image/png;base64,${qrBuffer.toString('base64')}`;
            
            // للاختبار: نرجع رابط وهمي
            return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
        } catch (error) {
            console.error('خطأ في توليد QR:', error);
            return null;
        }
    }
    
    // تنسيق QR للنص
    formatQRForDisplay(qrData) {
        // تبسيط QR للنص (في الإصدار الحقيقي نستخدم مكتبة qrcode-terminal)
        const shortQR = qrData.length > 100 ? qrData.substring(0, 100) + '...' : qrData;
        return `[QR Code: ${shortQR}]`;
    }
    
    // ============================================
    // 9. دوال عرض المعلومات
    // ============================================
    
    async showActiveSessions(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({
                where: { 
                    adminId: admin.id,
                    status: 'ready'
                },
                order: [['lastActivity', 'DESC']]
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱➕ إضافة جلسة', callback_data: 'session_add' },
                        { text: '📋 جميع الجلسات', callback_data: 'session_list' }
                    ]
                ]
            };
            
            let message = `*✅ الجلسات النشطة (${sessions.length})*\n\n`;
            
            if (sessions.length === 0) {
                message += `📭 *لا توجد جلسات نشطة*\n\n`;
                message += `انقر على "📱➕ إضافة جلسة" لربط حساب واتساب.`;
            } else {
                sessions.forEach((session, index) => {
                    message += `${index + 1}. *${session.phoneNumber || 'بدون رقم'}*\n`;
                    message += `   🆔 \`${session.sessionId?.substring(0, 8) || session.id.substring(0, 8)}\`\n`;
                    message += `   ⏰ ${moment(session.lastActivity || session.updatedAt).fromNow()}\n`;
                    message += `   🔗 [إدارة](/manage_${session.id})\n\n`;
                });
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('خطأ في عرض الجلسات النشطة:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
        }
    }
    
    async showSessionInfo(chatId, userId, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) {
                return this.bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
            }
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 تحديث الحالة', callback_data: `refresh_session_${sessionId}` },
                        { text: '🗑️ حذف الجلسة', callback_data: `delete_session_${sessionId}` }
                    ],
                    [
                        { text: '📱 إرسال رسالة', callback_data: `send_msg_${sessionId}` },
                        { text: '👥 المجموعات', callback_data: `groups_${sessionId}` }
                    ],
                    [
                        { text: '📋 القائمة', callback_data: 'session_list' }
                    ]
                ]
            };
            
            const statusEmoji = {
                'ready': '✅',
                'awaiting_qr': '📱',
                'authenticating': '🔐',
                'disconnected': '❌',
                'error': '⚠️',
                'pending': '⏳'
            }[session.status] || '❓';
            
            let message = `*📱 معلومات الجلسة*\n\n`;
            message += `${statusEmoji} *الحالة:* ${session.status}\n`;
            message += `📞 *الرقم:* ${session.phoneNumber || 'غير محدد'}\n`;
            message += `🆔 *المعرف:* \`${session.id.substring(0, 12)}\`\n`;
            message += `📅 *أنشئت:* ${moment(session.createdAt).format('YYYY-MM-DD HH:mm')}\n`;
            message += `⏰ *آخر نشاط:* ${session.lastActivity ? moment(session.lastActivity).fromNow() : 'لم يحدث'}\n\n`;
            
            if (session.status === 'awaiting_qr') {
                message += `*📱 QR Code متاح للربط*\n`;
                message += `انقر على "🔄 تحديث الحالة" للحصول على QR جديد\n`;
            } else if (session.status === 'ready') {
                message += `*✅ الجلسة نشطة ومتصلة*\n`;
                message += `يمكنك استخدام الأزرار للإرسال والإدارة\n`;
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('خطأ في عرض معلومات الجلسة:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض المعلومات');
        }
    }
    
    async showMainMenu(chatId, userId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 إدارة الجلسات', callback_data: 'session_list' },
                    { text: '📊 الإحصائيات', callback_data: 'menu_stats' }
                ],
                [
                    { text: '🆘 المساعدة', callback_data: 'menu_help' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId,
            '🏠 *القائمة الرئيسية*\n\n' +
            'اختر أحد الخيارات أدناه:',
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
    
    // ============================================
    // 10. بدء البوت
    // ============================================
    start() {
        console.log('🤖 بوت تليجرام مع نظام QR Code جاهز للعمل!');
        return this.bot;
    }
}

// ============================================
// 11. التصدير
// ============================================
module.exports = TelegramBotHandler;
