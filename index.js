// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot النسخة الشاملة
// مصمم خصيصاً للعمل على Render.com
// النسخة: 2.1.0 - Fixed & Optimized
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Sequelize, DataTypes, Op } = require('sequelize');

// ============================================
// 1. إعداد Express للويب سيرفيس - Render Compatible
// ============================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// صفحة الرئيسية للتحقق من التشغيل
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Telegram Bot - Render</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 800px;
                    width: 100%;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                h1 {
                    font-size: 2.5rem;
                    margin-bottom: 30px;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                }
                
                .status {
                    background: rgba(0, 255, 0, 0.2);
                    padding: 20px;
                    border-radius: 10px;
                    margin: 25px 0;
                    text-align: center;
                    font-size: 1.2rem;
                    border: 2px solid rgba(0, 255, 0, 0.3);
                }
                
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin: 30px 0;
                }
                
                .stat-box {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    transition: transform 0.3s;
                }
                
                .stat-box:hover {
                    transform: translateY(-5px);
                }
                
                .stat-value {
                    font-size: 2rem;
                    font-weight: bold;
                    display: block;
                    margin: 10px 0;
                }
                
                .info {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 20px;
                    border-radius: 10px;
                    margin-top: 20px;
                }
                
                .warning {
                    background: rgba(255, 165, 0, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 15px 0;
                    border: 2px solid rgba(255, 165, 0, 0.3);
                }
                
                @media (max-width: 600px) {
                    .container {
                        padding: 20px;
                    }
                    
                    h1 {
                        font-size: 2rem;
                    }
                    
                    .stats {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Telegram Bot</h1>
                <div class="status">
                    ✅ البوت يعمل بنجاح على Render
                </div>
                
                <div class="stats">
                    <div class="stat-box">
                        <span>⏱️ وقت التشغيل</span>
                        <span class="stat-value">${Math.floor(process.uptime())}s</span>
                    </div>
                    
                    <div class="stat-box">
                        <span>🌐 المنفذ</span>
                        <span class="stat-value">${PORT}</span>
                    </div>
                    
                    <div class="stat-box">
                        <span>📊 الذاكرة</span>
                        <span class="stat-value">${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB</span>
                    </div>
                    
                    <div class="stat-box">
                        <span>🔧 النسخة</span>
                        <span class="stat-value">2.1.0</span>
                    </div>
                </div>
                
                <div class="info">
                    <h3>📋 معلومات النظام:</h3>
                    <p>• 🏗️ Platform: ${process.platform}</p>
                    <p>• 🚀 Node.js: ${process.version}</p>
                    <p>• 📅 تاريخ التشغيل: ${new Date().toLocaleString('ar-SA')}</p>
                </div>
                
                <div class="warning">
                    <strong>⚠️ ملاحظة:</strong> البوت يعمل في وضع Headless على Render.
                    تم تصميم النظام خصيصاً للعمل المستمر مع ميزة الجهاز المصاحب.
                </div>
            </div>
        </body>
        </html>
    `);
});

// صفحة الصحة للـ Render
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        botVersion: '2.1.0'
    });
});

// صفحة حالة البوت
app.get('/status', async (req, res) => {
    try {
        const stats = {
            whatsappSessions: global.whatsappClients ? global.whatsappClients.size : 0,
            activeAutoPosts: global.activeAutoPosts ? global.activeAutoPosts.size : 0,
            activeAutoJoins: global.activeAutoJoins ? global.activeAutoJoins.size : 0,
            userStates: global.userStates ? global.userStates.size : 0,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: global.dbInitialized || false
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook للتحقق من QR
app.post('/webhook/qr', (req, res) => {
    const { sessionId, qr } = req.body;
    console.log(`📱 QR Code received for session: ${sessionId}`);
    res.json({ status: 'received' });
});

// ============================================
// 2. إعداد قاعدة البيانات المتقدمة
// ============================================
console.log('🚀 بدء تشغيل WhatsApp Bot المتقدم...');

let sequelize;
if (process.env.NODE_ENV === 'production') {
    // PostgreSQL للـ Render
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });
} else {
    // SQLite للتطوير المحلي
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: './database/bot.db',
        logging: false
    });
}

// نموذج المشرفين المحسن
const Admin = sequelize.define('Admin', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    telegramId: { 
        type: DataTypes.STRING, 
        unique: true, 
        allowNull: false 
    },
    username: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    phoneNumber: DataTypes.STRING,
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
    },
    permissions: { 
        type: DataTypes.JSON, 
        defaultValue: ['basic'] 
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            autoCollectLinks: true,
            autoReplyEnabled: true,
            maxSessions: 5,
            notificationEnabled: true
        }
    },
    lastActivity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['telegramId'] },
        { fields: ['isActive'] }
    ]
});

// نموذج جلسات واتساب المحسن
const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { 
        type: DataTypes.STRING, 
        primaryKey: true 
    },
    sessionId: { 
        type: DataTypes.STRING, 
        unique: true 
    },
    phoneNumber: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    sessionData: DataTypes.TEXT,
    status: { 
        type: DataTypes.ENUM(
            'pending', 
            'awaiting_qr', 
            'connected', 
            'disconnected', 
            'error',
            'authenticated'
        ),
        defaultValue: 'pending'
    },
    qrCode: DataTypes.TEXT,
    qrSentAt: DataTypes.DATE,
    connectionData: {
        type: DataTypes.JSON,
        defaultValue: {
            platform: 'unknown',
            phone: {},
            pushname: '',
            wid: ''
        }
    },
    lastActivity: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    },
    connectedAt: DataTypes.DATE,
    disconnectedAt: DataTypes.DATE,
    groupsCount: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    contactsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    stats: {
        type: DataTypes.JSON,
        defaultValue: {
            messagesReceived: 0,
            messagesSent: 0,
            groupsJoined: 0,
            linksCollected: 0
        }
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            autoReply: true,
            autoCollect: true,
            autoJoin: false,
            broadcastEnabled: true
        }
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['adminId'] },
        { fields: ['status'] },
        { fields: ['phoneNumber'] },
        { fields: ['createdAt'] }
    ]
});

// نموذج الروابط المجمعة المحسن
const CollectedLink = sequelize.define('CollectedLink', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    url: { 
        type: DataTypes.STRING, 
        unique: true, 
        allowNull: false 
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
            'signal'
        ),
        defaultValue: 'other'
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    source: DataTypes.STRING,
    sessionId: DataTypes.STRING,
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {
            groupName: '',
            groupSize: 0,
            isActive: true,
            lastChecked: null
        }
    },
    status: {
        type: DataTypes.ENUM('active', 'expired', 'invalid', 'joined'),
        defaultValue: 'active'
    },
    collectedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    },
    lastChecked: DataTypes.DATE,
    checkCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['type'] },
        { fields: ['sessionId'] },
        { fields: ['collectedAt'] },
        { fields: ['status'] }
    ]
});

// نموذج الإعلانات المحسن
const Advertisement = sequelize.define('Advertisement', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
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
            'document',
            'location',
            'poll'
        ),
        defaultValue: 'text'
    },
    content: { 
        type: DataTypes.TEXT, 
        allowNull: false 
    },
    fileId: DataTypes.STRING,
    fileUrl: DataTypes.STRING,
    caption: DataTypes.TEXT,
    buttons: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    schedule: {
        type: DataTypes.JSON,
        defaultValue: {
            enabled: false,
            startTime: null,
            endTime: null,
            days: [1, 2, 3, 4, 5, 6, 0],
            timezone: 'Asia/Riyadh'
        }
    },
    target: {
        type: DataTypes.JSON,
        defaultValue: {
            allGroups: true,
            specificGroups: [],
            minMembers: 0,
            maxMembers: 1000000
        }
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
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
            successRate: 0
        }
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            delayBetweenGroups: 1000,
            maxGroupsPerHour: 100,
            retryFailed: true,
            optimizeSending: true
        }
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['adminId'] },
        { fields: ['isActive'] },
        { fields: ['createdAt'] }
    ]
});

// نموذج النشر التلقائي المحسن
const AutoPost = sequelize.define('AutoPost', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    sessionId: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    adId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    status: { 
        type: DataTypes.ENUM(
            'active', 
            'paused', 
            'completed', 
            'error',
            'waiting'
        ),
        defaultValue: 'active'
    },
    interval: { 
        type: DataTypes.INTEGER, 
        defaultValue: 1,
        validate: {
            min: 1,
            max: 3600
        }
    },
    lastPostAt: DataTypes.DATE,
    nextPostAt: DataTypes.DATE,
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
            averageTimePerCycle: 0
        }
    },
    settings: { 
        type: DataTypes.JSON, 
        defaultValue: {
            randomDelay: true,
            minDelay: 500,
            maxDelay: 3000,
            skipInactive: true,
            maxRetries: 3,
            stopOnError: false
        }
    },
    logs: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['adminId', 'status'] },
        { fields: ['sessionId'] },
        { fields: ['nextPostAt'] }
    ]
});

// نموذج الردود التلقائية المحسن
const AutoReply = sequelize.define('AutoReply', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    sessionId: DataTypes.STRING,
    name: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    triggerType: { 
        type: DataTypes.ENUM(
            'private', 
            'group', 
            'both',
            'broadcast'
        ),
        defaultValue: 'both'
    },
    trigger: { 
        type: DataTypes.TEXT, 
        allowNull: false 
    },
    response: { 
        type: DataTypes.TEXT, 
        allowNull: false 
    },
    responseType: {
        type: DataTypes.ENUM('text', 'image', 'file', 'contact'),
        defaultValue: 'text'
    },
    isActive: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: true 
    },
    matchType: { 
        type: DataTypes.ENUM(
            'exact', 
            'contains', 
            'regex',
            'starts_with',
            'ends_with'
        ),
        defaultValue: 'contains'
    },
    priority: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            min: 1,
            max: 10
        }
    },
    cooldown: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Cooldown in seconds'
    },
    conditions: {
        type: DataTypes.JSON,
        defaultValue: {
            timeRange: null,
            daysOfWeek: null,
            maxTriggersPerDay: null,
            requireKeywords: [],
            excludeKeywords: []
        }
    },
    stats: { 
        type: DataTypes.JSON, 
        defaultValue: { 
            triggered: 0,
            lastTriggered: null,
            successful: 0,
            failed: 0,
            bySession: {}
        }
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['adminId', 'isActive'] },
        { fields: ['sessionId'] },
        { fields: ['triggerType'] },
        { fields: ['priority'] }
    ]
});

// نموذج الانضمام التلقائي المحسن
const AutoJoin = sequelize.define('AutoJoin', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    sessionId: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    status: { 
        type: DataTypes.ENUM(
            'active', 
            'paused', 
            'completed',
            'error'
        ),
        defaultValue: 'active'
    },
    lastJoinAt: DataTypes.DATE,
    nextJoinAt: DataTypes.DATE,
    stats: { 
        type: DataTypes.JSON, 
        defaultValue: { 
            totalLinks: 0,
            joined: 0,
            failed: 0,
            skipped: 0,
            lastLinks: [],
            successRate: 0,
            lastError: null
        }
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
            maxJoinsPerHour: 10
        }
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            delayBetweenJoins: 5000,
            verifyBeforeJoin: true,
            leaveInactiveGroups: false,
            autoLeaveAfterDays: 30,
            notifyOnJoin: true
        }
    },
    logs: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    timestamps: true,
    indexes: [
        { fields: ['adminId', 'status'] },
        { fields: ['sessionId'] },
        { fields: ['nextJoinAt'] }
    ]
});

// نموذج البث الجماعي المحسن
const Broadcast = sequelize.define('Broadcast', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    adminId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    sessionId: DataTypes.STRING,
    name: DataTypes.STRING,
    message: DataTypes.TEXT,
    type: {
        type: DataTypes.ENUM('text', 'image', 'document', 'video'),
        defaultValue: 'text'
    },
    targetType: {
        type: DataTypes.ENUM('contacts', 'groups', 'specific'),
        defaultValue: 'contacts'
    },
    targets: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    status: {
        type: DataTypes.ENUM('pending', 'sending', 'completed', 'failed'),
        defaultValue: 'pending'
    },
    progress: {
        type: DataTypes.JSON,
        defaultValue: {
            total: 0,
            sent: 0,
            failed: 0,
            current: 0
        }
    },
    scheduledAt: DataTypes.DATE,
    startedAt: DataTypes.DATE,
    completedAt: DataTypes.DATE,
    results: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            delayBetweenMessages: 1000,
            maxRetries: 3,
            stopOnManyErrors: true,
            errorThreshold: 10
        }
    },
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
});

// ============================================
// 3. مكتبات إضافية - Render Compatible
// ============================================
const TelegramBot = require('node-telegram-bot-api');
const { Client: WhatsAppClient, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const axios = require('axios');

// ============================================
// 4. المتغيرات العامة والذاكرة
// ============================================
// تخزين الجلسات النشطة
global.whatsappClients = new Map();
global.userStates = new Map();
global.activeAutoPosts = new Map();
global.activeAutoJoins = new Map();
global.sessionQRs = new Map();
global.messageQueues = new Map();
global.cooldownTimers = new Map();

// حالة قاعدة البيانات
global.dbInitialized = false;

// ============================================
// 5. دوال المساعدة المتقدمة
// ============================================
async function initializeDatabase() {
    try {
        console.log('🔧 جاري تهيئة قاعدة البيانات...');
        
        await sequelize.authenticate();
        console.log('✅ قاعدة البيانات متصلة بنجاح');
        
        // مزامنة الجداول مع الخيارات الآمنة
        await sequelize.sync({ 
            alter: process.env.NODE_ENV !== 'production',
            force: false 
        });
        console.log('✅ تم مزامنة الجداول بنجاح');
        
        // إنشاء المشرفين من متغير البيئة
        const adminIds = process.env.TELEGRAM_ADMIN_IDS ? 
            process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()) : 
            [];
        
        console.log(`👥 جاري إنشاء ${adminIds.length} مشرف...`);
        
        for (const telegramId of adminIds) {
            try {
                const [admin] = await Admin.findOrCreate({
                    where: { telegramId },
                    defaults: {
                        username: `admin_${telegramId}`,
                        firstName: 'مشرف',
                        permissions: [
                            'admin', 
                            'manage_sessions', 
                            'manage_ads',
                            'manage_broadcasts',
                            'view_stats'
                        ],
                        isActive: true,
                        settings: {
                            autoCollectLinks: true,
                            autoReplyEnabled: true,
                            maxSessions: 5,
                            notificationEnabled: true,
                            language: 'ar'
                        }
                    }
                });
                console.log(`✅ المشرف ${telegramId} جاهز`);
            } catch (error) {
                console.error(`❌ خطأ في إنشاء المشرف ${telegramId}:`, error.message);
            }
        }
        
        global.dbInitialized = true;
        console.log('🎉 تم تهيئة قاعدة البيانات بنجاح');
        
        return true;
    } catch (error) {
        console.error('❌ خطأ فادح في تهيئة قاعدة البيانات:', error);
        return false;
    }
}

async function createWhatsAppSession(phoneNumber, adminId, chatId) {
    const sessionId = `wa_${crypto.randomBytes(8).toString('hex')}`;
    
    console.log(`📱 جاري إنشاء جلسة جديدة للرقم: ${phoneNumber}`);
    
    try {
        // حفظ الجلسة في قاعدة البيانات
        const session = await WhatsAppSession.create({
            id: sessionId,
            sessionId: sessionId,
            phoneNumber: phoneNumber,
            adminId: adminId,
            status: 'awaiting_qr',
            settings: {
                autoReply: true,
                autoCollect: true,
                autoJoin: false,
                broadcastEnabled: true
            },
            metadata: {
                createdFrom: 'telegram_bot',
                platform: 'render',
                userAgent: 'WhatsApp-Bot/2.1.0'
            }
        });
        
        console.log(`✅ تم حفظ الجلسة في قاعدة البيانات: ${sessionId}`);
        
        // إعداد عميل واتساب مع LocalAuth
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
        
        // تخزين العميل في الذاكرة
        global.whatsappClients.set(sessionId, client);
        
        // معالج QR Code
        client.on('qr', async (qr) => {
            console.log(`📱 تم توليد QR Code للجلسة: ${sessionId}`);
            
            // حفظ QR في الذاكرة
            global.sessionQRs.set(sessionId, {
                qr: qr,
                timestamp: Date.now(),
                phoneNumber: phoneNumber
            });
            
            // تحديث الجلسة في قاعدة البيانات
            await session.update({
                qrCode: qr,
                qrSentAt: new Date(),
                status: 'awaiting_qr'
            });
            
            // إرسال QR Code للمستخدم
            await sendQRCodeToUser(adminId, qr, sessionId, phoneNumber, chatId);
        });
        
        // عند جاهزية العميل
        client.on('ready', async () => {
            console.log(`✅ WhatsApp جاهز للجلسة: ${sessionId} (${phoneNumber})`);
            
            const connectionData = {
                platform: client.info.platform,
                phone: client.info.phone,
                pushname: client.info.pushname,
                wid: client.info.wid._serialized
            };
            
            // تحديث الجلسة
            await session.update({
                status: 'connected',
                connectedAt: new Date(),
                connectionData: connectionData,
                lastActivity: new Date()
            });
            
            // مسح QR من الذاكرة
            global.sessionQRs.delete(sessionId);
            
            // إرسال إشعار الاتصال الناجح
            const telegramBot = global.telegramBot;
            if (telegramBot) {
                await telegramBot.sendMessage(chatId,
                    `🎉 *تم الربط بنجاح!*\n\n` +
                    `✅ *حساب WhatsApp متصل الآن*\n` +
                    `📱 الرقم: ${phoneNumber}\n` +
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
            
            // بدء تجميع المجموعات
            setTimeout(() => collectGroupsAndContacts(client, sessionId), 3000);
        });
        
        // عند استقبال رسالة
        client.on('message', async (message) => {
            await handleWhatsAppMessage(message, sessionId);
        });
        
        // عند حدوث تغيير في الحالة
        client.on('change_state', async (state) => {
            console.log(`📡 تغيير حالة الجلسة ${sessionId}: ${state}`);
            await session.update({ 
                status: state,
                lastActivity: new Date() 
            });
        });
        
        // عند فقدان الاتصال
        client.on('disconnected', async (reason) => {
            console.log(`❌ فقدان الاتصال بالجلسة ${sessionId}: ${reason}`);
            
            await session.update({
                status: 'disconnected',
                disconnectedAt: new Date(),
                lastActivity: new Date()
            });
            
            // إعلام المشرف
            const admin = await Admin.findByPk(adminId);
            if (admin && admin.settings?.notificationEnabled) {
                const telegramBot = global.telegramBot;
                if (telegramBot) {
                    await telegramBot.sendMessage(admin.telegramId,
                        `⚠️ *تم فقدان الاتصال*\n\n` +
                        `📱 الرقم: ${phoneNumber}\n` +
                        `📌 السبب: ${reason}\n` +
                        `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                        `استخدم /sessions لعرض الحالة وإعادة المحاولة.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
        });
        
        // عند حدوث خطأ
        client.on('auth_failure', async (error) => {
            console.error(`❌ فشل المصادقة للجلسة ${sessionId}:`, error);
            
            await session.update({
                status: 'error',
                lastActivity: new Date()
            });
        });
        
        // تهيئة العميل
        await client.initialize();
        console.log(`🚀 تم تهيئة عميل WhatsApp للجلسة: ${sessionId}`);
        
        return sessionId;
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء جلسة WhatsApp:', error);
        
        // تحديث حالة الجلسة
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            await session.update({
                status: 'error',
                lastActivity: new Date()
            });
        }
        
        throw error;
    }
}

async function sendQRCodeToUser(adminId, qr, sessionId, phoneNumber, chatId) {
    try {
        console.log(`📤 جاري إرسال QR Code إلى المشرف: ${adminId}`);
        
        // توليد QR Code نصي
        const qrText = await new Promise((resolve, reject) => {
            qrcode.toString(qr, { type: 'terminal', small: true }, (err, text) => {
                if (err) reject(err);
                else resolve(text);
            });
        });
        
        // إنشاء رسالة مفصلة
        const message = `
📱 *QR Code لربط جهاز مصاحب*

🔗 *معلومات الجلسة:*
• 📞 الرقم: \`${phoneNumber}\`
• 🆔 المعرف: \`${sessionId.substring(0, 8)}\`
• ⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}
• 📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}

🚀 *طريقة الربط:*

1. *افتح WhatsApp* على هاتفك
2. *اضغط* على **النقاط الثلاث** (⋮) أو **الإعدادات**
3. *اختر* **"الأجهزة المرتبطة"** أو **"Linked Devices"**
4. *انقر* على **"ربط جهاز"** أو **"Link a Device"**
5. *اختر* **"ربط باستخدام رابط QR Code"**
6. *مسح* الكود أدناه بكاميرا الهاتف

📝 *تعليمات QR Code:*
\`\`\`
${qrText}
\`\`\`

🔗 *رابط QR (بديل):*
\`${qr}\`

⏱️ *مدة الصلاحية:* 60 ثانية
🔄 *سيتم تجديده تلقائياً*

✅ *بعد المسح:* ستصلك رسالة تأكيد على هاتفك
        `;
        
        // زر المساعدة
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 كيفية الربط بالصور', callback_data: `qr_help_${sessionId}` },
                    { text: '🔄 إعادة توليد QR', callback_data: `qr_regenerate_${sessionId}` }
                ],
                [
                    { text: '❌ إلغاء الجلسة', callback_data: `qr_cancel_${sessionId}` }
                ],
                [
                    { text: '📋 العودة للقائمة', callback_data: 'menu_sessions' }
                ]
            ]
        };
        
        // إرسال الرسالة
        const telegramBot = global.telegramBot;
        if (telegramBot) {
            await telegramBot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true
            });
        }
        
        console.log(`✅ تم إرسال QR Code بنجاح إلى ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في إرسال QR Code:', error);
        
        // إرسال رسالة بديلة
        const telegramBot = global.telegramBot;
        if (telegramBot) {
            await telegramBot.sendMessage(chatId,
                `❌ *عذراً، حدث خطأ في توليد QR Code*\n\n` +
                `🔗 *الرابط البديل:*\n` +
                `\`${qr}\`\n\n` +
                `انسخ هذا الرابط والصقه في متصفح لرؤية QR Code.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
}

async function collectGroupsAndContacts(client, sessionId) {
    try {
        console.log(`📊 جاري تجميع بيانات الجلسة: ${sessionId}`);
        
        // الحصول على جميع المحادثات
        const chats = await client.getChats();
        
        // تصنيف المحادثات
        const groups = chats.filter(chat => chat.isGroup);
        const contacts = chats.filter(chat => !chat.isGroup && chat.isUser);
        
        console.log(`📈 جمع ${groups.length} مجموعة و ${contacts.length} جهة اتصال`);
        
        // تحديث إحصائيات الجلسة
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            await session.update({
                groupsCount: groups.length,
                contactsCount: contacts.length,
                lastActivity: new Date(),
                stats: {
                    ...session.stats,
                    groupsCollected: groups.length,
                    contactsCollected: contacts.length
                }
            });
            
            // تجميع روابط المجموعات
            if (session.settings?.autoCollect) {
                await collectGroupLinks(client, sessionId, groups);
            }
        }
        
        return { groups, contacts };
        
    } catch (error) {
        console.error('❌ خطأ في تجميع المجموعات والجهات:', error);
        return { groups: [], contacts: [] };
    }
}

async function collectGroupLinks(client, sessionId, groups) {
    try {
        console.log(`🔗 جاري تجميع روابط المجموعات للجلسة: ${sessionId}`);
        
        let collectedCount = 0;
        
        for (const group of groups.slice(0, 50)) {
            try {
                // محاولة الحصول على رابط الدعوة
                const inviteCode = await group.getInviteCode();
                if (inviteCode) {
                    const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                    
                    // التحقق من عدم تكرار الرابط
                    const existingLink = await CollectedLink.findOne({
                        where: { url: inviteLink }
                    });
                    
                    if (!existingLink) {
                        // حفظ الرابط
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
                
                // تأخير بسيط بين المجموعات
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`⚠️ لا يمكن الحصول على رابط المجموعة: ${group.name || 'غير معروفة'}`);
            }
        }
        
        console.log(`🎯 تم تجميع ${collectedCount} رابط جديد`);
        
        // تحديث إحصائيات الجلسة
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            const stats = session.stats || {};
            stats.linksCollected = (stats.linksCollected || 0) + collectedCount;
            await session.update({ stats });
        }
        
    } catch (error) {
        console.error('❌ خطأ في تجميع روابط المجموعات:', error);
    }
}

async function handleWhatsAppMessage(message, sessionId) {
    try {
        // تحديث إحصائيات الجلسة
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            const stats = session.stats || {};
            stats.messagesReceived = (stats.messagesReceived || 0) + 1;
            await session.update({ 
                stats,
                lastActivity: new Date() 
            });
        }
        
        // 1. تجميع الروابط من الرسالة
        if (session?.settings?.autoCollect) {
            await collectLinksFromMessage(message, sessionId);
        }
        
        // 2. التحقق من الردود التلقائية
        if (session?.settings?.autoReply) {
            await checkAutoReplies(message, sessionId);
        }
        
        // 3. اكتشاف روابط الانضمام
        await detectJoinLinks(message, sessionId);
        
    } catch (error) {
        console.error('❌ خطأ في معالجة رسالة WhatsApp:', error);
    }
}

async function collectLinksFromMessage(message, sessionId) {
    try {
        if (!message.body) return;
        
        // استخراج جميع الروابط
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.body.match(urlRegex) || [];
        
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
                    hasMedia: !!message.hasMedia
                }
            });
            
            console.log(`✅ رابط جديد محفوظ: ${type} - ${url.substring(0, 50)}...`);
        }
        
    } catch (error) {
        console.error('❌ خطأ في تجميع الروابط من الرسالة:', error);
    }
}

async function checkAutoReplies(message, sessionId) {
    try {
        // الحصول على جميع الردود التلقائية النشطة لهذه الجلسة
        const autoReplies = await AutoReply.findAll({
            where: {
                [Op.or]: [
                    { sessionId: sessionId },
                    { sessionId: null }
                ],
                isActive: true
            },
            order: [['priority', 'DESC']]
        });
        
        for (const reply of autoReplies) {
            // التحقق من وقت التبريد
            const cooldownKey = `${sessionId}_${reply.id}`;
            if (global.cooldownTimers.has(cooldownKey)) {
                const lastTrigger = global.cooldownTimers.get(cooldownKey);
                const cooldownMs = reply.cooldown * 1000;
                if (Date.now() - lastTrigger < cooldownMs) {
                    continue;
                }
            }
            
            if (shouldTriggerAutoReply(message, reply)) {
                // إرسال الرد
                await sendAutoReply(message, reply, sessionId);
                
                // تحديث وقت التبريد
                global.cooldownTimers.set(cooldownKey, Date.now());
                
                // تحديث الإحصائيات
                const stats = reply.stats || {};
                stats.triggered = (stats.triggered || 0) + 1;
                stats.lastTriggered = new Date();
                stats.bySession = stats.bySession || {};
                stats.bySession[sessionId] = (stats.bySession[sessionId] || 0) + 1;
                
                await reply.update({ stats });
                
                console.log(`🤖 تم إرسال رد تلقائي: ${reply.name}`);
                
                // خروج بعد أول رد مناسب (الأولوية الأعلى)
                if (reply.priority >= 5) break;
            }
        }
        
    } catch (error) {
        console.error('❌ خطأ في الرد التلقائي:', error);
    }
}

function shouldTriggerAutoReply(message, reply) {
    const text = message.body || '';
    const isGroup = message.from.includes('@g.us');
    
    // التحقق من نوع المحادثة
    if (reply.triggerType === 'private' && isGroup) return false;
    if (reply.triggerType === 'group' && !isGroup) return false;
    
    // التحقق من الشروط الإضافية
    const conditions = reply.conditions || {};
    
    // التحقق من نطاق الوقت
    if (conditions.timeRange) {
        const now = new Date();
        const hours = now.getHours();
        const [start, end] = conditions.timeRange.split('-').map(Number);
        if (hours < start || hours >= end) return false;
    }
    
    // التحقق من أيام الأسبوع
    if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
        const day = new Date().getDay();
        if (!conditions.daysOfWeek.includes(day)) return false;
    }
    
    // التحقق من الكلمات المطلوبة
    if (conditions.requireKeywords && conditions.requireKeywords.length > 0) {
        const hasRequired = conditions.requireKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasRequired) return false;
    }
    
    // التحقق من الكلمات المستبعدة
    if (conditions.excludeKeywords && conditions.excludeKeywords.length > 0) {
        const hasExcluded = conditions.excludeKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasExcluded) return false;
    }
    
    // التحقق من المحتوى الرئيسي
    switch (reply.matchType) {
        case 'exact':
            return text.trim() === reply.trigger;
        case 'contains':
            return text.toLowerCase().includes(reply.trigger.toLowerCase());
        case 'regex':
            try {
                const regex = new RegExp(reply.trigger, 'i');
                return regex.test(text);
            } catch {
                return false;
            }
        case 'starts_with':
            return text.toLowerCase().startsWith(reply.trigger.toLowerCase());
        case 'ends_with':
            return text.toLowerCase().endsWith(reply.trigger.toLowerCase());
        default:
            return false;
    }
}

async function sendAutoReply(message, reply, sessionId) {
    try {
        const client = global.whatsappClients.get(sessionId);
        if (!client) {
            console.log(`❌ العميل غير متصل للجلسة: ${sessionId}`);
            return;
        }
        
        switch (reply.responseType) {
            case 'text':
                await client.sendMessage(message.from, reply.response);
                break;
            default:
                await client.sendMessage(message.from, reply.response);
        }
        
        // تحديث إحصائيات الجلسة
        const session = await WhatsAppSession.findByPk(sessionId);
        if (session) {
            const stats = session.stats || {};
            stats.messagesSent = (stats.messagesSent || 0) + 1;
            await session.update({ stats });
        }
        
    } catch (error) {
        console.error('❌ خطأ في إرسال الرد التلقائي:', error);
        
        // تحديث إحصائيات الفشل
        const replyStats = reply.stats || {};
        replyStats.failed = (replyStats.failed || 0) + 1;
        await reply.update({ stats: replyStats });
    }
}

async function detectJoinLinks(message, sessionId) {
    try {
        if (!message.body) return;
        
        // البحث عن روابط انضمام واتساب
        const whatsappInviteRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/g;
        const inviteLinks = message.body.match(whatsappInviteRegex) || [];
        
        for (const link of inviteLinks) {
            await processDetectedJoinLink(link, sessionId);
        }
        
    } catch (error) {
        console.error('❌ خطأ في اكتشاف روابط الانضمام:', error);
    }
}

async function processDetectedJoinLink(link, sessionId) {
    try {
        // التحقق إذا كان الرابط محفوظاً مسبقاً
        const existing = await CollectedLink.findOne({
            where: { url: link }
        });
        
        if (existing) {
            // تحديث وقت الاكتشاف الأخير
            await existing.update({
                lastChecked: new Date(),
                checkCount: (existing.checkCount || 0) + 1,
                status: 'active'
            });
        } else {
            // حفظ الرابط جديد
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
            await joinWhatsAppGroup(link, sessionId);
        }
        
    } catch (error) {
        console.error('❌ خطأ في معالجة رابط الانضمام:', error);
    }
}

async function joinWhatsAppGroup(inviteLink, sessionId) {
    try {
        const client = global.whatsappClients.get(sessionId);
        if (!client) {
            console.log(`❌ العميل غير متصل للانضمام: ${sessionId}`);
            return false;
        }
        
        // استخراج كود الدعوة من الرابط
        const inviteCode = inviteLink.split('/').pop();
        
        console.log(`➕ محاولة الانضمام للمجموعة: ${inviteLink}`);
        
        // محاولة الانضمام
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
            const stats = autoJoin.stats || {};
            stats.joined = (stats.joined || 0) + 1;
            stats.totalLinks = (stats.totalLinks || 0) + 1;
            stats.successRate = stats.joined / stats.totalLinks * 100;
            stats.lastJoinAt = new Date();
            stats.lastLinks = [...(stats.lastLinks || []).slice(-9), inviteLink];
            
            await autoJoin.update({ stats });
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ فشل الانضمام للمجموعة:', error.message);
        
        // تحديث إحصائيات الفشل
        const autoJoin = await AutoJoin.findOne({
            where: { sessionId: sessionId, status: 'active' }
        });
        
        if (autoJoin) {
            const stats = autoJoin.stats || {};
            stats.failed = (stats.failed || 0) + 1;
            stats.totalLinks = (stats.totalLinks || 0) + 1;
            stats.successRate = stats.joined / stats.totalLinks * 100;
            stats.lastError = error.message;
            
            await autoJoin.update({ stats });
        }
        
        return false;
    }
}

// ============================================
// 6. بدء سيرفر الويب
// ============================================
async function startWebServer() {
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, () => {
            console.log(`🌐 السيرفر يعمل على: http://localhost:${PORT}`);
            console.log(`🌐 صفحة الصحة: http://localhost:${PORT}/health`);
            console.log(`🌐 صفحة الحالة: http://localhost:${PORT}/status`);
            resolve(server);
        });
        
        server.on('error', reject);
    });
}

