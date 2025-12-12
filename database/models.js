// ============================================
// 📁 قاعدة البيانات - تعريف النماذج (Models)
// الإصدار: 2.0.0 - Render Optimized
// ============================================

const { Sequelize, DataTypes, Op } = require('sequelize');

// استيراد sequelize من الملف الرئيسي
const sequelize = require('./index').sequelize;

// ============================================
// 1. نموذج المشرفين المحسن
// ============================================
const Admin = sequelize.define('Admin', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للمشرف'
    },
    telegramId: { 
        type: DataTypes.STRING, 
        unique: true, 
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'معرف المستخدم في تليجرام'
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'اسم المستخدم في تليجرام'
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'الاسم الأول'
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'الاسم الأخير'
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            is: /^\+?[1-9]\d{1,14}$/
        },
        comment: 'رقم الهاتف (اختياري)'
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true,
        comment: 'حالة الحساب (نشط/معطل)'
    },
    permissions: { 
        type: DataTypes.JSON, 
        defaultValue: ['basic'],
        comment: 'قائمة الصلاحيات'
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            autoCollectLinks: true,
            autoReplyEnabled: true,
            maxSessions: 5,
            notificationEnabled: true,
            language: 'ar',
            timezone: 'Asia/Riyadh',
            reportFrequency: 'daily',
            autoJoinEnabled: false,
            maxAutoJoinsPerDay: 10,
            broadcastDelay: 1000,
            adPostingDelay: 2000
        },
        comment: 'إعدادات المستخدم الشخصية'
    },
    lastActivity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'آخر نشاط للمستخدم'
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'آخر مرة قام فيها بتسجيل الدخول'
    },
    loginCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'عدد مرات تسجيل الدخول'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'admins',
    indexes: [
        { fields: ['telegramId'] },
        { fields: ['isActive'] },
        { fields: ['lastActivity'] },
        { fields: ['createdAt'] }
    ],
    hooks: {
        beforeUpdate: (admin, options) => {
            admin.updatedAt = new Date();
        }
    }
});

// ============================================
// 2. نموذج جلسات واتساب المحسن
// ============================================
const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { 
        type: DataTypes.STRING, 
        primaryKey: true,
        comment: 'معرف الجلسة الفريد'
    },
    sessionId: { 
        type: DataTypes.STRING, 
        unique: true,
        comment: 'معرف الجلسة في نظام WhatsApp'
    },
    phoneNumber: { 
        type: DataTypes.STRING, 
        allowNull: false,
        validate: {
            notEmpty: true,
            is: /^\+?[1-9]\d{1,14}$/
        },
        comment: 'رقم الهاتف المرتبط بالحساب'
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف المشرف المالك'
    },
    sessionData: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'بيانات الجلسة المشفرة'
    },
    status: { 
        type: DataTypes.ENUM(
            'pending', 
            'awaiting_qr', 
            'connected', 
            'disconnected', 
            'error',
            'authenticated',
            'loading',
            'terminated'
        ),
        defaultValue: 'pending',
        comment: 'حالة الجلسة الحالية'
    },
    qrCode: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'كود QR الحالي'
    },
    qrSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ إرسال آخر QR'
    },
    qrAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'عدد محاولات توليد QR'
    },
    connectionData: {
        type: DataTypes.JSON,
        defaultValue: {
            platform: 'unknown',
            phone: {},
            pushname: '',
            wid: '',
            me: {},
            battery: null,
            platform: '',
            locale: '',
            isBusiness: false
        },
        comment: 'بيانات الاتصال والجهاز'
    },
    lastActivity: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'آخر نشاط للجلسة'
    },
    connectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ الاتصال الناجح'
    },
    disconnectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ فقدان الاتصال'
    },
    groupsCount: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0,
        comment: 'عدد المجموعات'
    },
    contactsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'عدد جهات الاتصال'
    },
    stats: {
        type: DataTypes.JSON,
        defaultValue: {
            messagesReceived: 0,
            messagesSent: 0,
            groupsJoined: 0,
            linksCollected: 0,
            adsPosted: 0,
            broadcastsSent: 0,
            autoRepliesTriggered: 0,
            errors: 0,
            uptime: 0,
            lastMessageAt: null,
            peakActivity: null
        },
        comment: 'إحصائيات الجلسة'
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            autoReply: true,
            autoCollect: true,
            autoJoin: false,
            broadcastEnabled: true,
            adPostingEnabled: true,
            notificationEnabled: true,
            maxGroupsPerDay: 50,
            maxMessagesPerDay: 1000,
            autoLeaveInactiveGroups: false,
            leaveAfterDays: 30,
            safetyMode: true,
            spamProtection: true
        },
        comment: 'إعدادات الجلسة'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            createdFrom: 'telegram_bot',
            platform: 'render',
            userAgent: 'WhatsApp-Bot/2.0.0',
            version: '2.0.0',
            features: [],
            restrictions: [],
            tags: []
        },
        comment: 'بيانات وصفية إضافية'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'هل الجلسة نشطة؟'
    },
    lastHealthCheck: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'آخر فحص صحة للجلسة'
    },
    healthStatus: {
        type: DataTypes.ENUM('healthy', 'warning', 'critical', 'unknown'),
        defaultValue: 'unknown',
        comment: 'حالة صحة الجلسة'
    },
    errorLogs: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'سجلات الأخطاء'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'whatsapp_sessions',
    indexes: [
        { fields: ['adminId'] },
        { fields: ['status'] },
        { fields: ['phoneNumber'] },
        { fields: ['createdAt'] },
        { fields: ['lastActivity'] },
        { fields: ['isActive'] },
        { fields: ['healthStatus'] }
    ],
    hooks: {
        beforeUpdate: (session, options) => {
            session.updatedAt = new Date();
        }
    }
});

