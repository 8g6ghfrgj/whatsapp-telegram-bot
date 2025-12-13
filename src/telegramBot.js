// ============================================
// 📱 WhatsApp Telegram Bot - النسخة المبسطة
// الإصدار: 3.0.0 - WhatsApp Bot Simplified
// ============================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Op } = require('sequelize');

// استيراد النماذج
const { 
    Admin, 
    WhatsAppSession, 
    CollectedLink, 
    Advertisement,
    AutoReply,
    AutoJoin
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
        this.sessionQRs = new Map();
        this.activeBroadcasts = new Map();
        
        // إعداد المعالجات
        this.setupHandlers();
        
        console.log('✅ بوت التليجرام مهيأ وجاهز');
    }
    
    setupHandlers() {
        console.log('🔧 جاري إعداد معالجات البوت...');
        
        // الأوامر الرئيسية
        this.bot.onText(/\/start/, async (msg) => {
            await this.handleStart(msg);
        });
        
        this.bot.onText(/\/addsession/, async (msg) => {
            await this.startAddSession(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/sessions/, async (msg) => {
            await this.showSessions(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/collectlinks/, async (msg) => {
            await this.collectLinksFromSessions(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/links/, async (msg) => {
            await this.showLinks(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/addad/, async (msg) => {
            await this.startAddAd(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/ads/, async (msg) => {
            await this.showAds(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/broadcast/, async (msg) => {
            await this.startBroadcast(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/stopbroadcast/, async (msg) => {
            await this.stopBroadcast(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/addautoreply/, async (msg) => {
            await this.startAddAutoReply(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/autoreplies/, async (msg) => {
            await this.showAutoReplies(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/addadmin/, async (msg) => {
            await this.startAddAdmin(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/admins/, async (msg) => {
            await this.showAdmins(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/autojoin/, async (msg) => {
            await this.startAutoJoin(msg.chat.id, msg.from.id);
        });
        
        this.bot.onText(/\/help/, async (msg) => {
            await this.showHelp(msg.chat.id);
        });
        
        // معالجة الرسائل النصية
        this.bot.on('message', async (msg) => {
            if (msg.text && msg.text.startsWith('/')) return;
            
            const chatId = msg.chat.id;
            const telegramId = msg.from.id.toString();
            const userState = this.userStates.get(telegramId);
            
            if (!userState || !msg.text) return;
            
            switch (userState.state) {
                case 'awaiting_autojoin_links':
                    await this.handleAutoJoinLinks(chatId, telegramId, msg.text);
                    break;
                    
                case 'awaiting_ad_content':
                    await this.handleAdContent(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_broadcast_message':
                    await this.handleBroadcastMessage(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_autoreply_trigger':
                    await this.handleAutoReplyTrigger(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_autoreply_response':
                    await this.handleAutoReplyResponse(chatId, telegramId, msg.text, userState.data);
                    break;
                    
                case 'awaiting_admin_telegram_id':
                    await this.handleAdminTelegramId(chatId, telegramId, msg.text);
                    break;
            }
        });
        
        // معالجة الأزرار
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const userId = query.from.id.toString();
            const data = query.data;
            
            await this.bot.answerCallbackQuery(query.id);
            
            const parts = data.split('_');
            const action = parts[0];
            
            switch (action) {
                case 'delete':
                    if (parts[1] === 'session') {
                        await this.deleteSession(chatId, userId, parts[2]);
                    } else if (parts[1] === 'ad') {
                        await this.deleteAd(chatId, userId, parts[2]);
                    } else if (parts[1] === 'autoreply') {
                        await this.deleteAutoReply(chatId, userId, parts[2]);
                    } else if (parts[1] === 'admin') {
                        await this.deleteAdmin(chatId, userId, parts[2]);
                    }
                    break;
                    
                case 'linktype':
                    await this.showLinksByType(chatId, userId, parts[1]);
                    break;
                    
                case 'startbroadcast':
                    await this.confirmStartBroadcast(chatId, userId, parts[1]);
                    break;
                    
                case 'adtype':
                    await this.handleAdType(chatId, userId, parts[1]);
                    break;
                    
                case 'autoreplytype':
                    await this.handleAutoReplyType(chatId, userId, parts[1]);
                    break;
            }
        });
        
        console.log('✅ تم إعداد جميع المعالجات');
    }
    
    // ============================================
    // 1. معالجة الأمر /start
    // ============================================
    async handleStart(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id.toString();
        
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            
            if (!admin) {
                return this.bot.sendMessage(chatId,
                    `🔒 *غير مصرح لك بالدخول!*\n\n` +
                    `أرسل رقم Telegram ID الخاص بك للمشرف الرئيسي لإضافتك.\n\n` +
                    `🆔 *رقمك:* \`${telegramId}\``,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // لوحة التحكم
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 إضافة حساب واتساب', callback_data: 'add_session' },
                        { text: '📋 عرض الحسابات', callback_data: 'show_sessions' }
                    ],
                    [
                        { text: '🔗 تجميع الروابط', callback_data: 'collect_links' },
                        { text: '📊 عرض الروابط', callback_data: 'show_links' }
                    ],
                    [
                        { text: '📢 إضافة إعلان', callback_data: 'add_ad' },
                        { text: '📋 عرض الإعلانات', callback_data: 'show_ads' }
                    ],
                    [
                        { text: '📨 نشر تلقائي', callback_data: 'start_broadcast' },
                        { text: '⏸️ إيقاف النشر', callback_data: 'stop_broadcast' }
                    ],
                    [
                        { text: '🤖 إضافة رد تلقائي', callback_data: 'add_autoreply' },
                        { text: '📋 عرض الردود', callback_data: 'show_autoreplies' }
                    ],
                    [
                        { text: '👑 إضافة مشرف', callback_data: 'add_admin' },
                        { text: '📋 عرض المشرفين', callback_data: 'show_admins' }
                    ],
                    [
                        { text: '➕ انضمام تلقائي', callback_data: 'auto_join' },
                        { text: '🆘 المساعدة', callback_data: 'help' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId,
                `🎉 *مرحباً بك في نظام إدارة WhatsApp*\n\n` +
                `اختر من القائمة أدناه:` +
                `\n📱 **إضافة حساب واتساب:** ربط حساب WhatsApp جديد` +
                `\n📋 **عرض الحسابات:** عرض وإدارة الحسابات المربوطة` +
                `\n🔗 **تجميع الروابط:** جمع روابط من جميع المجموعات` +
                `\n📊 **عرض الروابط:** عرض الروابط المجمعة مصنفة` +
                `\n📢 **إضافة إعلان:** إنشاء إعلان نصي/صورة/فيديو` +
                `\n📨 **نشر تلقائي:** نشر الإعلان في جميع المجموعات` +
                `\n🤖 **إضافة رد تلقائي:** إعداد ردود آلية` +
                `\n👑 **إضافة مشرف:** إضافة مشرفين جدد` +
                `\n➕ **انضمام تلقائي:** الانضمام لروابط واتساب`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );
            
        } catch (error) {
            console.error('❌ خطأ في الأمر /start:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى');
        }
    }
    
    // ============================================
    // 2. إضافة جلسة واتساب جديدة
    // ============================================
    async startAddSession(chatId, telegramId) {
        console.log(`➕ طلب إضافة جلسة من: ${telegramId}`);
        
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            // التحقق من الحد الأقصى
            const sessionCount = await WhatsAppSession.count({ 
                where: { adminId: admin.id, status: 'connected' } 
            });
            
            if (sessionCount >= 10) {
                return this.bot.sendMessage(chatId,
                    '❌ وصلت للحد الأقصى (10 جلسات)\n' +
                    'احذف بعض الجلسات أولاً',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // إنشاء جلسة
            const sessionId = `wa_${crypto.randomBytes(6).toString('hex')}`;
            
            const session = await WhatsAppSession.create({
                id: sessionId,
                sessionId: sessionId,
                phoneNumber: 'جديد',
                adminId: admin.id,
                status: 'awaiting_qr'
            });
            
            // إعداد عميل واتساب
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
                        '--disable-dev-shm-usage'
                    ]
                }
            });
            
            this.whatsappClients.set(sessionId, client);
            
            // توليد QR Code
            client.on('qr', async (qr) => {
                console.log(`📱 تم توليد QR Code للجلسة: ${sessionId}`);
                
                await session.update({
                    qrCode: qr,
                    qrSentAt: new Date()
                });
                
                // عرض QR Code نصي
                qrcode.toString(qr, { type: 'terminal', small: true }, (err, qrText) => {
                    if (err) {
                        console.error('❌ خطأ في توليد QR:', err);
                        return;
                    }
                    
                    // إرسال QR Code للمستخدم
                    const message = `
📱 *QR Code لربط حساب WhatsApp*

🔗 *طريقة الربط:*
1. افتح WhatsApp على هاتفك
2. اضغط على النقاط الثلاث (⋮)
3. اختر "الأجهزة المرتبطة"
4. انقر على "ربط جهاز"
5. مسح الكود أدناه بكاميرا الهاتف

\`\`\`
${qrText}
\`\`\`

⏱️ *مدة الصلاحية:* 60 ثانية

🔗 *رابط QR:* \`${qr}\`

✅ بعد المسح ستصلك رسالة تأكيد
                    `;
                    
                    this.bot.sendMessage(chatId, message, {
                        parse_mode: 'Markdown'
                    }).catch(err => {
                        console.error('❌ خطأ في إرسال QR:', err);
                    });
                });
            });
            
            // عند جاهزية العميل
            client.on('ready', async () => {
                console.log(`✅ WhatsApp جاهز للجلسة: ${sessionId}`);
                
                await session.update({
                    status: 'connected',
                    connectedAt: new Date(),
                    phoneNumber: client.info.phone?.user || 'غير معروف'
                });
                
                this.bot.sendMessage(chatId,
                    `🎉 *تم الربط بنجاح!*\n\n` +
                    `✅ حساب WhatsApp متصل الآن\n` +
                    `📱 الرقم: ${session.phoneNumber}\n` +
                    `👤 الاسم: ${client.info.pushname || 'غير معروف'}\n\n` +
                    `⚡ يمكنك الآن استخدام الميزات`,
                    { parse_mode: 'Markdown' }
                );
            });
            
            // عند فقدان الاتصال
            client.on('disconnected', async (reason) => {
                console.log(`❌ فقدان الاتصال: ${reason}`);
                await session.update({ status: 'disconnected' });
            });
            
            // تهيئة العميل
            await client.initialize();
            
        } catch (error) {
            console.error('❌ خطأ في إضافة الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة الجلسة');
        }
    }
    
    // ============================================
    // 3. عرض الجلسات
    // ============================================
    async showSessions(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: admin.id },
                order: [['createdAt', 'DESC']]
            });
            
            if (sessions.length === 0) {
                return this.bot.sendMessage(chatId,
                    '📭 *لا توجد حسابات واتساب*\n' +
                    'استخدم /addsession لإضافة حساب',
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `📱 *الحسابات المربوطة*\n\n`;
            let keyboardButtons = [];
            
            sessions.forEach(session => {
                const statusEmoji = session.status === 'connected' ? '🟢' : '🔴';
                message += `${statusEmoji} *${session.phoneNumber}*\n`;
                message += `   📌 الحالة: ${session.status}\n`;
                message += `   📅 التاريخ: ${new Date(session.createdAt).toLocaleDateString('ar-SA')}\n`;
                message += `   ───────────────\n`;
                
                keyboardButtons.push([
                    { 
                        text: `🗑️ حذف ${session.phoneNumber}`, 
                        callback_data: `delete_session_${session.id}`
                    }
                ]);
            });
            
            const keyboard = {
                inline_keyboard: keyboardButtons
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض الجلسات:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
        }
    }
    
    // ============================================
    // 4. تجميع الروابط من الجلسات
    // ============================================
    async collectLinksFromSessions(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({
                where: { 
                    adminId: admin.id,
                    status: 'connected'
                }
            });
            
            if (sessions.length === 0) {
                return this.bot.sendMessage(chatId,
                    '❌ *لا توجد جلسات نشطة*\n' +
                    'أضف جلسة واتساب أولاً',
                    { parse_mode: 'Markdown' }
                );
            }
            
            await this.bot.sendMessage(chatId, '⏳ *جاري تجميع الروابط...*', { parse_mode: 'Markdown' });
            
            let totalLinks = 0;
            
            for (const session of sessions) {
                const client = this.whatsappClients.get(session.id);
                if (!client) continue;
                
                try {
                    const chats = await client.getChats();
                    const groups = chats.filter(chat => chat.isGroup);
                    
                    for (const group of groups.slice(0, 20)) { // تحد من عدد المجموعات
                        try {
                            const inviteCode = await group.getInviteCode();
                            if (inviteCode) {
                                const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                                
                                // التحقق من عدم التكرار
                                const existing = await CollectedLink.findOne({
                                    where: { url: inviteLink }
                                });
                                
                                if (!existing) {
                                    await CollectedLink.create({
                                        url: inviteLink,
                                        type: 'whatsapp_group',
                                        title: group.name || 'مجموعة واتساب',
                                        source: 'auto_collection',
                                        sessionId: session.id,
                                        status: 'active'
                                    });
                                    
                                    totalLinks++;
                                }
                            }
                        } catch (error) {
                            // تجاهل المجموعات التي لا يمكن الحصول على رابطها
                        }
                        
                        // تأخير بسيط
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                } catch (error) {
                    console.error(`❌ خطأ في تجميع رواق الجلسة ${session.id}:`, error);
                }
            }
            
            await this.bot.sendMessage(chatId,
                `✅ *تم تجميع الروابط*\n\n` +
                `📊 *النتائج:*\n` +
                `• 🔗 إجمالي الروابط المجمعة: ${totalLinks}\n` +
                `• 📱 من جلسات: ${sessions.length}\n\n` +
                `استخدم /links لعرض الروابط`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في تجميع الروابط:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في تجميع الروابط');
        }
    }
    
    // ============================================
    // 5. عرض الروابط المجمعة
    // ============================================
    async showLinks(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: admin.id }
            });
            
            const sessionIds = sessions.map(s => s.id);
            
            // عد الروابط حسب النوع
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
                    type: { [Op.notIn]: ['whatsapp_group', 'whatsapp_invite', 'telegram'] },
                    sessionId: sessionIds
                }
            });
            
            const totalLinks = whatsappGroups + whatsappInvites + telegramLinks + otherLinks;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: `📱 مجموعات واتساب (${whatsappGroups})`, callback_data: 'linktype_whatsapp_group' },
                        { text: `📩 دعوات واتساب (${whatsappInvites})`, callback_data: 'linktype_whatsapp_invite' }
                    ],
                    [
                        { text: `📢 تليجرام (${telegramLinks})`, callback_data: 'linktype_telegram' },
                        { text: `🌐 أخرى (${otherLinks})`, callback_data: 'linktype_other' }
                    ],
                    [
                        { text: `📋 الكل (${totalLinks})`, callback_data: 'linktype_all' }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId,
                `🔗 *الروابط المجمعة*\n\n` +
                `📊 *الإحصائيات:*\n` +
                `• 📱 مجموعات واتساب: ${whatsappGroups}\n` +
                `• 📩 دعوات واتساب: ${whatsappInvites}\n` +
                `• 📢 تليجرام: ${telegramLinks}\n` +
                `• 🌐 روابط أخرى: ${otherLinks}\n` +
                `• 📋 الإجمالي: ${totalLinks}\n\n` +
                `اختر نوع الروابط لعرضها:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );
            
        } catch (error) {
            console.error('❌ خطأ في عرض الروابط:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
        }
    }
    
    async showLinksByType(chatId, telegramId, type) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const sessions = await WhatsAppSession.findAll({
                where: { adminId: admin.id }
            });
            
            const sessionIds = sessions.map(s => s.id);
            
            let whereClause = { sessionId: sessionIds };
            
            if (type !== 'all') {
                whereClause.type = type;
            }
            
            const links = await CollectedLink.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: 50
            });
            
            if (links.length === 0) {
                return this.bot.sendMessage(chatId,
                    '📭 *لا توجد روابط*\n' +
                    'استخدم /collectlinks لتجميع الروابط',
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `🔗 *الروابط ${type === 'all' ? 'الكل' : type}*\n\n`;
            
            links.forEach((link, index) => {
                if (index < 30) { // حد عرض 30 رابط
                    message += `${index + 1}. ${link.title}\n`;
                    message += `   🔗 ${link.url}\n`;
                    message += `   📅 ${new Date(link.createdAt).toLocaleDateString('ar-SA')}\n\n`;
                }
            });
            
            if (links.length > 30) {
                message += `\n⚠️ *عرض 30 رابط من أصل ${links.length}*\n`;
            }
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض الروابط حسب النوع:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
        }
    }
    
    // ============================================
    // 6. إضافة إعلان
    // ============================================
    async startAddAd(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📝 نص', callback_data: 'adtype_text' },
                        { text: '🖼️ صورة', callback_data: 'adtype_image' }
                    ],
                    [
                        { text: '🎥 فيديو', callback_data: 'adtype_video' },
                        { text: '📞 جهة اتصال', callback_data: 'adtype_contact' }
                    ]
                ]
            };
            
            this.userStates.set(telegramId, {
                state: 'awaiting_ad_type',
                data: { adminId: admin.id }
            });
            
            await this.bot.sendMessage(chatId,
                `📢 *إنشاء إعلان جديد*\n\n` +
                `اختر نوع الإعلان:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );
            
        } catch (error) {
            console.error('❌ خطأ في بدء إضافة إعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAdType(chatId, telegramId, type) {
        try {
            const userState = this.userStates.get(telegramId);
            if (!userState) return;
            
            this.userStates.set(telegramId, {
                state: 'awaiting_ad_content',
                data: { ...userState.data, type: type }
            });
            
            const typeNames = {
                'text': 'نص',
                'image': 'صورة',
                'video': 'فيديو',
                'contact': 'جهة اتصال'
            };
            
            await this.bot.sendMessage(chatId,
                `📢 *إعلان ${typeNames[type]}*\n\n` +
                `أرسل ${typeNames[type]} الإعلان الآن:`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في معالجة نوع الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAdContent(chatId, telegramId, content, data) {
        try {
            const admin = await Admin.findByPk(data.adminId);
            if (!admin) return;
            
            const adName = `إعلان ${data.type}_${Date.now()}`;
            
            await Advertisement.create({
                adminId: admin.id,
                name: adName,
                type: data.type,
                content: content,
                isActive: true
            });
            
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إضافة الإعلان بنجاح!*\n\n` +
                `📢 *اسم الإعلان:* ${adName}\n` +
                `📝 *النوع:* ${data.type}\n\n` +
                `استخدم /ads لعرض الإعلانات`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حفظ الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في حفظ الإعلان');
        }
    }
    
    // ============================================
    // 7. عرض الإعلانات
    // ============================================
    async showAds(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const ads = await Advertisement.findAll({
                where: { adminId: admin.id },
                order: [['createdAt', 'DESC']]
            });
            
            if (ads.length === 0) {
                return this.bot.sendMessage(chatId,
                    '📭 *لا توجد إعلانات*\n' +
                    'استخدم /addad لإضافة إعلان',
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `📢 *الإعلانات*\n\n`;
            let keyboardButtons = [];
            
            ads.forEach(ad => {
                const typeEmoji = 
                    ad.type === 'text' ? '📝' :
                    ad.type === 'image' ? '🖼️' :
                    ad.type === 'video' ? '🎥' : '📞';
                
                const statusEmoji = ad.isActive ? '🟢' : '🔴';
                
                message += `${typeEmoji} ${statusEmoji} *${ad.name}*\n`;
                message += `   📝 المحتوى: ${ad.content.substring(0, 50)}${ad.content.length > 50 ? '...' : ''}\n`;
                message += `   📅 التاريخ: ${new Date(ad.createdAt).toLocaleDateString('ar-SA')}\n\n`;
                
                keyboardButtons.push([
                    { 
                        text: `🗑️ حذف ${ad.name}`, 
                        callback_data: `delete_ad_${ad.id}`
                    },
                    { 
                        text: `📨 نشر`, 
                        callback_data: `startbroadcast_${ad.id}`
                    }
                ]);
            });
            
            const keyboard = {
                inline_keyboard: keyboardButtons
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض الإعلانات:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعلانات');
        }
    }
    
    // ============================================
    // 8. بدء البث التلقائي
    // ============================================
    async startBroadcast(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const ads = await Advertisement.findAll({
                where: { 
                    adminId: admin.id,
                    isActive: true 
                }
            });
            
            if (ads.length === 0) {
                return this.bot.sendMessage(chatId,
                    '❌ *لا توجد إعلانات نشطة*\n' +
                    'أضف إعلاناً أولاً',
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `📨 *اختر إعلان للنشر التلقائي:*\n\n`;
            let keyboardButtons = [];
            
            ads.forEach(ad => {
                message += `📝 *${ad.name}*\n`;
                message += `   ${ad.content.substring(0, 50)}${ad.content.length > 50 ? '...' : ''}\n\n`;
                
                keyboardButtons.push([
                    { 
                        text: `📨 نشر ${ad.name}`, 
                        callback_data: `startbroadcast_${ad.id}`
                    }
                ]);
            });
            
            const keyboard = {
                inline_keyboard: keyboardButtons
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('❌ خطأ في بدء البث:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في بدء البث');
        }
    }
    
    async confirmStartBroadcast(chatId, telegramId, adId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const ad = await Advertisement.findByPk(adId);
            if (!ad || ad.adminId !== admin.id) {
                return this.bot.sendMessage(chatId, '❌ الإعلان غير موجود');
            }
            
            // بدء البث
            this.startAutoBroadcast(chatId, admin.id, ad);
            
            await this.bot.sendMessage(chatId,
                `🚀 *بدأ النشر التلقائي*\n\n` +
                `📢 *الإعلان:* ${ad.name}\n` +
                `⏳ *جاري النشر في جميع المجموعات...*\n\n` +
                `استخدم /stopbroadcast لإيقاف النشر`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في تأكيد البث:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في بدء البث');
        }
    }
    
    async startAutoBroadcast(chatId, adminId, ad) {
        try {
            const sessions = await WhatsAppSession.findAll({
                where: { 
                    adminId: adminId,
                    status: 'connected'
                }
            });
            
            if (sessions.length === 0) {
                this.bot.sendMessage(chatId, '❌ لا توجد جلسات نشطة للنشر');
                return;
            }
            
            let broadcastId = `broadcast_${Date.now()}`;
            this.activeBroadcasts.set(broadcastId, { active: true, ad: ad });
            
            // دالة النشر في دورة
            const broadcastCycle = async () => {
                if (!this.activeBroadcasts.get(broadcastId)?.active) {
                    return;
                }
                
                for (const session of sessions) {
                    const client = this.whatsappClients.get(session.id);
                    if (!client) continue;
                    
                    try {
                        const chats = await client.getChats();
                        const groups = chats.filter(chat => chat.isGroup);
                        
                        for (const group of groups) {
                            if (!this.activeBroadcasts.get(broadcastId)?.active) {
                                break;
                            }
                            
                            try {
                                await client.sendMessage(group.id._serialized, ad.content);
                                console.log(`✅ تم النشر في ${group.name}`);
                                
                                // تأخير 1 ثانية بين المجموعات
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                
                            } catch (error) {
                                console.error(`❌ خطأ في النشر لـ ${group.name}:`, error.message);
                            }
                        }
                        
                    } catch (error) {
                        console.error(`❌ خطأ في جلب مجموعات الجلسة ${session.id}:`, error);
                    }
                }
                
                // عندما تكتمل الدورة، ابدأ دورة جديدة بعد 5 دقائق
                if (this.activeBroadcasts.get(broadcastId)?.active) {
                    this.bot.sendMessage(chatId,
                        `✅ *اكتملت دورة النشر*\n\n` +
                        `📢 *الإعلان:* ${ad.name}\n` +
                        `🔄 *جاري البدء بدورة جديدة بعد 5 دقائق...*`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    setTimeout(broadcastCycle, 5 * 60 * 1000); // 5 دقائق
                }
            };
            
            // بدء الدورة الأولى
            broadcastCycle();
            
        } catch (error) {
            console.error('❌ خطأ في البث التلقائي:', error);
            this.bot.sendMessage(chatId, '❌ حدث خطأ في البث التلقائي');
        }
    }
    
    async stopBroadcast(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            // إيقاف جميع عمليات البث للمشرف
            let stoppedCount = 0;
            for (const [id, broadcast] of this.activeBroadcasts.entries()) {
                if (broadcast.ad.adminId === admin.id) {
                    this.activeBroadcasts.set(id, { ...broadcast, active: false });
                    stoppedCount++;
                }
            }
            
            await this.bot.sendMessage(chatId,
                `⏸️ *تم إيقاف النشر*\n\n` +
                `✅ تم إيقاف ${stoppedCount} عملية نشر`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إيقاف البث:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في إيقاف البث');
        }
    }
    
    // ============================================
    // 9. إضافة رد تلقائي
    // ============================================
    async startAddAutoReply(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '👤 خاص فقط', callback_data: 'autoreplytype_private' },
                        { text: '👥 جماعات فقط', callback_data: 'autoreplytype_group' }
                    ],
                    [
                        { text: '👤👥 كلا النوعين', callback_data: 'autoreplytype_both' }
                    ]
                ]
            };
            
            this.userStates.set(telegramId, {
                state: 'awaiting_autoreply_type',
                data: { adminId: admin.id }
            });
            
            await this.bot.sendMessage(chatId,
                `🤖 *إضافة رد تلقائي*\n\n` +
                `اختر نوع المحادثة:`,
                { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                }
            );
            
        } catch (error) {
            console.error('❌ خطأ في بدء إضافة رد:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAutoReplyType(chatId, telegramId, type) {
        try {
            const userState = this.userStates.get(telegramId);
            if (!userState) return;
            
            this.userStates.set(telegramId, {
                state: 'awaiting_autoreply_trigger',
                data: { ...userState.data, triggerType: type }
            });
            
            await this.bot.sendMessage(chatId,
                `🤖 *الرد التلقائي*\n\n` +
                `أرسل النص الذي سيحفز الرد (الكلمة أو الجملة):`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في معالجة نوع الرد:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAutoReplyTrigger(chatId, telegramId, trigger, data) {
        try {
            this.userStates.set(telegramId, {
                state: 'awaiting_autoreply_response',
                data: { ...data, trigger: trigger }
            });
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حفظ المحفز:* "${trigger}"\n\n` +
                `أرسل الآن نص الرد:`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حفظ المحفز:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAutoReplyResponse(chatId, telegramId, response, data) {
        try {
            const admin = await Admin.findByPk(data.adminId);
            if (!admin) return;
            
            const replyName = `رد ${data.triggerType}_${Date.now()}`;
            
            await AutoReply.create({
                adminId: admin.id,
                name: replyName,
                triggerType: data.triggerType,
                trigger: data.trigger,
                response: response,
                isActive: true,
                matchType: 'contains'
            });
            
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إضافة الرد التلقائي بنجاح!*\n\n` +
                `🤖 *الاسم:* ${replyName}\n` +
                `🎯 *النوع:* ${data.triggerType}\n` +
                `🔤 *المحفز:* ${data.trigger}\n` +
                `📝 *الرد:* ${response.substring(0, 50)}${response.length > 50 ? '...' : ''}\n\n` +
                `استخدم /autoreplies لعرض الردود`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حفظ الرد:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في حفظ الرد');
        }
    }
    
    // ============================================
    // 10. عرض الردود التلقائية
    // ============================================
    async showAutoReplies(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            const replies = await AutoReply.findAll({
                where: { adminId: admin.id },
                order: [['createdAt', 'DESC']]
            });
            
            if (replies.length === 0) {
                return this.bot.sendMessage(chatId,
                    '📭 *لا توجد ردود تلقائية*\n' +
                    'استخدم /addautoreply لإضافة رد',
                    { parse_mode: 'Markdown' }
                );
            }
            
            let message = `🤖 *الردود التلقائية*\n\n`;
            let keyboardButtons = [];
            
            replies.forEach(reply => {
                const typeEmoji = 
                    reply.triggerType === 'private' ? '👤' :
                    reply.triggerType === 'group' ? '👥' : '👤👥';
                
                const statusEmoji = reply.isActive ? '🟢' : '🔴';
                
                message += `${typeEmoji} ${statusEmoji} *${reply.name}*\n`;
                message += `   🔤 المحفز: ${reply.trigger}\n`;
                message += `   📝 الرد: ${reply.response.substring(0, 50)}${reply.response.length > 50 ? '...' : ''}\n`;
                message += `   📅 التاريخ: ${new Date(reply.createdAt).toLocaleDateString('ar-SA')}\n\n`;
                
                keyboardButtons.push([
                    { 
                        text: `🗑️ حذف ${reply.name}`, 
                        callback_data: `delete_autoreply_${reply.id}`
                    }
                ]);
            });
            
            const keyboard = {
                inline_keyboard: keyboardButtons
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض الردود:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض الردود');
        }
    }
    
    // ============================================
    // 11. إضافة مشرف
    // ============================================
    async startAddAdmin(chatId, telegramId) {
        try {
            const mainAdmin = await Admin.findOne({ where: { telegramId } });
            if (!mainAdmin) return;
            
            // التحقق من صلاحيات المدير
            if (!mainAdmin.permissions?.includes('admin')) {
                return this.bot.sendMessage(chatId,
                    '❌ *غير مصرح لك!*\n' +
                    'تحتاج صلاحية مدير لإضافة مشرفين',
                    { parse_mode: 'Markdown' }
                );
            }
            
            this.userStates.set(telegramId, {
                state: 'awaiting_admin_telegram_id',
                data: {}
            });
            
            await this.bot.sendMessage(chatId,
                `👑 *إضافة مشرف جديد*\n\n` +
                `أرسل رقم Telegram ID للمستخدم الذي تريد إضافته كمشرف:`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في بدء إضافة مشرف:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAdminTelegramId(chatId, telegramId, newAdminId) {
        try {
            // التحقق من صحة الرقم
            if (!newAdminId || isNaN(newAdminId) || newAdminId.length < 5) {
                return this.bot.sendMessage(chatId,
                    '❌ *رقم Telegram ID غير صالح!*\n' +
                    'أرسل رقم صحيح (مثال: 123456789)',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // التحقق إذا كان المشرف موجوداً بالفعل
            const existingAdmin = await Admin.findOne({ where: { telegramId: newAdminId } });
            if (existingAdmin) {
                return this.bot.sendMessage(chatId,
                    '⚠️ *هذا المستخدم مشرف بالفعل!*',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // إضافة المشرف
            await Admin.create({
                telegramId: newAdminId,
                firstName: `مشرف ${newAdminId.substring(0, 5)}`,
                permissions: ['manage_sessions', 'manage_ads', 'view_stats'],
                isActive: true
            });
            
            this.userStates.delete(telegramId);
            
            await this.bot.sendMessage(chatId,
                `✅ *تم إضافة المشرف بنجاح!*\n\n` +
                `👤 *رقم Telegram ID:* ${newAdminId}\n` +
                `💼 *الصلاحيات:*\n` +
                `• إدارة جلسات WhatsApp\n` +
                `• إدارة الإعلانات\n` +
                `• عرض الإحصائيات\n\n` +
                `يمكن للمستخدم الجديد إرسال /start للبدء`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إضافة المشرف:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في إضافة المشرف');
        }
    }
    
    // ============================================
    // 12. عرض المشرفين
    // ============================================
    async showAdmins(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin || !admin.permissions?.includes('admin')) {
                return this.bot.sendMessage(chatId,
                    '❌ *غير مصرح لك!*\n' +
                    'تحتاج صلاحية مدير لعرض المشرفين',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const admins = await Admin.findAll({
                order: [['createdAt', 'DESC']]
            });
            
            let message = `👑 *المشرفين*\n\n`;
            let keyboardButtons = [];
            
            admins.forEach(adminItem => {
                const isCurrent = adminItem.telegramId === telegramId;
                const statusEmoji = adminItem.isActive ? '🟢' : '🔴';
                
                message += `${statusEmoji} *${adminItem.firstName}*${isCurrent ? ' (أنت)' : ''}\n`;
                message += `   🆔 ID: ${adminItem.telegramId}\n`;
                message += `   📅 التسجيل: ${new Date(adminItem.createdAt).toLocaleDateString('ar-SA')}\n`;
                
                if (!isCurrent) {
                    keyboardButtons.push([
                        { 
                            text: `🗑️ حذف ${adminItem.firstName}`, 
                            callback_data: `delete_admin_${adminItem.id}`
                        }
                    ]);
                }
                
                message += `\n`;
            });
            
            const keyboard = {
                inline_keyboard: keyboardButtons
            };
            
            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('❌ خطأ في عرض المشرفين:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في عرض المشرفين');
        }
    }
    
    // ============================================
    // 13. الانضمام التلقائي
    // ============================================
    async startAutoJoin(chatId, telegramId) {
        try {
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin) return;
            
            this.userStates.set(telegramId, {
                state: 'awaiting_autojoin_links',
                data: { adminId: admin.id }
            });
            
            await this.bot.sendMessage(chatId,
                `➕ *الانضمام التلقائي*\n\n` +
                `أرسل روابط واتساب التي تريد الانضمام إليها.\n` +
                `يمكنك إرسال عدة روابط في رسالة واحدة.\n\n` +
                `📝 *مثال:*\n` +
                `https://chat.whatsapp.com/xxx\n` +
                `https://chat.whatsapp.com/yyy\n` +
                `https://chat.whatsapp.com/zzz`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في بدء الانضمام:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ');
        }
    }
    
    async handleAutoJoinLinks(chatId, telegramId, text) {
        try {
            const userState = this.userStates.get(telegramId);
            if (!userState) return;
            
            // استخراج روابط واتساب
            const whatsappRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/g;
            const links = text.match(whatsappRegex) || [];
            
            if (links.length === 0) {
                return this.bot.sendMessage(chatId,
                    '❌ *لم يتم العثور على روابط واتساب!*\n' +
                    'تأكد من إرسال روابط صحيحة',
                    { parse_mode: 'Markdown' }
                );
            }
            
            await this.bot.sendMessage(chatId,
                `⏳ *جاري الانضمام لـ ${links.length} رابط...*\n` +
                `سيتم الانضمام بفاصل 2 دقيقة بين كل رابط`,
                { parse_mode: 'Markdown' }
            );
            
            // الحصول على جلسة نشطة
            const sessions = await WhatsAppSession.findAll({
                where: { 
                    adminId: userState.data.adminId,
                    status: 'connected'
                },
                limit: 1
            });
            
            if (sessions.length === 0) {
                return this.bot.sendMessage(chatId,
                    '❌ *لا توجد جلسات واتساب نشطة!*\n' +
                    'أضف حساب واتساب أولاً',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const session = sessions[0];
            const client = this.whatsappClients.get(session.id);
            
            if (!client) {
                return this.bot.sendMessage(chatId,
                    '❌ *الجلسة غير متصلة!*\n' +
                    'تحقق من اتصال حساب WhatsApp',
                    { parse_mode: 'Markdown' }
                );
            }
            
            // بدء عملية الانضمام
            this.userStates.delete(telegramId);
            
            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                
                try {
                    // استخراج كود الدعوة
                    const inviteCode = link.split('/').pop();
                    
                    await this.bot.sendMessage(chatId,
                        `⏳ *جاري الانضمام للرابط ${i + 1}/${links.length}*`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    // محاولة الانضمام
                    await client.acceptInvite(inviteCode);
                    
                    await this.bot.sendMessage(chatId,
                        `✅ *تم الانضمام بنجاح!*\n` +
                        `🔗 ${link}`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    // حفظ الرابط
                    await CollectedLink.create({
                        url: link,
                        type: 'whatsapp_group',
                        title: `مجموعة منضمة ${i + 1}`,
                        source: 'auto_join',
                        sessionId: session.id,
                        status: 'joined'
                    });
                    
                } catch (error) {
                    await this.bot.sendMessage(chatId,
                        `❌ *فشل الانضمام للرابط ${i + 1}*\n` +
                        `🔗 ${link}\n` +
                        `📋 الخطأ: ${error.message.substring(0, 100)}`,
                        { parse_mode: 'Markdown' }
                    );
                }
                
                // انتظار 2 دقيقة قبل الرابط التالي
                if (i < links.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
                }
            }
            
            await this.bot.sendMessage(chatId,
                `✅ *اكتملت عملية الانضمام!*\n` +
                `📊 النتائج: ${links.length} رابط`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في الانضمام:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في الانضمام');
        }
    }
    
    // ============================================
    // 14. حذف العناصر
    // ============================================
    async deleteSession(chatId, telegramId, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) return;
            
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin || admin.id !== session.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            // إغلاق العميل
            const client = this.whatsappClients.get(sessionId);
            if (client) {
                await client.destroy();
                this.whatsappClients.delete(sessionId);
            }
            
            // حذف الجلسة
            await session.destroy();
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حذف الحساب بنجاح*\n` +
                `📱 ${session.phoneNumber}`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حذف الجلسة:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في الحذف');
        }
    }
    
    async deleteAd(chatId, telegramId, adId) {
        try {
            const ad = await Advertisement.findByPk(adId);
            if (!ad) return;
            
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin || admin.id !== ad.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            await ad.destroy();
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حذف الإعلان بنجاح*\n` +
                `📢 ${ad.name}`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حذف الإعلان:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في الحذف');
        }
    }
    
    async deleteAutoReply(chatId, telegramId, replyId) {
        try {
            const reply = await AutoReply.findByPk(replyId);
            if (!reply) return;
            
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin || admin.id !== reply.adminId) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            await reply.destroy();
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حذف الرد التلقائي بنجاح*\n` +
                `🤖 ${reply.name}`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حذف الرد:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في الحذف');
        }
    }
    
    async deleteAdmin(chatId, telegramId, adminId) {
        try {
            const adminToDelete = await Admin.findByPk(adminId);
            if (!adminToDelete) return;
            
            const admin = await Admin.findOne({ where: { telegramId } });
            if (!admin || !admin.permissions?.includes('admin')) {
                return this.bot.sendMessage(chatId, '❌ غير مصرح لك!');
            }
            
            // منع حذف نفسه
            if (adminToDelete.id === admin.id) {
                return this.bot.sendMessage(chatId,
                    '❌ *لا يمكنك حذف نفسك!*',
                    { parse_mode: 'Markdown' }
                );
            }
            
            await adminToDelete.destroy();
            
            await this.bot.sendMessage(chatId,
                `✅ *تم حذف المشرف بنجاح*\n` +
                `👤 ${adminToDelete.firstName}`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في حذف المشرف:', error);
            await this.bot.sendMessage(chatId, '❌ حدث خطأ في الحذف');
        }
    }
    
    // ============================================
    // 15. المساعدة
    // ============================================
    async showHelp(chatId) {
        const helpText = `
🆘 *دليل استخدام البوت*

📋 *الأوامر الرئيسية:*
• /start - عرض القائمة الرئيسية
• /addsession - إضافة حساب واتساب جديد
• /sessions - عرض الحسابات المربوطة
• /collectlinks - تجميع الروابط من المجموعات
• /links - عرض الروابط المجمعة
• /addad - إضافة إعلان جديد
• /ads - عرض الإعلانات
• /broadcast - بدء النشر التلقائي
• /stopbroadcast - إيقاف النشر التلقائي
• /addautoreply - إضافة رد تلقائي
• /autoreplies - عرض الردود التلقائية
• /addadmin - إضافة مشرف جديد
• /admins - عرض المشرفين
• /autojoin - الانضمام التلقائي لروابط واتساب

🚀 *ميزات البوت:*
1. **ربط حساب واتساب:** 
   - إنشاء QR Code للربط كجهاز مصاحب
   - دعم حسابات متعددة

2. **تجميع الروابط:**
   - جمع روابط المجموعات تلقائياً
   - تصنيف الروابط حسب النوع
   - منع التكرار

3. **النشر التلقائي:**
   - نشر الإعلانات في جميع المجموعات
   - دورة نشر متكررة
   - تأخير 1 ثانية بين المجموعات

4. **الردود التلقائية:**
   - ردود في المحادثات الخاصة
   - ردود في المجموعات
   - محفزات نصية

5. **إدارة المشرفين:**
   - إضافة مشرفين جدد
   - حذف المشرفين

6. **الانضمام التلقائي:**
   - الانضمام لروابط واتساب
   - تأخير 2 دقيقة بين كل رابط

⚡ *نصائح:*
• تأكد من اتصال هاتفك بالإنترنت عند ربط الحساب
• استخدم /stopbroadcast لإيقاف النشر عند الحاجة
• الروابط المجمعة تحفظ في قاعدة البيانات

📞 *للإستفسارات:*
راجع التعليمات أو تواصل مع المطور
        `;
        
        await this.bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    }
    
    // ============================================
    // 16. دالة البدء
    // ============================================
    async start() {
        console.log('🚀 بدء تشغيل WhatsApp Telegram Bot...');
        
        try {
            // إنشاء مجلد الجلسات
            await fs.mkdir('./sessions', { recursive: true });
            console.log('✅ مجلد sessions/ تم إنشاؤه');
            
            console.log('✅ WhatsApp Telegram Bot يعمل الآن!');
            console.log('📱 جاهز لاستقبال الأوامر عبر Telegram');
            console.log('🔗 أرسل /start للبدء');
            
            return this.bot;
            
        } catch (error) {
            console.error('❌ خطأ في بدء تشغيل البوت:', error);
            throw error;
        }
    }
    
    // ============================================
    // 17. تنظيف الموارد
    // ============================================
    async cleanup() {
        console.log('🧹 جاري تنظيف موارد البوت...');
        
        for (const [sessionId, client] of this.whatsappClients.entries()) {
            try {
                await client.destroy();
                console.log(`✅ تم إغلاق جلسة: ${sessionId}`);
            } catch (error) {
                console.error(`❌ خطأ في إغلاق جلسة ${sessionId}:`, error);
            }
        }
        
        this.whatsappClients.clear();
        this.userStates.clear();
        this.activeBroadcasts.clear();
        
        console.log('✅ تم تنظيف جميع موارد البوت');
    }
}

module.exports = WhatsAppTelegramBot;