// ============================================
// 7. بدء مهام الصيانة
// ============================================
function startMaintenanceTasks() {
    console.log('🔧 بدء مهام الصيانة التلقائية...');
    
    // مهمة تنظيف ذاكرة التبريد كل ساعة
    cron.schedule('0 * * * *', () => {
        console.log('🧹 جاري تنظيف ذاكرة التبريد...');
        const now = Date.now();
        for (const [key, timestamp] of global.cooldownTimers.entries()) {
            if (now - timestamp > 3600000) {
                global.cooldownTimers.delete(key);
            }
        }
        console.log(`✅ تم تنظيف ذاكرة التبريد: ${global.cooldownTimers.size} مدة باقية`);
    });
    
    // مهمة تحديث حالة الجلسات كل 5 دقائق
    cron.schedule('*/5 * * * *', async () => {
        console.log('🔄 جاري تحديث حالة الجلسات...');
        
        try {
            const sessions = await WhatsAppSession.findAll({
                where: {
                    status: ['connected', 'authenticated'],
                    lastActivity: {
                        [Op.lt]: new Date(Date.now() - 300000)
                    }
                }
            });
            
            for (const session of sessions) {
                const client = global.whatsappClients.get(session.id);
                if (client) {
                    try {
                        // اختبار الاتصال
                        await client.getState();
                        await session.update({ lastActivity: new Date() });
                    } catch (error) {
                        console.log(`❌ جلسة ${session.id} فقدت الاتصال`);
                        await session.update({ status: 'disconnected' });
                        global.whatsappClients.delete(session.id);
                    }
                }
            }
        } catch (error) {
            console.error('❌ خطأ في تحديث حالة الجلسات:', error);
        }
    });
    
    console.log('✅ تم جدولة مهام الصيانة');
}