// ============================================
// 3. نموذج الروابط المجمعة المحسن
// ============================================
const CollectedLink = sequelize.define('CollectedLink', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للرابط'
    },
    url: { 
        type: DataTypes.STRING, 
        unique: true, 
        allowNull: false,
        validate: {
            notEmpty: true,
            isUrl: true
        },
        comment: 'الرابط الفعلي'
    },
    type: { 
        type: DataTypes.ENUM(
            'whatsapp_group', 
            'whatsapp_invite', 
            'telegram', 
            'website', 
            'other',
            'whatsapp_channel',
            'discord',
            'signal',
            'facebook',
            'instagram',
            'twitter',
            'youtube',
            'tiktok',
            'linkedin'
        ),
        defaultValue: 'other',
        comment: 'نوع الرابط'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'عنوان الرابط'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'وصف الرابط'
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'المصدر الذي تم جمع الرابط منه'
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'معرف الجلسة التي جمعت الرابط'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            groupName: '',
            groupSize: 0,
            isActive: true,
            lastChecked: null,
            category: '',
            language: '',
            country: '',
            membersCount: 0,
            isVerified: false,
            description: '',
            icon: '',
            tags: [],
            qualityScore: 0
        },
        comment: 'بيانات وصفية إضافية'
    },
    status: {
        type: DataTypes.ENUM('active', 'expired', 'invalid', 'joined', 'pending', 'blocked'),
        defaultValue: 'active',
        comment: 'حالة الرابط'
    },
    collectedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ جمع الرابط'
    },
    lastChecked: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ آخر فحص للرابط'
    },
    checkCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'عدد مرات فحص الرابط'
    },
    successRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'معدل نجاح الرابط (%)'
    },
    tags: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'وسوم الرابط للتصنيف'
    },
    priority: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            min: 1,
            max: 10
        },
        comment: 'أولوية الرابط (1-10)'
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'هل الرابط مؤرشف؟'
    },
    archiveReason: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'سبب الأرشفة'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'collected_links',
    indexes: [
        { fields: ['type'] },
        { fields: ['sessionId'] },
        { fields: ['collectedAt'] },
        { fields: ['status'] },
        { fields: ['priority'] },
        { fields: ['isArchived'] },
        { fields: ['tags'], using: 'gin' }
    ],
    hooks: {
        beforeUpdate: (link, options) => {
            link.updatedAt = new Date();
        }
    }
});

