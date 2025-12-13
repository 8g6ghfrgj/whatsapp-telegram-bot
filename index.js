// ============================================
// 📱 WhatsApp Telegram Bot - الملف الرئيسي
// الإصدار: 3.0.0 - WhatsApp Bot Simplified
// ============================================

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const WhatsAppTelegramBot = require('./telegramBot');

// ============================================
// 1. إعداد قاعدة البيانات
// ============================================

const sequelize = new Sequelize(
    process.env.DB_NAME || 'whatsapp_bot',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            paranoid: true,
            underscored: true
        }
    }
);

// ============================================
// 2. تعريف النماذج (Models)
// ============================================

// 2.1 نموذج المشرفين
const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    telegramId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'مشرف'
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: ['manage_sessions', 'manage_ads', 'view_stats']
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            notificationEnabled: true,
            language: 'ar',
            maxSessions: 10,
            autoCollectLinks: true,
            autoReplyEnabled: true
        }
    },
    lastActivity: {
        type: DataTypes.DATE,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'admins',
    indexes: [
        {
            unique: true,
            fields: ['telegramId']
        }
    ]
});

// 2.2 نموذج جلسات واتساب
const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM(
            'awaiting_qr',
            'connected',
            'authenticated',
            'disconnected',
            'error'
        ),
        allowNull: false,
        defaultValue: 'awaiting_qr'
    },
    qrCode: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    qrSentAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    connectedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    disconnectedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    groupsCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    contactsCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    connectionData: {
        type: DataTypes.JSON,
        allowNull: true
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            autoReply: true,
            autoCollect: true,
            autoJoin: false,
            broadcastEnabled: true
        }
    },
    stats: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            messagesReceived: 0,
            messagesSent: 0,
            linksCollected: 0,
            groupsJoined: 0
        }
    },
    lastActivity: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'whatsapp_sessions',
    indexes: [
        {
            unique: true,
            fields: ['sessionId']
        },
        {
            fields: ['adminId']
        },
        {
            fields: ['status']
        }
    ]
});

// 2.3 نموذج الروابط المجمعة
const CollectedLink = sequelize.define('CollectedLink', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    url: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM(
            'whatsapp_group',
            'whatsapp_invite',
            'telegram',
            'discord',
            'signal',
            'website',
            'other'
        ),
        allowNull: false,
        defaultValue: 'other'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM(
            'active',
            'inactive',
            'joined',
            'failed',
            'pending'
        ),
        allowNull: false,
        defaultValue: 'active'
    },
    collectedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    lastChecked: {
        type: DataTypes.DATE,
        allowNull: true
    },
    checkCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'collected_links',
    indexes: [
        {
            unique: true,
            fields: ['url']
        },
        {
            fields: ['type']
        },
        {
            fields: ['sessionId']
        },
        {
            fields: ['status']
        }
    ]
});

// 2.4 نموذج الإعلانات
const Advertisement = sequelize.define('Advertisement', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM(
            'text',
            'image',
            'video',
            'contact',
            'document'
        ),
        allowNull: false,
        defaultValue: 'text'
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    target: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
            allGroups: true,
            specificGroups: [],
            minMembers: 0,
            maxMembers: 1000000
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
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
        }
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            delayBetweenGroups: 1000,
            retryFailed: true,
            optimizeSending: true,
            maxRetries: 3
        }
    },
    stats: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            sent: 0,
            failed: 0,
            lastSent: null,
            successRate: 0
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'advertisements',
    indexes: [
        {
            fields: ['adminId']
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['type']
        }
    ]
});

// 2.5 نموذج النشر التلقائي
const AutoPost = sequelize.define('AutoPost', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    adId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    target: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
            allGroups: true,
            specificSessions: [],
            excludeGroups: []
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
            timezone: 'Asia/Riyadh'
        }
    },
    status: {
        type: DataTypes.ENUM(
            'active',
            'paused',
            'completed',
            'error'
        ),
        allowNull: false,
        defaultValue: 'active'
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            delayBetweenGroups: 1000,
            delayBetweenSessions: 5000,
            maxGroupsPerCycle: 50,
            retryFailed: true
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
            successRate: 0
        }
    },
    lastRunAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    nextRunAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'auto_posts',
    indexes: [
        {
            fields: ['adminId']
        },
        {
            fields: ['status']
        },
        {
            fields: ['adId']
        }
    ]
});

