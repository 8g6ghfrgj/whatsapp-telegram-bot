// ============================================
// 📱 WhatsApp Client Manager
// الملف: whatsappClient.js
// الوصف: إدارة متقدمة لجلسات WhatsApp مع تحسينات الأداء
// الإصدار: 2.0.0
// ============================================

const { Client, LocalAuth, MessageMedia, Buttons, List } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class WhatsAppClientManager extends EventEmitter {
    constructor() {
        super();
        
        // تخزين العملاء النشطين
        this.clients = new Map();
        
        // تخزين حالات QR
        this.qrCodes = new Map();
        
        // طابور الرسائل
        this.messageQueue = new Map();
        
        // إحصائيات الأداء
        this.stats = {
            totalClients: 0,
            activeClients: 0,
            messagesProcessed: 0,
            errors: 0,
            lastCleanup: Date.now()
        };
        
        // إعدادات الأداء
        this.settings = {
            maxRetries: 3,
            retryDelay: 1000,
            messageDelay: 500,
            maxQueueSize: 1000,
            cleanupInterval: 3600000, // ساعة واحدة
            healthCheckInterval: 300000, // 5 دقائق
            reconnectAttempts: 5,
            reconnectDelay: 5000
        };
        
        // تهيئة عمليات التنظيف الدورية
        this.initCleanup();
        this.initHealthChecks();
        
        console.log('✅ WhatsApp Client Manager initialized');
    }
    
    // ============================================
    // 1. إدارة العملاء
    // ============================================
    
    /**
     * إنشاء عميل WhatsApp جديد
     * @param {string} sessionId - معرف الجلسة
     * @param {string} phoneNumber - رقم الهاتف
     * @param {Object} options - خيارات إضافية
     * @returns {Promise<Object>} معلومات العميل
     */
    async createClient(sessionId, phoneNumber, options = {}) {
        console.log(`📱 Creating WhatsApp client for ${phoneNumber} (${sessionId})`);
        
        try {
            // التحقق من عدم تكرار الجلسة
            if (this.clients.has(sessionId)) {
                throw new Error(`Client with sessionId ${sessionId} already exists`);
            }
            
            // إعداد خيارات العميل
            const clientOptions = {
                authStrategy: new LocalAuth({
                    clientId: sessionId,
                    dataPath: './sessions',
                    backupSyncIntervalMs: 600000 // 10 دقائق
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
                        '--window-size=1920,1080',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-ipc-flooding-protection',
                        '--disable-client-side-phishing-detection',
                        '--disable-component-update',
                        '--disable-default-apps',
                        '--disable-sync',
                        '--disable-translate',
                        '--metrics-recording-only',
                        '--mute-audio',
                        '--no-default-browser-check',
                        '--no-pings',
                        '--remote-debugging-port=0',
                        '--safebrowsing-disable-auto-update',
                        '--use-mock-keychain'
                    ],
                    defaultViewport: { width: 1920, height: 1080 },
                    ignoreHTTPSErrors: true,
                    timeout: 60000,
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
                },
                qrTimeout: 60000,
                takeoverOnConflict: true,
                takeoverTimeoutMs: 10000,
                restartOnAuthFail: true,
                restartOnCrash: true,
                killProcessOnBrowserClose: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ffmpegPath: 'ffmpeg',
                bypassCSP: true,
                cacheEnabled: false,
                chromiumArgs: [],
                ...options
            };
            
            // إنشاء العميل
            const client = new Client(clientOptions);
            
            // تسجيل معالجات الأحداث
            this.registerEventHandlers(client, sessionId, phoneNumber);
            
            // تخزين العميل
            this.clients.set(sessionId, {
                client,
                sessionId,
                phoneNumber,
                status: 'initializing',
                createdAt: Date.now(),
                lastActivity: Date.now(),
                stats: {
                    messagesSent: 0,
                    messagesReceived: 0,
                    groupsJoined: 0,
                    errors: 0,
                    reconnects: 0
                },
                metadata: {
                    platform: 'unknown',
                    pushname: '',
                    wid: '',
                    phone: {}
                },
                settings: {
                    autoReply: true,
                    autoCollect: true,
                    autoJoin: false,
                    broadcastEnabled: true
                }
            });
            
            // تحديث الإحصائيات
            this.stats.totalClients++;
            this.stats.activeClients++;
            
            console.log(`✅ WhatsApp client created for ${phoneNumber}`);
            
            return {
                sessionId,
                phoneNumber,
                status: 'initializing',
                qrPending: true
            };
            
        } catch (error) {
            console.error(`❌ Failed to create WhatsApp client:`, error);
            this.stats.errors++;
            throw error;
        }
    }
    
    /**
     * تسجيل معالجات الأحداث للعميل
     */
    registerEventHandlers(client, sessionId, phoneNumber) {
        const clientData = this.clients.get(sessionId);
        
        // حدث QR Code
        client.on('qr', async (qr) => {
            console.log(`📱 QR Code generated for ${phoneNumber}`);
            
            // توليد QR Code نصي
            let qrText = '';
            try {
                qrText = await new Promise((resolve, reject) => {
                    qrcode.toString(qr, { type: 'terminal', small: true }, (err, text) => {
                        if (err) reject(err);
                        else resolve(text);
                    });
                });
            } catch (error) {
                qrText = 'Unable to generate QR text';
            }
            
            // تخزين QR
            this.qrCodes.set(sessionId, {
                qr,
                qrText,
                phoneNumber,
                timestamp: Date.now(),
                expiresAt: Date.now() + 60000 // 60 ثانية
            });
            
            // تحديث حالة العميل
            clientData.status = 'awaiting_qr';
            clientData.lastActivity = Date.now();
            
            // إرسال حدث QR
            this.emit('qr', {
                sessionId,
                phoneNumber,
                qr,
                qrText,
                timestamp: Date.now()
            });
            
            console.log(`📤 QR ready for ${phoneNumber}`);
        });
        
        // حدث جاهزية العميل
        client.on('ready', async () => {
            console.log(`✅ WhatsApp client ready for ${phoneNumber}`);
            
            // تحديث حالة العميل
            clientData.status = 'connected';
            clientData.metadata = {
                platform: client.info.platform,
                pushname: client.info.pushname,
                wid: client.info.wid._serialized,
                phone: client.info.phone
            };
            clientData.lastActivity = Date.now();
            clientData.connectedAt = Date.now();
            
            // مسح QR
            this.qrCodes.delete(sessionId);
            
            // بدء تجميع المجموعات والجهات
            setTimeout(() => this.collectInitialData(client, sessionId), 3000);
            
            // إرسال حدث الاتصال
            this.emit('ready', {
                sessionId,
                phoneNumber,
                metadata: clientData.metadata,
                timestamp: Date.now()
            });
            
            console.log(`🎉 ${phoneNumber} is now connected and ready`);
        });
        
        // حدث استقبال الرسائل
        client.on('message', async (message) => {
            try {
                // تحديث النشاط
                clientData.lastActivity = Date.now();
                clientData.stats.messagesReceived++;
                
                // معالجة الرسالة
                await this.processMessage(message, sessionId);
                
                // إرسال حدث الرسالة
                this.emit('message', {
                    sessionId,
                    phoneNumber,
                    message: this.sanitizeMessage(message),
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.error(`❌ Error processing message:`, error);
                clientData.stats.errors++;
            }
        });
        
        // حدث تغيير الحالة
        client.on('change_state', (state) => {
            console.log(`📡 State change for ${phoneNumber}: ${state}`);
            
            clientData.status = state;
            clientData.lastActivity = Date.now();
            
            this.emit('state_change', {
                sessionId,
                phoneNumber,
                state,
                timestamp: Date.now()
            });
        });
        
        // حدث فقدان الاتصال
        client.on('disconnected', (reason) => {
            console.log(`❌ Disconnected ${phoneNumber}: ${reason}`);
            
            clientData.status = 'disconnected';
            clientData.disconnectedAt = Date.now();
            clientData.disconnectReason = reason;
            this.stats.activeClients--;
            
            // محاولة إعادة الاتصال
            this.scheduleReconnect(sessionId);
            
            this.emit('disconnected', {
                sessionId,
                phoneNumber,
                reason,
                timestamp: Date.now()
            });
        });
        
        // حدث المصادقة
        client.on('authenticated', () => {
            console.log(`🔐 Authenticated ${phoneNumber}`);
            
            clientData.status = 'authenticated';
            clientData.lastActivity = Date.now();
            
            this.emit('authenticated', {
                sessionId,
                phoneNumber,
                timestamp: Date.now()
            });
        });
        
        // حدث فشل المصادقة
        client.on('auth_failure', (error) => {
            console.error(`❌ Auth failure for ${phoneNumber}:`, error);
            
            clientData.status = 'auth_failure';
            clientData.lastActivity = Date.now();
            clientData.stats.errors++;
            
            this.emit('auth_failure', {
                sessionId,
                phoneNumber,
                error: error.message,
                timestamp: Date.now()
            });
        });
        
        // حدث تحميل الشاشة
        client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Loading ${phoneNumber}: ${percent}% - ${message}`);
            
            this.emit('loading', {
                sessionId,
                phoneNumber,
                percent,
                message,
                timestamp: Date.now()
            });
        });
        
        // حدث الجاهزية
        client.on('ready', () => {
            // تم التعامل معه مسبقاً
        });
        
        // حدث الخطأ العام
        client.on('error', (error) => {
            console.error(`❌ Client error for ${phoneNumber}:`, error);
            
            clientData.stats.errors++;
            
            this.emit('error', {
                sessionId,
                phoneNumber,
                error: error.message,
                timestamp: Date.now()
            });
        });
    }
    
    /**
     * بدء تهيئة العميل
     */
    async initializeClient(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        if (clientData.status !== 'initializing') {
            throw new Error(`Client already initialized: ${clientData.status}`);
        }
        
        try {
            console.log(`🚀 Initializing client ${sessionId}...`);
            
            await clientData.client.initialize();
            
            console.log(`✅ Client ${sessionId} initialization started`);
            
            return {
                sessionId,
                status: 'initializing',
                message: 'Client initialization in progress'
            };
            
        } catch (error) {
            console.error(`❌ Failed to initialize client ${sessionId}:`, error);
            
            clientData.status = 'error';
            clientData.error = error.message;
            this.stats.errors++;
            
            throw error;
        }
    }
    
    /**
     * الحصول على معلومات العميل
     */
    getClientInfo(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            return null;
        }
        
        return {
            sessionId,
            phoneNumber: clientData.phoneNumber,
            status: clientData.status,
            createdAt: clientData.createdAt,
            lastActivity: clientData.lastActivity,
            connectedAt: clientData.connectedAt,
            disconnectedAt: clientData.disconnectedAt,
            metadata: clientData.metadata,
            stats: clientData.stats,
            settings: clientData.settings
        };
    }
    
    /**
     * الحصول على جميع العملاء
     */
    getAllClients() {
        const clients = [];
        
        for (const [sessionId, clientData] of this.clients) {
            clients.push(this.getClientInfo(sessionId));
        }
        
        return clients;
    }
    
    /**
     * الحصول على العملاء النشطين
     */
    getActiveClients() {
        return this.getAllClients().filter(client => 
            client.status === 'connected' || client.status === 'authenticated'
        );
    }
    
    // ============================================
    // 2. إدارة الرسائل
    // ============================================
    
    /**
     * معالجة الرسالة الواردة
     */
    async processMessage(message, sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            return;
        }
        
        // تسجيل الرسالة
        const messageLog = {
            id: message.id._serialized,
            from: message.from,
            to: message.to,
            body: message.body,
            type: message.type,
            timestamp: message.timestamp,
            hasMedia: message.hasMedia,
            isGroupMsg: message.from.includes('@g.us'),
            sessionId,
            processedAt: Date.now()
        };
        
        // إرسال حدث المعالجة
        this.emit('message_processed', messageLog);
        
        // تجميع الروابط إذا كان مفعلاً
        if (clientData.settings.autoCollect) {
            await this.collectLinksFromMessage(message, sessionId);
        }
        
        // اكتشاف روابط الانضمام
        await this.detectJoinLinks(message, sessionId);
        
        this.stats.messagesProcessed++;
    }
    
    /**
     * تجميع الروابط من الرسالة
     */
    async collectLinksFromMessage(message, sessionId) {
        try {
            if (!message.body) return;
            
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.body.match(urlRegex) || [];
            
            if (links.length === 0) return;
            
            const collectedLinks = [];
            
            for (const url of links) {
                // تصنيف الرابط
                const type = this.classifyLink(url);
                
                // إنشاء كائن الرابط
                const linkData = {
                    url,
                    type,
                    title: `Link from ${message.from || 'unknown'}`,
                    description: message.body.substring(0, 200),
                    source: message.from,
                    sessionId,
                    metadata: {
                        sender: message.from,
                        timestamp: message.timestamp,
                        hasMedia: message.hasMedia,
                        messageType: message.type
                    },
                    collectedAt: Date.now()
                };
                
                collectedLinks.push(linkData);
                
                console.log(`🔗 Collected ${type} link: ${url.substring(0, 50)}...`);
            }
            
            // إرسال حدث تجميع الروابط
            if (collectedLinks.length > 0) {
                this.emit('links_collected', {
                    sessionId,
                    links: collectedLinks,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('❌ Error collecting links:', error);
        }
    }
    
    /**
     * تصنيف الرابط
     */
    classifyLink(url) {
        if (url.includes('chat.whatsapp.com')) return 'whatsapp_group';
        if (url.includes('whatsapp.com')) return 'whatsapp_invite';
        if (url.includes('t.me') || url.includes('telegram.me')) return 'telegram';
        if (url.includes('discord.gg')) return 'discord';
        if (url.includes('signal.group')) return 'signal';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('facebook.com') || url.includes('fb.me')) return 'facebook';
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('tiktok.com')) return 'tiktok';
        if (url.includes('http')) return 'website';
        return 'other';
    }
    
    /**
     * اكتشاف روابط الانضمام
     */
    async detectJoinLinks(message, sessionId) {
        try {
            if (!message.body) return;
            
            const whatsappInviteRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/g;
            const inviteLinks = message.body.match(whatsappInviteRegex) || [];
            
            if (inviteLinks.length === 0) return;
            
            for (const link of inviteLinks) {
                this.emit('join_link_detected', {
                    sessionId,
                    link,
                    from: message.from,
                    timestamp: Date.now()
                });
                
                console.log(`➕ Join link detected: ${link}`);
            }
            
        } catch (error) {
            console.error('❌ Error detecting join links:', error);
        }
    }
    
    /**
     * إرسال رسالة
     */
    async sendMessage(sessionId, to, message, options = {}) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        if (clientData.status !== 'connected') {
            throw new Error(`Client not connected: ${clientData.status}`);
        }
        
        try {
            const client = clientData.client;
            
            // التحقق من صحة الرقم
            if (!to.includes('@')) {
                to = to.includes('-') ? `${to}@g.us` : `${to}@c.us`;
            }
            
            // إعداد خيارات الإرسال
            const sendOptions = {
                linkPreview: options.linkPreview !== false,
                sendAudioAsVoice: options.sendAudioAsVoice || false,
                sendMediaAsSticker: options.sendMediaAsSticker || false,
                sendMediaAsDocument: options.sendMediaAsDocument || false,
                ...options
            };
            
            // إرسال الرسالة
            let result;
            
            if (options.media) {
                // إرسال وسائط
                const media = await MessageMedia.fromUrl(options.media.url, {
                    unsafeMime: true,
                    filename: options.media.filename
                });
                
                if (options.media.caption) {
                    sendOptions.caption = options.media.caption;
                }
                
                result = await client.sendMessage(to, media, sendOptions);
            } else if (options.buttons) {
                // إرسال أزرار
                const buttons = new Buttons(message, options.buttons, options.title, options.footer);
                result = await client.sendMessage(to, buttons, sendOptions);
            } else if (options.list) {
                // إرسال قائمة
                const list = new List(message, options.list, options.title, options.footer, options.buttonText);
                result = await client.sendMessage(to, list, sendOptions);
            } else {
                // إرسال نص عادي
                result = await client.sendMessage(to, message, sendOptions);
            }
            
            // تحديث الإحصائيات
            clientData.stats.messagesSent++;
            clientData.lastActivity = Date.now();
            
            console.log(`📤 Message sent to ${to.substring(0, 15)}...`);
            
            // إرسال حدث إرسال الرسالة
            this.emit('message_sent', {
                sessionId,
                to,
                messageId: result.id._serialized,
                timestamp: Date.now()
            });
            
            return {
                success: true,
                messageId: result.id._serialized,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Failed to send message:`, error);
            
            clientData.stats.errors++;
            
            // إعادة المحاولة إذا كانت محاولة الإرسال الأولى
            if (options.retryCount < (options.maxRetries || this.settings.maxRetries)) {
                const retryCount = (options.retryCount || 0) + 1;
                const retryDelay = this.settings.retryDelay * retryCount;
                
                console.log(`🔄 Retrying message (${retryCount}/${options.maxRetries || this.settings.maxRetries})...`);
                
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                
                return this.sendMessage(sessionId, to, message, {
                    ...options,
                    retryCount
                });
            }
            
            throw error;
        }
    }
    
    /**
     * إرسال رسالة إلى مجموعة
     */
    async sendMessageToGroup(sessionId, groupId, message, options = {}) {
        // تأكد من أن المعرف يحتوي على @g.us
        if (!groupId.includes('@g.us')) {
            groupId = `${groupId}@g.us`;
        }
        
        return this.sendMessage(sessionId, groupId, message, options);
    }
    
    /**
     * إرسال وسائط
     */
    async sendMedia(sessionId, to, mediaOptions) {
        return this.sendMessage(sessionId, to, '', {
            media: mediaOptions
        });
    }
    
    // ============================================
    // 3. إدارة المجموعات والجهات
    // ============================================
    
    /**
     * تجميع البيانات الأولية
     */
    async collectInitialData(client, sessionId) {
        try {
            console.log(`📊 Collecting initial data for session ${sessionId}...`);
            
            const clientData = this.clients.get(sessionId);
            if (!clientData) return;
            
            // الحصول على جميع المحادثات
            const chats = await client.getChats();
            
            // تصنيف المحادثات
            const groups = chats.filter(chat => chat.isGroup);
            const contacts = chats.filter(chat => !chat.isGroup && chat.isUser);
            
            // تحديث البيانات
            clientData.groups = groups;
            clientData.contacts = contacts;
            clientData.groupsCount = groups.length;
            clientData.contactsCount = contacts.length;
            
            console.log(`✅ Collected ${groups.length} groups and ${contacts.length} contacts`);
            
            // إرسال حدث تجميع البيانات
            this.emit('data_collected', {
                sessionId,
                groups: groups.length,
                contacts: contacts.length,
                timestamp: Date.now()
            });
            
            // تجميع روابط المجموعات إذا كان مفعلاً
            if (clientData.settings.autoCollect) {
                await this.collectGroupLinks(client, sessionId, groups);
            }
            
        } catch (error) {
            console.error(`❌ Error collecting initial data:`, error);
        }
    }
    
    /**
     * تجميع روابط المجموعات
     */
    async collectGroupLinks(client, sessionId, groups) {
        try {
            console.log(`🔗 Collecting group links for session ${sessionId}...`);
            
            const collectedLinks = [];
            const maxGroups = Math.min(groups.length, 50); // حد 50 مجموعة
            
            for (let i = 0; i < maxGroups; i++) {
                const group = groups[i];
                
                try {
                    // محاولة الحصول على رابط الدعوة
                    const inviteCode = await group.getInviteCode();
                    
                    if (inviteCode) {
                        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                        
                        const linkData = {
                            url: inviteLink,
                            type: 'whatsapp_group',
                            title: group.name || 'WhatsApp Group',
                            description: `Group with ${group.participants?.length || 0} members`,
                            source: 'auto_collection',
                            sessionId,
                            metadata: {
                                groupName: group.name,
                                groupSize: group.participants?.length || 0,
                                groupId: group.id._serialized,
                                isActive: true
                            },
                            collectedAt: Date.now()
                        };
                        
                        collectedLinks.push(linkData);
                        
                        console.log(`✅ Group link collected: ${group.name || 'Unnamed'}`);
                    }
                    
                    // تأخير بين المجموعات
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log(`⚠️ Could not get invite link for group: ${group.name || 'Unnamed'}`);
                }
            }
            
            // إرسال حدث تجميع روابط المجموعات
            if (collectedLinks.length > 0) {
                this.emit('group_links_collected', {
                    sessionId,
                    links: collectedLinks,
                    timestamp: Date.now()
                });
            }
            
            console.log(`🎯 Collected ${collectedLinks.length} group links`);
            
        } catch (error) {
            console.error('❌ Error collecting group links:', error);
        }
    }
    
    /**
     * الانضمام إلى مجموعة عبر رابط الدعوة
     */
    async joinGroup(sessionId, inviteLink) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        if (clientData.status !== 'connected') {
            throw new Error(`Client not connected: ${clientData.status}`);
        }
        
        try {
            const client = clientData.client;
            
            // استخراج كود الدعوة
            const inviteCode = inviteLink.split('/').pop();
            
            console.log(`➕ Joining group with invite code: ${inviteCode.substring(0, 10)}...`);
            
            // الانضمام للمجموعة
            await client.acceptInvite(inviteCode);
            
            // تحديث الإحصائيات
            clientData.stats.groupsJoined++;
            clientData.lastActivity = Date.now();
            
            console.log(`✅ Successfully joined group`);
            
            // إرسال حدث الانضمام
            this.emit('group_joined', {
                sessionId,
                inviteLink,
                timestamp: Date.now()
            });
            
            return {
                success: true,
                inviteLink,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Failed to join group:`, error);
            
            clientData.stats.errors++;
            
            throw error;
        }
    }
    
    /**
     * الحصول على معلومات المجموعة
     */
    async getGroupInfo(sessionId, groupId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        if (clientData.status !== 'connected') {
            throw new Error(`Client not connected: ${clientData.status}`);
        }
        
        try {
            const client = clientData.client;
            
            // تأكد من أن المعرف يحتوي على @g.us
            if (!groupId.includes('@g.us')) {
                groupId = `${groupId}@g.us`;
            }
            
            // الحصول على معلومات المجموعة
            const chat = await client.getChatById(groupId);
            
            if (!chat.isGroup) {
                throw new Error('Not a group chat');
            }
            
            // الحصول على المشاركين
            const participants = await chat.participants;
            
            return {
                id: chat.id._serialized,
                name: chat.name,
                description: chat.description,
                createdAt: chat.createdAt,
                participantsCount: participants.length,
                participants: participants.map(p => ({
                    id: p.id._serialized,
                    name: p.name || p.pushname || p.shortName || 'Unknown',
                    isAdmin: p.isAdmin,
                    isSuperAdmin: p.isSuperAdmin
                })),
                isReadOnly: chat.isReadOnly,
                areMessagesAutoDeleted: chat.areMessagesAutoDeleted
            };
            
        } catch (error) {
            console.error(`❌ Failed to get group info:`, error);
            throw error;
        }
    }
    
    /**
     * الحصول على جميع المجموعات
     */
    async getAllGroups(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        if (clientData.status !== 'connected') {
            throw new Error(`Client not connected: ${clientData.status}`);
        }
        
        try {
            const client = clientData.client;
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            return groups.map(group => ({
                id: group.id._serialized,
                name: group.name,
                participantsCount: group.participants?.length || 0,
                isReadOnly: group.isReadOnly,
                unreadCount: group.unreadCount
            }));
            
        } catch (error) {
            console.error(`❌ Failed to get groups:`, error);
            throw error;
        }
    }
    
    /**
     * الحصول على جميع جهات الاتصال
     */
    async getAllContacts(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        if (clientData.status !== 'connected') {
            throw new Error(`Client not connected: ${clientData.status}`);
        }
        
        try {
            const client = clientData.client;
            const chats = await client.getChats();
            const contacts = chats.filter(chat => !chat.isGroup && chat.isUser);
            
            return contacts.map(contact => ({
                id: contact.id._serialized,
                name: contact.name,
                pushname: contact.pushname,
                isUser: contact.isUser,
                isGroup: contact.isGroup,
                isWAContact: contact.isWAContact,
                unreadCount: contact.unreadCount
            }));
            
        } catch (error) {
            console.error(`❌ Failed to get contacts:`, error);
            throw error;
        }
    }
    
    // ============================================
    // 4. إدارة الحالة والأداء
    // ============================================
    
    /**
     * جدولة إعادة الاتصال
     */
    async scheduleReconnect(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) return;
        
        if (clientData.reconnectAttempts >= this.settings.reconnectAttempts) {
            console.log(`❌ Max reconnection attempts reached for ${sessionId}`);
            return;
        }
        
        const attempts = clientData.reconnectAttempts || 0;
        const delay = this.settings.reconnectDelay * (attempts + 1);
        
        console.log(`🔄 Scheduling reconnect for ${sessionId} in ${delay}ms (attempt ${attempts + 1})`);
        
        setTimeout(async () => {
            try {
                await this.reconnectClient(sessionId);
            } catch (error) {
                console.error(`❌ Reconnect failed for ${sessionId}:`, error);
                this.scheduleReconnect(sessionId);
            }
        }, delay);
        
        clientData.reconnectAttempts = attempts + 1;
    }
    
    /**
     * إعادة الاتصال بالعميل
     */
    async reconnectClient(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        console.log(`🔄 Attempting to reconnect ${sessionId}...`);
        
        try {
            // إغلاق العميل الحالي
            await clientData.client.destroy();
            
            // إعادة الإنشاء
            await this.createClient(sessionId, clientData.phoneNumber);
            await this.initializeClient(sessionId);
            
            console.log(`✅ Reconnect initiated for ${sessionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to reconnect ${sessionId}:`, error);
            throw error;
        }
    }
    
    /**
     * تهيئة عمليات التنظيف الدورية
     */
    initCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.settings.cleanupInterval);
    }
    
    /**
     * تنظيف البيانات القديمة
     */
    cleanup() {
        console.log('🧹 Running cleanup...');
        
        const now = Date.now();
        let cleaned = 0;
        
        // تنظيف QR Codes المنتهية
        for (const [sessionId, qrData] of this.qrCodes) {
            if (now > qrData.expiresAt) {
                this.qrCodes.delete(sessionId);
                cleaned++;
            }
        }
        
        // تنظير طابور الرسائل القديم
        for (const [queueId, queue] of this.messageQueue) {
            if (queue.length > this.settings.maxQueueSize) {
                // الاحتفاظ بأحدث الرسائل فقط
                this.messageQueue.set(queueId, queue.slice(-this.settings.maxQueueSize));
                cleaned += queue.length - this.settings.maxQueueSize;
            }
        }
        
        this.stats.lastCleanup = now;
        
        if (cleaned > 0) {
            console.log(`✅ Cleaned ${cleaned} items`);
        }
    }
    
    /**
     * تهيئة فحوصات الصحة الدورية
     */
    initHealthChecks() {
        setInterval(() => {
            this.healthCheck();
        }, this.settings.healthCheckInterval);
    }
    
    /**
     * فحص صحة العملاء
     */
    healthCheck() {
        console.log('🏥 Running health check...');
        
        const now = Date.now();
        const inactiveThreshold = 300000; // 5 دقائق
        
        for (const [sessionId, clientData] of this.clients) {
            // التحقق من العملاء غير النشطين
            if (clientData.status === 'connected' && 
                now - clientData.lastActivity > inactiveThreshold) {
                
                console.log(`⚠️ Client ${sessionId} is inactive, forcing reconnect`);
                
                // محاولة إعادة الاتصال
                this.scheduleReconnect(sessionId);
            }
        }
        
        console.log(`✅ Health check completed`);
    }
    
    /**
     * الحصول على إحصائيات النظام
     */
    getStats() {
        return {
            ...this.stats,
            connectedClients: this.getActiveClients().length,
            totalClients: this.clients.size,
            qrCodes: this.qrCodes.size,
            messageQueues: this.messageQueue.size,
            timestamp: Date.now(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
    }
    
    /**
     * تحديث إعدادات العميل
     */
    updateClientSettings(sessionId, settings) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        clientData.settings = {
            ...clientData.settings,
            ...settings
        };
        
        console.log(`⚙️ Updated settings for ${sessionId}`);
        
        return clientData.settings;
    }
    
    /**
     * إغلاق العميل
     */
    async closeClient(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        try {
            console.log(`🛑 Closing client ${sessionId}...`);
            
            // إغلاق العميل
            await clientData.client.destroy();
            
            // تحديث الحالة
            clientData.status = 'closed';
            clientData.closedAt = Date.now();
            this.stats.activeClients--;
            
            // تنظيف البيانات
            this.qrCodes.delete(sessionId);
            
            console.log(`✅ Client ${sessionId} closed successfully`);
            
            return {
                success: true,
                sessionId,
                closedAt: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Failed to close client ${sessionId}:`, error);
            throw error;
        }
    }
    
    /**
     * إغلاق جميع العملاء
     */
    async closeAllClients() {
        console.log('🛑 Closing all WhatsApp clients...');
        
        const results = [];
        
        for (const [sessionId] of this.clients) {
            try {
                const result = await this.closeClient(sessionId);
                results.push(result);
            } catch (error) {
                results.push({
                    sessionId,
                    success: false,
                    error: error.message
                });
            }
        }
        
        console.log(`✅ Closed ${results.filter(r => r.success).length} clients`);
        
        return results;
    }
    
    /**
     * تنظيف جميع الموارد
     */
    async cleanupAll() {
        console.log('🧹 Cleaning up all resources...');
        
        await this.closeAllClients();
        
        this.clients.clear();
        this.qrCodes.clear();
        this.messageQueue.clear();
        
        this.stats = {
            totalClients: 0,
            activeClients: 0,
            messagesProcessed: 0,
            errors: 0,
            lastCleanup: Date.now()
        };
        
        console.log('✅ All resources cleaned up');
    }
    
    // ============================================
    // 5. أدوات المساعدة
    // ============================================
    
    /**
     * تنظيف بيانات الرسالة
     */
    sanitizeMessage(message) {
        return {
            id: message.id._serialized,
            from: message.from,
            to: message.to,
            body: message.body ? message.body.substring(0, 500) : '',
            type: message.type,
            timestamp: message.timestamp,
            hasMedia: message.hasMedia,
            isGroupMsg: message.from.includes('@g.us'),
            author: message.author
        };
    }
    
    /**
     * التحقق من صحة الرقم
     */
    validatePhoneNumber(phoneNumber) {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phoneNumber);
    }
    
    /**
     * توليد معرف جلسة فريد
     */
    generateSessionId() {
        return `wa_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    /**
     * التحقق من حالة العميل
     */
    isClientConnected(sessionId) {
        const clientData = this.clients.get(sessionId);
        return clientData && (clientData.status === 'connected' || clientData.status === 'authenticated');
    }
    
    /**
     * الحصول على QR Code
     */
    getQRCode(sessionId) {
        return this.qrCodes.get(sessionId);
    }
    
    /**
     * تحديث نشاط العميل
     */
    updateActivity(sessionId) {
        const clientData = this.clients.get(sessionId);
        if (clientData) {
            clientData.lastActivity = Date.now();
        }
    }
    
    // ============================================
    // 6. معالجة الأخطاء
    // ============================================
    
    /**
     * معالجة الأخطاء المركزية
     */
    handleError(error, context = '') {
        const errorData = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: Date.now()
        };
        
        console.error(`❌ Error in ${context}:`, error);
        
        // تحديث إحصائيات الأخطاء
        this.stats.errors++;
        
        // إرسال حدث الخطأ
        this.emit('error', errorData);
        
        // تسجيل الخطأ في ملف
        this.logError(errorData);
        
        return errorData;
    }
    
    /**
     * تسجيل الخطأ في ملف
     */
    async logError(errorData) {
        try {
            const logDir = path.join(__dirname, 'logs');
            await fs.mkdir(logDir, { recursive: true });
            
            const logFile = path.join(logDir, 'errors.log');
            const logEntry = `${new Date(errorData.timestamp).toISOString()} - ${errorData.context}: ${errorData.message}\n`;
            
            await fs.appendFile(logFile, logEntry);
            
        } catch (logError) {
            console.error('❌ Failed to log error:', logError);
        }
    }
    
    // ============================================
    // 7. التصدير والاستيراد
    // ============================================
    
    /**
     * تصدير حالة العميل
     */
    async exportClientState(sessionId) {
        const clientData = this.clients.get(sessionId);
        
        if (!clientData) {
            throw new Error(`Client not found: ${sessionId}`);
        }
        
        const exportData = {
            sessionId,
            phoneNumber: clientData.phoneNumber,
            status: clientData.status,
            metadata: clientData.metadata,
            stats: clientData.stats,
            settings: clientData.settings,
            createdAt: clientData.createdAt,
            lastActivity: clientData.lastActivity,
            exportTimestamp: Date.now()
        };
        
        return exportData;
    }
    
    /**
     * تصدير جميع الحالات
     */
    async exportAllStates() {
        const exportData = {
            clients: [],
            stats: this.stats,
            timestamp: Date.now()
        };
        
        for (const [sessionId] of this.clients) {
            try {
                const clientState = await this.exportClientState(sessionId);
                exportData.clients.push(clientState);
            } catch (error) {
                console.error(`❌ Failed to export client ${sessionId}:`, error);
            }
        }
        
        return exportData;
    }
}

// ============================================
// 8. تصدير المدير كـ Singleton
// ============================================

let whatsappClientManagerInstance = null;

/**
 * الحصول على نسخة وحيدة من المدير
 */
function getWhatsAppClientManager() {
    if (!whatsappClientManagerInstance) {
        whatsappClientManagerInstance = new WhatsAppClientManager();
    }
    return whatsappClientManagerInstance;
}

// تصدير المدير ووظائف المساعدة
module.exports = {
    WhatsAppClientManager,
    getWhatsAppClientManager,
    
    // وظائف المساعدة للتصدير
    createClient: (sessionId, phoneNumber, options) => 
        getWhatsAppClientManager().createClient(sessionId, phoneNumber, options),
    
    initializeClient: (sessionId) => 
        getWhatsAppClientManager().initializeClient(sessionId),
    
    sendMessage: (sessionId, to, message, options) => 
        getWhatsAppClientManager().sendMessage(sessionId, to, message, options),
    
    getClientInfo: (sessionId) => 
        getWhatsAppClientManager().getClientInfo(sessionId),
    
    getAllClients: () => 
        getWhatsAppClientManager().getAllClients(),
    
    getActiveClients: () => 
        getWhatsAppClientManager().getActiveClients(),
    
    closeClient: (sessionId) => 
        getWhatsAppClientManager().closeClient(sessionId),
    
    getStats: () => 
        getWhatsAppClientManager().getStats(),
    
    // أدوات المساعدة
    validatePhoneNumber: (phoneNumber) => 
        getWhatsAppClientManager().validatePhoneNumber(phoneNumber),
    
    generateSessionId: () => 
        getWhatsAppClientManager().generateSessionId(),
    
    isClientConnected: (sessionId) => 
        getWhatsAppClientManager().isClientConnected(sessionId),
    
    getQRCode: (sessionId) => 
        getWhatsAppClientManager().getQRCode(sessionId)
};
