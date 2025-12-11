// ============================================
// ملف معالجة أوامر تليجرام - WhatsApp-Telegram Bot
// النسخة المحسنة مع نظام الأزرار التفاعلية
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
require('moment/locale/ar');

moment.locale('ar');

// استيراد المديرين
const { getWhatsAppManager } = require('./whatsappClient');
const { Admin, Advertisement, AutoReply, CollectedLink, WhatsAppSession } = require('../database/models');

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
        this.userStates = new Map(); // لحفظ حالة المستخدمين
        this.activeAutoPosts = new Map(); // للنشر التلقائي النشط
        this.setupHandlers();
    }
    
    // ============================================
    // 1. إعداد معالجات الأوامر والأزرار
    // ============================================
    setupHandlers() {
        console.log('🤖 جاري إعداد معالجات بوت تليجرام مع الأزرار...');
        
        // أوامر الأساسية
        this.setupBasicCommands();
        
        // أوامر الجلسات
        this.setupSessionCommands();
        
        // أوامر الروابط
        this.setupLinkCommands();
        
        // أوامر الإعلانات
        this.setupAdCommands();
        
        // أوامر النشر التلقائي
        this.setupAutoPostCommands();
        
        // أوامر الانضمام التلقائي
        this.setupJoinCommands();
        
        // أوامر الردود التلقائية
        this.setupAutoReplyCommands();
        
        // معالجة الأزرار التفاعلية
        this.setupCallbackHandlers();
        
        // معالجة الوسائط
        this.setupMediaHandlers();
        
        // معالجة الرسائل النصية
        this.setupMessageHandler();
    }
    
    // ============================================
    // 2. الأوامر الأساسية مع أزرار
    // ============================================
    setupBasicCommands() {
        // /start
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
                            { text: '📱 الجلسات', callback_data: 'menu_sessions' },
                            { text: '🔗 الروابط', callback_data: 'menu_links' }
                        ],
                        [
                            { text: '📢 الإعلانات', callback_data: 'menu_ads' },
                            { text: '🚀 النشر التلقائي', callback_data: 'menu_autopost' }
                        ],
                        [
                            { text: '👥 الانضمام', callback_data: 'menu_join' },
                            { text: '🤖 الردود', callback_data: 'menu_autoreply' }
                        ],
                        [
                            { text: '📊 الإحصائيات', callback_data: 'menu_stats' },
                            { text: '🆘 المساعدة', callback_data: 'menu_help' }
                        ]
                    ]
                };
                
                const welcomeMessage = `
🌟 *مرحباً ${admin.firstName || 'مشرف'}!* 🌟

*🤖 بوت إدارة واتساب عبر تليجرام*

*📋 الأوامر المتاحة عبر الأزرار أدناه:*

• 📱 **الجلسات**: إدارة جلسات واتساب
• 🔗 **الروابط**: عرض الروابط المجمعة
• 📢 **الإعلانات**: إدارة الإعلانات
• 🚀 **النشر التلقائي**: نشر تلقائي في المجموعات
• 👥 **الانضمام**: الانضمام التلقائي للمجموعات
• 🤖 **الردود**: الردود التلقائية
• 📊 **الإحصائيات**: إحصائيات النظام
• 🆘 **المساعدة**: مركز المساعدة

*💼 حالتك:* ${admin.isActive ? '✅ نشط' : '❌ غير نشط'}
*🎫 الصلاحيات:* ${admin.permissions.join(', ')}
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
        
        // /help - مع أزرار
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            
            const helpKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 الجلسات', callback_data: 'menu_sessions' },
                        { text: '🔗 الروابط', callback_data: 'menu_links' }
                    ],
                    [
                        { text: '📢 الإعلانات', callback_data: 'menu_ads' },
                        { text: '🚀 النشر التلقائي', callback_data: 'menu_autopost' }
                    ],
                    [
                        { text: '👥 الانضمام', callback_data: 'menu_join' },
                        { text: '🤖 الردود', callback_data: 'menu_autoreply' }
                    ],
                    [
                        { text: '📊 الإحصائيات', callback_data: 'menu_stats' },
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            const helpMessage = `
*🆘 مركز المساعدة*

*🔗 الأوامر الأساسية:*
/start - بدء استخدام البوت
/help - عرض هذه الرسالة
/stats - إحصائيات النظام

