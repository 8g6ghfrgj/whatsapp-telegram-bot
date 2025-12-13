// ============================================
// 📱 WhatsApp Client Manager
// الإصدار: 3.0.0 - WhatsApp Bot Simplified
// ============================================

const { Client: WhatsAppClient, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Op } = require('sequelize');
const { WhatsAppSession, CollectedLink, AutoReply, AutoJoin } = require('./index');

class WhatsAppClientManager {
    constructor(telegramBot) {
        this.telegramBot = telegramBot;
        this.clients = new Map();
        this.messageHandlers = new Map();
        this.autoReplies = new Map();
        this.autoJoins = new Map();
        
        console.log('📱 مدير عميل WhatsApp مهيأ');
    }
    
    // ============================================
    // 1. إنشاء جلسة WhatsApp جديدة
    // ============================================
    async createSession(sessionId, adminId, chatId) {
        try {
            console.log(`📱 جاري إنشاء جلسة WhatsApp: ${sessionId}`);
            
            // التحقق إذا كانت الجلسة موجودة بالفعل
            if (this.clients.has(sessionId)) {
                console.log(`⚠️ الجلسة ${sessionId} موجودة بالفعل`);
                const existingClient = this.clients.get(sessionId);
                return this.setupClientListeners(existingClient, sessionId, adminId, chatId);
            }
            
            // إعداد عميل WhatsApp مع LocalAuth
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
            
            // حفظ العميل في الذاكرة
            this.clients.set(sessionId, client);
            
            // إعداد معالجات الأحداث
            return this.setupClientListeners(client, sessionId, adminId, chatId);
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء جلسة WhatsApp:', error);
            throw error;
        }
    }
    
