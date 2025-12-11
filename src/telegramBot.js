// ============================================
// ملف معالجة أوامر تليجرام - WhatsApp-Telegram Bot
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
    // 1. إعداد معالجات الأوامر
    // ============================================
    setupHandlers() {
        console.log('🤖 جاري إعداد معالجات بوت تليجرام...');
        
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
        
        // أوامر المشرفين
        this.setupAdminCommands();
        
        // معالجة الوسائط
        this.setupMediaHandlers();
    }
    
    // ============================================
    // 2. الأوامر الأساسية
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
                
                const welcomeMessage = `
🎉 *مرحباً بك ${admin.firstName || 'مشرف'}!*

*🤖 بوت إدارة واتساب*

*📊 حالة النظام:*
✅ البوت يعمل
📱 جاهز للاتصال بـ WhatsApp
🛠️ جميع الميزات مفعلة

*🚀 استخدم الأوامر:*
/sessions - إدارة جلسات واتساب
/links - عرض الروابط المجمعة
/ads - إدارة الإعلانات
/autopost - النشر التلقائي
/join - الانضمام للمجموعات
/autoreply - الردود التلقائية
/stats - الإحصائيات
/help - المساعدة

*👤 معلوماتك:*
🆔 ${admin.telegramId}
👑 ${admin.permissions.join(', ')}
📅 مسجل منذ: ${moment(admin.createdAt).fromNow()}
                `;
                
                this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('خطأ في /start:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
            }
        });
        
        // /help
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            
            const helpMessage = `
🆘 *مركز المساعدة*

*🔗 الأوامر الأساسية:*
/start - بدء استخدام البوت
/help - عرض هذه الرسالة
/stats - إحصائيات النظام

*📱 إدارة الجلسات:*
/sessions - عرض جميع الجلسات
/sessions add - إضافة جلسة جديدة
/sessions qr <id> - عرض QR code
/sessions remove <id> - حذف جلسة
/sessions info <id> - معلومات الجلسة

*🔗 جمع الروابط:*
/links - عرض جميع الروابط
/links whatsapp - روابط واتساب فقط
/links telegram - روابط تليجرام فقط
/links export - تصدير الروابط
/links stats - إحصائيات الروابط

*📢 إدارة الإعلانات:*
/ads - عرض جميع الإعلانات
/ads add - إضافة إعلان جديد
/ads edit <id> - تعديل إعلان
/ads delete <id> - حذف إعلان
/ads preview <id> - معاينة الإعلان

*🚀 النشر التلقائي:*
/autopost - حالة النشر التلقائي
/autopost start - بدء النشر التلقائي
/autopost stop - إيقاف النشر التلقائي
/autopost list - عرض قائمة النشر
/autopost interval <ثواني> - ضبط الفترة

*👥 الانضمام التلقائي:*
/join - حالة الانضمام التلقائي
/join on - تفعيل الانضمام التلقائي
/join off - تعطيل الانضمام التلقائي
/join stats - إحصائيات الانضمام
/join test <رابط> - اختبار رابط

*🤖 الردود التلقائية:*
/autoreply - عرض الردود
/autoreply add - إضافة رد جديد
/autoreply edit <id> - تعديل رد
/autoreply delete <id> - حذف رد
/autoreply test - اختبار الردود

*👑 أدوات المشرف:*
/admin list - قائمة المشرفين
/admin add <id> - إضافة مشرف
/admin remove <id> - حذف مشرف
/admin permissions - تعديل الصلاحيات

*📞 الدعم الفني:*
للإبلاغ عن مشاكل أو اقتراحات:
@دعم_البوت
                `;
            
            this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
        });
        
        // /stats
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
                
                const statsMessage = `
📊 *إحصائيات النظام*

*📱 جلسات واتساب:*
• الإجمالي: ${stats.totalSessions}
• النشطة: ${stats.readySessions}
• قيد الانتظار: ${stats.sessionsByStatus.awaiting_qr || 0}
• متصلة: ${stats.sessionsByStatus.ready || 0}

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

*📨 الرسائل:*
• المرسلة: ${stats.totalMessagesSent}
• المستقبلة: ${stats.totalMessagesReceived}

*👥 المشرفين:*
• الإجمالي: ${stats.totalAdmins}
• النشطون: ${await Admin.count({ where: { isActive: true } })}

*⏱️ وقت التشغيل:* ${Math.floor(process.uptime() / 3600)} ساعة
                `;
                
                this.bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('خطأ في /stats:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في جلب الإحصائيات');
            }
        });
    }
    
    // ============================================
    // 3. أوامر الجلسات
    // ============================================
    setupSessionCommands() {
        // /sessions
        this.bot.onText(/\/sessions/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const sessions = await WhatsAppSession.findAll({ 
                    where: { adminId: admin.id },
                    order: [['createdAt', 'DESC']]
                });
                
                if (sessions.length === 0) {
                    return this.bot.sendMessage(chatId,
                        '📭 *لا توجد جلسات واتساب*\n\n' +
                        'استخدم /sessions add لإضافة جلسة جديدة.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                let message = `*📱 جلسات واتساب (${sessions.length})*\n\n`;
                
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
                    message += `   🆔 \`${session.sessionId.substring(0, 8)}\`\n`;
                    message += `   📊 ${session.status}\n`;
                    message += `   📅 ${moment(session.createdAt).fromNow()}\n`;
                    
                    if (session.status === 'ready') {
                        message += `   ⚡ [إرسال رسالة](/send ${session.sessionId}) | [المجموعات](/groups ${session.sessionId})\n`;
                    } else if (session.status === 'awaiting_qr') {
                        message += `   📲 [عرض QR](/sessions qr ${session.sessionId})\n`;
                    }
                    
                    message += `   🗑️ [حذف](/sessions remove ${session.sessionId})\n\n`;
                });
                
                message += `\n📌 *أوامر سريعة:*\n`;
                message += `/sessions add - إضافة جلسة جديدة\n`;
                message += `/sessions refresh - تحديث الحالات\n`;
                message += `/sessions cleanup - تنظيف الجلسات المنتهية\n`;
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /sessions:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
            }
        });
        
        // /sessions add
        this.bot.onText(/\/sessions add/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId } });
                if (!admin) return;
                
                // التحقق من الحد الأقصى
                const sessionCount = await WhatsAppSession.count({ where: { adminId: admin.id } });
                const maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 5;
                
                if (sessionCount >= maxSessions) {
                    return this.bot.sendMessage(chatId,
                        `❌ *وصلت للحد الأقصى!*\n\n` +
                        `لديك ${sessionCount} من أصل ${maxSessions} جلسة.\n` +
                        `يرجى حذف جلسة قبل إضافة جديدة.`,
                        { parse_mode: 'Markdown' }
                    );
                }
                
                // حفظ حالة المستخدم
                this.userStates.set(userId, {
                    state: 'awaiting_phone_for_session',
                    data: { adminId: admin.id }
                });
                
                this.bot.sendMessage(chatId,
                    `🔐 *إضافة جلسة واتساب جديدة*\n\n` +
                    `1. أرسل لي *رقم الهاتف* مع رمز الدولة\n` +
                    `   مثال: \`+966501234567\`\n\n` +
                    `2. سأقوم بإنشاء جلسة وإرسال QR code\n\n` +
                    `3. امسح QR من تطبيق واتساب\n\n` +
                    `❌ للإلغاء: /cancel`,
                    { parse_mode: 'Markdown' }
                );
                
            } catch (error) {
                console.error('خطأ في /sessions add:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الجلسة');
            }
        });
    }
    
    // ============================================
    // 4. أوامر الروابط
    // ============================================
    setupLinkCommands() {
        // /links
        this.bot.onText(/\/links/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const links = await CollectedLink.findAll({
                    order: [['collectedAt', 'DESC']],
                    limit: 20
                });
                
                if (links.length === 0) {
                    return this.bot.sendMessage(chatId,
                        '🔍 *لا توجد روابط مجمعة*\n\n' +
                        'سيتم جمع الروابط تلقائياً من جلسات واتساب.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                let message = `*🔗 آخر ${links.length} رابط مجمع*\n\n`;
                
                links.forEach((link, index) => {
                    const categoryEmoji = {
                        'whatsapp': '📱',
                        'telegram': '📢',
                        'website': '🌐',
                        'other': '🔗'
                    }[link.category] || '🔗';
                    
                    message += `${index + 1}. ${categoryEmoji} *${link.title || 'بدون عنوان'}*\n`;
                    message += `   ${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''}\n`;
                    message += `   📍 ${link.sourceChat || 'غير معروف'}\n`;
                    message += `   ⏰ ${moment(link.collectedAt).fromNow()}\n\n`;
                });
                
                message += `\n📊 *إحصائيات:*\n`;
                message += `• الإجمالي: ${await CollectedLink.count()}\n`;
                message += `• واتساب: ${await CollectedLink.count({ where: { category: 'whatsapp' } })}\n`;
                message += `• تليجرام: ${await CollectedLink.count({ where: { category: 'telegram' } })}\n`;
                message += `• مواقع: ${await CollectedLink.count({ where: { category: 'website' } })}\n\n`;
                
                message += `📌 *أوامر سريعة:*\n`;
                message += `/links whatsapp - روابط واتساب فقط\n`;
                message += `/links telegram - روابط تليجرام فقط\n`;
                message += `/links export - تصدير جميع الروابط\n`;
                message += `/links collect - جمع روابط جديدة\n`;
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /links:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
            }
        });
        
        // /links whatsapp
        this.bot.onText(/\/links whatsapp/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const whatsappLinks = await CollectedLink.findAll({
                    where: { category: 'whatsapp' },
                    order: [['collectedAt', 'DESC']],
                    limit: 20
                });
                
                if (whatsappLinks.length === 0) {
                    return this.bot.sendMessage(chatId,
                        '📭 *لا توجد روابط واتساب*\n\n' +
                        'سيتم جمع روابط واتساب تلقائياً.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                let message = `*📱 روابط واتساب (${whatsappLinks.length})*\n\n`;
                
                whatsappLinks.forEach((link, index) => {
                    message += `${index + 1}. ${link.title || 'رابط واتساب'}\n`;
                    message += `   \`${link.url}\`\n`;
                    message += `   📍 ${link.sourceChat || 'غير معروف'}\n`;
                    message += `   ⏰ ${moment(link.collectedAt).fromNow()}\n\n`;
                });
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /links whatsapp:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض روابط واتساب');
            }
        });
    }
    
    // ============================================
    // 5. أوامر الإعلانات
    // ============================================
    setupAdCommands() {
        // /ads
        this.bot.onText(/\/ads/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const ads = await Advertisement.findAll({
                    where: { adminId: admin.id },
                    order: [['createdAt', 'DESC']]
                });
                
                if (ads.length === 0) {
                    return this.bot.sendMessage(chatId,
                        '📭 *لا توجد إعلانات*\n\n' +
                        'استخدم /ads add لإضافة إعلان جديد.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                let message = `*📢 إعلاناتك (${ads.length})*\n\n`;
                
                ads.forEach((ad, index) => {
                    const typeEmoji = {
                        'text': '📝',
                        'image': '🖼️',
                        'video': '🎥',
                        'contact': '👤',
                        'document': '📄'
                    }[ad.type] || '📢';
                    
                    const statusEmoji = ad.isActive ? '✅' : '❌';
                    
                    message += `${index + 1}. ${typeEmoji} ${statusEmoji} *${ad.type.toUpperCase()}*\n`;
                    message += `   ${ad.content.substring(0, 50)}${ad.content.length > 50 ? '...' : ''}\n`;
                    message += `   📊 مرسل: ${ad.stats?.sent || 0} | فاشل: ${ad.stats?.failed || 0}\n`;
                    message += `   🆔 \`${ad.id}\`\n`;
                    message += `   ⚡ [نشر الآن](/ads post ${ad.id}) | [تعديل](/ads edit ${ad.id})\n`;
                    message += `   ${ad.isActive ? '🛑 [إيقاف](/ads toggle ' + ad.id + ')' : '▶️ [تفعيل](/ads toggle ' + ad.id + ')'}\n`;
                    message += `   🗑️ [حذف](/ads delete ${ad.id})\n\n`;
                });
                
                message += `\n📌 *أوامر سريعة:*\n`;
                message += `/ads add - إضافة إعلان جديد\n`;
                message += `/ads stats - إحصائيات الإعلانات\n`;
                message += `/ads post all - نشر جميع الإعلانات\n`;
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /ads:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعلانات');
            }
        });
        
        // /ads add
        this.bot.onText(/\/ads add/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId } });
                if (!admin) return;
                
                // حفظ حالة المستخدم
                this.userStates.set(userId, {
                    state: 'awaiting_ad_type',
                    data: { adminId: admin.id }
                });
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '📝 نص', callback_data: 'ad_type_text' },
                            { text: '🖼️ صورة', callback_data: 'ad_type_image' },
                            { text: '🎥 فيديو', callback_data: 'ad_type_video' }
                        ],
                        [
                            { text: '👤 جهة اتصال', callback_data: 'ad_type_contact' },
                            { text: '📄 مستند', callback_data: 'ad_type_document' }
                        ],
                        [
                            { text: '❌ إلغاء', callback_data: 'ad_cancel' }
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
                console.error('خطأ في /ads add:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الإعلان');
            }
        });
    }
    
    // ============================================
    // 6. أوامر النشر التلقائي
    // ============================================
    setupAutoPostCommands() {
        // /autopost
        this.bot.onText(/\/autopost/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const isActive = this.activeAutoPosts.has(admin.id);
                const activePost = isActive ? this.activeAutoPosts.get(admin.id) : null;
                
                let message = `*🚀 النشر التلقائي*\n\n`;
                
                if (isActive && activePost) {
                    message += `✅ *الحالة:* نشط\n`;
                    message += `📊 *الإعلان:* ${activePost.adId}\n`;
                    message += `⏱️ *الفاصل:* ${activePost.interval}ms\n`;
                    message += `📅 *بدأ في:* ${moment(activePost.startedAt).fromNow()}\n`;
                    message += `📨 *تم إرسال:* ${activePost.stats?.sent || 0}\n`;
                    message += `❌ *فشل:* ${activePost.stats?.failed || 0}\n\n`;
                    
                    message += `🛑 لإيقاف النشر: /autopost stop\n`;
                    message += `⚡ لتعديل الفاصل: /autopost interval <ثواني>\n`;
                } else {
                    message += `❌ *الحالة:* متوقف\n\n`;
                    message += `▶️ لبدء النشر: /autopost start\n`;
                    message += `📋 لعرض الإعلانات: /ads\n`;
                }
                
                message += `\n📌 *أوامر سريعة:*\n`;
                message += `/autopost start - بدء النشر التلقائي\n`;
                message += `/autopost stop - إيقاف النشر التلقائي\n`;
                message += `/autopost list - قائمة النشر النشط\n`;
                message += `/autopost interval 2 - ضبط الفاصل لثانيتين\n`;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('خطأ في /autopost:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض حالة النشر');
            }
        });
        
        // /autopost start
        this.bot.onText(/\/autopost start/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId } });
                if (!admin) return;
                
                // التحقق إذا كان هناك نشر نشط بالفعل
                if (this.activeAutoPosts.has(admin.id)) {
                    return this.bot.sendMessage(chatId,
                        '⚠️ *النشر التلقائي يعمل بالفعل!*\n\n' +
                        'استخدم /autopost stop لإيقافه أولاً.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                // التحقق من وجود إعلانات
                const ads = await Advertisement.findAll({
                    where: { 
                        adminId: admin.id,
                        isActive: true 
                    }
                });
                
                if (ads.length === 0) {
                    return this.bot.sendMessage(chatId,
                        '❌ *لا توجد إعلانات نشطة!*\n\n' +
                        'استخدم /ads add لإضافة إعلان أولاً.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                // حفظ حالة المستخدم لاختيار الإعلان
                this.userStates.set(userId, {
                    state: 'select_ad_for_autopost',
                    data: { adminId: admin.id, ads: ads }
                });
                
                let message = `*🚀 بدء النشر التلقائي*\n\n`;
                message += `لديك ${ads.length} إعلان نشط:\n\n`;
                
                ads.forEach((ad, index) => {
                    message += `${index + 1}. ${ad.type === 'text' ? '📝' : '🖼️'} ${ad.content.substring(0, 30)}...\n`;
                    message += `   🆔 \`${ad.id}\`\n`;
                    message += `   📊 مرسل: ${ad.stats?.sent || 0}\n\n`;
                });
                
                message += `أرسل رقم الإعلان الذي تريد نشره تلقائياً:\n`;
                message += `مثال: \`1\` للنشر بالإعلان الأول\n\n`;
                message += `❌ للإلغاء: /cancel`;
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /autopost start:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في بدء النشر التلقائي');
            }
        });
    }
    
    // ============================================
    // 7. أوامر الانضمام التلقائي
    // ============================================
    setupJoinCommands() {
        // /join
        this.bot.onText(/\/join/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const isAutoJoinEnabled = process.env.AUTO_JOIN_ENABLED === 'true';
                
                let message = `*👥 الانضمام التلقائي للمجموعات*\n\n`;
                message += `✅ *الحالة:* ${isAutoJoinEnabled ? 'مفعل' : 'معطل'}\n`;
                message += `⏱️ *فحص كل:* ${process.env.AUTO_JOIN_CHECK_INTERVAL || 30000}ms\n`;
                message += `⏳ *تأخير بين المحاولات:* ${process.env.AUTO_JOIN_DELAY_BETWEEN || 2000}ms\n\n`;
                
                message += `📌 *الميزات:*\n`;
                message += `• الانضمام التلقائي لروابط واتساب\n`;
                message += `• استخراج الروابط من الرسائل\n`;
                message += `• تجنب المجموعات المغلقة\n`;
                message += `• تسجيل النتائج\n\n`;
                
                message += `🔧 *الأوامر:*\n`;
                message += `/join on - تفعيل الانضمام التلقائي\n`;
                message += `/join off - تعطيل الانضمام التلقائي\n`;
                message += `/join test <رابط> - اختبار رابط\n`;
                message += `/join stats - إحصائيات الانضمام\n`;
                message += `/join list - المجموعات المنضمة حديثاً\n`;
                
                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                
            } catch (error) {
                console.error('خطأ في /join:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض حالة الانضمام');
            }
        });
    }
    
    // ============================================
    // 8. أوامر الردود التلقائية
    // ============================================
    setupAutoReplyCommands() {
        // /autoreply
        this.bot.onText(/\/autoreply/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const admin = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!admin) return;
                
                const replies = await AutoReply.findAll({
                    where: { adminId: admin.id },
                    order: [['createdAt', 'DESC']]
                });
                
                if (replies.length === 0) {
                    return this.bot.sendMessage(chatId,
                        '🤖 *لا توجد ردود تلقائية*\n\n' +
                        'استخدم /autoreply add لإضافة رد تلقائي.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                let message = `*🤖 الردود التلقائية (${replies.length})*\n\n`;
                
                replies.forEach((reply, index) => {
                    const typeEmoji = {
                        'private': '👤',
                        'group': '👥',
                        'both': '🌐'
                    }[reply.triggerType] || '🤖';
                    
                    const statusEmoji = reply.isActive ? '✅' : '❌';
                    
                    message += `${index + 1}. ${typeEmoji} ${statusEmoji}\n`;
                    message += `   *مشغل:* \`${reply.trigger}\`\n`;
                    message += `   *رد:* ${reply.response.substring(0, 30)}...\n`;
                    message += `   📊 مستخدم: ${reply.stats?.triggered || 0} مرة\n`;
                    message += `   🆔 \`${reply.id}\`\n`;
                    message += `   ⚡ [تعديل](/autoreply edit ${reply.id}) | `;
                    message += `${reply.isActive ? '[إيقاف](/autoreply toggle ' + reply.id + ')' : '[تفعيل](/autoreply toggle ' + reply.id + ')'}\n`;
                    message += `   🗑️ [حذف](/autoreply delete ${reply.id})\n\n`;
                });
                
                message += `\n📌 *أوامر سريعة:*\n`;
                message += `/autoreply add - إضافة رد جديد\n`;
                message += `/autoreply test - اختبار الردود\n`;
                message += `/autoreply stats - إحصائيات الردود\n`;
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /autoreply:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الردود التلقائية');
            }
        });
    }
    
    // ============================================
    // 9. أوامر المشرفين
    // ============================================
    setupAdminCommands() {
        // /admin list
        this.bot.onText(/\/admin list/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            
            try {
                const requester = await Admin.findOne({ where: { telegramId: userId.toString() } });
                if (!requester || !requester.permissions.includes('admin')) {
                    return this.bot.sendMessage(chatId,
                        '❌ *غير مصرح!*\n\n' +
                        'ليست لديك صلاحية إدارة المشرفين.',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                const admins = await Admin.findAll({
                    order: [['createdAt', 'DESC']]
                });
                
                let message = `*👑 قائمة المشرفين (${admins.length})*\n\n`;
                
                admins.forEach((admin, index) => {
                    message += `${index + 1}. ${admin.isActive ? '✅' : '❌'} *${admin.firstName || 'مشرف'}*\n`;
                    message += `   🆔 \`${admin.telegramId}\`\n`;
                    message += `   👤 ${admin.username || 'بدون اسم مستخدم'}\n`;
                    message += `   👑 ${admin.permissions.join(', ')}\n`;
                    message += `   📅 ${moment(admin.createdAt).fromNow()}\n`;
                    
                    if (admin.id !== requester.id) {
                        message += `   🛠️ [تعديل](/admin edit ${admin.id}) | [حذف](/admin remove ${admin.id})\n`;
                    } else {
                        message += `   👈 أنت\n`;
                    }
                    
                    message += `\n`;
                });
                
                message += `\n📌 *أوامر:*\n`;
                message += `/admin add <id> - إضافة مشرف جديد\n`;
                message += `/admin permissions <id> <صلاحيات> - تعديل الصلاحيات\n`;
                message += `/admin deactivate <id> - تعطيل مشرف\n`;
                
                this.bot.sendMessage(chatId, message, { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });
                
            } catch (error) {
                console.error('خطأ في /admin list:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض المشرفين');
            }
        });
    }
    
    // ============================================
    // 10. معالجة الوسائط والردود
    // ============================================
    setupMediaHandlers() {
        // معالجة الصور
        this.bot.on('photo', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const userState = this.userStates.get(userId);
            
            if (userState && userState.state === 'awaiting_ad_image') {
                try {
                    const fileId = msg.photo[msg.photo.length - 1].file_id;
                    const file = await this.bot.getFile(fileId);
                    
                    userState.data.fileId = fileId;
                    userState.data.filePath = file.file_path;
                    userState.state = 'awaiting_ad_caption';
                    
                    this.bot.sendMessage(chatId,
                        `🖼️ *تم استلام الصورة*\n\n` +
                        `الآن أرسل لي *نص التعليق* للإعلان:\n` +
                        `(يمكنك إرسال /skip لتخطي التعليق)`,
                        { parse_mode: 'Markdown' }
                    );
                    
                } catch (error) {
                    console.error('خطأ في معالجة الصورة:', error);
                    this.bot.sendMessage(chatId, '❌ حدث خطأ في معالجة الصورة');
                }
            }
        });
        
        // معالجة الوثائق
        this.bot.on('document', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const userState = this.userStates.get(userId);
            
            if (userState && userState.state === 'awaiting_ad_document') {
                try {
                    const fileId = msg.document.file_id;
                    const fileName = msg.document.file_name;
                    
                    userState.data.fileId = fileId;
                    userState.data.fileName = fileName;
                    userState.state = 'awaiting_ad_caption';
                    
                    this.bot.sendMessage(chatId,
                        `📄 *تم استلام الملف*\n\n` +
                        `الملف: \`${fileName}\`\n\n` +
                        `الآن أرسل لي *نص التعليق* للإعلان:\n` +
                        `(يمكنك إرسال /skip لتخطي التعليق)`,
                        { parse_mode: 'Markdown' }
                    );
                    
                } catch (error) {
                    console.error('خطأ في معالجة الملف:', error);
                    this.bot.sendMessage(chatId, '❌ حدث خطأ في معالجة الملف');
                }
            }
        });
        
        // معالجة الردود
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            try {
                // معالجة اختيار نوع الإعلان
                if (data.startsWith('ad_type_')) {
                    const adType = data.replace('ad_type_', '');
                    const userState = this.userStates.get(userId);
                    
                    if (userState && userState.state === 'awaiting_ad_type') {
                        userState.data.adType = adType;
                        
                        if (adType === 'text') {
                            userState.state = 'awaiting_ad_content';
                            this.bot.sendMessage(chatId,
                                `📝 *إعلان نصي*\n\n` +
                                `أرسل لي *نص الإعلان*:\n` +
                                `(يمكنك استخدام Markdown للتنسيق)`,
                                { parse_mode: 'Markdown' }
                            );
                        } else if (adType === 'image') {
                            userState.state = 'awaiting_ad_image';
                            this.bot.sendMessage(chatId,
                                `🖼️ *إعلان بصورة*\n\n` +
                                `أرسل لي *الصورة* أولاً:`,
                                { parse_mode: 'Markdown' }
                            );
                        }
                        
                        // إجابة على Callback
                        this.bot.answerCallbackQuery(query.id, {
                            text: `تم اختيار ${adType}`,
                            show_alert: false
                        });
                    }
                }
                
                // إلغاء الإعلان
                if (data === 'ad_cancel') {
                    this.userStates.delete(userId);
                    this.bot.sendMessage(chatId, '❌ تم إلغاء إضافة الإعلان');
                    
                    this.bot.answerCallbackQuery(query.id, {
                        text: 'تم الإلغاء',
                        show_alert: false
                    });
                }
                
            } catch (error) {
                console.error('خطأ في معالجة Callback:', error);
                this.bot.answerCallbackQuery(query.id, {
                    text: 'حدث خطأ',
                    show_alert: true
                });
            }
        });
    }
    
    // ============================================
    // 11. معالجة الرسائل النصية للحالات
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
                        
                    case 'awaiting_ad_caption':
                        await this.handleAdCaptionInput(msg, userState);
                        break;
                        
                    case 'select_ad_for_autopost':
                        await this.handleAdSelectionForAutopost(msg, userState);
                        break;
                        
                    // يمكن إضافة حالات أخرى هنا
                }
            } catch (error) {
                console.error('خطأ في معالجة الرسالة:', error);
                this.bot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
                this.userStates.delete(userId);
            }
        });
    }
    
    // ============================================
    // 12. دوال مساعدة
    // ============================================
    async handlePhoneNumberInput(msg, userState) {
        const chatId = msg.chat.id;
        const phoneNumber = msg.text.trim();
        
        // التحقق من رقم الهاتف
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return this.bot.sendMessage(chatId,
                '❌ *رقم هاتف غير صالح!*\n\n' +
                'يجب أن يبدأ بـ + ويتبعه رمز الدولة ثم الرقم.\n' +
                'مثال: \`+966501234567\`\n\n' +
                'حاول مرة أخرى أو /cancel للإلغاء',
                { parse_mode: 'Markdown' }
            );
        }
        
        try {
            // إنشاء جلسة جديدة
            const sessionId = await this.whatsappManager.createSession(
                userState.data.adminId,
                phoneNumber
            );
            
            this.bot.sendMessage(chatId,
                `✅ *تم إنشاء الجلسة*\n\n` +
                `🆔 المعرف: \`${sessionId.substring(0, 8)}\`\n` +
                `📱 الرقم: ${phoneNumber}\n\n` +
                `⏳ جاري تحضير QR code...`,
                { parse_mode: 'Markdown' }
            );
            
            // الاستماع لحدث QR
            this.whatsappManager.once('sessionQR', (data) => {
                if (data.sessionId === sessionId) {
                    this.bot.sendMessage(chatId,
                        `📱 *QR Code جاهز*\n\n` +
                        `1. افتح واتساب على هاتفك\n` +
                        `2. اذهب إلى الإعدادات → الأجهزة المرتبطة\n` +
                        `3. انقر على "ربط جهاز"\n` +
                        `4. مسح QR Code التالي:\n\n` +
                        `\`\`\`\n${data.qrCode}\n\`\`\``,
                        { parse_mode: 'Markdown' }
                    );
                }
            });
            
            // مسح حالة المستخدم
            this.userStates.delete(msg.from.id.toString());
            
        } catch (error) {
            console.error('خطأ في إنشاء الجلسة:', error);
            this.bot.sendMessage(chatId,
                `❌ *فشل إنشاء الجلسة!*\n\n` +
                `الخطأ: ${error.message}\n\n` +
                `حاول مرة أخرى أو تواصل مع الدعم.`,
                { parse_mode: 'Markdown' }
            );
            this.userStates.delete(msg.from.id.toString());
        }
    }
    
    async handleAdContentInput(msg, userState) {
        const chatId = msg.chat.id;
        const content = msg.text;
        
        try {
            const ad = await Advertisement.create({
                adminId: userState.data.adminId,
                type: userState.data.adType,
                content: content,
                isActive: true,
                stats: { sent: 0, failed: 0 }
            });
            
            this.bot.sendMessage(chatId,
                `✅ *تم إضافة الإعلان بنجاح!*\n\n` +
                `🆔 المعرف: \`${ad.id}\`\n` +
                `📝 النوع: ${ad.type}\n` +
                `📄 المحتوى: ${content.substring(0, 50)}...\n\n` +
                `⚡ يمكنك نشره الآن باستخدام:\n` +
                `/ads post ${ad.id}`,
                { parse_mode: 'Markdown' }
            );
            
            this.userStates.delete(msg.from.id.toString());
            
        } catch (error) {
            console.error('خطأ في إضافة الإعلان:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الإعلان');
            this.userStates.delete(msg.from.id.toString());
        }
    }
    
    async handleAdSelectionForAutopost(msg, userState) {
        const chatId = msg.chat.id;
        const selection = parseInt(msg.text);
        
        if (isNaN(selection) || selection < 1 || selection > userState.data.ads.length) {
            return this.bot.sendMessage(chatId,
                '❌ *رقم غير صحيح!*\n\n' +
                `يرجى إرسال رقم بين 1 و ${userState.data.ads.length}\n` +
                'أو /cancel للإلغاء',
                { parse_mode: 'Markdown' }
            );
        }
        
        const selectedAd = userState.data.ads[selection - 1];
        
        // بدء النشر التلقائي
        this.startAutoPosting(userState.data.adminId, selectedAd.id);
        
        this.bot.sendMessage(chatId,
            `🚀 *بدأ النشر التلقائي!*\n\n` +
            `📢 الإعلان: ${selectedAd.content.substring(0, 50)}...\n` +
            `⏱️ الفاصل: ${process.env.AUTO_POST_INTERVAL || 1000}ms\n` +
            `📱 الجلسات النشطة: ${this.whatsappManager.getReadySessions().length}\n\n` +
            `🔧 التحكم:\n` +
            `/autopost stop - لإيقاف النشر\n` +
            `/autopost - لعرض الحالة`,
            { parse_mode: 'Markdown' }
        );
        
        this.userStates.delete(msg.from.id.toString());
    }
    
    // ============================================
    // 13. بدء النشر التلقائي
    // ============================================
    startAutoPosting(adminId, adId) {
        const interval = parseInt(process.env.AUTO_POST_INTERVAL) || 1000;
        
        const autoPostJob = {
            adminId: adminId,
            adId: adId,
            interval: interval,
            startedAt: new Date(),
            stats: { sent: 0, failed: 0 },
            timer: null,
            isRunning: true
        };
        
        // بدء النشر
        autoPostJob.timer = setInterval(async () => {
            if (!autoPostJob.isRunning) return;
            
            try {
                const ad = await Advertisement.findByPk(adId);
                if (!ad || !ad.isActive) {
                    this.stopAutoPosting(adminId);
                    return;
                }
                
                // النشر في المجموعات
                const results = await this.whatsappManager.autoPostAdvertisement(
                    { content: ad.content },
                    null,
                    interval
                );
                
                // تحديث الإحصائيات
                autoPostJob.stats.sent += results.sent;
                autoPostJob.stats.failed += results.failed;
                
                // تحديث إحصائيات الإعلان
                ad.stats.sent = (ad.stats.sent || 0) + results.sent;
                ad.stats.failed = (ad.stats.failed || 0) + results.failed;
                await ad.save();
                
            } catch (error) {
                console.error('خطأ في النشر التلقائي:', error);
                autoPostJob.stats.failed++;
            }
        }, interval);
        
        this.activeAutoPosts.set(adminId, autoPostJob);
    }
    
    // ============================================
    // 14. إيقاف النشر التلقائي
    // ============================================
    stopAutoPosting(adminId) {
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
    // 15. بدء البوت
    // ============================================
    start() {
        console.log('🤖 بوت تليجرام جاهز للعمل!');
        
        // إضافة معالج الرسائل
        this.setupMessageHandler();
        
        return this.bot;
    }
}

// ============================================
// 16. التصدير
// ============================================
module.exports = TelegramBotHandler;