// ============================================
// 4. نموذج الإعلانات المحسن
// ============================================
const Advertisement = sequelize.define('Advertisement', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للإعلان'
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف المشرف المالك'
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [3, 100]
        },
        comment: 'اسم الإعلان'
    },
    type: { 
        type: DataTypes.ENUM(
            'text', 
            'image', 
            'video', 
            'contact', 
            'document',
            'location',
            'poll',
            'audio',
            'sticker',
            'gif',
            'buttons',
            'carousel',
            'catalog'
        ),
        defaultValue: 'text',
        comment: 'نوع المحتوى'
    },
    content: { 
        type: DataTypes.TEXT, 
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'محتوى الإعلان'
    },
    fileId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'معرف الملف في التخزين'
    },
    fileUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'رابط الملف'
    },
    caption: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'وصف الصورة/الفيديو'
    },
    buttons: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'أزرار تفاعلية'
    },
    schedule: {
        type: DataTypes.JSON,
        defaultValue: {
            enabled: false,
            startTime: null,
            endTime: null,
            days: [1, 2, 3, 4, 5, 6, 0],
            timezone: 'Asia/Riyadh',
            repeat: false,
            repeatInterval: 24,
            repeatCount: null,
            excludeDates: [],
            specificDates: []
        },
        comment: 'جدولة الإعلان'
    },
    target: {
        type: DataTypes.JSON,
        defaultValue: {
            allGroups: true,
            specificGroups: [],
            minMembers: 0,
            maxMembers: 1000000,
            includeKeywords: [],
            excludeKeywords: [],
            countries: [],
            languages: [],
            groupTypes: [],
            excludeOwnedGroups: false,
            excludeJoinedRecently: false,
            minJoinDays: 0
        },
        comment: 'الجمهور المستهدف'
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true,
        comment: 'هل الإعلان نشط؟'
    },
    stats: { 
        type: DataTypes.JSON, 
        defaultValue: { 
            sent: 0, 
            failed: 0,
            views: 0,
            clicks: 0,
            groups: [],
            lastSent: null,
            successRate: 0,
            totalRecipients: 0,
            deliveryRate: 0,
            engagementRate: 0,
            conversions: 0,
            costPerClick: 0,
            costPerView: 0
        },
        comment: 'إحصائيات الإعلان'
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            delayBetweenGroups: 1000,
            maxGroupsPerHour: 100,
            retryFailed: true,
            optimizeSending: true,
            randomizeOrder: true,
            avoidSpam: true,
            maxRetries: 3,
            stopOnError: false,
            errorThreshold: 10,
            qualityCheck: true,
            contentReview: true
        },
        comment: 'إعدادات النشر'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            category: '',
            tags: [],
            campaignId: null,
            version: 1,
            lastEditedBy: null,
            editHistory: [],
            notes: '',
            approvalStatus: 'pending',
            approvedBy: null,
            approvedAt: null
        },
        comment: 'بيانات وصفية إضافية'
    },
    budget: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        comment: 'الميزانية المخصصة'
    },
    spent: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        comment: 'المبلغ المنفق'
    },
    startDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ بدء الحملة'
    },
    endDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ انتهاء الحملة'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'advertisements',
    indexes: [
        { fields: ['adminId'] },
        { fields: ['isActive'] },
        { fields: ['createdAt'] },
        { fields: ['type'] },
        { fields: ['schedule.enabled'] }
    ],
    hooks: {
        beforeUpdate: (ad, options) => {
            ad.updatedAt = new Date();
        }
    }
});

// ============================================
// 5. نموذج النشر التلقائي المحسن
// ============================================
const AutoPost = sequelize.define('AutoPost', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للنشر التلقائي'
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف المشرف المالك'
    },
    sessionId: { 
        type: DataTypes.STRING, 
        allowNull: false,
        comment: 'معرف الجلسة المستخدمة'
    },
    adId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف الإعلان المراد نشره'
    },
    status: { 
        type: DataTypes.ENUM(
            'active', 
            'paused', 
            'completed', 
            'error',
            'waiting',
            'stopped',
            'queued'
        ),
        defaultValue: 'active',
        comment: 'حالة النشر'
    },
    interval: { 
        type: DataTypes.INTEGER, 
        defaultValue: 1,
        validate: {
            min: 1,
            max: 3600
        },
        comment: 'الفاصل الزمني بالساعات'
    },
    lastPostAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ آخر نشر'
    },
    nextPostAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ النشر التالي'
    },
    stats: { 
        type: DataTypes.JSON, 
        defaultValue: { 
            totalGroups: 0,
            postedGroups: 0,
            failedGroups: [],
            cycle: 0,
            totalMessages: 0,
            startTime: null,
            lastCycleTime: null,
            averageTimePerCycle: 0,
            successRate: 0,
            totalTimeSpent: 0,
            efficiency: 0,
            lastError: null,
            errorCount: 0
        },
        comment: 'إحصائيات النشر'
    },
    settings: { 
        type: DataTypes.JSON, 
        defaultValue: {
            randomDelay: true,
            minDelay: 500,
            maxDelay: 3000,
            skipInactive: true,
            maxRetries: 3,
            stopOnError: false,
            optimizePath: true,
            avoidDuplicates: true,
            qualityCheck: true,
            rotateMessages: false,
            rotationCount: 5,
            adaptiveDelay: true,
            monitorPerformance: true,
            autoPauseOnLowQuality: false
        },
        comment: 'إعدادات النشر'
    },
    logs: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'سجلات النشر'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            startMethod: 'manual',
            stopReason: null,
            pausedBy: null,
            resumedBy: null,
            lastOptimized: null,
            optimizationCount: 0,
            tags: [],
            category: 'general'
        },
        comment: 'بيانات وصفية إضافية'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'auto_posts',
    indexes: [
        { fields: ['adminId', 'status'] },
        { fields: ['sessionId'] },
        { fields: ['nextPostAt'] },
        { fields: ['adId'] },
        { fields: ['createdAt'] }
    ],
    hooks: {
        beforeUpdate: (autoPost, options) => {
            autoPost.updatedAt = new Date();
        }
    }
});