    // ============================================
    // 2. إعداد معالجات الأحداث للعميل
    // ============================================
    async setupClientListeners(client, sessionId, adminId, chatId) {
        // معالج QR Code
        client.on('qr', async (qr) => {
            await this.handleQRCode(qr, sessionId, adminId, chatId);
        });
        
        // عند جاهزية العميل
        client.on('ready', async () => {
            await this.handleClientReady(client, sessionId, adminId, chatId);
        });
        
        // عند استقبال رسالة
        client.on('message', async (message) => {
            await this.handleIncomingMessage(message, sessionId);
        });
        
        // عند حدوث تغيير في الحالة
        client.on('change_state', async (state) => {
            await this.handleStateChange(state, sessionId);
        });
        
        // عند فقدان الاتصال
        client.on('disconnected', async (reason) => {
            await this.handleDisconnection(reason, sessionId, adminId);
        });
        
        // عند فشل المصادقة
        client.on('auth_failure', async (error) => {
            await this.handleAuthFailure(error, sessionId, adminId);
        });
        
        // عند تغيير البطارية
        client.on('change_battery', async (batteryInfo) => {
            await this.handleBatteryChange(batteryInfo, sessionId);
        });
        
        // عند إنشاء محادثة
        client.on('chat_new', async (chat) => {
            await this.handleNewChat(chat, sessionId);
        });
        
        // عند تغيير حالة الرسالة
        client.on('message_ack', async (message, ack) => {
            await this.handleMessageAck(message, ack, sessionId);
        });
        
        // عند حذف محادثة
        client.on('chat_removed', async (chat) => {
            await this.handleChatRemoved(chat, sessionId);
        });
        
        // تهيئة العميل
        try {
            await client.initialize();
            console.log(`✅ تم تهيئة عميل WhatsApp: ${sessionId}`);
            
            // إرسال رسالة تأكيد
            if (chatId) {
                await this.telegramBot.bot.sendMessage(chatId,
                    `⚡ *جاري تهيئة WhatsApp...*\n\n` +
                    `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
                    `⏳ انتظر ظهور QR Code...`,
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error(`❌ خطأ في تهيئة العميل ${sessionId}:`, error);
            
            // تحديث حالة الجلسة
            await WhatsAppSession.update(
                { status: 'error' },
                { where: { id: sessionId } }
            );
            
            throw error;
        }
        
        return client;
    }
    
    // ============================================
    // 3. معالجة QR Code
    // ============================================
    async handleQRCode(qr, sessionId, adminId, chatId) {
        try {
            console.log(`📱 تم توليد QR Code للجلسة: ${sessionId}`);
            
            // تحديث الجلسة في قاعدة البيانات
            await WhatsAppSession.update(
                {
                    qrCode: qr,
                    qrSentAt: new Date(),
                    status: 'awaiting_qr'
                },
                { where: { id: sessionId } }
            );
            
            // إرسال QR Code للمستخدم
            await this.sendQRToTelegram(qr, sessionId, adminId, chatId);
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة QR Code للجلسة ${sessionId}:`, error);
        }
    }
    
    async sendQRToTelegram(qr, sessionId, adminId, chatId) {
        try {
            // استخدام مكتبة qrcode لتوليد QR نصي
            const qrcode = require('qrcode-terminal');
            
            // توليد QR نصي
            const qrText = await new Promise((resolve, reject) => {
                qrcode.toString(qr, { type: 'terminal', small: true }, (err, text) => {
                    if (err) reject(err);
                    else resolve(text);
                });
            });
            
            const message = `
📱 *QR Code لربط WhatsApp*

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
            
            await this.telegramBot.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown'
            });
            
            console.log(`✅ تم إرسال QR Code إلى المشرف ${adminId}`);
            
        } catch (error) {
            console.error('❌ خطأ في إرسال QR Code:', error);
            
            // بديل: إرسال الرابط فقط
            await this.telegramBot.bot.sendMessage(chatId,
                `📱 *QR Code لربط WhatsApp*\n\n` +
                `🔗 *الرابط:* \`${qr}\`\n\n` +
                `انسخ هذا الرابط والصقه في متصفح لرؤية QR Code.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
    
    // ============================================
    // 4. معالجة جاهزية العميل
    // ============================================
    async handleClientReady(client, sessionId, adminId, chatId) {
        try {
            console.log(`✅ WhatsApp جاهز للجلسة: ${sessionId}`);
            
            const connectionData = {
                platform: client.info.platform,
                phone: client.info.phone,
                pushname: client.info.pushname,
                wid: client.info.wid._serialized,
                battery: client.info.battery,
                plugged: client.info.plugged,
                locale: client.info.locale
            };
            
            // تحديث الجلسة في قاعدة البيانات
            await WhatsAppSession.update(
                {
                    status: 'connected',
                    connectedAt: new Date(),
                    phoneNumber: client.info.phone?.user || 'غير معروف',
                    connectionData: connectionData,
                    lastActivity: new Date()
                },
                { where: { id: sessionId } }
            );
            
            // تحميل الردود التلقائية
            await this.loadAutoRepliesForSession(sessionId);
            
            // تحميل الانضمام التلقائي
            await this.loadAutoJoinsForSession(sessionId);
            
            // جمع المجموعات والجهات
            setTimeout(async () => {
                await this.collectGroupsAndContacts(client, sessionId);
            }, 3000);
            
            // إرسال إشعار الاتصال الناجح
            if (chatId) {
                await this.telegramBot.bot.sendMessage(chatId,
                    `🎉 *تم الربط بنجاح!*\n\n` +
                    `✅ *حساب WhatsApp متصل الآن*\n` +
                    `📱 الرقم: ${connectionData.phone?.user || 'غير معروف'}\n` +
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
            }
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة جاهزية العميل ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 5. معالجة الرسائل الواردة
    // ============================================
    async handleIncomingMessage(message, sessionId) {
        try {
            // تحديث إحصائيات الجلسة
            await WhatsAppSession.update(
                {
                    stats: {
                        messagesReceived: (message.stats?.messagesReceived || 0) + 1
                    },
                    lastActivity: new Date()
                },
                { where: { id: sessionId } }
            );
            
            // 1. تجميع الروابط من الرسالة
            await this.collectLinksFromMessage(message, sessionId);
            
            // 2. التحقق من الردود التلقائية
            await this.checkAutoReplies(message, sessionId);
            
            // 3. اكتشاف روابط الانضمام
            await this.detectJoinLinks(message, sessionId);
            
            // 4. إرسال إشعار للمشرف (للمراسلات الخاصة فقط)
            if (!message.from.includes('@g.us')) {
                await this.notifyAdminOfPrivateMessage(message, sessionId);
            }
            
            // 5. معالجة الرسائل المعينة
            await this.handleSpecificMessageTypes(message, sessionId);
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة رسالة WhatsApp للجلسة ${sessionId}:`, error);
        }
    }
    
