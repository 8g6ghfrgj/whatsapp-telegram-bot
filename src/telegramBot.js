// ============================================
// ملف Telegram Bot مع نظام الأزرار التفاعلية فقط
// إصدار كامل - WhatsApp-Telegram Bot
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const crypto = require('crypto');
require('moment/locale/ar');

moment.locale('ar');

// استيراد النماذج
const { Admin, WhatsAppSession, Advertisement, AutoReply, CollectedLink } = require('../database/models');

class TelegramBotHandler {
    constructor(token, whatsappManager = null) {
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
        this.userStates = new Map(); // لحفظ حالات المستخدمين
        this.sessionQRs = new Map(); // لتخزين QR codes
        this.activeAutoPosts = new Map(); // للنشر التلقائي النشط
        
        console.log('🤖 Telegram Bot Handler initialized with button system');
        this.setupAllHandlers();
    }
    
    // ============================================
    // 1. إعداد جميع المعالجات
    // ============================================
    setupAllHandlers() {
        this.setupStartHandler();
        this.setupCallbackHandlers();
        this.setupMessageHandlers();
        this.setupCommandBlockers();
    }
    
    // ============================================
    // 2. معالجة /start مع الأزرار الرئيسية
    // ============================================
    setupStartHandler() {
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId } });
                
                if (!admin) {
                    return this.showNonAdminMenu(chatId, msg.from);
                }
                
                await this.showMainMenu(chatId, admin);
                
            } catch (error) {
                console.error('Error in /start:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
            }
        });
    }
    
    // ============================================
    // 3. قائمة لغير المشرفين
    // ============================================
    async showNonAdminMenu(chatId, user) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👑 طلب صلاحية مشرف', callback_data: 'request_admin_access' },
                    { text: '📞 تواصل مع المطور', url: 'https://t.me/username' }
                ],
                [
                    { text: '📚 دليل الاستخدام', callback_data: 'nonadmin_guide' },
                    { text: 'ℹ️ عن البوت', callback_data: 'nonadmin_about' }
                ]
            ]
        };
        
        const message = `
👋 *مرحباً ${user.first_name || 'عزيزي'}!*

🤖 *بوت إدارة حسابات واتساب*

🚀 *مميزات البوت:*
• ربط حساب واتساب كجهاز مصاحب
• إدارة متعددة للحسابات
• نشر إعلانات تلقائياً
• جمع روابط المجموعات
• انضمام تلقائي للمجموعات

🔒 *للأسف أنت لست مشرفاً في النظام*
يمكنك طلب الصلاحية أو التواصل مع المطور.

💡 *اختر أحد الخيارات أدناه:*
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 4. القائمة الرئيسية للمشرفين
    // ============================================
    async showMainMenu(chatId, admin) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 إدارة الجلسات', callback_data: 'menu_sessions' },
                    { text: '🔗 جمع الروابط', callback_data: 'menu_links' }
                ],
                [
                    { text: '📢 الإعلانات', callback_data: 'menu_ads' },
                    { text: '🚀 النشر التلقائي', callback_data: 'menu_autopost' }
                ],
                [
                    { text: '👥 الانضمام التلقائي', callback_data: 'menu_join' },
                    { text: '🤖 الردود التلقائية', callback_data: 'menu_autoreply' }
                ],
                [
                    { text: '👑 إدارة المشرفين', callback_data: 'menu_admins' },
                    { text: '📊 الإحصائيات', callback_data: 'menu_stats' }
                ],
                [
                    { text: '⚙️ الإعدادات', callback_data: 'menu_settings' },
                    { text: '🆘 المساعدة', callback_data: 'menu_help' }
                ]
            ]
        };
        
        const sessionsCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
        const activeSessions = await WhatsAppSession.count({ 
            where: { 
                adminId: admin.id,
                status: 'ready'
            }
        });
        
        const message = `
🎮 *القائمة الرئيسية*

🌟 *مرحباً ${admin.firstName || 'مشرف'}!*

📊 *نظرة سريعة على حسابك:*
• 📱 الجلسات: ${sessionsCount} (${activeSessions} نشطة)
• 👑 الصلاحيات: ${admin.permissions.join(', ')}
• ✅ الحالة: ${admin.isActive ? 'نشط' : 'معطل'}

🚀 *جميع الميزات متاحة عبر الأزرار أدناه:*