// ============================================
// 6. نموذج الردود التلقائية المحسن
// ============================================
const AutoReply = sequelize.define('AutoReply', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للرد التلقائي'
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف المشرف المالك'
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'معرف الجلسة المستخدمة'
    },
    name: { 
        type: DataTypes.STRING, 
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [3, 50]
        },
        comment: 'اسم الرد التلقائي'
    },
    triggerType: { 
        type: DataTypes.ENUM(
            'private', 
            'group', 
            'both',
            'broadcast',
            'channel'
        ),
        defaultValue: 'both',
        comment: 'نوع المحادثة المستهدفة'
    },
    trigger: { 
        type: DataTypes.TEXT, 
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'النص المحفز'
    },
    response: { 
        type: DataTypes.TEXT, 
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'نص الرد'
    },
    responseType: {
        type: DataTypes.ENUM('text', 'image', 'file', 'contact', 'location', 'poll'),
        defaultValue: 'text',
        comment: 'نوع الرد'
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true,
        comment: 'هل الرد نشط؟'
    },
    matchType: { 
        type: DataTypes.ENUM(
            'exact', 
            'contains', 
            'regex',
            'starts_with',
            'ends_with',
            'similar',
            'multiple'
        ),
        defaultValue: 'contains',
        comment: 'طريقة المطابقة'
    },
    priority: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            min: 1,
            max: 10
        },
        comment: 'أولوية الرد'
    },
    cooldown: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'فترة التبريد بالثواني'
    },
    conditions: {
        type: DataTypes.JSON,
        defaultValue: {
            timeRange: null,
            daysOfWeek: null,
            maxTriggersPerDay: null,
            requireKeywords: [],
            excludeKeywords: [],
            requireSenderType: null,
            excludeSenders: [],
            requireGroupSize: null,
            excludeGroups: [],
            language: null,
            country: null,
            messageLength: null,
            hasMedia: null,
            isForwarded: null,
            isReply: null
        },
        comment: 'شروط إضافية'
    },
    stats: { 
        type: DataTypes.JSON, 
        defaultValue: { 
            triggered: 0,
            lastTriggered: null,
            successful: 0,
            failed: 0,
            bySession: {},
            byTime: {},
            bySender: {},
            successRate: 0,
            averageResponseTime: 0,
            totalResponseTime: 0
        },
        comment: 'إحصائيات الرد'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            category: 'general',
            tags: [],
            version: 1,
            lastEditedBy: null,
            editHistory: [],
            notes: '',
            aiEnhanced: false,
            learningEnabled: false,
            confidenceScore: 0
        },
        comment: 'بيانات وصفية إضافية'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'auto_replies',
    indexes: [
        { fields: ['adminId', 'isActive'] },
        { fields: ['sessionId'] },
        { fields: ['triggerType'] },
        { fields: ['priority'] },
        { fields: ['matchType'] },
        { fields: ['createdAt'] }
    ],
    hooks: {
        beforeUpdate: (autoReply, options) => {
            autoReply.updatedAt = new Date();
        }
    }
});