    async collectLinksFromMessage(message, sessionId) {
        try {
            if (!message.body) return;
            
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.body.match(urlRegex) || [];
            
            if (links.length === 0) return;
            
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
                        hasMedia: !!message.hasMedia,
                        isGroup: message.from.includes('@g.us')
                    }
                });
                
                console.log(`✅ رابط جديد محفوظ: ${type} - ${url.substring(0, 50)}...`);
                
                // تحديث إحصائيات الجلسة
                await WhatsAppSession.update(
                    {
                        stats: {
                            linksCollected: (message.stats?.linksCollected || 0) + 1
                        }
                    },
                    { where: { id: sessionId } }
                );
            }
            
        } catch (error) {
            console.error('❌ خطأ في تجميع الروابط من الرسالة:', error);
        }
    }
    
    async checkAutoReplies(message, sessionId) {
        try {
            // الحصول على الردود التلقائية المخزنة في الذاكرة لهذه الجلسة
            const replies = this.autoReplies.get(sessionId) || [];
            
            if (replies.length === 0) return;
            
            const isGroup = message.from.includes('@g.us');
            const messageText = message.body || '';
            
            for (const reply of replies) {
                // التحقق من أن الرد نشط
                if (!reply.isActive) continue;
                
                // التحقق من نوع المحادثة
                if (reply.triggerType === 'private' && isGroup) continue;
                if (reply.triggerType === 'group' && !isGroup) continue;
                
                // التحقق من المطابقة
                let shouldReply = false;
                
                switch (reply.matchType) {
                    case 'exact':
                        shouldReply = messageText.trim() === reply.trigger;
                        break;
                    case 'contains':
                        shouldReply = messageText.toLowerCase().includes(reply.trigger.toLowerCase());
                        break;
                    case 'starts_with':
                        shouldReply = messageText.toLowerCase().startsWith(reply.trigger.toLowerCase());
                        break;
                    case 'ends_with':
                        shouldReply = messageText.toLowerCase().endsWith(reply.trigger.toLowerCase());
                        break;
                    case 'regex':
                        try {
                            const regex = new RegExp(reply.trigger, 'i');
                            shouldReply = regex.test(messageText);
                        } catch {
                            shouldReply = false;
                        }
                        break;
                }
                
                if (shouldReply) {
                    // إرسال الرد
                    await this.sendAutoReply(message, reply, sessionId);
                    
                    // تحديث إحصائيات الرد
                    reply.stats.triggered = (reply.stats.triggered || 0) + 1;
                    reply.stats.lastTriggered = new Date();
                    
                    // حفظ في قاعدة البيانات
                    await AutoReply.update(
                        { stats: reply.stats },
                        { where: { id: reply.id } }
                    );
                    
                    console.log(`🤖 تم إرسال رد تلقائي: ${reply.name}`);
                    
                    // خروج بعد أول رد مناسب
                    if (reply.priority >= 8) break;
                }
            }
            
        } catch (error) {
            console.error('❌ خطأ في الرد التلقائي:', error);
        }
    }
    
    async sendAutoReply(message, reply, sessionId) {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                console.log(`❌ العميل غير متصل للجلسة: ${sessionId}`);
                return;
            }
            
            // إرسال الرد بناءً على النوع
            if (reply.responseType === 'text') {
                await client.sendMessage(message.from, reply.response);
            } else if (reply.responseType === 'image') {
                // معالجة الصور
                // يمكن إضافة دعم للصور لاحقاً
                await client.sendMessage(message.from, reply.response);
            } else {
                await client.sendMessage(message.from, reply.response);
            }
            
            // تحديث إحصائيات الجلسة
            await WhatsAppSession.update(
                {
                    stats: {
                        messagesSent: (message.stats?.messagesSent || 0) + 1
                    }
                },
                { where: { id: sessionId } }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إرسال الرد التلقائي:', error);
            
            // تحديث إحصائيات الفشل
            reply.stats.failed = (reply.stats.failed || 0) + 1;
            await AutoReply.update(
                { stats: reply.stats },
                { where: { id: reply.id } }
            );
        }
    }
    
    async detectJoinLinks(message, sessionId) {
        try {
            if (!message.body) return;
            
            const whatsappInviteRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/g;
            const inviteLinks = message.body.match(whatsappInviteRegex) || [];
            
            if (inviteLinks.length === 0) return;
            
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
                await existing.update({
                    lastChecked: new Date(),
                    checkCount: (existing.checkCount || 0) + 1,
                    status: 'active'
                });
            } else {
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
    
    async notifyAdminOfPrivateMessage(message, sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) return;
            
            const admin = await require('./index').Admin.findByPk(session.adminId);
            if (!admin || !admin.settings?.notificationEnabled) return;
            
            // إرسال إشعار للمشرف
            const messagePreview = message.body 
                ? (message.body.length > 100 ? message.body.substring(0, 100) + '...' : message.body)
                : '📎 رسالة تحتوي على مرفق';
            
            await this.telegramBot.bot.sendMessage(admin.telegramId,
                `📨 *رسالة جديدة على WhatsApp*\n\n` +
                `📱 من: ${message.from}\n` +
                `🔗 الجلسة: ${session.phoneNumber}\n` +
                `📝 المحتوى:\n${messagePreview}\n\n` +
                `⏰ ${new Date().toLocaleTimeString('ar-SA')}`,
                { parse_mode: 'Markdown' }
            );
            
        } catch (error) {
            console.error('❌ خطأ في إرسال إشعار الرسالة:', error);
        }
    }
    
    async handleSpecificMessageTypes(message, sessionId) {
        try {
            // معالجة أنواع رسائل معينة
            if (message.type === 'location') {
                await this.handleLocationMessage(message, sessionId);
            } else if (message.type === 'contact') {
                await this.handleContactMessage(message, sessionId);
            } else if (message.type === 'image' || message.type === 'video') {
                await this.handleMediaMessage(message, sessionId);
            }
            
        } catch (error) {
            console.error('❌ خطأ في معالجة نوع رسالة محدد:', error);
        }
    }
    
    async handleLocationMessage(message, sessionId) {
        console.log(`📍 رسالة موقع من ${message.from}`);
        // يمكن إضافة معالجة الموقع هنا
    }
    
    async handleContactMessage(message, sessionId) {
        console.log(`📞 رسالة جهة اتصال من ${message.from}`);
        // يمكن إضافة معالجة جهات الاتصال هنا
    }
    
    async handleMediaMessage(message, sessionId) {
        console.log(`📷 رسالة وسائط من ${message.from}`);
        // يمكن إضافة معالجة الوسائط هنا
    }
    
    // ============================================
    // 6. معالجة تغيير الحالة
    // ============================================
    async handleStateChange(state, sessionId) {
        try {
            console.log(`📡 تغيير حالة الجلسة ${sessionId}: ${state}`);
            
            await WhatsAppSession.update(
                { 
                    status: state,
                    lastActivity: new Date() 
                },
                { where: { id: sessionId } }
            );
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة تغيير الحالة للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 7. معالجة فقدان الاتصال
    // ============================================
    async handleDisconnection(reason, sessionId, adminId) {
        try {
            console.log(`❌ فقدان الاتصال بالجلسة ${sessionId}: ${reason}`);
            
            await WhatsAppSession.update(
                {
                    status: 'disconnected',
                    disconnectedAt: new Date(),
                    lastActivity: new Date()
                },
                { where: { id: sessionId } }
            );
            
            // إغلاق العميل من الذاكرة
            if (this.clients.has(sessionId)) {
                const client = this.clients.get(sessionId);
                try {
                    await client.destroy();
                } catch (error) {
                    console.error(`❌ خطأ في إغلاق العميل ${sessionId}:`, error);
                }
                this.clients.delete(sessionId);
            }
            
            // إزالة الردود التلقائية
            this.autoReplies.delete(sessionId);
            
            // إزالة الانضمام التلقائي
            this.autoJoins.delete(sessionId);
            
            // إعلام المشرف
            if (adminId) {
                const admin = await require('./index').Admin.findByPk(adminId);
                if (admin && admin.settings?.notificationEnabled) {
                    await this.telegramBot.bot.sendMessage(admin.telegramId,
                        `⚠️ *تم فقدان الاتصال*\n\n` +
                        `📱 الجلسة: ${sessionId}\n` +
                        `📌 السبب: ${reason}\n` +
                        `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                        `استخدم /sessions لعرض الحالة وإعادة المحاولة.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة فقدان الاتصال للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 8. معالجة فشل المصادقة
    // ============================================
    async handleAuthFailure(error, sessionId, adminId) {
        try {
            console.error(`❌ فشل المصادقة للجلسة ${sessionId}:`, error);
            
            await WhatsAppSession.update(
                {
                    status: 'error',
                    lastActivity: new Date()
                },
                { where: { id: sessionId } }
            );
            
            // إزالة العميل من الذاكرة
            this.clients.delete(sessionId);
            this.autoReplies.delete(sessionId);
            this.autoJoins.delete(sessionId);
            
        } catch (updateError) {
            console.error(`❌ خطأ في تحديث حالة فشل المصادقة للجلسة ${sessionId}:`, updateError);
        }
    }
    
    // ============================================
    // 9. معالجة تغيير البطارية
    // ============================================
    async handleBatteryChange(batteryInfo, sessionId) {
        try {
            console.log(`🔋 حالة البطارية للجلسة ${sessionId}:`, batteryInfo);
            
            // يمكن تحديث حالة البطارية في قاعدة البيانات إذا لزم الأمر
            await WhatsAppSession.update(
                {
                    connectionData: {
                        battery: batteryInfo.battery,
                        plugged: batteryInfo.plugged
                    }
                },
                { where: { id: sessionId } }
            );
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة تغيير البطارية للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 10. معالجة محادثة جديدة
    // ============================================
    async handleNewChat(chat, sessionId) {
        try {
            console.log(`💬 محادثة جديدة للجلسة ${sessionId}:`, chat.name || chat.id._serialized);
            
            // تحديث عدد جهات الاتصال إذا كانت محادثة خاصة
            if (!chat.isGroup) {
                await WhatsAppSession.update(
                    {
                        contactsCount: (chat.contactsCount || 0) + 1
                    },
                    { where: { id: sessionId } }
                );
            }
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة محادثة جديدة للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 11. معالجة تأكيد الرسالة
    // ============================================
    async handleMessageAck(message, ack, sessionId) {
        try {
            // يمكن تسجيل تأكيد الرسالة إذا لزم الأمر
            console.log(`✅ تأكيد رسالة للجلسة ${sessionId}:`, ack);
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة تأكيد الرسالة للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 12. معالجة حذف محادثة
    // ============================================
    async handleChatRemoved(chat, sessionId) {
        try {
            console.log(`🗑️ حذف محادثة للجلسة ${sessionId}:`, chat.name || chat.id._serialized);
            
        } catch (error) {
            console.error(`❌ خطأ في معالجة حذف محادثة للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 13. تجميع المجموعات والجهات
    // ============================================
    async collectGroupsAndContacts(client, sessionId) {
        try {
            console.log(`📊 جاري تجميع بيانات الجلسة: ${sessionId}`);
            
            const chats = await client.getChats();
            
            const groups = chats.filter(chat => chat.isGroup);
            const contacts = chats.filter(chat => !chat.isGroup && chat.isUser);
            
            console.log(`📈 جمع ${groups.length} مجموعة و ${contacts.length} جهة اتصال`);
            
            // تحديث إحصائيات الجلسة
            await WhatsAppSession.update(
                {
                    groupsCount: groups.length,
                    contactsCount: contacts.length,
                    lastActivity: new Date(),
                    stats: {
                        groupsCollected: groups.length,
                        contactsCollected: contacts.length
                    }
                },
                { where: { id: sessionId } }
            );
            
            // تجميع روابط المجموعات
            await this.collectGroupLinks(client, sessionId, groups);
            
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
            
            for (const group of groups.slice(0, 30)) { // تحد من عدد المجموعات
                try {
                    const inviteCode = await group.getInviteCode();
                    if (inviteCode) {
                        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                        
                        const existingLink = await CollectedLink.findOne({
                            where: { url: inviteLink }
                        });
                        
                        if (!existingLink) {
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
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                } catch (error) {
                    console.log(`⚠️ لا يمكن الحصول على رابط المجموعة: ${group.name || 'غير معروفة'}`);
                }
            }
            
            console.log(`🎯 تم تجميع ${collectedCount} رابط جديد`);
            
            // تحديث إحصائيات الجلسة
            await WhatsAppSession.update(
                {
                    stats: {
                        linksCollected: (group.stats?.linksCollected || 0) + collectedCount
                    }
                },
                { where: { id: sessionId } }
            );
            
        } catch (error) {
            console.error('❌ خطأ في تجميع روابط المجموعات:', error);
        }
    }
    
    // ============================================
    // 14. تحميل الردود التلقائية
    // ============================================
    async loadAutoRepliesForSession(sessionId) {
        try {
            const replies = await AutoReply.findAll({
                where: {
                    [Op.or]: [
                        { sessionId: sessionId },
                        { sessionId: null }
                    ],
                    isActive: true
                },
                order: [['priority', 'DESC']]
            });
            
            this.autoReplies.set(sessionId, replies);
            console.log(`🤖 تم تحميل ${replies.length} رد تلقائي للجلسة ${sessionId}`);
            
        } catch (error) {
            console.error(`❌ خطأ في تحميل الردود التلقائية للجلسة ${sessionId}:`, error);
        }
    }
    
    async reloadAutoRepliesForSession(sessionId) {
        try {
            await this.loadAutoRepliesForSession(sessionId);
            return true;
        } catch (error) {
            console.error(`❌ خطأ في إعادة تحميل الردود التلقائية:`, error);
            return false;
        }
    }
    
    // ============================================
    // 15. تحميل الانضمام التلقائي
    // ============================================
    async loadAutoJoinsForSession(sessionId) {
        try {
            const autoJoins = await AutoJoin.findAll({
                where: {
                    sessionId: sessionId,
                    status: 'active'
                }
            });
            
            this.autoJoins.set(sessionId, autoJoins);
            console.log(`➕ تم تحميل ${autoJoins.length} عملية انضمام للجلسة ${sessionId}`);
            
        } catch (error) {
            console.error(`❌ خطأ في تحميل الانضمام التلقائي للجلسة ${sessionId}:`, error);
        }
    }
    
    // ============================================
    // 16. الانضمام لمجموعة واتساب
    // ============================================
    async joinWhatsAppGroup(inviteLink, sessionId) {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                console.log(`❌ العميل غير متصل للانضمام: ${sessionId}`);
                return false;
            }
            
            const inviteCode = inviteLink.split('/').pop();
            
            console.log(`➕ محاولة الانضمام للمجموعة: ${inviteLink}`);
            
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
                autoJoin.stats.joined = (autoJoin.stats.joined || 0) + 1;
                autoJoin.stats.totalLinks = (autoJoin.stats.totalLinks || 0) + 1;
                autoJoin.stats.successRate = autoJoin.stats.joined / autoJoin.stats.totalLinks * 100;
                autoJoin.stats.lastJoinAt = new Date();
                autoJoin.stats.lastLinks = [...(autoJoin.stats.lastLinks || []).slice(-9), inviteLink];
                
                await autoJoin.update({ stats: autoJoin.stats });
            }
            
            // إرسال إشعار للمشرف
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                const admin = await require('./index').Admin.findByPk(session.adminId);
                if (admin && admin.settings?.notificationEnabled) {
                    await this.telegramBot.bot.sendMessage(admin.telegramId,
                        `✅ *تم الانضمام التلقائي لمجموعة جديدة*\n\n` +
                        `🔗 الرابط: ${inviteLink}\n` +
                        `📱 الجلسة: ${session.phoneNumber}\n` +
                        `👤 العضو: ${session.connectionData?.pushname || 'غير معروف'}\n` +
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
                autoJoin.stats.failed = (autoJoin.stats.failed || 0) + 1;
                autoJoin.stats.totalLinks = (autoJoin.stats.totalLinks || 0) + 1;
                autoJoin.stats.successRate = autoJoin.stats.joined / autoJoin.stats.totalLinks * 100;
                autoJoin.stats.lastError = error.message;
                
                await autoJoin.update({ stats: autoJoin.stats });
            }
            
            return false;
        }
    }
    
    // ============================================
    // 17. إرسال رسالة
    // ============================================
    async sendMessage(sessionId, to, message) {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                throw new Error('العميل غير متصل');
            }
            
            const result = await client.sendMessage(to, message);
            
            // تحديث إحصائيات الجلسة
            await WhatsAppSession.update(
                {
                    stats: {
                        messagesSent: (session.stats?.messagesSent || 0) + 1
                    },
                    lastActivity: new Date()
                },
                { where: { id: sessionId } }
            );
            
            return result;
            
        } catch (error) {
            console.error(`❌ خطأ في إرسال رسالة:`, error);
            throw error;
        }
    }
    
    // ============================================
    // 18. إرسال رسالة وسائط
    // ============================================
    async sendMedia(sessionId, to, mediaPath, caption = '') {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                throw new Error('العميل غير متصل');
            }
            
            const media = MessageMedia.fromFilePath(mediaPath);
            media.caption = caption;
            
            const result = await client.sendMessage(to, media);
            
            // تحديث إحصائيات الجلسة
            await WhatsAppSession.update(
                {
                    lastActivity: new Date()
                },
                { where: { id: sessionId } }
            );
            
            return result;
            
        } catch (error) {
            console.error(`❌ خطأ في إرسال وسائط:`, error);
            throw error;
        }
    }
    
    // ============================================
    // 19. الحصول على معلومات العميل
    // ============================================
    async getClientInfo(sessionId) {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                return null;
            }
            
            return {
                isConnected: true,
                info: client.info,
                state: client.state
            };
        } catch (error) {
            console.error(`❌ خطأ في الحصول على معلومات العميل:`, error);
            return null;
        }
    }
    
    // ============================================
    // 20. إغلاق جلسة
    // ============================================
    async closeSession(sessionId) {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                return false;
            }
            
            await client.destroy();
            this.clients.delete(sessionId);
            this.autoReplies.delete(sessionId);
            this.autoJoins.delete(sessionId);
            
            // تحديث حالة الجلسة
            await WhatsAppSession.update(
                {
                    status: 'disconnected',
                    disconnectedAt: new Date()
                },
                { where: { id: sessionId } }
            );
            
            console.log(`✅ تم إغلاق جلسة WhatsApp: ${sessionId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في إغلاق الجلسة:`, error);
            return false;
        }
    }
    
    // ============================================
    // 21. إعادة تشغيل جلسة
    // ============================================
    async restartSession(sessionId) {
        try {
            const session = await WhatsAppSession.findByPk(sessionId);
            if (!session) {
                throw new Error('الجلسة غير موجودة');
            }
            
            // إغلاق الجلسة الحالية
            await this.closeSession(sessionId);
            
            // إنشاء جلسة جديدة
            const client = await this.createSession(sessionId, session.adminId, null);
            
            console.log(`🔄 تم إعادة تشغيل جلسة WhatsApp: ${sessionId}`);
            return client;
            
        } catch (error) {
            console.error(`❌ خطأ في إعادة تشغيل الجلسة:`, error);
            throw error;
        }
    }
    
    // ============================================
    // 22. الحصول على جميع الجلسات النشطة
    // ============================================
    getActiveSessions() {
        const activeSessions = [];
        
        for (const [sessionId, client] of this.clients.entries()) {
            if (client.info) {
                activeSessions.push({
                    sessionId,
                    phoneNumber: client.info.phone?.user,
                    pushname: client.info.pushname,
                    isConnected: true
                });
            }
        }
        
        return activeSessions;
    }
    
    // ============================================
    // 23. الحصول على جلسة معينة
    // ============================================
    getSession(sessionId) {
        return this.clients.get(sessionId) || null;
    }
    
    // ============================================
    // 24. التحقق من اتصال الجلسة
    // ============================================
    isSessionConnected(sessionId) {
        const client = this.clients.get(sessionId);
        return client ? !!client.info : false;
    }
    
    // ============================================
    // 25. البث الجماعي
    // ============================================
    async broadcastMessage(sessionId, message, targetType = 'groups') {
        try {
            const client = this.clients.get(sessionId);
            if (!client) {
                throw new Error('العميل غير متصل');
            }
            
            const chats = await client.getChats();
            let targets = [];
            
            if (targetType === 'groups') {
                targets = chats.filter(chat => chat.isGroup);
            } else if (targetType === 'contacts') {
                targets = chats.filter(chat => !chat.isGroup && chat.isUser);
            } else {
                targets = chats;
            }
            
            console.log(`📨 بدء البث لـ ${targets.length} هدف`);
            
            let sentCount = 0;
            let failedCount = 0;
            
            for (const target of targets) {
                try {
                    await client.sendMessage(target.id._serialized, message);
                    sentCount++;
                    
                    // تأخير 1 ثانية بين الرسائل
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`❌ فشل إرسال لـ ${target.name || target.id._serialized}:`, error.message);
                    failedCount++;
                }
            }
            
            return {
                total: targets.length,
                sent: sentCount,
                failed: failedCount,
                successRate: (sentCount / targets.length) * 100
            };
            
        } catch (error) {
            console.error(`❌ خطأ في البث الجماعي:`, error);
            throw error;
        }
    }
    
    // ============================================
    // 26. تنظيف الموارد
    // ============================================
    async cleanup() {
        console.log('🧹 جاري تنظيف موارد مدير WhatsApp...');
        
        for (const [sessionId, client] of this.clients.entries()) {
            try {
                await client.destroy();
                console.log(`✅ تم إغلاق جلسة: ${sessionId}`);
            } catch (error) {
                console.error(`❌ خطأ في إغلاق جلسة ${sessionId}:`, error);
            }
        }
        
        this.clients.clear();
        this.autoReplies.clear();
        this.autoJoins.clear();
        
        console.log('✅ تم تنظيف جميع موارد مدير WhatsApp');
    }
}

module.exports = WhatsAppClientManager;