// ============================================
// 8. التعامل مع الإيقاف النظيف
// ============================================
process.on('SIGINT', async () => {
    console.log('\n\n' + '='.repeat(50));
    console.log('🛑 تلقي إشارة إيقاف... جاري الإغلاق النظيف');
    console.log('='.repeat(50));
    
    try {
        // إغلاق جميع جلسات WhatsApp
        console.log('\n📱 جاري إغلاق جلسات WhatsApp...');
        let closedSessions = 0;
        
        for (const [sessionId, client] of global.whatsappClients.entries()) {
            try {
                await client.destroy();
                closedSessions++;
                console.log(`   ✅ جلسة ${sessionId.substring(0, 8)}`);
            } catch (error) {
                console.log(`   ⚠️ جلسة ${sessionId.substring(0, 8)}: ${error.message}`);
            }
        }
        
        // تحديث حالة الجلسات في قاعدة البيانات
        await WhatsAppSession.update(
            { status: 'disconnected', disconnectedAt: new Date() },
            { where: { status: ['connected', 'authenticated', 'awaiting_qr'] } }
        );
        
        // إغلاق اتصال قاعدة البيانات
        console.log('\n🗄️  جاري إغلاق اتصال قاعدة البيانات...');
        await sequelize.close();
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ تم الإغلاق النظيف بنجاح!');
        console.log(`📊 الإحصائيات:`);
        console.log(`• 📱 جلسات WhatsApp: ${closedSessions}/${global.whatsappClients.size}`);
        console.log(`• 🗄️  قاعدة البيانات: مغلقة`);
        console.log(`• ⏱️  وقت التشغيل: ${Math.floor(process.uptime())} ثانية`);
        console.log('='.repeat(50) + '\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ خطأ في الإغلاق النظيف:', error);
        process.exit(1);
    }
});

// ============================================
// 9. تصدير الوحدات
// ============================================
module.exports = {
    app,
    sequelize,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin,
    Broadcast,
    
    // دوال المساعدة
    initializeDatabase,
    createWhatsAppSession,
    startWebServer,
    startMaintenanceTasks,
    
    // دوال الحصول على المتغيرات العالمية
    getWhatsAppClients: () => global.whatsappClients,
    getUserStates: () => global.userStates,
    getActiveAutoPosts: () => global.activeAutoPosts,
    getActiveAutoJoins: () => global.activeAutoJoins,
    getSessionQRs: () => global.sessionQRs,
    getMessageQueues: () => global.messageQueues,
    getCooldownTimers: () => global.cooldownTimers,
    isDbInitialized: () => global.dbInitialized,
    
    // دوال التعيين
    setTelegramBot: (bot) => { global.telegramBot = bot; },
    setWhatsAppClients: (clients) => { global.whatsappClients = clients; },
    setUserStates: (states) => { global.userStates = states; }
};