// ============================================
// 7. نموذج الانضمام التلقائي المحسن
// ============================================
const AutoJoin = sequelize.define('AutoJoin', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للانضمام التلقائي'
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف المشرف المالك'
    },
    sessionId: { 
        type: DataTypes.STRING, 
        allowNull: false,
        comment: 'معرف الجلسة المستخدمة'
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
        defaultValue: 'active',
        comment: 'حالة الانضمام'
    },
    lastJoinAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ آخر انضمام'
    },
    nextJoinAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ الانضمام التالي'
    },
    stats: { 
        type: DataTypes.JSON, 
        defaultValue: { 
            totalLinks: 0,
            joined: 0,
            failed: 0,
            skipped: 0,
            lastLinks: [],
            successRate: 0,
            lastError: null,
            totalTimeSpent: 0,
            averageTimePerJoin: 0,
            groupsDiscovered: 0,
            activeGroups: 0,
            inactiveGroups: 0,
            errorLogs: []
        },
        comment: 'إحصائيات الانضمام'
    },
    filters: { 
        type: DataTypes.JSON, 
        defaultValue: {
            minGroupSize: 0,
            maxGroupSize: 100000,
            allowedKeywords: [],
            excludedKeywords: [],
            countryCodes: [],
            requireDescription: false,
            maxJoinsPerHour: 10,
            minSuccessRate: 0,
            excludeJoinedGroups: true,
            excludeRecentGroups: true,
            recentDaysThreshold: 7,
            languageFilter: [],
            categoryFilter: [],
            qualityThreshold: 0
        },
        comment: 'فلاتر المجموعات'
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            delayBetweenJoins: 5000,
            verifyBeforeJoin: true,
            leaveInactiveGroups: false,
            autoLeaveAfterDays: 30,
            notifyOnJoin: true,
            monitorGroupActivity: true,
            autoOptimize: true,
            adaptiveDelay: true,
            maxRetries: 3,
            stopOnManyErrors: true,
            errorThreshold: 5,
            backupSession: false,
            rotateSessions: false
        },
        comment: 'إعدادات الانضمام'
    },
    logs: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'سجلات الانضمام'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            startMethod: 'manual',
            stopReason: null,
            discoveredGroups: [],
            blacklistedGroups: [],
            whitelistedGroups: [],
            tags: [],
            category: 'general',
            lastOptimized: null,
            optimizationCount: 0
        },
        comment: 'بيانات وصفية إضافية'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'auto_joins',
    indexes: [
        { fields: ['adminId', 'status'] },
        { fields: ['sessionId'] },
        { fields: ['nextJoinAt'] },
        { fields: ['createdAt'] }
    ],
    hooks: {
        beforeUpdate: (autoJoin, options) => {
            autoJoin.updatedAt = new Date();
        }
    }
});

// ============================================
// 8. نموذج البث الجماعي المحسن
// ============================================
const Broadcast = sequelize.define('Broadcast', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للبث'
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        comment: 'معرف المشرف المالك'
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'معرف الجلسة المستخدمة'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'اسم البث'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'محتوى الرسالة'
    },
    type: {
        type: DataTypes.ENUM('text', 'image', 'document', 'video', 'audio', 'contact', 'location'),
        defaultValue: 'text',
        comment: 'نوع الرسالة'
    },
    targetType: {
        type: DataTypes.ENUM('contacts', 'groups', 'specific', 'all', 'filtered'),
        defaultValue: 'contacts',
        comment: 'نوع الجمهور المستهدف'
    },
    targets: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'قائمة المستهدفين'
    },
    filters: {
        type: DataTypes.JSON,
        defaultValue: {
            minGroupSize: 0,
            maxGroupSize: 100000,
            includeKeywords: [],
            excludeKeywords: [],
            countries: [],
            languages: [],
            groupTypes: [],
            excludeRecent: false,
            excludeInactive: true,
            qualityThreshold: 0
        },
        comment: 'فلاتر الجمهور'
    },
    status: {
        type: DataTypes.ENUM('pending', 'sending', 'completed', 'failed', 'paused', 'cancelled'),
        defaultValue: 'pending',
        comment: 'حالة البث'
    },
    progress: {
        type: DataTypes.JSON,
        defaultValue: {
            total: 0,
            sent: 0,
            failed: 0,
            current: 0,
            pending: 0,
            successRate: 0,
            averageTimePerMessage: 0,
            estimatedTimeRemaining: 0
        },
        comment: 'تقدم البث'
    },
    scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ الجدولة'
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ البدء'
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ الإكمال'
    },
    results: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'نتائج البث'
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            delayBetweenMessages: 1000,
            maxRetries: 3,
            stopOnManyErrors: true,
            errorThreshold: 10,
            optimizeOrder: true,
            randomizeDelay: true,
            minDelay: 500,
            maxDelay: 3000,
            trackResponses: true,
            autoStopOnLowSuccess: false,
            successThreshold: 50,
            backupSession: false
        },
        comment: 'إعدادات البث'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            category: 'general',
            tags: [],
            campaignId: null,
            version: 1,
            notes: '',
            priority: 1,
            retryCount: 0,
            lastRetryAt: null,
            createdBy: 'system'
        },
        comment: 'بيانات وصفية إضافية'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'broadcasts',
    indexes: [
        { fields: ['adminId'] },
        { fields: ['status'] },
        { fields: ['scheduledAt'] },
        { fields: ['createdAt'] },
        { fields: ['targetType'] }
    ],
    hooks: {
        beforeUpdate: (broadcast, options) => {
            broadcast.updatedAt = new Date();
        }
    }
});