*📱 إدارة الجلسات:*
• عرض جميع الجلسات
• إضافة جلسة جديدة
• عرض QR code
• حذف جلسة

*🔗 جمع الروابط:*
• عرض جميع الروابط
• روابط واتساب فقط
• روابط تليجرام فقط
• تصدير الروابط

*📢 إدارة الإعلانات:*
• عرض جميع الإعلانات
• إضافة إعلان جديد
• تعديل إعلان
• حذف إعلان

*🚀 النشر التلقائي:*
• بدء النشر التلقائي
• إيقاف النشر التلقائي
• عرض قائمة النشر
• ضبط الفترة الزمنية

*👥 الانضمام التلقائي:*
• تفعيل/تعطيل الانضمام
• إحصائيات الانضمام
• اختبار الروابط
• عرض المجموعات

*🤖 الردود التلقائية:*
• عرض الردود
• إضافة رد جديد
• تعديل رد
• حذف رد

*📞 الدعم الفني:*
للإبلاغ عن مشاكل أو اقتراحات
            `;
            
            this.bot.sendMessage(chatId, helpMessage, { 
                parse_mode: 'Markdown',
                reply_markup: helpKeyboard
            });
        });
        
        // /stats - مع أزرار
        this.bot.onText(/\/stats/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const stats = this.whatsappManager.getStats();
                const totalLinks = await CollectedLink.count();
                const totalAds = await Advertisement.count();
                const totalReplies = await AutoReply.count();
                
                const statsKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔄 تحديث', callback_data: 'stats_refresh' },
                            { text: '📊 تفاصيل', callback_data: 'stats_details' }
                        ],
                        [
                            { text: '📱 جلسات', callback_data: 'stats_sessions' },
                            { text: '🔗 روابط', callback_data: 'stats_links' }
                        ],
                        [
                            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                        ]
                    ]
                };
                
                const statsMessage = `
📊 *إحصائيات النظام*

*📱 جلسات واتساب:*
• الإجمالي: ${stats.totalSessions}
• النشطة: ${stats.readySessions}
• قيد الانتظار: ${stats.sessionsByStatus?.awaiting_qr || 0}
• متصلة: ${stats.sessionsByStatus?.ready || 0}

*🔗 الروابط المجمعة:*
• الإجمالي: ${totalLinks}
• روابط واتساب: ${await CollectedLink.count({ where: { category: 'whatsapp' } })}
• روابط تليجرام: ${await CollectedLink.count({ where: { category: 'telegram' } })}

*📢 الإعلانات:*
• الإجمالي: ${totalAds}
• النشطة: ${await Advertisement.count({ where: { isActive: true } })}

*🤖 الردود التلقائية:*
• الإجمالي: ${totalReplies}
• النشطة: ${await AutoReply.count({ where: { isActive: true } })}

*👥 المشرفين:*
• الإجمالي: ${await Admin.count()}
• النشطون: ${await Admin.count({ where: { isActive: true } })}

