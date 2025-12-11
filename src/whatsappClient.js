// ============================================
// مدير واتساب - نظام الجهاز المصاحب وجلسات متعددة
// ============================================

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');

// ============================================
// 1. فئة مدير الجلسات الفردية
// ============================================
class WhatsAppSession extends EventEmitter {
    constructor(sessionId, adminId, phoneNumber = null) {
        super();
        
        this.sessionId = sessionId;
        this.adminId = adminId;
        this.phoneNumber = phoneNumber;
        this.status = 'initializing';
        this.client = null;
        this.qrCode = null;
        this.lastActivity = new Date();
        this.metadata = {
            connectedAt: null,
            chatsCount: 0,
            groupsCount: 0,
            messagesSent: 0,
            messagesReceived: 0
        };
        
        // إعدادات الجلسة
        this.config = {
            authStrategy: new LocalAuth({ 
                clientId: `whatsapp-session-${sessionId}`,
                dataPath: path.join(process.env.WHATSAPP_SESSION_DIR || './sessions', sessionId)
            }),
            puppeteer: {
                headless: process.env.BROWSER_HEADLESS !== 'false',
                args: (process.env.BROWSER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(','),
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
            },
            restartOnAuthFail: true,
            takeoverOnConflict: true,
            qrMaxRetries: 3,
            qrTimeout: parseInt(process.env.WHATSAPP_QR_TIMEOUT) || 60000
        };
        
        this.initialize();
    }
    
    // ============================================
    // 2. تهيئة الجلسة
    // ============================================
    async initialize() {
        try {
            console.log(chalk.blue(`🔄 جاري تهيئة جلسة ${this.sessionId.substring(0, 8)}...`));
            
            this.status = 'initializing';
            this.emit('statusChange', this.status);
            
            // إنشاء مجلد الجلسة إذا لم يكن موجوداً
            const sessionDir = path.join(process.env.WHATSAPP_SESSION_DIR || './sessions', this.sessionId);
            await fs.mkdir(sessionDir, { recursive: true });
            
            // إنشاء عميل واتساب
            this.client = new Client(this.config);
            
            // ============================================
            // 3. إعداد معالجات الأحداث
            // ============================================
            
            // حدث QR Code
            this.client.on('qr', (qr) => {
                console.log(chalk.yellow(`📱 QR Code للجلسة ${this.sessionId.substring(0, 8)}`));
                
                this.qrCode = qr;
                this.status = 'awaiting_qr';
                this.lastActivity = new Date();
                
                // عرض QR في الكونسول
                qrcode.generate(qr, { small: true });
                
                // إرسال الحدث
                this.emit('qr', {
                    sessionId: this.sessionId,
                    qrCode: qr,
                    qrTerminal: qrcode.generate(qr, { small: false })
                });
            });
            
            // حدث جاهزية
            this.client.on('ready', () => {
                console.log(chalk.green(`✅ جلسة ${this.sessionId.substring(0, 8)} جاهزة!`));
                
                this.status = 'ready';
                this.metadata.connectedAt = new Date();
                this.lastActivity = new Date();
                
                // تحديث معلومات الجلسة
                this.updateSessionInfo();
                
                this.emit('ready', {
                    sessionId: this.sessionId,
                    phoneNumber: this.client.info.wid.user,
                    metadata: this.metadata
                });
            });
            
            // حدث المصادقة
            this.client.on('authenticated', () => {
                console.log(chalk.green(`🔐 جلسة ${this.sessionId.substring(0, 8)} تمت المصادقة`));
                this.status = 'authenticated';
                this.emit('authenticated', this.sessionId);
            });
            
            // حدث فصل الاتصال
            this.client.on('disconnected', (reason) => {
                console.log(chalk.red(`❌ جلسة ${this.sessionId.substring(0, 8)} تم فصلها: ${reason}`));
                
                this.status = 'disconnected';
                this.qrCode = null;
                this.lastActivity = new Date();
                
                this.emit('disconnected', {
                    sessionId: this.sessionId,
                    reason: reason
                });
                
                // إعادة المحاولة التلقائية بعد 30 ثانية
                if (reason === 'NAVIGATION') {
                    setTimeout(() => {
                        this.reconnect();
                    }, 30000);
                }
            });
            
            // حدث الرسائل
            this.client.on('message', async (message) => {
                this.lastActivity = new Date();
                this.metadata.messagesReceived++;
                
                // تمرير الرسالة للمعالجين
                this.emit('message', {
                    sessionId: this.sessionId,
                    message: message,
                    timestamp: new Date()
                });
            });
            
            // حدث الرسائل الخاصة
            this.client.on('message_create', async (message) => {
                if (message.fromMe) {
                    this.metadata.messagesSent++;
                    this.lastActivity = new Date();
                }
            });
            
            // حدث الانضمام للمجموعة
            this.client.on('group_join', async (notification) => {
                console.log(chalk.cyan(`👥 انضمام لمجموعة في الجلسة ${this.sessionId.substring(0, 8)}`));
                
                this.emit('groupJoin', {
                    sessionId: this.sessionId,
                    groupId: notification.id.remote,
                    participant: notification.recipientIds[0],
                    timestamp: new Date()
                });
            });
            
            // حدث مغادرة المجموعة
            this.client.on('group_leave', async (notification) => {
                console.log(chalk.yellow(`👥 مغادرة مجموعة في الجلسة ${this.sessionId.substring(0, 8)}`));
                
                this.emit('groupLeave', {
                    sessionId: this.sessionId,
                    groupId: notification.id.remote,
                    participant: notification.recipientIds[0],
                    timestamp: new Date()
                });
            });
            
            // حدث الأخطاء
            this.client.on('auth_failure', (error) => {
                console.log(chalk.red(`❌ فشل مصادقة للجلسة ${this.sessionId.substring(0, 8)}: ${error}`));
                
                this.status = 'auth_failure';
                this.emit('authFailure', {
                    sessionId: this.sessionId,
                    error: error
                });
            });
            
            // بدء العميل
            await this.client.initialize();
            
            console.log(chalk.blue(`⚙️  جلسة ${this.sessionId.substring(0, 8)} تم تهيئتها`));
            
        } catch (error) {
            console.log(chalk.red(`❌ خطأ في تهيئة جلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            
            this.status = 'error';
            this.emit('error', {
                sessionId: this.sessionId,
                error: error.message
            });
            
            throw error;
        }
    }
    
    // ============================================
    // 4. تحديث معلومات الجلسة
    // ============================================
    async updateSessionInfo() {
        if (!this.client || this.status !== 'ready') return;
        
        try {
            const chats = await this.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            this.metadata.chatsCount = chats.length;
            this.metadata.groupsCount = groups.length;
            this.phoneNumber = this.client.info.wid.user;
            
            // تحديث الحدث
            this.emit('infoUpdate', {
                sessionId: this.sessionId,
                metadata: this.metadata
            });
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️  خطأ في تحديث معلومات الجلسة: ${error.message}`));
        }
    }
    
    // ============================================
    // 5. إعادة الاتصال
    // ============================================
    async reconnect() {
        console.log(chalk.blue(`🔄 إعادة اتصال للجلسة ${this.sessionId.substring(0, 8)}...`));
        
        try {
            if (this.client) {
                await this.client.destroy();
            }
            
            this.status = 'reconnecting';
            this.emit('statusChange', this.status);
            
            await this.initialize();
            
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ فشل إعادة الاتصال للجلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            return false;
        }
    }
    
    // ============================================
    // 6. إرسال رسالة
    // ============================================
    async sendMessage(to, content, options = {}) {
        if (!this.client || this.status !== 'ready') {
            throw new Error('الجلسة غير جاهزة للإرسال');
        }
        
        try {
            const result = await this.client.sendMessage(to, content, options);
            
            this.metadata.messagesSent++;
            this.lastActivity = new Date();
            
            this.emit('messageSent', {
                sessionId: this.sessionId,
                to: to,
                content: content,
                messageId: result.id.id,
                timestamp: new Date()
            });
            
            return result;
        } catch (error) {
            console.log(chalk.red(`❌ فشل إرسال رسالة من الجلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            
            this.emit('messageError', {
                sessionId: this.sessionId,
                to: to,
                error: error.message
            });
            
            throw error;
        }
    }
    
    // ============================================
    // 7. جمع الروابط من المحادثات
    // ============================================
    async collectLinks(limit = 100) {
        if (!this.client || this.status !== 'ready') {
            throw new Error('الجلسة غير جاهزة لجمع الروابط');
        }
        
        try {
            const chats = await this.client.getChats();
            const links = [];
            const linkRegex = /(https?:\/\/[^\s]+)/g;
            
            for (const chat of chats.slice(0, limit)) {
                const messages = await chat.fetchMessages({ limit: 50 });
                
                for (const message of messages) {
                    if (message.body) {
                        const matches = message.body.match(linkRegex);
                        
                        if (matches) {
                            for (const url of matches) {
                                links.push({
                                    url: url,
                                    chatId: chat.id._serialized,
                                    chatName: chat.name,
                                    messageId: message.id.id,
                                    timestamp: message.timestamp,
                                    sessionId: this.sessionId
                                });
                            }
                        }
                    }
                }
            }
            
            this.emit('linksCollected', {
                sessionId: this.sessionId,
                count: links.length,
                links: links
            });
            
            return links;
        } catch (error) {
            console.log(chalk.red(`❌ فشل جمع الروابط من الجلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            throw error;
        }
    }
    
    // ============================================
    // 8. الانضمام لمجموعة عبر الرابط
    // ============================================
    async joinGroup(inviteLink) {
        if (!this.client || this.status !== 'ready') {
            throw new Error('الجلسة غير جاهزة للانضمام');
        }
        
        try {
            const result = await this.client.acceptInvite(inviteLink);
            
            console.log(chalk.green(`✅ انضمام ناجح لمجموعة من الجلسة ${this.sessionId.substring(0, 8)}`));
            
            this.emit('groupJoined', {
                sessionId: this.sessionId,
                groupId: result.id._serialized,
                groupName: result.name,
                inviteLink: inviteLink,
                timestamp: new Date()
            });
            
            return result;
        } catch (error) {
            console.log(chalk.red(`❌ فشل الانضمام للمجموعة من الجلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            
            this.emit('groupJoinError', {
                sessionId: this.sessionId,
                inviteLink: inviteLink,
                error: error.message
            });
            
            throw error;
        }
    }
    
    // ============================================
    // 9. الحصول على جميع المجموعات
    // ============================================
    async getGroups() {
        if (!this.client || this.status !== 'ready') {
            throw new Error('الجلسة غير جاهزة');
        }
        
        try {
            const chats = await this.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            return groups.map(group => ({
                id: group.id._serialized,
                name: group.name,
                participantsCount: group.participants.length,
                isReadOnly: group.isReadOnly,
                timestamp: group.timestamp
            }));
        } catch (error) {
            console.log(chalk.red(`❌ فشل جلب المجموعات من الجلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            throw error;
        }
    }
    
    // ============================================
    // 10. إنهاء الجلسة
    // ============================================
    async destroy() {
        console.log(chalk.yellow(`🛑 إنهاء جلسة ${this.sessionId.substring(0, 8)}...`));
        
        try {
            if (this.client) {
                await this.client.destroy();
            }
            
            this.status = 'destroyed';
            this.emit('destroyed', this.sessionId);
            
            console.log(chalk.green(`✅ جلسة ${this.sessionId.substring(0, 8)} تم إنهاؤها`));
            
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ خطأ في إنهاء الجلسة ${this.sessionId.substring(0, 8)}: ${error.message}`));
            return false;
        }
    }
    
    // ============================================
    // 11. الحصول على معلومات الجلسة
    // ============================================
    getInfo() {
        return {
            sessionId: this.sessionId,
            adminId: this.adminId,
            phoneNumber: this.phoneNumber,
            status: this.status,
            qrCode: this.qrCode,
            lastActivity: this.lastActivity,
            metadata: this.metadata,
            isReady: this.status === 'ready'
        };
    }
}

// ============================================
// 12. فئة مدير الجلسات الرئيسي
// ============================================
class WhatsAppManager extends EventEmitter {
    constructor() {
        super();
        
        this.sessions = new Map(); // sessionId -> WhatsAppSession
        this.adminSessions = new Map(); // adminId -> [sessionId1, sessionId2, ...]
        this.status = 'initialized';
        
        console.log(chalk.cyan('🚀 مدير جلسات واتساب تم تهيئته'));
    }
    
    // ============================================
    // 13. إنشاء جلسة جديدة
    // ============================================
    async createSession(adminId, phoneNumber = null) {
        try {
            // التحقق من الحد الأقصى للجلسات للمشرف
            const adminSessionIds = this.adminSessions.get(adminId) || [];
            const maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 5;
            
            if (adminSessionIds.length >= maxSessions) {
                throw new Error(`وصلت للحد الأقصى من الجلسات (${maxSessions})`);
            }
            
            // إنشاء معرف فريد للجلسة
            const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
            
            console.log(chalk.blue(`➕ إنشاء جلسة جديدة ${sessionId.substring(0, 8)} للمشرف ${adminId}`));
            
            // إنشاء الجلسة
            const session = new WhatsAppSession(sessionId, adminId, phoneNumber);
            
            // تخزين الجلسة
            this.sessions.set(sessionId, session);
            this.adminSessions.set(adminId, [...adminSessionIds, sessionId]);
            
            // تتبع أحداث الجلسة
            this.setupSessionListeners(session);
            
            this.emit('sessionCreated', {
                sessionId: sessionId,
                adminId: adminId,
                phoneNumber: phoneNumber
            });
            
            return sessionId;
            
        } catch (error) {
            console.log(chalk.red(`❌ فشل إنشاء جلسة: ${error.message}`));
            throw error;
        }
    }
    
    // ============================================
    // 14. إعداد معالجات أحداث الجلسة
    // ============================================
    setupSessionListeners(session) {
        // تتبع جميع أحداث الجلسة
        session.on('qr', (data) => {
            this.emit('sessionQR', data);
        });
        
        session.on('ready', (data) => {
            this.emit('sessionReady', data);
        });
        
        session.on('message', (data) => {
            this.emit('sessionMessage', data);
        });
        
        session.on('disconnected', (data) => {
            this.emit('sessionDisconnected', data);
        });
        
        session.on('error', (data) => {
            this.emit('sessionError', data);
        });
    }
    
    // ============================================
    // 15. الحصول على جلسة
    // ============================================
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    
    // ============================================
    // 16. الحصول على جلسات المشرف
    // ============================================
    getAdminSessions(adminId) {
        const sessionIds = this.adminSessions.get(adminId) || [];
        return sessionIds.map(id => this.getSession(id)).filter(s => s !== undefined);
    }
    
    // ============================================
    // 17. جلسات جاهزة للمشرف
    // ============================================
    getReadySessions(adminId = null) {
        if (adminId) {
            const sessions = this.getAdminSessions(adminId);
            return sessions.filter(s => s.status === 'ready');
        }
        
        return Array.from(this.sessions.values()).filter(s => s.status === 'ready');
    }
    
    // ============================================
    // 18. حذف جلسة
    // ============================================
    async deleteSession(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            
            if (!session) {
                throw new Error('الجلسة غير موجودة');
            }
            
            // إنهاء الجلسة
            await session.destroy();
            
            // إزالة من التخزين
            this.sessions.delete(sessionId);
            
            // إزالة من قائمة المشرف
            const adminId = session.adminId;
            const adminSessionIds = this.adminSessions.get(adminId) || [];
            const updatedSessionIds = adminSessionIds.filter(id => id !== sessionId);
            
            if (updatedSessionIds.length === 0) {
                this.adminSessions.delete(adminId);
            } else {
                this.adminSessions.set(adminId, updatedSessionIds);
            }
            
            this.emit('sessionDeleted', {
                sessionId: sessionId,
                adminId: adminId
            });
            
            console.log(chalk.green(`🗑️  جلسة ${sessionId.substring(0, 8)} تم حذفها`));
            
            return true;
            
        } catch (error) {
            console.log(chalk.red(`❌ فشل حذف الجلسة: ${error.message}`));
            throw error;
        }
    }
    
    // ============================================
    // 19. إرسال رسالة من أي جلسة جاهزة
    // ============================================
    async sendMessageFromAnySession(to, content, options = {}) {
        const readySessions = this.getReadySessions();
        
        if (readySessions.length === 0) {
            throw new Error('لا توجد جلسات جاهزة للإرسال');
        }
        
        // استخدام الجلسة الأولى الجاهزة
        const session = readySessions[0];
        
        try {
            const result = await session.sendMessage(to, content, options);
            return {
                sessionId: session.sessionId,
                ...result
            };
        } catch (error) {
            // محاولة جلسة أخرى إذا فشلت الأولى
            if (readySessions.length > 1) {
                const backupSession = readySessions[1];
                const result = await backupSession.sendMessage(to, content, options);
                
                return {
                    sessionId: backupSession.sessionId,
                    ...result
                };
            }
            
            throw error;
        }
    }
    
    // ============================================
    // 20. جمع الروابط من جميع الجلسات
    // ============================================
    async collectLinksFromAllSessions() {
        const readySessions = this.getReadySessions();
        const allLinks = [];
        
        console.log(chalk.blue(`🔍 جمع الروابط من ${readySessions.length} جلسة...`));
        
        for (const session of readySessions) {
            try {
                const links = await session.collectLinks(50);
                allLinks.push(...links);
                
                console.log(chalk.green(`✅ جلسة ${session.sessionId.substring(0, 8)}: جمعت ${links.length} رابط`));
            } catch (error) {
                console.log(chalk.yellow(`⚠️  جلسة ${session.sessionId.substring(0, 8)}: فشل جمع الروابط`));
            }
        }
        
        return allLinks;
    }
    
    // ============================================
    // 21. الانضمام للمجموعات من الروابط
    // ============================================
    async joinGroupsFromLinks(inviteLinks, sessionId = null) {
        const results = {
            successful: [],
            failed: []
        };
        
        // تحديد الجلسة (أو استخدام جلسة جاهزة)
        let targetSession;
        
        if (sessionId) {
            targetSession = this.getSession(sessionId);
            if (!targetSession || targetSession.status !== 'ready') {
                throw new Error('الجلسة المحددة غير جاهزة');
            }
        } else {
            const readySessions = this.getReadySessions();
            if (readySessions.length === 0) {
                throw new Error('لا توجد جلسات جاهزة');
            }
            targetSession = readySessions[0];
        }
        
        console.log(chalk.blue(`👥 الانضمام لـ ${inviteLinks.length} مجموعة عبر جلسة ${targetSession.sessionId.substring(0, 8)}...`));
        
        // الانضمام للمجموعات مع تأخير بين المحاولات
        for (const [index, link] of inviteLinks.entries()) {
            try {
                // تأخير بين المحاولات لتجنب الحظر
                if (index > 0) {
                    const delay = parseInt(process.env.AUTO_JOIN_DELAY_BETWEEN) || 2000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                const group = await targetSession.joinGroup(link);
                
                results.successful.push({
                    link: link,
                    groupId: group.id._serialized,
                    groupName: group.name
                });
                
                console.log(chalk.green(`✅ انضممت بنجاح للمجموعة: ${group.name}`));
                
            } catch (error) {
                results.failed.push({
                    link: link,
                    error: error.message
                });
                
                console.log(chalk.red(`❌ فشل الانضمام للمجموعة: ${error.message}`));
            }
        }
        
        return results;
    }
    
    // ============================================
    // 22. النشر التلقائي للإعلانات
    // ============================================
    async autoPostAdvertisement(adContent, targetGroups = null, interval = 1000) {
        const readySessions = this.getReadySessions();
        
        if (readySessions.length === 0) {
            throw new Error('لا توجد جلسات جاهزة للنشر');
        }
        
        // تحديد المجموعات المستهدفة
        let groupsToPost = targetGroups;
        if (!groupsToPost) {
            // جلب جميع المجموعات من جميع الجلسات
            const allGroups = [];
            
            for (const session of readySessions) {
                try {
                    const sessionGroups = await session.getGroups();
                    allGroups.push(...sessionGroups.map(g => ({
                        ...g,
                        sessionId: session.sessionId
                    })));
                } catch (error) {
                    console.log(chalk.yellow(`⚠️  فشل جلب مجموعات الجلسة ${session.sessionId.substring(0, 8)}`));
                }
            }
            
            groupsToPost = allGroups;
        }
        
        console.log(chalk.blue(`📢 بدء النشر في ${groupsToPost.length} مجموعة...`));
        
        const results = {
            sent: 0,
            failed: 0,
            details: []
        };
        
        // النشر في المجموعات مع التأخير
        for (const [index, group] of groupsToPost.entries()) {
            try {
                // تأخير بين المجموعات
                if (index > 0) {
                    await new Promise(resolve => setTimeout(resolve, interval));
                }
                
                const session = this.getSession(group.sessionId);
                if (!session || session.status !== 'ready') {
                    throw new Error('الجلسة غير متاحة');
                }
                
                await session.sendMessage(group.id, adContent.content, adContent.options);
                
                results.sent++;
                results.details.push({
                    groupId: group.id,
                    groupName: group.name,
                    status: 'success',
                    timestamp: new Date()
                });
                
                console.log(chalk.green(`✅ نشر في ${group.name}`));
                
            } catch (error) {
                results.failed++;
                results.details.push({
                    groupId: group.id,
                    groupName: group.name,
                    status: 'failed',
                    error: error.message,
                    timestamp: new Date()
                });
                
                console.log(chalk.red(`❌ فشل النشر في ${group.name}: ${error.message}`));
            }
        }
        
        console.log(chalk.cyan(`📊 نتائج النشر: ${results.sent} ناجح، ${results.failed} فاشل`));
        
        return results;
    }
    
    // ============================================
    // 23. حفظ جميع الجلسات
    // ============================================
    async saveAllSessions() {
        console.log(chalk.blue('💾 جاري حفظ جميع الجلسات...'));
        
        const sessionsData = {};
        
        for (const [sessionId, session] of this.sessions.entries()) {
            sessionsData[sessionId] = {
                adminId: session.adminId,
                phoneNumber: session.phoneNumber,
                status: session.status,
                metadata: session.metadata,
                lastActivity: session.lastActivity
            };
        }
        
        try {
            const saveDir = process.env.WHATSAPP_SESSION_DIR || './sessions';
            await fs.mkdir(saveDir, { recursive: true });
            
            const savePath = path.join(saveDir, 'sessions_backup.json');
            await fs.writeFile(savePath, JSON.stringify(sessionsData, null, 2));
            
            console.log(chalk.green(`✅ تم حفظ ${Object.keys(sessionsData).length} جلسة`));
            return true;
            
        } catch (error) {
            console.log(chalk.red(`❌ فشل حفظ الجلسات: ${error.message}`));
            return false;
        }
    }
    
    // ============================================
    // 24. تحميل الجلسات المحفوظة
    // ============================================
    async loadSavedSessions() {
        try {
            const savePath = path.join(process.env.WHATSAPP_SESSION_DIR || './sessions', 'sessions_backup.json');
            
            const data = await fs.readFile(savePath, 'utf8');
            const sessionsData = JSON.parse(data);
            
            console.log(chalk.blue(`📂 جاري تحميل ${Object.keys(sessionsData).length} جلسة محفوظة...`));
            
            for (const [sessionId, sessionInfo] of Object.entries(sessionsData)) {
                // إنشاء الجلسات المحفوظة
                await this.createSession(sessionInfo.adminId, sessionInfo.phoneNumber);
            }
            
            console.log(chalk.green('✅ تم تحميل الجلسات المحفوظة'));
            return true;
            
        } catch (error) {
            console.log(chalk.yellow('⚠️  لا توجد جلسات محفوظة للتحميل'));
            return false;
        }
    }
    
    // ============================================
    // 25. الحصول على إحصائيات
    // ============================================
    getStats() {
        const totalSessions = this.sessions.size;
        const readySessions = this.getReadySessions().length;
        const totalAdmins = this.adminSessions.size;
        
        // حساب المجموع الكلي للرسائل
        let totalMessagesSent = 0;
        let totalMessagesReceived = 0;
        
        for (const session of this.sessions.values()) {
            totalMessagesSent += session.metadata.messagesSent || 0;
            totalMessagesReceived += session.metadata.messagesReceived || 0;
        }
        
        return {
            totalSessions,
            readySessions,
            totalAdmins,
            totalMessagesSent,
            totalMessagesReceived,
            sessionsByStatus: this.getSessionsByStatus(),
            adminsWithSessions: Array.from(this.adminSessions.entries()).map(([adminId, sessionIds]) => ({
                adminId,
                sessionCount: sessionIds.length,
                readySessions: sessionIds.filter(id => {
                    const session = this.sessions.get(id);
                    return session && session.status === 'ready';
                }).length
            }))
        };
    }
    
    // ============================================
    // 26. الحصول على الجلسات حسب الحالة
    // ============================================
    getSessionsByStatus() {
        const statusCount = {
            ready: 0,
            awaiting_qr: 0,
            authenticating: 0,
            disconnected: 0,
            error: 0,
            initializing: 0,
            destroyed: 0
        };
        
        for (const session of this.sessions.values()) {
            statusCount[session.status] = (statusCount[session.status] || 0) + 1;
        }
        
        return statusCount;
    }
    
    // ============================================
    // 27. إنهاء جميع الجلسات
    // ============================================
    async destroyAllSessions() {
        console.log(chalk.yellow('🛑 إنهاء جميع الجلسات...'));
        
        const destroyPromises = [];
        
        for (const session of this.sessions.values()) {
            destroyPromises.push(session.destroy());
        }
        
        try {
            await Promise.allSettled(destroyPromises);
            
            this.sessions.clear();
            this.adminSessions.clear();
            
            console.log(chalk.green('✅ تم إنهاء جميع الجلسات'));
            return true;
            
        } catch (error) {
            console.log(chalk.red(`❌ خطأ في إنهاء الجلسات: ${error.message}`));
            return false;
        }
    }
}

// ============================================
// 28. إنشاء وإرجاع نسخة وحيدة من المدير
// ============================================
let whatsappManagerInstance = null;

function getWhatsAppManager() {
    if (!whatsappManagerInstance) {
        whatsappManagerInstance = new WhatsAppManager();
    }
    return whatsappManagerInstance;
}

// ============================================
// 29. التصدير
// ============================================
module.exports = {
    WhatsAppSession,
    WhatsAppManager,
    getWhatsAppManager
};