// ============================================
// 9. نموذج سجلات النظام (Logs)
// ============================================
const SystemLog = sequelize.define('SystemLog', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للسجل'
    },
    level: {
        type: DataTypes.ENUM('info', 'warning', 'error', 'debug', 'critical'),
        defaultValue: 'info',
        comment: 'مستوى السجل'
    },
    category: {
        type: DataTypes.ENUM(
            'system', 
            'whatsapp', 
            'telegram', 
            'database', 
            'api',
            'autopost',
            'autoreply',
            'autojoin',
            'broadcast',
            'advertisement',
            'security',
            'performance',
            'maintenance'
        ),
        defaultValue: 'system',
        comment: 'فئة السجل'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'نص السجل'
    },
    details: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'تفاصيل إضافية'
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'معرف الجلسة'
    },
    adminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'معرف المشرف'
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'عنوان IP'
    },
    userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'وكيل المستخدم'
    },
    resolved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'هل تم حل المشكلة؟'
    },
    resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ الحل'
    },
    resolvedBy: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'تم الحل بواسطة'
    },
    tags: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'وسوم السجل'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    }
}, {
    timestamps: true,
    updatedAt: false,
    tableName: 'system_logs',
    indexes: [
        { fields: ['level'] },
        { fields: ['category'] },
        { fields: ['createdAt'] },
        { fields: ['sessionId'] },
        { fields: ['adminId'] },
        { fields: ['resolved'] }
    ]
});

// ============================================
// 10. نموذج الإحصائيات اليومية
// ============================================
const DailyStat = sequelize.define('DailyStat', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للإحصائية'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
        comment: 'التاريخ'
    },
    adminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'معرف المشرف'
    },
    stats: {
        type: DataTypes.JSON,
        defaultValue: {
            // جلسات واتساب
            activeSessions: 0,
            totalSessions: 0,
            newSessions: 0,
            disconnectedSessions: 0,
            
            // الرسائل
            messagesReceived: 0,
            messagesSent: 0,
            totalMessages: 0,
            avgResponseTime: 0,
            
            // الروابط
            linksCollected: 0,
            whatsappLinks: 0,
            telegramLinks: 0,
            otherLinks: 0,
            activeLinks: 0,
            expiredLinks: 0,
            
            // الإعلانات
            adsPosted: 0,
            adsCreated: 0,
            activeAds: 0,
            adSuccessRate: 0,
            
            // النشر التلقائي
            autoPostsCompleted: 0,
            autoPostSuccessRate: 0,
            autoPostMessages: 0,
            
            // الردود التلقائية
            autoRepliesTriggered: 0,
            autoReplySuccessRate: 0,
            
            // الانضمام التلقائي
            autoJoinsCompleted: 0,
            groupsJoined: 0,
            autoJoinSuccessRate: 0,
            
            // البث الجماعي
            broadcastsSent: 0,
            broadcastRecipients: 0,
            broadcastSuccessRate: 0,
            
            // النظام
            errors: 0,
            warnings: 0,
            uptime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            
            // الأداء
            peakActivity: null,
            lowActivity: null,
            avgActivity: 0,
            efficiency: 0,
            qualityScore: 0
        },
        comment: 'الإحصائيات اليومية'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            notes: '',
            tags: [],
            verified: false,
            anomalies: [],
            trends: [],
            recommendations: []
        },
        comment: 'بيانات وصفية إضافية'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'daily_stats',
    indexes: [
        { fields: ['date'] },
        { fields: ['adminId'] },
        { fields: ['createdAt'] }
    ],
    hooks: {
        beforeUpdate: (dailyStat, options) => {
            dailyStat.updatedAt = new Date();
        }
    }
});