*⏱️ وقت التشغيل:* ${Math.floor(process.uptime() / 3600)} ساعة
                `;
                
                this.bot.sendMessage(chatId, statsMessage, { 
                    parse_mode: 'Markdown',
                    reply_markup: statsKeyboard
                });
                
            } catch (error) {
                console.error('خطأ في /stats:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في جلب الإحصائيات');
            }
        });
    }
    
    // ============================================
    // 3. أوامر الجلسات مع أزرار
    // ============================================
    setupSessionCommands() {
        // /sessions
        this.bot.onText(/\/sessions/, async (msg) => {
            await this.showSessionsMenu(msg.chat.id, msg.from.id);
        });
    }
    
    // عرض قائمة الجلسات مع الأزرار
    async showSessionsMenu(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({ 
                where: { adminId: admin.id },
                order: [['createdAt', 'DESC']]
            });
            
            const sessionKeyboard = {
                inline_keyboard: [
                    [
                        { text: '➕ إضافة جلسة', callback_data: 'session_add' },
                        { text: '🔄 تحديث', callback_data: 'session_refresh' }
                    ],
                    [
                        { text: '📋 جميع الجلسات', callback_data: 'session_list' },
                        { text: '✅ النشطة فقط', callback_data: 'session_active' }
                    ],
                    [
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            let message = `*📱 إدارة جلسات واتساب*\n\n`;
            
            if (sessions.length === 0) {
                message += `📭 *لا توجد جلسات واتساب*\n\n`;
                message += `استخدم زر ➕ إضافة جلسة لبدء ربط حساب واتساب.`;
            } else {
                const activeSessions = sessions.filter(s => s.status === 'ready').length;
                message += `📊 *الإحصائيات:*\n`;
                message += `• الإجمالي: ${sessions.length} جلسة\n`;
                message += `• النشطة: ${activeSessions} جلسة\n`;
                message += `• قيد الانتظار: ${sessions.filter(s => s.status === 'awaiting_qr').length} جلسة\n\n`;
                message += `استخدم الأزرار أدناه للإدارة:`;
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
    
    // عرض الجلسات التفصيلي
    async showSessionsList(chatId, userId, filter = 'all') {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            let whereCondition = { adminId: admin.id };
            if (filter === 'active') {
                whereCondition.status = 'ready';
            } else if (filter === 'pending') {
                whereCondition.status = 'awaiting_qr';
            }
            
            const sessions = await WhatsAppSession.findAll({ 
                where: whereCondition,
                order: [['createdAt', 'DESC']],
                limit: 10
            });
            
            if (sessions.length === 0) {
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '➕ إضافة جلسة', callback_data: 'session_add' },
                            { text: '📋 القائمة', callback_data: 'session_list' }
                        ],
                        [
                            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                        ]
                    ]
                };
                
                return this.bot.sendMessage(chatId,
                    `📭 *لا توجد جلسات ${filter === 'active' ? 'نشطة' : ''}*\n\n` +
                    `استخدم زر ➕ إضافة جلسة لبدء ربط حساب واتساب.`,
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            }
            
            let message = `*📱 ${filter === 'active' ? 'الجلسات النشطة' : 'جميع الجلسات'} (${sessions.length})*\n\n`;
            
            sessions.forEach((session, index) => {
                const statusEmoji = {
                    'ready': '✅',
                    'awaiting_qr': '📱',
                    'authenticating': '🔐',
                    'disconnected': '❌',
                    'error': '⚠️',
                    'pending': '⏳'
                }[session.status] || '❓';
                
                message += `${index + 1}. ${statusEmoji} *${session.phoneNumber || 'بدون رقم'}*\n`;
                message += `   🆔 \`${session.sessionId?.substring(0, 8) || session.id.substring(0, 8)}\`\n`;
                message += `   📊 ${session.status}\n`;
                message += `   📅 ${moment(session.createdAt).fromNow()}\n`;
                
                if (session.status === 'ready') {
                    message += `   ⚡ [إرسال رسالة](/send_${session.id}) | `;
                    message += `[مجموعات](/groups_${session.id})\n`;
                } else if (session.status === 'awaiting_qr') {
                    message += `   📲 [عرض QR](/qr_${session.id})\n`;
                }
                
                message += `   🗑️ [حذف](/delete_${session.id})\n\n`;
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '➕ إضافة جلسة', callback_data: 'session_add' },
                        { text: '🔄 تحديث', callback_data: 'session_refresh' }
                    ],
                    [
                        { text: '✅ النشطة فقط', callback_data: 'session_active' },
                        { text: '📋 الكل', callback_data: 'session_list' }
                    ],
                    [
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            message += `\n📌 *استخدم الأزرار للإدارة:*`;
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('خطأ في عرض قائمة الجلسات:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
        }
    }
    
    // ============================================
    // 4. أوامر الروابط مع أزرار
    // ============================================
    setupLinkCommands() {
        // /links
        this.bot.onText(/\/links/, async (msg) => {
            await this.showLinksMenu(msg.chat.id, msg.from.id);
        });
    }
    
    // عرض قائمة الروابط
    async showLinksMenu(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const linksKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 روابط واتساب', callback_data: 'links_whatsapp' },
                        { text: '📢 روابط تليجرام', callback_data: 'links_telegram' }
                    ],
                    [
                        { text: '🌐 جميع المواقع', callback_data: 'links_websites' },
                        { text: '📊 الإحصائيات', callback_data: 'links_stats' }
                    ],
                    [
                        { text: '🔍 جمع جديد', callback_data: 'links_collect' },
                        { text: '📥 تصدير', callback_data: 'links_export' }
                    ],
                    [
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            const totalLinks = await CollectedLink.count();
            const whatsappLinks = await CollectedLink.count({ where: { category: 'whatsapp' } });
            const telegramLinks = await CollectedLink.count({ where: { category: 'telegram' } });
            
            let message = `*🔗 إدارة الروابط المجمعة*\n\n`;
            
            if (totalLinks === 0) {
                message += `🔍 *لا توجد روابط مجمعة بعد*\n\n`;
                message += `سيتم جمع الروابط تلقائياً من جلسات واتساب.`;
            } else {
                message += `📊 *الإحصائيات:*\n`;
                message += `• الإجمالي: ${totalLinks} رابط\n`;
                message += `• واتساب: ${whatsappLinks} رابط\n`;
                message += `• تليجرام: ${telegramLinks} رابط\n`;
                message += `• مواقع: ${totalLinks - whatsappLinks - telegramLinks} رابط\n\n`;
                message += `استخدم الأزرار أدناه للتصفية والإدارة:`;
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: linksKeyboard
            });
            
        } catch (error) {
            console.error('خطأ في عرض قائمة الروابط:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
        }
    }
    
    // ============================================
    // 5. أوامر الإعلانات مع أزرار
    // ============================================
    setupAdCommands() {
        // /ads
        this.bot.onText(/\/ads/, async (msg) => {
            await this.showAdsMenu(msg.chat.id, msg.from.id);
        });
    }
    
    // عرض قائمة الإعلانات
    async showAdsMenu(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const adsKeyboard = {
                inline_keyboard: [
                    [
                        { text: '➕ إضافة إعلان', callback_data: 'ad_add' },
                        { text: '📋 قائمة الإعلانات', callback_data: 'ad_list' }
                    ],
                    [
                        { text: '✅ النشطة', callback_data: 'ad_active' },
                        { text: '📊 إحصائيات', callback_data: 'ad_stats' }
                    ],
                    [
                        { text: '🚀 نشر تلقائي', callback_data: 'menu_autopost' },
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            const totalAds = await Advertisement.count({ where: { adminId: admin.id } });
            const activeAds = await Advertisement.count({ 
                where: { 
                    adminId: admin.id,
                    isActive: true 
                } 
            });
            
            let message = `*📢 إدارة الإعلانات*\n\n`;
            
            if (totalAds === 0) {
                message += `📭 *لا توجد إعلانات*\n\n`;
                message += `استخدم زر ➕ إضافة إعلان لبدء إنشاء إعلانك الأول.`;
            } else {
                message += `📊 *الإحصائيات:*\n`;
                message += `• الإجمالي: ${totalAds} إعلان\n`;
                message += `• النشطة: ${activeAds} إعلان\n\n`;
                
                // آخر 3 إعلانات
                const recentAds = await Advertisement.findAll({
                    where: { adminId: admin.id },
                    order: [['createdAt', 'DESC']],
                    limit: 3
                });
                
                message += `📌 *آخر الإعلانات:*\n`;
                recentAds.forEach((ad, index) => {
                    const typeEmoji = {
                        'text': '📝',
                        'image': '🖼️',
                        'video': '🎥',
                        'contact': '👤',
                        'document': '📄'
                    }[ad.type] || '📢';
                    
                    message += `${index + 1}. ${typeEmoji} ${ad.content.substring(0, 30)}...\n`;
                });
                
                message += `\nاستخدم الأزرار أدناه للإدارة:`;
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: adsKeyboard
            });
            
        } catch (error) {
            console.error('خطأ في عرض قائمة الإعلانات:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعلانات');
        }
    }
    
    // ============================================
    // 6. أوامر النشر التلقائي مع أزرار
    // ============================================
    setupAutoPostCommands() {
        // /autopost
        this.bot.onText(/\/autopost/, async (msg) => {
            await this.showAutoPostMenu(msg.chat.id, msg.from.id);
        });
    }
    
    // عرض قائمة النشر التلقائي
    async showAutoPostMenu(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const isActive = this.activeAutoPosts.has(admin.id);
            const activePost = isActive ? this.activeAutoPosts.get(admin.id) : null;
            
            const autopostKeyboard = {
                inline_keyboard: [
                    [
                        { text: isActive ? '🛑 إيقاف النشر' : '🚀 بدء النشر', 
                          callback_data: isActive ? 'autopost_stop' : 'autopost_start' }
                    ],
                    [
                        { text: '⚡ إعدادات الفاصل', callback_data: 'autopost_settings' },
                        { text: '📋 قائمة النشر', callback_data: 'autopost_list' }
                    ],
                    [
                        { text: '📢 الإعلانات', callback_data: 'menu_ads' },
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            let message = `*🚀 النشر التلقائي*\n\n`;
            
            if (isActive && activePost) {
                const ad = await Advertisement.findByPk(activePost.adId);
                const adContent = ad ? ad.content.substring(0, 50) + '...' : 'غير معروف';
                
                message += `✅ *الحالة:* نشط\n`;
                message += `📢 *الإعلان:* ${adContent}\n`;
                message += `⏱️ *الفاصل:* ${activePost.interval}ms\n`;
                message += `📅 *بدأ في:* ${moment(activePost.startedAt).fromNow()}\n`;
                message += `📨 *تم إرسال:* ${activePost.stats?.sent || 0}\n`;
                message += `❌ *فشل:* ${activePost.stats?.failed || 0}\n\n`;
                
                message += `🛑 استخدم زر إيقاف النشر لإيقافه.`;
            } else {
                message += `❌ *الحالة:* متوقف\n\n`;
                message += `🚀 استخدم زر بدء النشر لبدء النشر التلقائي.\n`;
                message += `📋 تأكد من وجود إعلانات نشطة أولاً.`;
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: autopostKeyboard
            });
            
        } catch (error) {
            console.error('خطأ في عرض قائمة النشر:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض حالة النشر');
        }
    }
    
    // ============================================
    // 7. أوامر الانضمام التلقائي مع أزرار
    // ============================================
    setupJoinCommands() {
        // /join
        this.bot.onText(/\/join/, async (msg) => {
            await this.showJoinMenu(msg.chat.id, msg.from.id);
        });
    }
    
    // عرض قائمة الانضمام
    async showJoinMenu(chatId, userId) {
        const isAutoJoinEnabled = process.env.AUTO_JOIN_ENABLED === 'true';
        
        const joinKeyboard = {
            inline_keyboard: [
                [
                    { text: isAutoJoinEnabled ? '❌ تعطيل الانضمام' : '✅ تفعيل الانضمام', 
                      callback_data: isAutoJoinEnabled ? 'join_disable' : 'join_enable' }
                ],
                [
                    { text: '🔗 اختبار رابط', callback_data: 'join_test' },
                    { text: '📊 إحصائيات', callback_data: 'join_stats' }
                ],
                [
                    { text: '👥 المجموعات', callback_data: 'join_groups' },
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        const message = `
*👥 الانضمام التلقائي للمجموعات*

✅ *الميزات المتاحة:*
• الانضمام التلقائي لروابط واتساب
• استخراج الروابط من الرسائل
• تجنب المجموعات المغلقة
• تسجيل النتائج

🔧 *الإعدادات الحالية:*
• الحالة: ${isAutoJoinEnabled ? '✅ مفعل' : '❌ معطل'}
• فحص كل: ${process.env.AUTO_JOIN_CHECK_INTERVAL || 30000}ms
• تأخير بين المحاولات: ${process.env.AUTO_JOIN_DELAY_BETWEEN || 2000}ms

📌 *استخدم الأزرار للتحكم:*
        `;
        
        this.bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: joinKeyboard
        });
    }
    
    // ============================================
    // 8. معالجة الأزرار التفاعلية
    // ============================================
    setupCallbackHandlers() {
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            try {
                // الرد على الاستعلام أولاً
                await this.bot.answerCallbackQuery(query.id);
                
                // معالجة البيانات حسب النوع
                if (data.startsWith('menu_')) {
                    await this.handleMenuActions(chatId, userId, data);
                } 
                else if (data.startsWith('session_')) {
                    await this.handleSessionActions(chatId, userId, data, query);
                }
                else if (data.startsWith('links_')) {
                    await this.handleLinkActions(chatId, userId, data);
                }
                else if (data.startsWith('ad_')) {
                    await this.handleAdActions(chatId, userId, data);
                }
                else if (data.startsWith('autopost_')) {
                    await this.handleAutoPostActions(chatId, userId, data);
                }
                else if (data.startsWith('join_')) {
                    await this.handleJoinActions(chatId, userId, data);
                }
                else if (data.startsWith('stats_')) {
                    await this.handleStatsActions(chatId, userId, data);
                }
                
            } catch (error) {
                console.error('خطأ في معالجة Callback:', error);
                this.bot.answerCallbackQuery(query.id, {
                    text: 'حدث خطأ في المعالجة',
                    show_alert: true
                });
            }
        });
    }
    
    // معالجة إجراءات القوائم
    async handleMenuActions(chatId, userId, action) {
        switch (action) {
            case 'menu_main':
            case 'menu_start':
                await this.bot.sendMessage(chatId, '🏠 *العودة للقائمة الرئيسية*', { parse_mode: 'Markdown' });
                // إعادة إرسال رسالة /start
                const msg = { chat: { id: chatId }, from: { id: userId } };
                this.bot.processUpdate({ message: msg });
                break;
                
            case 'menu_sessions':
                await this.showSessionsMenu(chatId, userId);
                break;
                
            case 'menu_links':
                await this.showLinksMenu(chatId, userId);
                break;
                
            case 'menu_ads':
                await this.showAdsMenu(chatId, userId);
                break;
                
            case 'menu_autopost':
                await this.showAutoPostMenu(chatId, userId);
                break;
                
            case 'menu_join':
                await this.showJoinMenu(chatId, userId);
                break;
                
            case 'menu_autoreply':
                // سيتم تنفيذها لاحقاً
                this.bot.sendMessage(chatId, '🤖 *قريباً: الردود التلقائية*', { parse_mode: 'Markdown' });
                break;
                
            case 'menu_stats':
                await this.bot.sendMessage(chatId, '📊 *جاري جلب الإحصائيات...*', { parse_mode: 'Markdown' });
                const msg2 = { chat: { id: chatId }, from: { id: userId } };
                this.bot.processUpdate({ message: msg2 });
                break;
                
            case 'menu_help':
                await this.bot.sendMessage(chatId, '🆘 *جاري تحميل المساعدة...*', { parse_mode: 'Markdown' });
                const msg3 = { chat: { id: chatId }, from: { id: userId } };
                this.bot.processUpdate({ message: msg3 });
                break;
        }
    }
    
    // معالجة إجراءات الجلسات
    async handleSessionActions(chatId, userId, action, query) {
        switch (action) {
            case 'session_add':
                await this.startAddSession(chatId, userId);
                break;
                
            case 'session_refresh':
                await this.showSessionsMenu(chatId, userId);
                break;
                
            case 'session_list':
                await this.showSessionsList(chatId, userId, 'all');
                break;
                
            case 'session_active':
                await this.showSessionsList(chatId, userId, 'active');
                break;
                
            case 'session_pending':
                await this.showSessionsList(chatId, userId, 'pending');
                break;
        }
    }
    
    // معالجة إجراءات الروابط
    async handleLinkActions(chatId, userId, action) {
        const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
        if (!admin) return;
        
        switch (action) {
            case 'links_whatsapp':
                await this.showLinksByCategory(chatId, admin.id, 'whatsapp');
                break;
                
            case 'links_telegram':
                await this.showLinksByCategory(chatId, admin.id, 'telegram');
                break;
                
            case 'links_websites':
                await this.showLinksByCategory(chatId, admin.id, 'website');
                break;
                
            case 'links_stats':
                await this.showLinksStats(chatId, admin.id);
                break;
                
            case 'links_collect':
                await this.collectLinksNow(chatId, userId);
                break;
                
            case 'links_export':
                await this.exportLinks(chatId, admin.id);
                break;
        }
    }
    
    // معالجة إجراءات الإعلانات
    async handleAdActions(chatId, userId, action) {
        switch (action) {
            case 'ad_add':
                await this.startAddAd(chatId, userId);
                break;
                
            case 'ad_list':
                await this.showAdsList(chatId, userId);
                break;
                
            case 'ad_active':
                await this.showActiveAds(chatId, userId);
                break;
                
            case 'ad_stats':
                await this.showAdStats(chatId, userId);
                break;
        }
    }
    
    // معالجة إجراءات النشر التلقائي
    async handleAutoPostActions(chatId, userId, action) {
        const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
        if (!admin) return;
        
        switch (action) {
            case 'autopost_start':
                await this.startAutoPostProcess(chatId, userId);
                break;
                
            case 'autopost_stop':
                await this.stopAutoPosting(admin.id);
                await this.showAutoPostMenu(chatId, userId);
                break;
                
            case 'autopost_settings':
                await this.showAutoPostSettings(chatId, userId);
                break;
                
            case 'autopost_list':
                await this.showAutoPostList(chatId, userId);
                break;
        }
    }
    
    // معالجة إجراءات الانضمام
    async handleJoinActions(chatId, userId, action) {
        switch (action) {
            case 'join_enable':
                await this.enableAutoJoin(chatId);
                break;
                
            case 'join_disable':
                await this.disableAutoJoin(chatId);
                break;
                
            case 'join_test':
                await this.testJoinLink(chatId, userId);
                break;
                
            case 'join_stats':
                await this.showJoinStats(chatId);
                break;
                
            case 'join_groups':
                await this.showJoinedGroups(chatId, userId);
                break;
        }
    }
    
    // معالجة إجراءات الإحصائيات
    async handleStatsActions(chatId, userId, action) {
        switch (action) {
            case 'stats_refresh':
                const msg = { chat: { id: chatId }, from: { id: userId } };
                this.bot.processUpdate({ message: msg });
                break;
                
            case 'stats_details':
                await this.showDetailedStats(chatId, userId);
                break;
                
            case 'stats_sessions':
                await this.showSessionStats(chatId, userId);
                break;
                
            case 'stats_links':
                await this.showLinkStats(chatId, userId);
                break;
        }
    }
    
    // ============================================
    // 9. دوال مساعدة للأزرار
    // ============================================
    
    // بدء إضافة جلسة
    async startAddSession(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
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
                `🔐 *إضافة جلسة واتساب جديدة*\n\n` +
                `1. أرسل لي *رقم الهاتف* مع رمز الدولة\n` +
                `   مثال: \`+966501234567\`\n\n` +
                `2. سأقوم بإنشاء جلسة وإرسال QR code\n\n` +
                `3. امسح QR من تطبيق واتساب\n\n` +
                `❌ للإلغاء استخدم الزر أدناه`,
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
    
    // عرض الروابط حسب الفئة
    async showLinksByCategory(chatId, adminId, category) {
        try {
            const links = await CollectedLink.findAll({
                where: { category: category },
                order: [['collectedAt', 'DESC']],
                limit: 10
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 واتساب', callback_data: 'links_whatsapp' },
                        { text: '📢 تليجرام', callback_data: 'links_telegram' },
                        { text: '🌐 مواقع', callback_data: 'links_websites' }
                    ],
                    [
                        { text: '📋 القائمة', callback_data: 'menu_links' },
                        { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                    ]
                ]
            };
            
            let message = `*🔗 روابط ${category === 'whatsapp' ? 'واتساب' : category === 'telegram' ? 'تليجرام' : 'المواقع'}*\n\n`;
            
            if (links.length === 0) {
                message += `📭 *لا توجد روابط في هذه الفئة*\n\n`;
                message += `سيتم جمع الروابط تلقائياً من جلسات واتساب.`;
            } else {
                links.forEach((link, index) => {
                    message += `${index + 1}. ${link.title || 'بدون عنوان'}\n`;
                    message += `   \`${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''}\`\n`;
                    message += `   📍 ${link.sourceChat || 'غير معروف'}\n`;
                    message += `   ⏰ ${moment(link.collectedAt).fromNow()}\n\n`;
                });
            }
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('خطأ في عرض الروابط:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
        }
    }
    
    // بدء إضافة إعلان
    async startAddAd(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📝 نص', callback_data: 'ad_type_text' },
                        { text: '🖼️ صورة', callback_data: 'ad_type_image' }
                    ],
                    [
                        { text: '🎥 فيديو', callback_data: 'ad_type_video' },
                        { text: '📄 مستند', callback_data: 'ad_type_document' }
                    ],
                    [
                        { text: '❌ إلغاء', callback_data: 'menu_ads' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `📢 *إضافة إعلان جديد*\n\n` +
                `اختر نوع الإعلان:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            
        } catch (error) {
            console.error('خطأ في بدء إضافة إعلان:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الإعلان');
        }
    }
    
    // بدء عملية النشر التلقائي
    async startAutoPostProcess(chatId, userId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
            if (!admin) return;
            
            if (this.activeAutoPosts.has(admin.id)) {
                return this.bot.sendMessage(chatId,
                    '⚠️ *النشر التلقائي يعمل بالفعل!*\n\n' +
                    'استخدم زر إيقاف النشر لإيقافه أولاً.',
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
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '➕ إضافة إعلان', callback_data: 'ad_add' },
                            { text: '📋 القائمة', callback_data: 'menu_ads' }
                        ]
                    ]
                };
                
                return this.bot.sendMessage(chatId,
                    '❌ *لا توجد إعلانات نشطة!*\n\n' +
                    'استخدم زر إضافة إعلان لإنشاء إعلان أولاً.',
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            }
            
            // حفظ حالة المستخدم لاختيار الإعلان
            this.userStates.set(userId, {
                state: 'select_ad_for_autopost',
                data: { adminId: admin.id, ads: ads }
            });
            
            let message = `*🚀 بدء النشر التلقائي*\n\n`;
            message += `لديك ${ads.length} إعلان نشط:\n\n`;
            
            const adKeyboard = [];
            ads.forEach((ad, index) => {
                if (index % 2 === 0) adKeyboard.push([]);
                adKeyboard[Math.floor(index / 2)].push({
                    text: `${index + 1}. ${ad.type === 'text' ? '📝' : '🖼️'}`,
                    callback_data: `autopost_select_${ad.id}`
                });
            });
            
            adKeyboard.push([
                { text: '❌ إلغاء', callback_data: 'menu_autopost' }
            ]);
            
            this.bot.sendMessage(chatId, message, { 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: adKeyboard }
            });
            
        } catch (error) {
            console.error('خطأ في بدء النشر التلقائي:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في بدء النشر التلقائي');
        }
    }
    
    // ============================================
    // 10. معالجة الرسائل النصية
    // ============================================
    setupMessageHandler() {
        this.bot.on('message', async (msg) => {
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const userState = this.userStates.get(userId);
            
            if (!userState || !msg.text) return;
            
            try {
                switch (userState.state) {
                    case 'awaiting_phone_for_session':
                        await this.handlePhoneNumberInput(msg, userState);
                        break;
                        
                    case 'awaiting_ad_content':
                        await this.handleAdContentInput(msg, userState);
                        break;
                        
                    case 'select_ad_for_autopost':
                        await this.handleAdSelectionForAutopost(msg, userState);
                        break;
                }
            } catch (error) {
                console.error('خطأ في معالجة الرسالة:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
                this.userStates.delete(userId);
            }
        });
    }
    
    // معالجة إدخال رقم الهاتف
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
                'يجب أن يبدأ بـ + ويتبعه رمز الدولة ثم الرقم.\n' +
                'مثال: \`+966501234567\`\n\n' +
                'حاول مرة أخرى أو استخدم الزر للإلغاء',
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
        
        try {
            if (!this.whatsappManager) {
                throw new Error('مدير واتساب غير متاح');
            }
            
            const sessionId = await this.whatsappManager.createSession(
                userState.data.adminId,
                phoneNumber
            );
            
            // حفظ في قاعدة البيانات
            await WhatsAppSession.create({
                id: sessionId,
                sessionId: sessionId,
                phoneNumber: phoneNumber,
                adminId: userState.data.adminId,
                status: 'pending'
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 عرض QR', callback_data: `session_qr_${sessionId}` },
                        { text: '📋 القائمة', callback_data: 'session_list' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `✅ *تم إنشاء الجلسة*\n\n` +
                `🆔 المعرف: \`${sessionId.substring(0, 8)}\`\n` +
                `📱 الرقم: ${phoneNumber}\n\n` +
                `⏳ جاري تحضير QR code...`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            
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
    // 11. دوال إضافية
    // ============================================
    
    // إيقاف النشر التلقائي
    async stopAutoPosting(adminId) {
        const autoPostJob = this.activeAutoPosts.get(adminId);
        
        if (autoPostJob && autoPostJob.timer) {
            clearInterval(autoPostJob.timer);
            autoPostJob.isRunning = false;
            this.activeAutoPosts.delete(adminId);
            return true;
        }
        
        return false;
    }
    
    // ============================================
    // 12. بدء البوت
    // ============================================
    start() {
        console.log('🤖 بوت تليجرام مع الأزرار جاهز للعمل!');
        return this.bot;
    }
}

// ============================================
// 13. التصدير
// ============================================
module.exports = TelegramBotHandler;
