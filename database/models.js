// ============================================
// 🗄️ WhatsApp Bot Models
// نماذج قاعدة البيانات كاملة
// ============================================

const { DataTypes } = require('sequelize');

class WhatsAppModels {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.models = {};
        this.initModels();
    }

    // ============================================
    // 1. تهيئة جميع النماذج
    // ============================================
    initModels() {
        console.log('🗄️ جاري تهيئة نماذج قاعدة البيانات...');

        this.models.Admin = this.initAdminModel();
        this.models.WhatsAppSession = this.initWhatsAppSessionModel();
        this.models.CollectedLink = this.initCollectedLinkModel();
        this.models.Advertisement = this.initAdvertisementModel();
        this.models.AutoPost = this.initAutoPostModel();
        this.models.AutoReply = this.initAutoReplyModel();
        this.models.AutoJoin = this.initAutoJoinModel();
        this.models.Broadcast = this.initBroadcastModel();
        this.models.Notification = this.initNotificationModel();
        this.models.ActivityLog = this.initActivityLogModel();
        this.models.Archive = this.initArchiveModel();
        this.models.LoginAttempt = this.initLoginAttemptModel();
        this.models.SystemLog = this.initSystemLogModel();
        this.models.Backup = this.initBackupModel();

        console.log(`✅ تم تهيئة ${Object.keys(this.models).length} نموذج`);
        
        // إعداد العلاقات بين النماذج
        this.setupAssociations();
        
        console.log('✅ تم إعداد العلاقات بين النماذج');
    }

    // ============================================
    // 2. نموذج المشرفين
    // ============================================
    initAdminModel() {
        return this.sequelize.define('Admin', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            telegramId: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                field: 'telegram_id',
                validate: {
                    notEmpty: true
                }
            },
            username: {
                type: DataTypes.STRING(100),
                allowNull: true,
                validate: {
                    len: [3, 100]
                }
            },
            firstName: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'مشرف',
                field: 'first_name',
                validate: {
                    notEmpty: true
                }
            },
            lastName: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'last_name'
            },
            phoneNumber: {
                type: DataTypes.STRING(20),
                allowNull: true,
                field: 'phone_number',
                validate: {
                    is: /^\+?[1-9]\d{1,14}$/
                }
            },
            email: {
                type: DataTypes.STRING(100),
                allowNull: true,
                validate: {
                    isEmail: true
                }
            },
            permissions: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: ['manage_sessions', 'manage_ads', 'view_stats'],
                validate: {
                    isArray(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('يجب أن تكون الصلاحيات مصفوفة');
                        }
                    }
                }
            },
            settings: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    notificationEnabled: true,
                    language: 'ar',
                    maxSessions: 10,
                    autoCollectLinks: true,
                    autoReplyEnabled: true,
                    theme: 'light',
                    timezone: 'Asia/Riyadh',
                    autoBackup: true,
                    backupFrequency: 'daily'
                },
                validate: {
                    isObject(value) {
                        if (typeof value !== 'object' || value === null) {
                            throw new Error('يجب أن تكون الإعدادات كائن');
                        }
                    }
                }
            },
            lastActivity: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_activity'
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: 'is_active'
            },
            isSuperAdmin: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_super_admin'
            },
            twoFactorEnabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'two_factor_enabled'
            },
            twoFactorSecret: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'two_factor_secret'
            },
            lastPasswordChange: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_password_change'
            },
            failedLoginAttempts: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'failed_login_attempts'
            },
            accountLockedUntil: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'account_locked_until'
            },
            commissionRate: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0.00,
                field: 'commission_rate'
            },
            totalEarnings: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00,
                field: 'total_earnings'
            },
            lastPaymentDate: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_payment_date'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'admins',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['telegram_id']
                },
                {
                    fields: ['is_active']
                },
                {
                    fields: ['is_super_admin']
                },
                {
                    fields: ['last_activity']
                },
                {
                    fields: ['created_at']
                }
            ],
            hooks: {
                beforeCreate: (admin) => {
                    if (!admin.firstName.trim()) {
                        admin.firstName = 'مشرف';
                    }
                },
                beforeUpdate: (admin) => {
                    admin.updatedAt = new Date();
                }
            }
        });
    }

    // ============================================
    // 3. نموذج جلسات WhatsApp
    // ============================================
    initWhatsAppSessionModel() {
        return this.sequelize.define('WhatsAppSession', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            sessionId: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true,
                field: 'session_id',
                validate: {
                    notEmpty: true
                }
            },
            phoneNumber: {
                type: DataTypes.STRING(20),
                allowNull: false,
                field: 'phone_number',
                validate: {
                    notEmpty: true,
                    is: /^\+?[1-9]\d{1,14}$/
                }
            },
            status: {
                type: DataTypes.ENUM(
                    'awaiting_qr',
                    'connected',
                    'authenticated',
                    'disconnected',
                    'error',
                    'initializing',
                    'reconnecting'
                ),
                allowNull: false,
                defaultValue: 'awaiting_qr',
                validate: {
                    isIn: [['awaiting_qr', 'connected', 'authenticated', 'disconnected', 'error', 'initializing', 'reconnecting']]
                }
            },
            qrCode: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'qr_code'
            },
            qrSentAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'qr_sent_at'
            },
            connectedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'connected_at'
            },
            disconnectedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'disconnected_at'
            },
            groupsCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'groups_count',
                validate: {
                    min: 0
                }
            },
            contactsCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'contacts_count',
                validate: {
                    min: 0
                }
            },
            connectionData: {
                type: DataTypes.JSON,
                allowNull: true,
                field: 'connection_data'
            },
            settings: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    autoReply: true,
                    autoCollect: true,
                    autoJoin: false,
                    broadcastEnabled: true,
                    autoReconnect: true,
                    maxReconnectAttempts: 3,
                    reconnectInterval: 5000,
                    collectInterval: 3600000,
                    autoLeaveInactive: false,
                    inactiveDaysThreshold: 30,
                    maxGroupsPerDay: 50,
                    maxMessagesPerDay: 1000
                }
            },
            stats: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    messagesReceived: 0,
                    messagesSent: 0,
                    linksCollected: 0,
                    groupsJoined: 0,
                    groupsLeft: 0,
                    mediaReceived: 0,
                    mediaSent: 0,
                    errors: 0,
                    lastError: null,
                    uptime: 0,
                    lastRestart: null
                }
            },
            lastActivity: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'last_activity'
            },
            encryptedData: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'encrypted_data'
            },
            encryptionKey: {
                type: DataTypes.STRING(255),
                allowNull: true,
                field: 'encryption_key'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'whatsapp_sessions',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['session_id']
                },
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['phone_number']
                },
                {
                    fields: ['connected_at']
                },
                {
                    fields: ['last_activity']
                }
            ],
            hooks: {
                beforeCreate: (session) => {
                    if (!session.sessionId) {
                        session.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }
                },
                afterUpdate: async (session) => {
                    // تحديث آخر نشاط
                    if (session.changed('status') && session.status === 'connected') {
                        session.lastActivity = new Date();
                    }
                }
            }
        });
    }

    // ============================================
    // 4. نموذج الروابط المجمعة
    // ============================================
    initCollectedLinkModel() {
        return this.sequelize.define('CollectedLink', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            url: {
                type: DataTypes.STRING(500),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    isUrl: true
                }
            },
            type: {
                type: DataTypes.ENUM(
                    'whatsapp_group',
                    'whatsapp_invite',
                    'telegram',
                    'discord',
                    'signal',
                    'website',
                    'youtube',
                    'instagram',
                    'facebook',
                    'twitter',
                    'tiktok',
                    'other'
                ),
                allowNull: false,
                defaultValue: 'other',
                validate: {
                    isIn: [['whatsapp_group', 'whatsapp_invite', 'telegram', 'discord', 'signal', 'website', 'youtube', 'instagram', 'facebook', 'twitter', 'tiktok', 'other']]
                }
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: true,
                validate: {
                    len: [0, 255]
                }
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            source: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM(
                    'active',
                    'inactive',
                    'joined',
                    'failed',
                    'pending',
                    'expired',
                    'banned'
                ),
                allowNull: false,
                defaultValue: 'active',
                validate: {
                    isIn: [['active', 'inactive', 'joined', 'failed', 'pending', 'expired', 'banned']]
                }
            },
            collectedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'collected_at'
            },
            lastChecked: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_checked'
            },
            checkCount: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'check_count',
                validate: {
                    min: 0
                }
            },
            category: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            qualityScore: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 50,
                field: 'quality_score',
                validate: {
                    min: 0,
                    max: 100
                }
            },
            lastActivityScore: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                field: 'last_activity_score',
                validate: {
                    min: 0,
                    max: 100
                }
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'collected_links',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['url']
                },
                {
                    fields: ['type']
                },
                {
                    fields: ['session_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['collected_at']
                },
                {
                    fields: ['category']
                },
                {
                    fields: ['quality_score']
                },
                {
                    fields: ['source']
                }
            ],
            hooks: {
                beforeCreate: (link) => {
                    if (!link.url.startsWith('http')) {
                        link.url = 'https://' + link.url;
                    }
                    
                    // تصنيف تلقائي بناءً على الرابط
                    if (!link.type || link.type === 'other') {
                        link.type = this.classifyLinkType(link.url);
                    }
                    
                    if (!link.title && link.url) {
                        link.title = this.generateLinkTitle(link.url);
                    }
                },
                beforeUpdate: (link) => {
                    if (link.changed('status') && link.status === 'active') {
                        link.lastChecked = new Date();
                        link.checkCount += 1;
                    }
                }
            }
        });
    }

    // ============================================
    // 5. نموذج الإعلانات
    // ============================================
    initAdvertisementModel() {
        return this.sequelize.define('Advertisement', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },
            type: {
                type: DataTypes.ENUM(
                    'text',
                    'image',
                    'video',
                    'contact',
                    'document',
                    'location',
                    'poll'
                ),
                allowNull: false,
                defaultValue: 'text',
                validate: {
                    isIn: [['text', 'image', 'video', 'contact', 'document', 'location', 'poll']]
                }
            },
            content: {
                type: DataTypes.TEXT('long'),
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            mediaUrl: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'media_url',
                validate: {
                    isUrl: true
                }
            },
            mediaType: {
                type: DataTypes.STRING(50),
                allowNull: true,
                field: 'media_type'
            },
            mediaSize: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'media_size',
                validate: {
                    min: 0
                }
            },
            target: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    allGroups: true,
                    specificGroups: [],
                    minMembers: 0,
                    maxMembers: 1000000,
                    allowedCountries: [],
                    excludedCountries: [],
                    schedule: 'anytime',
                    ageRange: [18, 65],
                    gender: 'any'
                }
            },
            schedule: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    startTime: null,
                    endTime: null,
                    repeat: false,
                    interval: 3600,
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    timezone: 'Asia/Riyadh'
                }
            },
            settings: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    delayBetweenGroups: 1000,
                    retryFailed: true,
                    optimizeSending: true,
                    maxRetries: 3,
                    shuffleGroups: false,
                    skipInactive: true,
                    inactiveThreshold: 7,
                    requireConfirmation: false,
                    confirmationMessage: 'هل تريد نشر الإعلان؟'
                }
            },
            stats: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    sent: 0,
                    failed: 0,
                    lastSent: null,
                    successRate: 0,
                    clicks: 0,
                    views: 0,
                    conversions: 0,
                    costPerMessage: 0.0000,
                    totalCost: 0.00,
                    roi: 0.00,
                    engagementRate: 0.00,
                    bySession: {},
                    byGroup: {},
                    byTime: {}
                }
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: 'is_active'
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 5,
                validate: {
                    min: 1,
                    max: 10
                }
            },
            budget: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                validate: {
                    min: 0
                }
            },
            spent: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00,
                validate: {
                    min: 0
                }
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'advertisements',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['is_active']
                },
                {
                    fields: ['type']
                },
                {
                    fields: ['priority']
                },
                {
                    fields: ['created_at']
                },
                {
                    fields: ['budget']
                }
            ],
            hooks: {
                beforeCreate: (ad) => {
                    if (!ad.name) {
                        ad.name = `إعلان ${new Date().toLocaleDateString('ar-SA')}`;
                    }
                },
                beforeUpdate: (ad) => {
                    if (ad.changed('isActive') && !ad.isActive) {
                        // تحديث الإحصائيات عند إيقاف الإعلان
                        ad.stats.lastSent = new Date();
                    }
                }
            }
        });
    }

    // ============================================
    // 6. نموذج النشر التلقائي
    // ============================================
    initAutoPostModel() {
        return this.sequelize.define('AutoPost', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },
            target: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    allGroups: true,
                    specificSessions: [],
                    excludeGroups: [],
                    excludeKeywords: [],
                    minMembers: 10,
                    maxMembers: 1000,
                    requireKeywords: [],
                    priorityGroups: []
                }
            },
            schedule: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    startTime: null,
                    endTime: null,
                    repeat: true,
                    interval: 3600,
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    timezone: 'Asia/Riyadh',
                    randomDelay: true,
                    minDelay: 500,
                    maxDelay: 5000
                }
            },
            status: {
                type: DataTypes.ENUM(
                    'active',
                    'paused',
                    'completed',
                    'error',
                    'stopped',
                    'waiting'
                ),
                allowNull: false,
                defaultValue: 'active',
                validate: {
                    isIn: [['active', 'paused', 'completed', 'error', 'stopped', 'waiting']]
                }
            },
            settings: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    delayBetweenGroups: 1000,
                    delayBetweenSessions: 5000,
                    maxGroupsPerCycle: 50,
                    retryFailed: true,
                    maxRetries: 3,
                    skipRecentlyPosted: true,
                    recentThreshold: 86400,
                    rotateAds: false,
                    adRotationInterval: 3600,
                    stopOnError: false,
                    errorThreshold: 5
                }
            },
            stats: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    cyclesCompleted: 0,
                    totalSent: 0,
                    totalFailed: 0,
                    lastCycleAt: null,
                    successRate: 0,
                    averageTimePerCycle: 0,
                    totalTime: 0,
                    errors: [],
                    lastError: null,
                    bySession: {},
                    byAd: {}
                }
            },
            lastRunAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_run_at'
            },
            nextRunAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'next_run_at'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'auto_posts',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['ad_id']
                },
                {
                    fields: ['last_run_at']
                },
                {
                    fields: ['next_run_at']
                }
            ],
            hooks: {
                beforeCreate: (post) => {
                    if (!post.name) {
                        post.name = `نشر تلقائي ${new Date().toLocaleDateString('ar-SA')}`;
                    }
                    
                    if (!post.nextRunAt && post.status === 'active') {
                        post.nextRunAt = new Date(Date.now() + 60000); // بعد دقيقة
                    }
                },
                beforeUpdate: (post) => {
                    if (post.changed('status') && post.status === 'active' && !post.nextRunAt) {
                        post.nextRunAt = new Date(Date.now() + 60000);
                    }
                }
            }
        });
    }

    // ============================================
    // 7. نموذج الردود التلقائية
    // ============================================
    initAutoReplyModel() {
        return this.sequelize.define('AutoReply', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },
            triggerType: {
                type: DataTypes.ENUM(
                    'private',
                    'group',
                    'both'
                ),
                allowNull: false,
                defaultValue: 'both',
                field: 'trigger_type',
                validate: {
                    isIn: [['private', 'group', 'both']]
                }
            },
            trigger: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            response: {
                type: DataTypes.TEXT('long'),
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            responseType: {
                type: DataTypes.ENUM(
                    'text',
                    'image',
                    'video',
                    'contact',
                    'document',
                    'location',
                    'sticker'
                ),
                allowNull: false,
                defaultValue: 'text',
                field: 'response_type',
                validate: {
                    isIn: [['text', 'image', 'video', 'contact', 'document', 'location', 'sticker']]
                }
            },
            matchType: {
                type: DataTypes.ENUM(
                    'exact',
                    'contains',
                    'regex',
                    'starts_with',
                    'ends_with'
                ),
                allowNull: false,
                defaultValue: 'contains',
                field: 'match_type',
                validate: {
                    isIn: [['exact', 'contains', 'regex', 'starts_with', 'ends_with']]
                }
            },
            conditions: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    requireKeywords: [],
                    excludeKeywords: [],
                    timeRange: null,
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    requireMedia: false,
                    mediaType: null,
                    requireLocation: false,
                    locationRange: null,
                    requireContact: false,
                    contactType: null
                }
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 5,
                validate: {
                    min: 1,
                    max: 10
                }
            },
            cooldown: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 30,
                validate: {
                    min: 0
                }
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: 'is_active'
            },
            stats: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    triggered: 0,
                    failed: 0,
                    lastTriggered: null,
                    bySession: {},
                    byTrigger: {},
                    averageResponseTime: 0
                }
            },
            mediaUrl: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'media_url'
            },
            mediaType: {
                type: DataTypes.STRING(50),
                allowNull: true,
                field: 'media_type'
            },
            mediaSize: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'media_size'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'auto_replies',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['session_id']
                },
                {
                    fields: ['is_active']
                },
                {
                    fields: ['trigger_type']
                },
                {
                    fields: ['priority']
                },
                {
                    fields: ['trigger']
                }
            ],
            hooks: {
                beforeCreate: (reply) => {
                    if (!reply.name) {
                        reply.name = `رد ${reply.trigger.substring(0, 20)}...`;
                    }
                    
                    // تأكد من أن trigger نص
                    if (typeof reply.trigger !== 'string') {
                        reply.trigger = String(reply.trigger);
                    }
                },
                beforeUpdate: (reply) => {
                    if (reply.changed('trigger')) {
                        reply.stats.lastTriggered = null;
                    }
                }
            }
        });
    }

    // ============================================
    // 8. نموذج الانضمام التلقائي
    // ============================================
    initAutoJoinModel() {
        return this.sequelize.define('AutoJoin', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },
            links: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: [],
                validate: {
                    isArray(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('يجب أن تكون الروابط مصفوفة');
                        }
                    }
                }
            },
            filters: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    minMembers: 0,
                    maxMembers: 1000000,
                    allowedKeywords: [],
                    excludedKeywords: [],
                    allowedLanguages: [],
                    excludeCountries: [],
                    requireDescription: false,
                    requireActive: true,
                    activeThreshold: 7,
                    excludeRecent: true,
                    recentThreshold: 3
                }
            },
            status: {
                type: DataTypes.ENUM(
                    'active',
                    'paused',
                    'completed',
                    'error',
                    'stopped'
                ),
                allowNull: false,
                defaultValue: 'active',
                validate: {
                    isIn: [['active', 'paused', 'completed', 'error', 'stopped']]
                }
            },
            settings: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    delayBetweenJoins: 120000,
                    maxJoinsPerDay: 50,
                    notifyOnJoin: true,
                    stopOnError: false,
                    autoLeaveInactive: false,
                    inactiveDays: 30,
                    verifyGroup: true,
                    verificationDelay: 5000,
                    skipDuplicates: true,
                    duplicateThreshold: 7
                }
            },
            stats: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    totalLinks: 0,
                    joined: 0,
                    failed: 0,
                    successRate: 0,
                    lastJoinAt: null,
                    lastError: null,
                    lastLinks: [],
                    averageJoinTime: 0,
                    bySession: {},
                    byTime: {}
                }
            },
            lastRunAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_run_at'
            },
            nextRunAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'next_run_at'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'auto_joins',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['session_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['last_run_at']
                },
                {
                    fields: ['next_run_at']
                }
            ],
            hooks: {
                beforeCreate: (join) => {
                    if (!join.name) {
                        join.name = `انضمام ${new Date().toLocaleDateString('ar-SA')}`;
                    }
                    
                    // تأكد من أن links مصفوفة
                    if (!Array.isArray(join.links)) {
                        join.links = [];
                    }
                    
                    // حساب totalLinks
                    join.stats.totalLinks = join.links.length;
                },
                beforeUpdate: (join) => {
                    if (join.changed('links')) {
                        join.stats.totalLinks = join.links.length;
                    }
                }
            }
        });
    }

    // ============================================
    // 9. نموذج البث الجماعي
    // ============================================
    initBroadcastModel() {
        return this.sequelize.define('Broadcast', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },
            type: {
                type: DataTypes.ENUM(
                    'contacts',
                    'groups',
                    'both',
                    'specific'
                ),
                allowNull: false,
                defaultValue: 'groups',
                validate: {
                    isIn: [['contacts', 'groups', 'both', 'specific']]
                }
            },
            content: {
                type: DataTypes.TEXT('long'),
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            target: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    allContacts: true,
                    allGroups: true,
                    specificContacts: [],
                    specificGroups: [],
                    excludeContacts: [],
                    excludeGroups: [],
                    filters: {
                        minMembers: 0,
                        maxMembers: 1000000,
                        activeOnly: true,
                        recentActivity: 30
                    }
                }
            },
            schedule: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: {
                    sendAt: null,
                    repeat: false,
                    interval: 0,
                    timezone: 'Asia/Riyadh',
                    optimizeTime: true,
                    peakHours: [9, 10, 11, 15, 16, 17, 20, 21]
                }
            },
            status: {
                type: DataTypes.ENUM(
                    'scheduled',
                    'sending',
                    'completed',
                    'failed',
                    'cancelled',
                    'paused'
                ),
                allowNull: false,
                defaultValue: 'scheduled',
                validate: {
                    isIn: [['scheduled', 'sending', 'completed', 'failed', 'cancelled', 'paused']]
                }
            },
            stats: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: {
                    total: 0,
                    sent: 0,
                    failed: 0,
                    progress: 0,
                    startTime: null,
                    endTime: null,
                    duration: 0,
                    successRate: 0,
                    bySession: {},
                    byType: {}
                }
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'broadcasts',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['type']
                },
                {
                    fields: ['created_at']
                }
            ],
            hooks: {
                beforeCreate: (broadcast) => {
                    if (!broadcast.name) {
                        broadcast.name = `بث ${new Date().toLocaleDateString('ar-SA')}`;
                    }
                },
                beforeUpdate: (broadcast) => {
                    if (broadcast.changed('status') && broadcast.status === 'sending') {
                        broadcast.stats.startTime = new Date();
                    } else if (broadcast.changed('status') && broadcast.status === 'completed') {
                        broadcast.stats.endTime = new Date();
                        if (broadcast.stats.startTime) {
                            broadcast.stats.duration = 
                                (broadcast.stats.endTime - broadcast.stats.startTime) / 1000;
                        }
                        if (broadcast.stats.total > 0) {
                            broadcast.stats.successRate = 
                                (broadcast.stats.sent / broadcast.stats.total) * 100;
                        }
                    }
                }
            }
        });
    }

    // ============================================
    // 10. نموذج الإشعارات
    // ============================================
    initNotificationModel() {
        return this.sequelize.define('Notification', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            type: {
                type: DataTypes.ENUM(
                    'info',
                    'success',
                    'warning',
                    'error',
                    'system',
                    'broadcast',
                    'advertisement',
                    'session',
                    'link',
                    'join'
                ),
                allowNull: false,
                defaultValue: 'info',
                validate: {
                    isIn: [['info', 'success', 'warning', 'error', 'system', 'broadcast', 'advertisement', 'session', 'link', 'join']]
                }
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            data: {
                type: DataTypes.JSON,
                allowNull: true
            },
            isRead: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_read'
            },
            readAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'read_at'
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 3,
                validate: {
                    min: 1,
                    max: 5
                }
            },
            expiresAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'expires_at'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'notifications',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['is_read']
                },
                {
                    fields: ['type']
                },
                {
                    fields: ['priority']
                },
                {
                    fields: ['created_at']
                },
                {
                    fields: ['expires_at']
                }
            ],
            hooks: {
                beforeCreate: (notification) => {
                    if (!notification.title) {
                        notification.title = 'إشعار جديد';
                    }
                    
                    // تحديد تاريخ انتهاء إذا لم يكن محدداً
                    if (!notification.expiresAt) {
                        const expiryDays = {
                            'info': 7,
                            'success': 7,
                            'warning': 30,
                            'error': 90,
                            'system': 365
                        };
                        
                        const days = expiryDays[notification.type] || 7;
                        notification.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                    }
                }
            }
        });
    }

    // ============================================
    // 11. نموذج سجلات النشاطات
    // ============================================
    initActivityLogModel() {
        return this.sequelize.define('ActivityLog', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            action: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            module: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            details: {
                type: DataTypes.JSON,
                allowNull: true
            },
            ipAddress: {
                type: DataTypes.STRING(45),
                allowNull: true,
                field: 'ip_address'
            },
            userAgent: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'user_agent'
            },
            status: {
                type: DataTypes.ENUM('success', 'failed', 'warning'),
                allowNull: false,
                defaultValue: 'success'
            },
            executionTime: {
                type: DataTypes.INTEGER,
                allowNull: true,
                field: 'execution_time'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'activity_logs',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['admin_id']
                },
                {
                    fields: ['session_id']
                },
                {
                    fields: ['action']
                },
                {
                    fields: ['module']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['created_at']
                },
                {
                    fields: ['ip_address']
                }
            ]
        });
    }

    // ============================================
    // 12. نموذج الأرشفة
    // ============================================
    initArchiveModel() {
        return this.sequelize.define('Archive', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            tableName: {
                type: DataTypes.STRING(100),
                allowNull: false,
                field: 'table_name',
                validate: {
                    notEmpty: true
                }
            },
            recordId: {
                type: DataTypes.STRING(50),
                allowNull: false,
                field: 'record_id',
                validate: {
                    notEmpty: true
                }
            },
            data: {
                type: DataTypes.JSON,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            archivedBy: {
                type: DataTypes.STRING(50),
                allowNull: true,
                field: 'archived_by'
            },
            reason: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'archives',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['table_name']
                },
                {
                    fields: ['record_id']
                },
                {
                    fields: ['archived_by']
                },
                {
                    fields: ['archived_at']
                }
            ]
        });
    }

    // ============================================
    // 13. نموذج محاولات الدخول
    // ============================================
    initLoginAttemptModel() {
        return this.sequelize.define('LoginAttempt', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            ipAddress: {
                type: DataTypes.STRING(45),
                allowNull: false,
                field: 'ip_address',
                validate: {
                    notEmpty: true
                }
            },
            userAgent: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'user_agent'
            },
            success: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            reason: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'login_attempts',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['telegram_id']
                },
                {
                    fields: ['ip_address']
                },
                {
                    fields: ['success']
                },
                {
                    fields: ['attempt_time']
                }
            ]
        });
    }

    // ============================================
    // 14. نموذج سجلات النظام
    // ============================================
    initSystemLogModel() {
        return this.sequelize.define('SystemLog', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `syslog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            level: {
                type: DataTypes.ENUM(
                    'debug',
                    'info',
                    'warning',
                    'error',
                    'critical'
                ),
                allowNull: false,
                defaultValue: 'info',
                validate: {
                    isIn: [['debug', 'info', 'warning', 'error', 'critical']]
                }
            },
            component: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            details: {
                type: DataTypes.JSON,
                allowNull: true
            },
            stackTrace: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: 'stack_trace'
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'system_logs',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['level']
                },
                {
                    fields: ['component']
                },
                {
                    fields: ['created_at']
                }
            ]
        });
    }

    // ============================================
    // 15. نموذج النسخ الاحتياطية
    // ============================================
    initBackupModel() {
        return this.sequelize.define('Backup', {
            id: {
                type: DataTypes.STRING(50),
                primaryKey: true,
                defaultValue: () => `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            type: {
                type: DataTypes.ENUM(
                    'full',
                    'incremental',
                    'differential',
                    'schema',
                    'data'
                ),
                allowNull: false,
                defaultValue: 'full',
                validate: {
                    isIn: [['full', 'incremental', 'differential', 'schema', 'data']]
                }
            },
            size: {
                type: DataTypes.BIGINT,
                allowNull: true,
                validate: {
                    min: 0
                }
            },
            filePath: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'file_path'
            },
            checksum: {
                type: DataTypes.STRING(64),
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM(
                    'pending',
                    'in_progress',
                    'completed',
                    'failed',
                    'verified',
                    'corrupted'
                ),
                allowNull: false,
                defaultValue: 'pending',
                validate: {
                    isIn: [['pending', 'in_progress', 'completed', 'failed', 'verified', 'corrupted']]
                }
            },
            metadata: {
                type: DataTypes.JSON,
                allowNull: true
            }
        }, {
            tableName: 'backups',
            timestamps: true,
            paranoid: true,
            underscored: true,
            indexes: [
                {
                    fields: ['type']
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['created_at']
                }
            ]
        });
    }

    // ============================================
    // 16. دوال مساعدة للنماذج
    // ============================================
    classifyLinkType(url) {
        if (!url) return 'other';
        
        url = url.toLowerCase();
        
        if (url.includes('chat.whatsapp.com')) return 'whatsapp_group';
        if (url.includes('whatsapp.com')) return 'whatsapp_invite';
        if (url.includes('t.me') || url.includes('telegram.me')) return 'telegram';
        if (url.includes('discord.gg') || url.includes('discord.com')) return 'discord';
        if (url.includes('signal.group')) return 'signal';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('facebook.com')) return 'facebook';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('tiktok.com')) return 'tiktok';
        
        return 'website';
    }

    generateLinkTitle(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            
            // استخراج اسم من الرابط
            const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
            
            if (pathParts.length > 0) {
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart.length > 3) {
                    return decodeURIComponent(lastPart).replace(/[-_]/g, ' ');
                }
            }
            
            return hostname;
        } catch {
            return 'رابط غير معروف';
        }
    }

    // ============================================
    // 17. إعداد العلاقات بين النماذج
    // ============================================
    setupAssociations() {
        const {
            Admin,
            WhatsAppSession,
            CollectedLink,
            Advertisement,
            AutoPost,
            AutoReply,
            AutoJoin,
            Broadcast,
            Notification,
            ActivityLog,
            Archive,
            LoginAttempt,
            SystemLog,
            Backup
        } = this.models;

        // علاقات المشرف
        Admin.hasMany(WhatsAppSession, {
            foreignKey: 'adminId',
            as: 'sessions',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(Advertisement, {
            foreignKey: 'adminId',
            as: 'advertisements',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(AutoPost, {
            foreignKey: 'adminId',
            as: 'autoPosts',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(AutoReply, {
            foreignKey: 'adminId',
            as: 'autoReplies',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(AutoJoin, {
            foreignKey: 'adminId',
            as: 'autoJoins',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(Broadcast, {
            foreignKey: 'adminId',
            as: 'broadcasts',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(Notification, {
            foreignKey: 'adminId',
            as: 'notifications',
            onDelete: 'CASCADE'
        });
        
        Admin.hasMany(ActivityLog, {
            foreignKey: 'adminId',
            as: 'activityLogs',
            onDelete: 'SET NULL'
        });
        
        Admin.hasMany(LoginAttempt, {
            foreignKey: 'telegramId',
            sourceKey: 'telegramId',
            as: 'loginAttempts',
            onDelete: 'CASCADE'
        });

        // علاقات الجلسات
        WhatsAppSession.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });
        
        WhatsAppSession.hasMany(CollectedLink, {
            foreignKey: 'sessionId',
            as: 'collectedLinks',
            onDelete: 'CASCADE'
        });
        
        WhatsAppSession.hasMany(AutoReply, {
            foreignKey: 'sessionId',
            as: 'autoReplies',
            onDelete: 'CASCADE'
        });
        
        WhatsAppSession.hasMany(AutoJoin, {
            foreignKey: 'sessionId',
            as: 'autoJoins',
            onDelete: 'CASCADE'
        });
        
        WhatsAppSession.hasMany(ActivityLog, {
            foreignKey: 'sessionId',
            as: 'activityLogs',
            onDelete: 'SET NULL'
        });

        // علاقات الروابط
        CollectedLink.belongsTo(WhatsAppSession, {
            foreignKey: 'sessionId',
            as: 'session'
        });

        // علاقات الإعلانات
        Advertisement.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });
        
        Advertisement.hasMany(AutoPost, {
            foreignKey: 'adId',
            as: 'autoPosts',
            onDelete: 'CASCADE'
        });

        // علاقات النشر التلقائي
        AutoPost.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });
        
        AutoPost.belongsTo(Advertisement, {
            foreignKey: 'adId',
            as: 'advertisement'
        });

        // علاقات الردود التلقائية
        AutoReply.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });
        
        AutoReply.belongsTo(WhatsAppSession, {
            foreignKey: 'sessionId',
            as: 'session'
        });

        // علاقات الانضمام التلقائي
        AutoJoin.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });
        
        AutoJoin.belongsTo(WhatsAppSession, {
            foreignKey: 'sessionId',
            as: 'session'
        });

        // علاقات البث
        Broadcast.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });

        // علاقات الإشعارات
        Notification.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });

        // علاقات سجلات النشاطات
        ActivityLog.belongsTo(Admin, {
            foreignKey: 'adminId',
            as: 'admin'
        });
        
        ActivityLog.belongsTo(WhatsAppSession, {
            foreignKey: 'sessionId',
            as: 'session'
        });

        // علاقات الأرشفة
        Archive.belongsTo(Admin, {
            foreignKey: 'archivedBy',
            targetKey: 'id',
            as: 'archivedByAdmin'
        });

        // علاقات محاولات الدخول
        LoginAttempt.belongsTo(Admin, {
            foreignKey: 'telegramId',
            targetKey: 'telegramId',
            as: 'admin'
        });

        console.log('✅ تم إعداد جميع العلاقات');
    }

    // ============================================
    // 18. الحصول على جميع النماذج
    // ============================================
    getModels() {
        return this.models;
    }

    // ============================================
    // 19. مزامنة النماذج مع قاعدة البيانات
    // ============================================
    async sync(options = {}) {
        console.log('🔄 جاري مزامنة النماذج مع قاعدة البيانات...');
        
        const syncOptions = {
            force: options.force || false,
            alter: options.alter || true,
            logging: options.logging || console.log
        };

        try {
            // مزامنة جميع النماذج
            for (const [name, model] of Object.entries(this.models)) {
                console.log(`   🔄 مزامنة نموذج: ${name}`);
                await model.sync(syncOptions);
            }

            console.log('✅ تمت مزامنة جميع النماذج بنجاح');
            return true;

        } catch (error) {
            console.error('❌ فشل مزامنة النماذج:', error);
            throw error;
        }
    }

    // ============================================
    // 20. إنشاء بيانات تجريبية
    // ============================================
    async seedDemoData() {
        console.log('🌱 جاري إنشاء بيانات تجريبية...');

        try {
            // إنشاء مشرف تجريبي
            const admin = await this.models.Admin.create({
                telegramId: '123456789',
                username: 'demo_admin',
                firstName: 'المشرف التجريبي',
                permissions: ['admin', 'manage_sessions', 'manage_ads', 'manage_broadcasts', 'view_stats', 'manage_admins'],
                isSuperAdmin: true
            });

            console.log(`✅ تم إنشاء المشرف: ${admin.firstName}`);

            // إنشاء جلسة تجريبية
            const session = await this.models.WhatsAppSession.create({
                adminId: admin.id,
                sessionId: `demo_session_${Date.now()}`,
                phoneNumber: '+966501234567',
                status: 'connected',
                groupsCount: 5,
                contactsCount: 10
            });

            console.log(`✅ تم إنشاء الجلسة: ${session.phoneNumber}`);

            // إنشاء روابط تجريبية
            const demoLinks = [
                {
                    url: 'https://chat.whatsapp.com/ABC123',
                    type: 'whatsapp_group',
                    title: 'مجموعة تجريبية 1',
                    sessionId: session.id
                },
                {
                    url: 'https://chat.whatsapp.com/DEF456',
                    type: 'whatsapp_group',
                    title: 'مجموعة تجريبية 2',
                    sessionId: session.id
                },
                {
                    url: 'https://t.me/demochannel',
                    type: 'telegram',
                    title: 'قناة تليجرام تجريبية',
                    sessionId: session.id
                }
            ];

            for (const linkData of demoLinks) {
                await this.models.CollectedLink.create(linkData);
            }

            console.log(`✅ تم إنشاء ${demoLinks.length} رابط تجريبي`);

            // إنشاء إعلان تجريبي
            const ad = await this.models.Advertisement.create({
                adminId: admin.id,
                name: 'إعلان تجريبي',
                type: 'text',
                content: 'هذا إعلان تجريبي للنظام',
                isActive: true
            });

            console.log(`✅ تم إنشاء الإعلان: ${ad.name}`);

            // إنشاء رد تلقائي تجريبي
            const reply = await this.models.AutoReply.create({
                adminId: admin.id,
                sessionId: session.id,
                name: 'رد التحية',
                triggerType: 'both',
                trigger: 'مرحبا',
                response: 'أهلاً وسهلاً بك! كيف يمكنني مساعدتك؟',
                isActive: true
            });

            console.log(`✅ تم إنشاء الرد التلقائي: ${reply.name}`);

            console.log('🎉 تم إنشاء جميع البيانات التجريبية بنجاح');
            return { admin, session, ad, reply };

        } catch (error) {
            console.error('❌ فشل إنشاء البيانات التجريبية:', error);
            throw error;
        }
    }
}

// ============================================
// 21. التصدير
// ============================================
module.exports = WhatsAppModels;