// ============================================
// 11. نموذج إعدادات النظام
// ============================================
const SystemSetting = sequelize.define('SystemSetting', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي للإعداد'
    },
    key: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
            notEmpty: true
        },
        comment: 'مفتاح الإعداد'
    },
    value: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'قيمة الإعداد'
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'general',
        comment: 'فئة الإعداد'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'وصف الإعداد'
    },
    isPublic: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'هل الإعداد عام؟'
    },
    editable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'هل يمكن تعديله؟'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'بيانات وصفية إضافية'
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'نسخة الإعداد'
    },
    updatedBy: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'آخر من قام بالتحديث'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'system_settings',
    indexes: [
        { fields: ['key'] },
        { fields: ['category'] },
        { fields: ['isPublic'] }
    ],
    hooks: {
        beforeUpdate: (setting, options) => {
            setting.updatedAt = new Date();
            setting.version += 1;
        }
    }
});

// ============================================
// 12. نموذج قوائم الحظر
// ============================================
const Blacklist = sequelize.define('Blacklist', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true,
        comment: 'المعرف الأساسي'
    },
    type: {
        type: DataTypes.ENUM('phone', 'group', 'contact', 'url', 'ip', 'keyword'),
        allowNull: false,
        comment: 'نوع العنصر الممنوع'
    },
    value: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'قيمة العنصر الممنوع'
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'سبب المنع'
    },
    adminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'معرف المشرف الذي أضافه'
    },
    severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium',
        comment: 'شدة المنع'
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'تاريخ انتهاء المنع'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'هل المنع فعال؟'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'بيانات وصفية إضافية'
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ الإنشاء'
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        comment: 'تاريخ التحديث'
    }
}, {
    timestamps: true,
    tableName: 'blacklist',
    indexes: [
        { fields: ['type'] },
        { fields: ['value'] },
        { fields: ['isActive'] },
        { fields: ['expiresAt'] }
    ],
    hooks: {
        beforeUpdate: (blacklist, options) => {
            blacklist.updatedAt = new Date();
        }
    }
});

// ============================================
// 13. العلاقات بين النماذج
// ============================================

// المشرف ↔ الجلسات (One-to-Many)
Admin.hasMany(WhatsAppSession, { foreignKey: 'adminId', onDelete: 'CASCADE' });
WhatsAppSession.belongsTo(Admin, { foreignKey: 'adminId' });

// المشرف ↔ الإعلانات (One-to-Many)
Admin.hasMany(Advertisement, { foreignKey: 'adminId', onDelete: 'CASCADE' });
Advertisement.belongsTo(Admin, { foreignKey: 'adminId' });

// المشرف ↔ النشر التلقائي (One-to-Many)
Admin.hasMany(AutoPost, { foreignKey: 'adminId', onDelete: 'CASCADE' });
AutoPost.belongsTo(Admin, { foreignKey: 'adminId' });

// المشرف ↔ الردود التلقائية (One-to-Many)
Admin.hasMany(AutoReply, { foreignKey: 'adminId', onDelete: 'CASCADE' });
AutoReply.belongsTo(Admin, { foreignKey: 'adminId' });

// المشرف ↔ الانضمام التلقائي (One-to-Many)
Admin.hasMany(AutoJoin, { foreignKey: 'adminId', onDelete: 'CASCADE' });
AutoJoin.belongsTo(Admin, { foreignKey: 'adminId' });

// المشرف ↔ البث الجماعي (One-to-Many)
Admin.hasMany(Broadcast, { foreignKey: 'adminId', onDelete: 'CASCADE' });
Broadcast.belongsTo(Admin, { foreignKey: 'adminId' });

// الجلسة ↔ الروابط (One-to-Many)
WhatsAppSession.hasMany(CollectedLink, { foreignKey: 'sessionId', onDelete: 'SET NULL' });
CollectedLink.belongsTo(WhatsAppSession, { foreignKey: 'sessionId' });

// الجلسة ↔ النشر التلقائي (One-to-Many)
WhatsAppSession.hasMany(AutoPost, { foreignKey: 'sessionId', onDelete: 'CASCADE' });
AutoPost.belongsTo(WhatsAppSession, { foreignKey: 'sessionId' });

// الجلسة ↔ الانضمام التلقائي (One-to-Many)
WhatsAppSession.hasMany(AutoJoin, { foreignKey: 'sessionId', onDelete: 'CASCADE' });
AutoJoin.belongsTo(WhatsAppSession, { foreignKey: 'sessionId' });