// 2.6 نموذج الردود التلقائية
const AutoReply = sequelize.define('AutoReply', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    triggerType: {
        type: DataTypes.ENUM(
            'private',
            'group',
            'both'
        ),
        allowNull: false,
        defaultValue: 'both'
    },
    trigger: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    response: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    responseType: {
        type: DataTypes.ENUM(
            'text',
            'image',
            'video',
            'contact',
            'document'
        ),
        allowNull: false,
        defaultValue: 'text'
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
        defaultValue: 'contains'
    },
    conditions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
            requireKeywords: [],
            excludeKeywords: [],
            timeRange: null,
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
        }
    },
    priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    cooldown: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    stats: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            triggered: 0,
            failed: 0,
            lastTriggered: null,
            bySession: {}
        }
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'auto_replies',
    indexes: [
        {
            fields: ['adminId']
        },
        {
            fields: ['sessionId']
        },
        {
            fields: ['isActive']
        },
        {
            fields: ['triggerType']
        }
    ]
});

// 2.7 نموذج الانضمام التلقائي
const AutoJoin = sequelize.define('AutoJoin', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    links: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    },
    filters: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
            minMembers: 0,
            maxMembers: 1000000,
            allowedKeywords: [],
            excludedKeywords: []
        }
    },
    status: {
        type: DataTypes.ENUM(
            'active',
            'paused',
            'completed',
            'error'
        ),
        allowNull: false,
        defaultValue: 'active'
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            delayBetweenJoins: 120000, // 2 دقائق
            maxJoinsPerDay: 50,
            notifyOnJoin: true,
            stopOnError: false
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
            lastLinks: []
        }
    },
    lastRunAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    nextRunAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'auto_joins',
    indexes: [
        {
            fields: ['adminId']
        },
        {
            fields: ['sessionId']
        },
        {
            fields: ['status']
        }
    ]
});

// 2.8 نموذج البث الجماعي
const Broadcast = sequelize.define('Broadcast', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM(
            'contacts',
            'groups',
            'both',
            'specific'
        ),
        allowNull: false,
        defaultValue: 'groups'
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    target: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
            allContacts: true,
            allGroups: true,
            specificContacts: [],
            specificGroups: []
        }
    },
    schedule: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {
            sendAt: null,
            repeat: false,
            interval: 0
        }
    },
    status: {
        type: DataTypes.ENUM(
            'scheduled',
            'sending',
            'completed',
            'failed',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'scheduled'
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
            endTime: null
        }
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'broadcasts',
    indexes: [
        {
            fields: ['adminId']
        },
        {
            fields: ['status']
        },
        {
            fields: ['type']
        }
    ]
});

// ============================================
// 3. تعريف العلاقات بين النماذج
// ============================================

// علاقة المشرف مع الجلسات
Admin.hasMany(WhatsAppSession, {
    foreignKey: 'adminId',
    as: 'sessions',
    onDelete: 'CASCADE'
});
WhatsAppSession.belongsTo(Admin, {
    foreignKey: 'adminId',
    as: 'admin'
});

// علاقة المشرف مع الإعلانات
Admin.hasMany(Advertisement, {
    foreignKey: 'adminId',
    as: 'advertisements',
    onDelete: 'CASCADE'
});
Advertisement.belongsTo(Admin, {
    foreignKey: 'adminId',
    as: 'admin'
});

// علاقة المشرف مع الردود التلقائية
Admin.hasMany(AutoReply, {
    foreignKey: 'adminId',
    as: 'autoReplies',
    onDelete: 'CASCADE'
});
AutoReply.belongsTo(Admin, {
    foreignKey: 'adminId',
    as: 'admin'
});

// علاقة المشرف مع البث
Admin.hasMany(Broadcast, {
    foreignKey: 'adminId',
    as: 'broadcasts',
    onDelete: 'CASCADE'
});
Broadcast.belongsTo(Admin, {
    foreignKey: 'adminId',
    as: 'admin'
});

// علاقة الجلسة مع الروابط
WhatsAppSession.hasMany(CollectedLink, {
    foreignKey: 'sessionId',
    as: 'collectedLinks',
    onDelete: 'CASCADE'
});
CollectedLink.belongsTo(WhatsAppSession, {
    foreignKey: 'sessionId',
    as: 'session'
});

// علاقة الجلسة مع الردود التلقائية
WhatsAppSession.hasMany(AutoReply, {
    foreignKey: 'sessionId',
    as: 'autoReplies',
    onDelete: 'CASCADE'
});
AutoReply.belongsTo(WhatsAppSession, {
    foreignKey: 'sessionId',
    as: 'session'
});

// علاقة الجلسة مع الانضمام التلقائي
WhatsAppSession.hasMany(AutoJoin, {
    foreignKey: 'sessionId',
    as: 'autoJoins',
    onDelete: 'CASCADE'
});
AutoJoin.belongsTo(WhatsAppSession, {
    foreignKey: 'sessionId',
    as: 'session'
});