💡 *نصائح سريعة:*
• استخدم "📱 إدارة الجلسات" لربط واتساب
• "👑 إدارة المشرفين" لإضافة فريقك
• "📢 الإعلانات" لإنشاء حملات نشر
• "📊 الإحصائيات" لمتابعة الأداء
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 5. تعطيل جميع الأوامر التقليدية
    // ============================================
    setupCommandBlockers() {
        const blockedCommands = [
            '/help', '/sessions', '/links', '/ads', '/autopost', 
            '/join', '/autoreply', '/admin', '/stats', '/settings'
        ];
        
        blockedCommands.forEach(command => {
            this.bot.onText(new RegExp(`^${command}`), async (msg) => {
                const chatId = msg.chat.id;
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🏠 العودة للقائمة', callback_data: 'main_menu' },
                            { text: '🔄 إرسال /start', callback_data: 'send_start' }
                        ]
                    ]
                };
                
                this.bot.sendMessage(chatId,
                    `⚠️ *هذا الأمر غير متاح!*\n\n` +
                    `تم استبدال الأمر *${command}* بنظام *الأزرار التفاعلية*.\n\n` +
                    `🔧 *لماذا هذا التغيير؟*\n` +
                    `• تجربة مستخدم أفضل\n` +
                    `• وصول أسرع للميزات\n` +
                    `• واجهة أكثر تنظيماً\n\n` +
                    `🎮 *الطريقة الصحيحة:*\n` +
                    `1. أرسل */start*\n` +
                    `2. استخدم الأزرار للتنقل\n` +
                    `3. كل الميزات متاحة عبر الأزرار`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            });
        });
    }
    
    // ============================================
    // 6. معالجة جميع الأزرار التفاعلية
    // ============================================
    setupCallbackHandlers() {
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            try {
                // الرد الفوري على Callback
                await this.bot.answerCallbackQuery(query.id);
                
                // التحقق من صلاحية المشرف
                const admin = await Admin.findOne({ where: { telegramId: userId } });
                
                // الأزرار المسموحة لغير المشرفين
                const publicButtons = [
                    'request_admin_access', 'nonadmin_guide', 'nonadmin_about',
                    'send_start', 'main_menu'
                ];
                
                if (!admin && !publicButtons.includes(data)) {
                    return this.showNonAdminMenu(chatId, query.from);
                }
                
                // توجيه الزر للدالة المناسبة
                if (data.startsWith('menu_')) {
                    await this.handleMainMenu(chatId, admin, data);
                }
                else if (data.startsWith('session_')) {
                    await this.handleSessionActions(chatId, admin, data);
                }
                else if (data.startsWith('admin_')) {
                    await this.handleAdminActions(chatId, admin, data);
                }
                else if (data.startsWith('ad_')) {
                    await this.handleAdActions(chatId, admin, data);
                }
                else if (data === 'request_admin_access') {
                    await this.handleAdminRequest(chatId, userId, query);
                }
                else if (data === 'send_start') {
                    const msg = { chat: { id: chatId }, from: { id: userId } };
                    this.bot.processUpdate({ message: msg });
                }
                else if (data === 'main_menu') {
                    await this.showMainMenu(chatId, admin);
                }
                
            } catch (error) {
                console.error('Error in callback handler:', error);
                this.bot.answerCallbackQuery(query.id, {
                    text: 'حدث خطأ في المعالجة',
                    show_alert: true
                });
            }
        });
    }
    
    // ============================================
    // 7. معالجة القوائم الرئيسية
    // ============================================
    async handleMainMenu(chatId, admin, action) {
        switch (action) {
            case 'menu_sessions':
                await this.showSessionsMenu(chatId, admin);
                break;
                
            case 'menu_ads':
                await this.showAdsMenu(chatId, admin);
                break;
                
            case 'menu_admins':
                await this.showAdminsMenu(chatId, admin);
                break;
                
            case 'menu_stats':
                await this.showStatsMenu(chatId, admin);
                break;
                
            case 'menu_help':
                await this.showHelpMenu(chatId);
                break;
                
            case 'menu_settings':
                await this.showSettingsMenu(chatId, admin);
                break;
                
            case 'menu_links':
            case 'menu_autopost':
            case 'menu_join':
            case 'menu_autoreply':
                await this.showComingSoon(chatId, action.replace('menu_', ''));
                break;
                
            default:
                await this.showMainMenu(chatId, admin);
        }
    }
    
    // ============================================
    // 8. قائمة الجلسات مع الأزرار
    // ============================================
    async showSessionsMenu(chatId, admin) {
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: admin.id },
            order: [['createdAt', 'DESC']],
            limit: 8
        });
        
        const activeCount = sessions.filter(s => s.status === 'ready').length;
        const pendingCount = sessions.filter(s => s.status === 'awaiting_qr').length;
        
        // إنشاء لوحة الأزرار
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱➕ ربط حساب جديد', callback_data: 'session_add_new' },
                    { text: '🔄 تحديث القائمة', callback_data: 'menu_sessions' }
                ]
            ]
        };
        
        // إضافة أزرار للجلسات الحالية
        if (sessions.length > 0) {
            // أول 4 جلسات كأزرار فردية
            sessions.slice(0, 4).forEach(session => {
                const emoji = session.status === 'ready' ? '✅' : 
                            session.status === 'awaiting_qr' ? '📱' : '❌';
                const shortId = session.sessionId?.substring(0, 6) || session.id.substring(0, 6);
                
                keyboard.inline_keyboard.push([
                    {
                        text: `${emoji} ${session.phoneNumber || shortId}`,
                        callback_data: `session_view_${session.id}`
                    }
                ]);
            });
            
            // إذا كان هناك أكثر من 4 ج sessionsات، نضيف زر لعرض الكل
            if (sessions.length > 4) {
                keyboard.inline_keyboard.push([
                    {
                        text: `📋 عرض جميع الجلسات (${sessions.length})`,
                        callback_data: 'session_view_all'
                    }
                ]);
            }
        }
        
        // إضافة أزرار إضافية
        keyboard.inline_keyboard.push([
            { text: '📊 إحصائيات الجلسات', callback_data: 'session_stats' },
            { text: '⚙️ إعدادات الجلسات', callback_data: 'session_settings' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
        ]);
        
        // إنشاء الرسالة
        let message = `*📱 إدارة جلسات واتساب*\n\n`;
        
        message += `📊 *إحصائيات حسابك:*\n`;
        message += `• 📞 الإجمالي: ${sessions.length} جلسة\n`;
        message += `• ✅ نشطة: ${activeCount} جلسة\n`;
        message += `• 📱 بانتظار QR: ${pendingCount} جلسة\n`;
        message += `• ❌ غير نشطة: ${sessions.length - activeCount - pendingCount} جلسة\n\n`;
        
        if (sessions.length === 0) {
            message += `📭 *لا توجد جلسات واتساب بعد*\n\n`;
            message += `🔗 *كيفية الربط كجهاز مصاحب:*\n`;
            message += `1. انقر على "📱➕ ربط حساب جديد"\n`;
            message += `2. أرسل رقم هاتفك مع رمز الدولة\n`;
            message += `3. امسح QR Code من واتساب\n`;
            message += `4. انتظر تأكيد الاتصال\n\n`;
            message += `💡 *مثال للرقم:* \`+966501234567\``;
        } else {
            message += `*الجلسات المتاحة:* (انقر لعرض التفاصيل)\n\n`;
            message += `💡 *نصائح سريعة:*\n`;
            message += `• الجلسات النشطة (✅) جاهزة للاستخدام\n`;
            message += `• الجلسات بانتظار QR (📱) تحتاج للمسح\n`;
            message += `• انقر على أي جلسة لعرض خياراتها`;
        }
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 9. إضافة جلسة جديدة
    // ============================================
    async handleSessionActions(chatId, admin, action) {
        if (action === 'session_add_new') {
            // التحقق من الحد الأقصى
            const sessionCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
            const maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 5;
            
            if (sessionCount >= maxSessions) {
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🗑️ حذف جلسة', callback_data: 'session_view_all' },
                            { text: '📋 إدارة الجلسات', callback_data: 'menu_sessions' }
                        ]
                    ]
                };
                
                return this.bot.sendMessage(chatId,
                    `❌ *وصلت للحد الأقصى!*\n\n` +
                    `لديك ${sessionCount} من أصل ${maxSessions} جلسة.\n` +
                    `💡 *الحلول المقترحة:*\n` +
                    `1. حذف جلسات غير مستخدمة\n` +
                    `2. ترقية الخطة لزيادة الحد\n` +
                    `3. الانتظار لتجديد الجلسات\n\n` +
                    `🔧 *اختر أحد الخيارات:*`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            }
            
            // حفظ حالة المستخدم
            this.userStates.set(admin.telegramId, {
                state: 'awaiting_phone_for_session',
                adminId: admin.id,
                timestamp: Date.now()
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '❌ إلغاء العملية', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `📱 *إضافة جلسة واتساب جديدة*\n\n` +
                `🚀 *خطوات الربط كجهاز مصاحب:*\n\n` +
                `1. **أرسل رقم هاتفك** مع رمز الدولة\n` +
                `   📞 مثال: \`+966501234567\`\n` +
                `   📞 مثال: \`+971501234567\`\n\n` +
                `2. **سأنشئ جلسة WhatsApp Web**\n` +
                `   🔧 اتصال آمن وسريع\n\n` +
                `3. **سأرسل لك QR Code**\n` +
                `   📱 صورة للربط\n\n` +
                `4. **افتح واتساب على هاتفك**\n` +
                `   📲 تطبيق WhatsApp الرسمي\n\n` +
                `5. **اذهب للإعدادات → الأجهزة المرتبطة**\n` +
                `   ⚙️ ثم انقر على "ربط جهاز"\n\n` +
                `6. **امسح QR Code** بالكاميرا\n` +
                `   📸 توجيه الكاميرا نحو الشاشة\n\n` +
                `7. **انتظر تأكيد الربط**\n` +
                `   ✅ سيصبح البوت جهازاً مصاحباً\n\n` +
                `📝 *أرسل رقم الهاتف الآن:*`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
        else if (action === 'session_view_all') {
            await this.showAllSessions(chatId, admin);
        }
        else if (action.startsWith('session_view_')) {
            const sessionId = action.replace('session_view_', '');
            await this.showSessionDetails(chatId, admin, sessionId);
        }
        else if (action === 'session_stats') {
            await this.showSessionStats(chatId, admin);
        }
    }
    
    // ============================================
    // 10. قائمة الإعلانات مع الأزرار
    // ============================================
    async showAdsMenu(chatId, admin) {
        const ads = await Advertisement.findAll({
            where: { adminId: admin.id },
            order: [['createdAt', 'DESC']],
            limit: 10
        });
        
        const activeAds = ads.filter(ad => ad.isActive).length;
        const totalSent = ads.reduce((sum, ad) => sum + (ad.stats?.sent || 0), 0);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📢➕ إنشاء إعلان', callback_data: 'ad_create_new' },
                    { text: '📋 قائمة الإعلانات', callback_data: 'ad_list_all' }
                ]
            ]
        };
        
        // إضافة أزرار للإعلانات النشطة
        const activeAdsList = ads.filter(ad => ad.isActive).slice(0, 3);
        if (activeAdsList.length > 0) {
            activeAdsList.forEach(ad => {
                const typeEmoji = {
                    'text': '📝',
                    'image': '🖼️',
                    'video': '🎥',
                    'contact': '👤',
                    'document': '📄'
                }[ad.type] || '📢';
                
                const shortContent = ad.content.length > 20 ? 
                    ad.content.substring(0, 20) + '...' : ad.content;
                
                keyboard.inline_keyboard.push([
                    {
                        text: `${typeEmoji} ${shortContent}`,
                        callback_data: `ad_view_${ad.id}`
                    }
                ]);
            });
        }
        
        // أزرار إضافية
        keyboard.inline_keyboard.push([
            { text: '🚀 النشر التلقائي', callback_data: 'menu_autopost' },
            { text: '📊 إحصائيات الإعلانات', callback_data: 'ad_stats' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '⚙️ إعدادات الإعلانات', callback_data: 'ad_settings' },
            { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
        ]);
        
        let message = `*📢 إدارة الإعلانات*\n\n`;
        
        message += `📊 *إحصائيات حسابك:*\n`;
        message += `• 📝 الإجمالي: ${ads.length} إعلان\n`;
        message += `• ✅ نشطة: ${activeAds} إعلان\n`;
        message += `• 📨 تم إرسال: ${totalSent} مرة\n\n`;
        
        if (ads.length === 0) {
            message += `📭 *لا توجد إعلانات بعد*\n\n`;
            message += `🎯 *أنواع الإعلانات المتاحة:*\n`;
            message += `• 📝 نصوص مع تنسيق\n`;
            message += `• 🖼️ صور مع تعليقات\n`;
            message += `• 🎥 فيديوهات قصيرة\n`;
            message += `• 👤 جهات اتصال\n`;
            message += `• 📄 مستندات وملفات\n\n`;
            message += `💡 *انقر على "إنشاء إعلان" للبدء*`;
        } else {
            message += `*الإعلانات النشطة:* (انقر لعرض التفاصيل)\n\n`;
            message += `🔧 *استخدم الأزرار للإدارة:*\n`;
            message += `• إنشاء إعلان جديد\n`;
            message += `• تعديل الإعلانات الحالية\n`;
            message += `• ضبط النشر التلقائي\n`;
            message += `• عرض الإحصائيات`;
        }
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 11. قائمة إدارة المشرفين مع الأزرار
    // ============================================
    async showAdminsMenu(chatId, admin) {
        // التحقق من الصلاحية
        if (!admin.permissions.includes('add_admins')) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '👑 طلب صلاحية', callback_data: 'request_admin_permission' },
                        { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
                    ]
                ]
            };
            
            return this.bot.sendMessage(chatId,
                `❌ *غير مصرح!*\n\n` +
                `ليست لديك صلاحية إدارة المشرفين.\n\n` +
                `🔒 *الصلاحية المطلوبة:* \`add_admins\`\n` +
                `👑 *صلاحياتك الحالية:* ${admin.permissions.join(', ')}\n\n` +
                `💡 *يمكنك:*\n` +
                `1. طلب الصلاحية من المشرف الرئيسي\n` +
                `2. التواصل مع المطور\n` +
                `3. استخدام الميزات الأخرى`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
        
        const admins = await Admin.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        const activeAdmins = admins.filter(a => a.isActive).length;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👑➕ إضافة مشرف', callback_data: 'admin_add_new' },
                    { text: '📋 قائمة المشرفين', callback_data: 'admin_list_all' }
                ]
            ]
        };
        
        // إضافة أزرار للمشرفين
        admins.slice(0, 5).forEach(adminItem => {
            const statusIcon = adminItem.isActive ? '✅' : '❌';
            const isCurrent = adminItem.telegramId === admin.telegramId ? ' (أنت)' : '';
            const displayName = adminItem.firstName || adminItem.username || adminItem.telegramId;
            
            keyboard.inline_keyboard.push([
                {
                    text: `${statusIcon} ${displayName}${isCurrent}`,
                    callback_data: `admin_view_${adminItem.id}`
                }
            ]);
        });
        
        // إذا كان هناك أكثر من 5 مشرفين
        if (admins.length > 5) {
            keyboard.inline_keyboard.push([
                {
                    text: `📋 عرض الكل (${admins.length})`,
                    callback_data: 'admin_list_all'
                }
            ]);
        }
        
        // أزرار إضافية
        keyboard.inline_keyboard.push([
            { text: '⚙️ إدارة الصلاحيات', callback_data: 'admin_manage_permissions' },
            { text: '📊 إحصائيات المشرفين', callback_data: 'admin_stats' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
        ]);
        
        let message = `*👑 إدارة المشرفين*\n\n`;
        
        message += `📊 *إحصائيات النظام:*\n`;
        message += `• 👥 الإجمالي: ${admins.length} مشرف\n`;
        message += `• ✅ نشطين: ${activeAdmins} مشرف\n`;
        message += `• ❌ معطلين: ${admins.length - activeAdmins} مشرف\n\n`;
        
        message += `🔐 *صلاحياتك:* ${admin.permissions.join(', ')}\n\n`;
        
        message += `*المشرفون الحاليون:* (انقر لعرض التفاصيل)\n\n`;
        
        message += `💡 *معلومات مهمة:*\n`;
        message += `• يمكنك إضافة مشرفين جدد\n`;
        message += `• يمكنك تعديل صلاحيات المشرفين\n`;
        message += `• يمكنك تعطيل/تفعيل المشرفين\n`;
        message += `• كل تغيير يسجل في النظام`;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 12. إضافة مشرف جديد
    // ============================================
    async handleAdminActions(chatId, admin, action) {
        if (action === 'admin_add_new') {
            if (!admin.permissions.includes('add_admins')) {
                return this.bot.answerCallbackQuery(query.id, {
                    text: 'ليست لديك صلاحية إضافة مشرفين',
                    show_alert: true
                });
            }
            
            // حفظ حالة المستخدم
            this.userStates.set(admin.telegramId, {
                state: 'awaiting_admin_telegram_id',
                adminId: admin.id,
                timestamp: Date.now()
            });
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '❌ إلغاء', callback_data: 'menu_admins' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `👑 *إضافة مشرف جديد*\n\n` +
                `📝 *كيفية الحصول على رقم التليجرام:*\n\n` +
                `1. **اطلب من الشخص المراد إضافته**\n` +
                `   👤 الذي تريد منحه صلاحية المشرف\n\n` +
                `2. **ليذهب إلى بوت** @userinfobot\n` +
                `   🤖 بوت معلومات المستخدم\n\n` +
                `3. **ليرسل** \`/start\` **للبت**\n` +
                `   🚀 بدء المحادثة\n\n` +
                `4. **سيرسل له البوت رقمه**\n` +
                `   🔢 مثل: \`123456789\`\n\n` +
                `5. **ليعطيك هذا الرقم**\n` +
                `   📋 يمكن أن يعطيك عدة أرقام\n\n` +
                `6. **أرسل لي الرقم/الأرقام الآن**\n` +
                `   💡 مفصولة بفواصل إذا كانت متعددة\n\n` +
                `📋 *أمثلة:*\n` +
                `• إضافة شخص واحد: \`123456789\`\n` +
                `• إضافة عدة أشخاص: \`123456789,987654321,555555555\`\n\n` +
                `🔢 *أرسل رقم/أرقام التليجرام الآن:*`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
        else if (action === 'admin_list_all') {
            await this.showAllAdmins(chatId, admin);
        }
        else if (action.startsWith('admin_view_')) {
            const adminId = action.replace('admin_view_', '');
            await this.showAdminDetails(chatId, admin, adminId);
        }
    }
    
    // ============================================
    // 13. قائمة الإحصائيات مع الأزرار
    // ============================================
    async showStatsMenu(chatId, admin) {
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
        
        const totalAdmins = await Admin.count();
        const activeAdmins = await Admin.count({ where: { isActive: true } });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 جلسات واتساب', callback_data: 'stats_sessions_detail' },
                    { text: '📢 الإعلانات', callback_data: 'stats_ads_detail' }
                ],
                [
                    { text: '👥 المشرفين', callback_data: 'stats_admins_detail' },
                    { text: '🔗 الروابط', callback_data: 'stats_links_detail' }
                ],
                [
                    { text: '📊 إحصائيات النظام', callback_data: 'stats_system_detail' },
                    { text: '📈 تقرير أداء', callback_data: 'stats_performance' }
                ],
                [
                    { text: '🔄 تحديث الإحصائيات', callback_data: 'menu_stats' },
                    { text: '📥 تصدير التقرير', callback_data: 'stats_export' }
                ],
                [
                    { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
                ]
            ]
        };
        
        const uptimeHours = Math.floor(process.uptime() / 3600);
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        const message = `
📊 *إحصائيات النظام الشاملة*

*📱 جلسات واتساب:*
• 📞 الإجمالي: ${sessionsCount} جلسة
• ✅ نشطة: ${activeSessions} جلسة
• 📈 النسبة: ${sessionsCount > 0 ? ((activeSessions / sessionsCount) * 100).toFixed(1) : 0}%

*📢 الإعلانات:*
• 📝 الإجمالي: ${adsCount} إعلان
• ✅ نشطة: ${activeAds} إعلان
• 📈 النسبة: ${adsCount > 0 ? ((activeAds / adsCount) * 100).toFixed(1) : 0}%

*👥 المشرفين:*
• 👑 الإجمالي: ${totalAdmins} مشرف
• ✅ نشطين: ${activeAdmins} مشرف
• 📈 النسبة: ${totalAdmins > 0 ? ((activeAdmins / totalAdmins) * 100).toFixed(1) : 0}%

*⚙️ معلومات النظام:*
• ⏱️ وقت التشغيل: ${uptimeHours} ساعة
• 💾 استخدام الذاكرة: ${memoryUsage} MB
• 🌐 البيئة: ${process.env.NODE_ENV || 'تطوير'}
• 🚀 الإصدار: 3.0.0

💡 *انقر على أي قسم لعرض التفاصيل الكاملة*
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 14. قائمة المساعدة مع الأزرار
    // ============================================
    async showHelpMenu(chatId) {
        const keyboard = {
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
                    { text: '🔗 جمع الروابط', callback_data: 'help_links' },
                    { text: '👥 الانضمام التلقائي', callback_data: 'help_join' }
                ],
                [
                    { text: '📞 الدعم الفني', url: 'https://t.me/username' },
                    { text: '📚 الدليل الكامل', url: 'https://example.com/docs' }
                ],
                [
                    { text: '🎬 فيديوهات تعليمية', url: 'https://youtube.com/playlist' },
                    { text: '❓ الأسئلة الشائعة', callback_data: 'help_faq' }
                ],
                [
                    { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
                ]
            ]
        };
        
        const message = `
🆘 *مركز المساعدة والدعم*

*🎮 نظام الأزرار التفاعلية:*
• كل شيء يعمل عبر **الأزرار التفاعلية**
• لا حاجة لتذكر الأوامر النصية
• انقر على الزر للانتقال للقسم المطلوب
• استخدم زر "🏠 القائمة الرئيسية" للعودة

*📱 دليل ربط واتساب:*
1. انتقل لـ **إدارة الجلسات**
2. انقر على **"ربط حساب جديد"**
3. أرسل **رقم هاتفك** مع رمز الدولة
4. امسح **QR Code** من واتساب
5. انتظر اكتمال الربط

*📢 دليل إنشاء إعلان:*
1. انتقل لـ **الإعلانات**
2. انقر على **"إنشاء إعلان"**
3. اختر نوع الإعلان
4. أرسل المحتوى
5. اضبط الإعدادات

*👑 دليل إضافة مشرف:*
1. انتقل لـ **إدارة المشرفين**
2. انقر على **"إضافة مشرف"**
3. أرسل **رقم تليجرام** للشخص
4. تأكد من صلاحية **"add_admins"**

*🚀 دليل النشر التلقائي:*
1. انتقل لـ **النشر التلقائي**
2. اختر الإعلان المراد نشره
3. اضبط الفترة الزمنية
4. انقر على **بدء النشر**

*💡 نصائح عامة:*
• احفظ رقمك في مكان آمن
• استخدم أرقام واتساب حقيقية
• لا تشارك QR Code مع أحد
• تواصل مع الدعم للمساعدة

*📞 طرق التواصل:*
• زر **"الدعم الفني"** للتواصل المباشر
• زر **"الدليل الكامل"** للوثائق التفصيلية
• زر **"فيديوهات تعليمية"** للشرح المرئي
• زر **"الأسئلة الشائعة"** للحلول السريعة
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 15. قائمة الإعدادات مع الأزرار
    // ============================================
    async showSettingsMenu(chatId, admin) {
        const keyboard = {
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
                    { text: '💾 إعدادات التخزين', callback_data: 'settings_storage' },
                    { text: '🔧 إعدادات متقدمة', callback_data: 'settings_advanced' }
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

*الإعدادات المتاحة للضبط:*

• ⚙️ **إعدادات البوت:** ضبط إعدادات البوت الأساسية
• 🔔 **الإشعارات:** التحكم بالإشعارات والتنبيهات
• 🛡️ **الخصوصية:** إعدادات الخصوصية والأمان
• 🌐 **اللغة:** تغيير لغة الواجهة (العربية/الإنجليزية)
• 📊 **النشر:** ضبط إعدادات النشر التلقائي
• 👥 **الانضمام:** إعدادات الانضمام للمجموعات
• 💾 **التخزين:** إدارة مساحة التخزين والبيانات
• 🔧 **المتقدمة:** إعدادات للمستخدمين المتقدمين
• 🔄 **إعادة التعيين:** إعادة ضبط الإعدادات للافتراضي
• 📤 **نسخ احتياطي:** نسخ واستعادة بيانات النظام

*🔐 صلاحياتك الحالية:* ${admin.permissions.join(', ')}

💡 *اختر القسم الذي تريد ضبط إعداداته:*
        `;
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    
    // ============================================
    // 16. معالجة طلب إضافة مشرف
    // ============================================
    async handleAdminRequest(chatId, userId, query) {
        // البحث عن المشرفين الحاليين
        const admins = await Admin.findAll({ 
            where: { 
                isActive: true,
                permissions: { [Op.contains]: ['add_admins'] }
            }
        });
        
        if (admins.length === 0) {
            return this.bot.sendMessage(chatId,
                `❌ *لا يوجد مشرفون قادرون على الموافقة!*\n\n` +
                `حالياً لا يوجد مشرفون لديهم صلاحية إضافة مشرفين جدد.\n` +
                `📞 يرجى التواصل مع المطور مباشرة.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        const requestKeyboard = {
            inline_keyboard: [
                [
                    { text: '✅ قبول الطلب', callback_data: `accept_admin_${userId}` },
                    { text: '❌ رفض الطلب', callback_data: `reject_admin_${userId}` }
                ],
                [
                    { text: '💬 مراسلة المستخدم', url: `https://t.me/${query.from.username || 'user'}` },
                    { text: '👁️ عرض الملف الشخصي', callback_data: `view_profile_${userId}` }
                ]
            ]
        };
        
        // إرسال طلب لكل مشرف
        let sentCount = 0;
        for (const admin of admins) {
            try {
                await this.bot.sendMessage(admin.telegramId,
                    `🔔 *طلب جديد لإضافة مشرف*\n\n` +
                    `👤 *المستخدم:* ${query.from.first_name || 'مستخدم'}\n` +
                    `🆔 *الرقم:* ${userId}\n` +
                    `👤 *المعرف:* @${query.from.username || 'لا يوجد'}\n` +
                    `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-SA')}\n` +
                    `⏰ *الوقت:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                    `📝 *ملاحظات:*\n` +
                    `• يمكنك قبول أو رفض الطلب\n` +
                    `• يمكنك مراسلة المستخدم مباشرة\n` +
                    `• سيتم إعلام المستخدم بقرارك\n\n` +
                    `💡 *استخدم الأزرار للرد:*`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: requestKeyboard
                    }
                );
                sentCount++;
            } catch (error) {
                console.error(`خطأ في إرسال طلب للمشرف ${admin.telegramId}:`, error);
            }
        }
        
        // إعلام المستخدم
        const userKeyboard = {
            inline_keyboard: [
                [
                    { text: '📞 تواصل مع المطور', url: 'https://t.me/username' },
                    { text: '🔄 تحديث الحالة', callback_data: 'check_admin_request' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId,
            `📨 *تم إرسال طلبك بنجاح!*\n\n` +
            `✅ تم إرسال طلب إضافتك كمشرف إلى ${sentCount} مشرف.\n` +
            `⏳ ستصلك رسالة عندما يتم الرد على طلبك.\n` +
            `📞 يمكنك التواصل مع المطور للمسارعة في المعالجة.\n\n` +
            `💡 *معلومات طلبك:*\n` +
            `• رقمك: ${userId}\n` +
            `• اسمك: ${query.from.first_name || 'غير محدد'}\n` +
            `• الوقت: ${new Date().toLocaleTimeString('ar-SA')}`,
            {
                parse_mode: 'Markdown',
                reply_markup: userKeyboard
            }
        );
    }
    
    // ============================================
    // 17. معالجة الرسائل النصية
    // ============================================
    setupMessageHandlers() {
        this.bot.on('message', async (msg) => {
            // تجاهل الأوامر (يتم معالجتها في index.js)
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const userState = this.userStates.get(userId);
            
            if (!userState || !msg.text) return;
            
            try {
                if (userState.state === 'awaiting_phone_for_session') {
                    await this.handlePhoneInput(chatId, userId, msg.text, userState);
                }
                else if (userState.state === 'awaiting_admin_telegram_id') {
                    await this.handleAdminTelegramIdInput(chatId, userId, msg.text, userState);
                }
            } catch (error) {
                console.error('Error in message handler:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
                this.userStates.delete(userId);
            }
        });
    }
    
    // ============================================
    // 18. معالجة إدخال رقم الهاتف
    // ============================================
    async handlePhoneInput(chatId, userId, phoneNumber, userState) {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        
        if (!phoneRegex.test(phoneNumber)) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 حاول مرة أخرى', callback_data: 'session_add_new' },
                        { text: '❌ إلغاء', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            return this.bot.sendMessage(chatId,
                '❌ *رقم الهاتف غير صالح!*\n\n' +
                '📝 *الشروط الصحيحة:*\n' +
                '1. يجب أن يبدأ بـ **+**\n' +
                '2. يليه **رمز الدولة** (1-3 أرقام)\n' +
                '3. ثم **رقم الهاتف** (10-12 رقم)\n\n' +
                '✅ *أمثلة صحيحة:*\n' +
                '• \`+966501234567\` (السعودية)\n' +
                '• \`+971501234567\` (الإمارات)\n' +
                '• \`+201234567890\` (مصر)\n\n' +
                '❌ *أمثلة خاطئة:*\n' +
                '• \`966501234567\` (ناقص +)\n' +
                '• \`+501234567\` (ناقص رمز الدولة)\n' +
                '• \`+abcdef123456\` (يحتوي حروف)\n\n' +
                '📞 *أعد إرسال الرقم بشكل صحيح:*',
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
        
        try {
            // إنشاء جلسة جديدة
            const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
            const qrCodeData = `2@${crypto.randomBytes(32).toString('base64')}${crypto.randomBytes(32).toString('base64')}`;
            
            await WhatsAppSession.create({
                id: sessionId,
                sessionId: sessionId,
                phoneNumber: phoneNumber,
                adminId: userState.adminId,
                status: 'awaiting_qr',
                qrCode: qrCodeData,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            // حفظ QR مؤقتاً
            this.sessionQRs.set(sessionId, qrCodeData);
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 عرض QR Code', callback_data: `session_show_qr_${sessionId}` },
                        { text: '📋 العودة للقائمة', callback_data: 'menu_sessions' }
                    ],
                    [
                        { text: '🔄 إنشاء QR جديد', callback_data: `session_new_qr_${sessionId}` },
                        { text: '🗑️ حذف الجلسة', callback_data: `session_delete_${sessionId}` }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `✅ *تم إنشاء الجلسة بنجاح!*\n\n` +
                `📋 *معلومات الجلسة:*\n` +
                `• 📱 الرقم: ${phoneNumber}\n` +
                `• 🆔 المعرف: \`${sessionId.substring(0, 8)}\`\n` +
                `• 📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}\n` +
                `• ⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                `🔗 *الخطوات التالية:*\n` +
                `1. انقر على "📱 عرض QR Code"\n` +
                `2. امسح الكود من واتساب\n` +
                `3. انتظر تأكيد الاتصال\n\n` +
                `💡 *معلومات مهمة:*\n` +
                `• QR Code صالح لمدة 60 ثانية\n` +
                `• يمكنك إنشاء QR جديد إذا انتهت\n` +
                `• يمكنك حذف الجلسة إذا أردت`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            
            // مسح حالة المستخدم
            this.userStates.delete(userId);
            
        } catch (error) {
            console.error('Error creating session:', error);
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 حاول مرة أخرى', callback_data: 'session_add_new' },
                        { text: '📋 القائمة', callback_data: 'menu_sessions' }
                    ]
                ]
            };
            
            this.bot.sendMessage(chatId,
                `❌ *فشل إنشاء الجلسة!*\n\n` +
                `📝 *الخطأ:* ${error.message}\n\n` +
                `🔧 *الأسباب المحتملة:*\n` +
                `1. مشكلة في اتصال قاعدة البيانات\n` +
                `2. وصلت للحد الأقصى من الجلسات\n` +
                `3. مشكلة في تخزين البيانات\n` +
                `4. خطأ في النظام\n\n` +
                `💡 *الحلول المقترحة:*\n` +
                `1. حاول مرة أخرى بعد قليل\n` +
                `2. تأكد من اتصال الإنترنت\n` +
                `3. تواصل مع الدعم الفني`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            this.userStates.delete(userId);
        }
    }
    
    // ============================================
    // 19. معالجة إدخال أرقام المشرفين
    // ============================================
    async handleAdminTelegramIdInput(chatId, userId, telegramIds, userState) {
        const ids = telegramIds.split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0 && /^\d+$/.test(id));
        
        if (ids.length === 0) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 حاول مرة أخرى', callback_data: 'admin_add_new' },
                        { text: '❌ إلغاء', callback_data: 'menu_admins' }
                    ]
                ]
            };
            
            return this.bot.sendMessage(chatId,
                '❌ *لم تدخل أي أرقام صحيحة!*\n\n' +
                '📝 *الشروط الصحيحة:*\n' +
                '1. يجب أن تكون أرقاماً فقط\n' +
                '2. يمكن إدخال عدة أرقام مفصولة بفواصل\n' +
                '3. لا مسافات قبل أو بعد الأرقام\n\n' +
                '✅ *أمثلة صحيحة:*\n' +
                '• إضافة شخص واحد: \`123456789\`\n' +
                '• إضافة ثلاثة أشخاص: \`123456789,987654321,555555555\`\n\n' +
                '❌ *أمثلة خاطئة:*\n' +
                '• \`abc123\` (يحتوي حروف)\n' +
                '• \`123, 456, 789\` (يحتوي مسافات)\n' +
                '• \`123.456.789\` (يحتوي نقاط)\n\n' +
                '🔢 *أعد إرسال الأرقام بشكل صحيح:*',
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
        
        let addedCount = 0;
        let updatedCount = 0;
        let errorMessages = [];
        
        for (const telegramId of ids) {
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
                    
                    // محاولة إرسال رسالة ترحيب
                    try {
                        await this.bot.sendMessage(telegramId,
                            `🎉 *مبروك!*\n\n` +
                            `✅ تمت إضافتك كمشرف في نظام إدارة واتساب.\n` +
                            `🔧 الصلاحيات الممنوحة: basic\n` +
                            `👤 أضافك: ${userId}\n` +
                            `📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}\n\n` +
                            `🚀 *للبدء:*\n` +
                            `1. أرسل /start للبوت\n` +
                            `2. استخدم الأزرار للتنقل\n` +
                            `3. ابدأ بإدارة حسابك\n\n` +
                            `💡 *ملاحظة:*\n` +
                            `• يمكنك طلب صلاحيات إضافية\n` +
                            `• تواصل مع المشرف الرئيسي للمساعدة`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (sendError) {
                        console.error(`Error sending welcome to ${telegramId}:`, sendError);
                        errorMessages.push(`⚠️ ${telegramId}: تمت الإضافة لكن لا يمكن إرسال رسالة ترحيب`);
                    }
                } else {
                    // تحديث إذا كان معطلاً
                    if (!admin.isActive) {
                        await admin.update({ isActive: true });
                        updatedCount++;
                        errorMessages.push(`🔄 ${telegramId}: تم تفعيل المشرف (كان معطلاً)`);
                    } else {
                        errorMessages.push(`⚠️ ${telegramId}: موجود بالفعل ومفعل`);
                    }
                }
            } catch (error) {
                console.error(`Error adding admin ${telegramId}:`, error);
                errorMessages.push(`❌ ${telegramId}: ${error.message}`);
            }
        }
        
        // إنشاء تقرير النتائج
        let message = `*👑 نتيجة إضافة المشرفين*\n\n`;
        
        if (addedCount > 0) {
            message += `✅ *تمت الإضافة بنجاح:* ${addedCount} مشرف جديد\n`;
        }
        
        if (updatedCount > 0) {
            message += `🔄 *تم التحديث:* ${updatedCount} مشرف (تفعيل)\n`;
        }
        
        if (errorMessages.length > 0) {
            message += `\n*📝 التفاصيل والأخطاء:*\n`;
            errorMessages.forEach((err, index) => {
                message += `${index + 1}. ${err}\n`;
            });
        }
        
        message += `\n💡 *معلومات مهمة:*\n`;
        message += `• المشرفون الجدد سيصلكم رسالة ترحيب\n`;
        message += `• الصلاحيات الافتراضية: basic\n`;
        message += `• يمكن تعديل الصلاحيات لاحقاً\n`;
        message += `• يمكن تعطيل المشرفين إذا لزم الأمر`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📋 قائمة المشرفين', callback_data: 'menu_admins' },
                    { text: '⚙️ إدارة الصلاحيات', callback_data: 'admin_manage_permissions' }
                ],
                [
                    { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        // مسح حالة المستخدم
        this.userStates.delete(userId);
    }
    
    // ============================================
    // 20. دوال مساعدة
    // ============================================
    
    async showComingSoon(chatId, feature) {
        const featureNames = {
            'links': '🔗 جمع الروابط',
            'autopost': '🚀 النشر التلقائي',
            'join': '👥 الانضمام التلقائي',
            'autoreply': '🤖 الردود التلقائية'
        };
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🏠 القائمة الرئيسية', callback_data: 'main_menu' },
                    { text: '📞 متابعة التطوير', url: 'https://t.me/username' }
                ]
            ]
        };
        
        this.bot.sendMessage(chatId,
            `🔄 *قريباً: ${featureNames[feature] || feature}*\n\n` +
            `🚧 *هذه الميزة قيد التطوير حاليًا*\n\n` +
            `📅 *الجدول الزمني:*\n` +
            `• التطوير: قيد التنفيذ\n` +
            `• الاختبار: الأسبوع القادم\n` +
            `• الإطلاق: نهاية الشهر\n\n` +
            `💡 *مميزات ${featureNames[feature] || feature}:*\n` +
            `• جمع تلقائي لروابط المجموعات\n` +
            `• تصنيف الروابط حسب النوع\n` +
            `• تصدير الرولق لقوائم منظمة\n` +
            `• إحصائيات مفصلة\n\n` +
            `📞 *للحصول على إشعار بالإطلاق:*\n` +
            `تابع قناة التطوير أو تواصل مع المطور`,
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
    
    async showAllSessions(chatId, admin) {
        // سيتم تنفيذها لاحقاً
        this.bot.sendMessage(chatId, '🔄 قريباً: عرض جميع الجلسات', { parse_mode: 'Markdown' });
    }
    
    async showSessionDetails(chatId, admin, sessionId) {
        // سيتم تنفيذها لاحقاً
        this.bot.sendMessage(chatId, `🔄 قريباً: تفاصيل الجلسة ${sessionId}`, { parse_mode: 'Markdown' });
    }
    
    async showSessionStats(chatId, admin) {
        // سيتم تنفيذها لاحقاً
        this.bot.sendMessage(chatId, '🔄 قريباً: إحصائيات الجلسات', { parse_mode: 'Markdown' });
    }
    
    async showAllAdmins(chatId, admin) {
        // سيتم تنفيذها لاحقاً
        this.bot.sendMessage(chatId, '🔄 قريباً: قائمة جميع المشرفين', { parse_mode: 'Markdown' });
    }
    
    async showAdminDetails(chatId, admin, adminId) {
        // سيتم تنفيذها لاحقاً
        this.bot.sendMessage(chatId, `🔄 قريباً: تفاصيل المشرف ${adminId}`, { parse_mode: 'Markdown' });
    }
    
    // ============================================
    // 21. بدء البوت
    // ============================================
    start() {
        console.log('🤖 Telegram Bot Handler started successfully');
        console.log('🎮 System: Interactive Buttons Only');
        console.log('🚫 Disabled: All traditional commands');
        return this.bot;
    }
}

// ============================================
// 22. التصدير
// ============================================
module.exports = TelegramBotHandler;