// الإعلان ↔ النشر التلقائي (One-to-Many)
Advertisement.hasMany(AutoPost, { foreignKey: 'adId', onDelete: 'CASCADE' });
AutoPost.belongsTo(Advertisement, { foreignKey: 'adId' });

// ============================================
// 14. تصدير النماذج
// ============================================
module.exports = {
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin,
    Broadcast,
    SystemLog,
    DailyStat,
    SystemSetting,
    Blacklist,
    
    // دوال مساعدة للنماذج
    models: {
        Admin,
        WhatsAppSession,
        CollectedLink,
        Advertisement,
        AutoPost,
        AutoReply,
        AutoJoin,
        Broadcast,
        SystemLog,
        DailyStat,
        SystemSetting,
        Blacklist
    },
    
    // دالة لتهيئة جميع النماذج
    initializeModels: async function() {
        try {
            console.log('🔧 جاري تهيئة نماذج قاعدة البيانات...');
            
            // التحقق من الاتصال بقاعدة البيانات
            await sequelize.authenticate();
            console.log('✅ تم الاتصال بقاعدة البيانات');
            
            // مزامنة النماذج
            await sequelize.sync({ alter: true });
            console.log('✅ تم مزامنة النماذج مع قاعدة البيانات');
            
            // إنشاء الإعدادات الافتراضية إذا لم تكن موجودة
            await this.createDefaultSettings();
            
            console.log('🎉 تم تهيئة جميع النماذج بنجاح');
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة النماذج:', error);
            throw error;
        }
    },
    
    // دالة لإنشاء الإعدادات الافتراضية
    createDefaultSettings: async function() {
        const defaultSettings = [
            {
                key: 'system.name',
                value: 'WhatsApp Telegram Bot',
                category: 'system',
                description: 'اسم النظام',
                isPublic: true,
                editable: true
            },
            {
                key: 'system.version',
                value: '2.0.0',
                category: 'system',
                description: 'إصدار النظام',
                isPublic: true,
                editable: false
            },
            {
                key: 'system.maintenance',
                value: false,
                category: 'system',
                description: 'وضع الصيانة',
                isPublic: true,
                editable: true
            },
            {
                key: 'whatsapp.max_sessions',
                value: 10,
                category: 'whatsapp',
                description: 'الحد الأقصى للجلسات',
                isPublic: false,
                editable: true
            },
            {
                key: 'whatsapp.auto_collect',
                value: true,
                category: 'whatsapp',
                description: 'التجميع التلقائي للروابط',
                isPublic: false,
                editable: true
            },
            {
                key: 'whatsapp.auto_reply',
                value: true,
                category: 'whatsapp',
                description: 'الردود التلقائية',
                isPublic: false,
                editable: true
            },
            {
                key: 'telegram.notifications',
                value: true,
                category: 'telegram',
                description: 'الإشعارات في تليجرام',
                isPublic: false,
                editable: true
            },
            {
                key: 'security.max_login_attempts',
                value: 5,
                category: 'security',
                description: 'الحد الأقصى لمحاولات تسجيل الدخول',
                isPublic: false,
                editable: true
            },
            {
                key: 'performance.cleanup_days',
                value: 30,
                category: 'performance',
                description: 'عدد أيام الاحتفاظ بالسجلات',
                isPublic: false,
                editable: true
            },
            {
                key: 'notifications.daily_report',
                value: true,
                category: 'notifications',
                description: 'التقارير اليومية',
                isPublic: false,
                editable: true
            }
        ];
        
        for (const setting of defaultSettings) {
            await SystemSetting.findOrCreate({
                where: { key: setting.key },
                defaults: setting
            });
        }
    },
    
    // دالة لمسح جميع البيانات (للتنمية فقط)
    clearAllData: async function() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('لا يمكن مسح البيانات في بيئة الإنتاج');
        }
        
        console.log('⚠️ جاري مسح جميع البيانات...');
        
        const models = [
            Blacklist,
            SystemSetting,
            DailyStat,
            SystemLog,
            Broadcast,
            AutoJoin,
            AutoReply,
            AutoPost,
            Advertisement,
            CollectedLink,
            WhatsAppSession,
            Admin
        ];
        
        for (const model of models) {
            await model.destroy({ where: {}, force: true });
            console.log(`✅ تم مسح ${model.name}`);
        }
        
        console.log('🎉 تم مسح جميع البيانات بنجاح');
    }
};