// علاقة المشرف مع الانضمام التلقائي
Admin.hasMany(AutoJoin, {
    foreignKey: 'adminId',
    as: 'autoJoins',
    onDelete: 'CASCADE'
});
AutoJoin.belongsTo(Admin, {
    foreignKey: 'adminId',
    as: 'admin'
});

// علاقة المشرف مع النشر التلقائي
Admin.hasMany(AutoPost, {
    foreignKey: 'adminId',
    as: 'autoPosts',
    onDelete: 'CASCADE'
});
AutoPost.belongsTo(Admin, {
    foreignKey: 'adminId',
    as: 'admin'
});

// علاقة الإعلان مع النشر التلقائي
Advertisement.hasMany(AutoPost, {
    foreignKey: 'adId',
    as: 'autoPosts',
    onDelete: 'CASCADE'
});
AutoPost.belongsTo(Advertisement, {
    foreignKey: 'adId',
    as: 'advertisement'
});

// ============================================
// 4. وظائف المساعدة
// ============================================

// 4.1 التحقق من اتصال قاعدة البيانات
async function testDatabaseConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ الاتصال بقاعدة البيانات ناجح');
        return true;
    } catch (error) {
        console.error('❌ فشل الاتصال بقاعدة البيانات:', error.message);
        
        // محاولة إنشاء قاعدة البيانات إذا لم تكن موجودة
        if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('⚠️ قاعدة البيانات غير موجودة، جاري محاولة إنشائها...');
            
            const tempSequelize = new Sequelize(
                '',
                process.env.DB_USER || 'root',
                process.env.DB_PASSWORD || '',
                {
                    host: process.env.DB_HOST || 'localhost',
                    dialect: 'mysql'
                }
            );
            
            try {
                await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'whatsapp_bot'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
                console.log('✅ تم إنشاء قاعدة البيانات بنجاح');
                
                // إعادة المحاولة للاتصال
                await sequelize.authenticate();
                console.log('✅ الاتصال بقاعدة البيانات ناجح بعد الإنشاء');
                return true;
            } catch (createError) {
                console.error('❌ فشل إنشاء قاعدة البيانات:', createError.message);
                return false;
            } finally {
                await tempSequelize.close();
            }
        }
        
        return false;
    }
}

// 4.2 مزامنة قاعدة البيانات
async function syncDatabase(force = false) {
    try {
        const options = force ? { force: true } : { alter: true };
        
        console.log('🔄 جاري مزامنة قاعدة البيانات...');
        
        // ترتيب المزامنة حسب العلاقات
        await sequelize.sync(options);
        
        console.log('✅ تم مزامنة قاعدة البيانات بنجاح');
        
        // إضافة المشرف الرئيسي إذا لم يكن موجوداً
        await createDefaultAdmin();
        
        return true;
    } catch (error) {
        console.error('❌ فشل مزامنة قاعدة البيانات:', error);
        return false;
    }
}

// 4.3 إنشاء المشرف الافتراضي
async function createDefaultAdmin() {
    try {
        const defaultAdminId = process.env.DEFAULT_ADMIN_ID;
        
        if (!defaultAdminId) {
            console.log('⚠️ لم يتم تعيين DEFAULT_ADMIN_ID في ملف .env');
            return;
        }
        
        const existingAdmin = await Admin.findOne({
            where: { telegramId: defaultAdminId }
        });
        
        if (!existingAdmin) {
            await Admin.create({
                telegramId: defaultAdminId,
                firstName: 'المشرف الرئيسي',
                permissions: ['admin', 'manage_sessions', 'manage_ads', 'manage_broadcasts', 'view_stats', 'manage_admins'],
                settings: {
                    notificationEnabled: true,
                    language: 'ar',
                    maxSessions: 20,
                    autoCollectLinks: true,
                    autoReplyEnabled: true
                },
                isActive: true
            });
            
            console.log(`✅ تم إنشاء المشرف الرئيسي: ${defaultAdminId}`);
        } else {
            console.log('ℹ️ المشرف الرئيسي موجود بالفعل');
        }
    } catch (error) {
        console.error('❌ فشل إنشاء المشرف الافتراضي:', error);
    }
}

// 4.4 بدء تشغيل البوت
async function startBot() {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!token) {
            throw new Error('لم يتم تعيين TELEGRAM_BOT_TOKEN في ملف .env');
        }
        
        console.log('🚀 بدء تشغيل بوت التليجرام...');
        
        const bot = new WhatsAppTelegramBot(token);
        await bot.start();
        
        console.log('✅ بوت التليجرام يعمل بنجاح');
        
        return bot;
    } catch (error) {
        console.error('❌ فشل بدء تشغيل البوت:', error);
        throw error;
    }
}

// 4.5 معالجة الإغلاق النظيف
async function gracefulShutdown(signal, bot) {
    console.log(`\n${signal} تم استلام إشارة، جاري الإغلاق النظيف...`);
    
    try {
        // تنظيف موارد البوت
        if (bot && bot.cleanup) {
            await bot.cleanup();
            console.log('✅ تم تنظيف موارد البوت');
        }
        
        // إغلاق اتصال قاعدة البيانات
        await sequelize.close();
        console.log('✅ تم إغلاق اتصال قاعدة البيانات');
        
        console.log('👋 تم إغلاق التطبيق بنجاح');
        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ أثناء الإغلاق النظيف:', error);
        process.exit(1);
    }
}

// ============================================
// 5. الدالة الرئيسية
// ============================================
async function main() {
    try {
        console.log('============================================');
        console.log('🤖 WhatsApp Telegram Bot - الإصدار 3.0.0');
        console.log('============================================');
        
        // التحقق من متغيرات البيئة
        console.log('\n🔍 التحقق من متغيرات البيئة...');
        const requiredEnvVars = ['TELEGRAM_BOT_TOKEN'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error(`❌ متغيرات البيئة المفقودة: ${missingVars.join(', ')}`);
            console.log('📝 قم بنسخ ملف .env.example إلى .env واملأ البيانات');
            process.exit(1);
        }
        
        console.log('✅ جميع متغيرات البيئة موجودة');
        
        // اختبار اتصال قاعدة البيانات
        console.log('\n🔗 اختبار اتصال قاعدة البيانات...');
        const dbConnected = await testDatabaseConnection();
        
        if (!dbConnected) {
            console.error('❌ فشل الاتصال بقاعدة البيانات');
            
            // عرض معلومات الاتصال للمساعدة
            console.log('\n📋 معلومات الاتصال بقاعدة البيانات:');
            console.log(`   المضيف: ${process.env.DB_HOST || 'localhost'}`);
            console.log(`   المنفذ: ${process.env.DB_PORT || 3306}`);
            console.log(`   قاعدة البيانات: ${process.env.DB_NAME || 'whatsapp_bot'}`);
            console.log(`   المستخدم: ${process.env.DB_USER || 'root'}`);
            console.log(`   كلمة المرور: ${process.env.DB_PASSWORD ? '***' : '(فارغة)'}`);
            
            console.log('\n💡 الحلول المقترحة:');
            console.log('1. تأكد من تشغيل خادم MySQL');
            console.log('2. تحقق من صحة بيانات الاتصال في ملف .env');
            console.log('3. تأكد من صلاحيات المستخدم');
            
            process.exit(1);
        }
        
        // مزامنة قاعدة البيانات
        console.log('\n🔄 مزامنة قاعدة البيانات...');
        const forceSync = process.env.FORCE_SYNC_DB === 'true';
        await syncDatabase(forceSync);
        
        // بدء تشغيل البوت
        console.log('\n🚀 بدء تشغيل البوت...');
        const bot = await startBot();
        
        // تسجيل معالجات الإغلاق
        process.on('SIGINT', () => gracefulShutdown('SIGINT', bot));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM', bot));
        
        // معالجة الأخطاء غير الملتقطة
        process.on('uncaughtException', (error) => {
            console.error('❌ خطأ غير متوقع:', error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ رفض وعد غير معالج:', reason);
        });
        
        // عرض معلومات النظام
        console.log('\n============================================');
        console.log('✅ النظام يعمل بنجاح!');
        console.log('============================================');
        console.log(`🤖 بوت التليجرام: ${bot ? 'يعمل' : 'غير متوفر'}`);
        console.log(`🗄️  قاعدة البيانات: ${dbConnected ? 'متصل' : 'غير متصل'}`);
        console.log(`⏰ وقت البدء: ${new Date().toLocaleString('ar-SA')}`);
        console.log(`🖥️  PID: ${process.pid}`);
        console.log(`💾 الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log('============================================\n');
        
        console.log('📝 *تعليمات الاستخدام:*');
        console.log('1. أرسل /start إلى بوت التليجرام');
        console.log('2. أضف المشرف الرئيسي أولاً (رقم Telegram ID)');
        console.log('3. أضف حساب WhatsApp باستخدام /addsession');
        console.log('4. استخدم الأوامر الأخرى من القائمة');
        
    } catch (error) {
        console.error('❌ فشل بدء التطبيق:', error);
        process.exit(1);
    }
}

// ============================================
// 6. تصدير النماذج والوظائف
// ============================================
module.exports = {
    // النماذج
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin,
    Broadcast,
    
    // الدوال المساعدة
    sequelize,
    testDatabaseConnection,
    syncDatabase,
    startBot,
    
    // الدالة الرئيسية
    main
};

// ============================================
// 7. نقطة الدخول
// ============================================
if (require.main === module) {
    main();
}
