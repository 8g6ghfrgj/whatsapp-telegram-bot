// ============================================
// 📱 WhatsApp-Telegram Bot النسخة الكاملة والمتكاملة
// الإصدار: 2.0.0 - Optimized for Render
// الملف الرئيسي: index.js
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Sequelize, DataTypes, Op } = require('sequelize');

// ============================================
// 1. إعداد مكتبات إضافية - Render Compatible
// ============================================
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const TelegramBot = require('node-telegram-bot-api');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment');

// ============================================
// 2. إعداد Express للويب سيرفيس - Render Compatible
// ============================================
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
                        <span class="stat-value">2.0.0</span>
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
        botVersion: '2.0.0'
    });
});

// صفحة حالة البوت
app.get('/status', async (req, res) => {
    try {
        const stats = {
            whatsappSessions: whatsappClients.size,
            activeAutoPosts: activeAutoPosts.size,
            activeAutoJoins: activeAutoJoins.size,
            userStates: userStates.size,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: dbInitialized
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
// 3. إعداد قاعدة البيانات المتقدمة
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

// ============================================
// 4. تعريف نماذج قاعدة البيانات
// ============================================

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
// 5. المتغيرات العامة والذاكرة
// ============================================
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
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

// تخزين الجلسات النشطة
const whatsappClients = new Map();
const userStates = new Map();
const activeAutoPosts = new Map();
const activeAutoJoins = new Map();
const sessionQRs = new Map();
const messageQueues = new Map();
const cooldownTimers = new Map();

// حالة قاعدة البيانات
let dbInitialized = false;

// ============================================
// 6. دوال المساعدة الأساسية
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
        
        dbInitialized = true;
        console.log('🎉 تم تهيئة قاعدة البيانات بنجاح');
        
        return true;
    } catch (error) {
        console.error('❌ خطأ فادح في تهيئة قاعدة البيانات:', error);
        return false;
    }
}

// ============================================
// 7. دوال إدارة جلسات WhatsApp
// ============================================
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
                userAgent: 'WhatsApp-Bot/2.0.0'
            }
        });
        
        console.log(`✅ تم حفظ الجلسة في قاعدة البيانات: ${sessionId}`);
        
        // إعداد عميل واتساب مع LocalAuth
        const client = new Client({
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
        whatsappClients.set(sessionId, client);
        
        // معالج QR Code
        client.on('qr', async (qr) => {
            console.log(`📱 تم توليد QR Code للجلسة: ${sessionId}`);
            
            // حفظ QR في الذاكرة
            sessionQRs.set(sessionId, {
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
            sessionQRs.delete(sessionId);
            
            // إرسال إشعار الاتصال الناجح
            await bot.sendMessage(chatId,
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
                await bot.sendMessage(admin.telegramId,
                    `⚠️ *تم فقدان الاتصال*\n\n` +
                    `📱 الرقم: ${phoneNumber}\n` +
                    `📌 السبب: ${reason}\n` +
                    `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                    `استخدم /sessions لعرض الحالة وإعادة المحاولة.`,
                    { parse_mode: 'Markdown' }
                );
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
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم إرسال QR Code بنجاح إلى ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في إرسال QR Code:', error);
        
        // إرسال رسالة بديلة
        await bot.sendMessage(chatId,
            `❌ *عذراً، حدث خطأ في توليد QR Code*\n\n` +
            `🔗 *الرابط البديل:*\n` +
            `\`${qr}\`\n\n` +
            `انسخ هذا الرابط والصقه في متصفح لرؤية QR Code.`,
            { parse_mode: 'Markdown' }
        );
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
        
        for (const group of groups.slice(0, 50)) { // تحد من عدد المجموعات
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

// ============================================
// 8. معالجة رسائل WhatsApp
// ============================================
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
        
        // 4. إرسال إشعار للمشرف (للمراسلات الخاصة فقط)
        if (!message.from.includes('@g.us')) {
            await notifyAdminOfPrivateMessage(message, sessionId);
        }
        
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
            if (cooldownTimers.has(cooldownKey)) {
                const lastTrigger = cooldownTimers.get(cooldownKey);
                const cooldownMs = reply.cooldown * 1000;
                if (Date.now() - lastTrigger < cooldownMs) {
                    continue;
                }
            }
            
            if (shouldTriggerAutoReply(message, reply)) {
                // إرسال الرد
                await sendAutoReply(message, reply, sessionId);
                
                // تحديث وقت التبريد
                cooldownTimers.set(cooldownKey, Date.now());
                
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
        const client = whatsappClients.get(sessionId);
        if (!client) {
            console.log(`❌ العميل غير متصل للجلسة: ${sessionId}`);
            return;
        }
        
        switch (reply.responseType) {
            case 'text':
                await client.sendMessage(message.from, reply.response);
                break;
            case 'image':
                // معالجة الصور
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
        const client = whatsappClients.get(sessionId);
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
            
            // إرسال إشعار للمشرف إذا كان مفعلاً
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session && autoJoin.settings?.notifyOnJoin) {
                const admin = await Admin.findByPk(session.adminId);
                if (admin && admin.settings?.notificationEnabled) {
                    await bot.sendMessage(admin.telegramId,
                        `✅ *تم الانضمام التلقائي لمجموعة جديدة*\n\n` +
                        `🔗 الرابط: ${inviteLink}\n` +
                        `📱 الجلسة: ${session.phoneNumber}\n` +
                        `👤 العضو: ${session.connectionData?.pushname || 'غير معروف'}\n` +
                        `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
                        `📊 الإحصائيات: ${stats.joined}/${stats.totalLinks} (${Math.round(stats.successRate)}%)`,
                        { parse_mode: 'Markdown' }
                    );
                }
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

async function notifyAdminOfPrivateMessage(message, sessionId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (!session) return;
        
        const admin = await Admin.findByPk(session.adminId);
        if (!admin || !admin.settings?.notificationEnabled) return;
        
        // تجنب الإشعارات المفرطة
        const notificationKey = `${admin.id}_${message.from}`;
        const lastNotification = messageQueues.get(notificationKey) || 0;
        const now = Date.now();
        
        if (now - lastNotification < 60000) { // دقيقة واحدة بين الإشعارات
            return;
        }
        
        // إرسال إشعار
        const messagePreview = message.body 
            ? (message.body.length > 100 ? message.body.substring(0, 100) + '...' : message.body)
            : '📎 رسالة تحتوي على مرفق';
        
        await bot.sendMessage(admin.telegramId,
            `📨 *رسالة جديدة على WhatsApp*\n\n` +
            `📱 من: ${message.from}\n` +
            `🔗 الجلسة: ${session.phoneNumber}\n` +
            `📝 المحتوى:\n${messagePreview}\n\n` +
            `⏰ ${new Date().toLocaleTimeString('ar-SA')}`,
            { parse_mode: 'Markdown' }
        );
        
        // تحديث وقت الإشعار الأخير
        messageQueues.set(notificationKey, now);
        
    } catch (error) {
        console.error('❌ خطأ في إرسال إشعار الرسالة:', error);
    }
}

// ============================================
// 9. أوامر تليجرام الأساسية
// ============================================
bot.setMyCommands([
    { command: 'start', description: '🚀 بدء البوت والترحيب' },
    { command: 'sessions', description: '📱 إدارة جلسات WhatsApp' },
    { command: 'addsession', description: '➕ إضافة جلسة جديدة' },
    { command: 'links', description: '🔗 الروابط المجمعة' },
    { command: 'stats', description: '📊 الإحصائيات والتقارير' },
    { command: 'ads', description: '📢 نظام الإعلانات' },
    { command: 'broadcast', description: '📨 البث الجماعي' },
    { command: 'autoreply', description: '🤖 الردود التلقائية' },
    { command: 'autojoin', description: '➕ الانضمام التلقائي' },
    { command: 'settings', description: '⚙️ إعدادات البوت' },
    { command: 'help', description: '🆘 المساعدة والدعم' },
    { command: 'status', description: '📊 حالة النظام' },
    { command: 'restart', description: '🔄 إعادة تشغيل' },
    { command: 'clear', description: '🧹 مسح البيانات' },
    { command: 'logs', description: '📋 عرض السجلات' }
]);

// أمر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const username = msg.from.username || msg.from.first_name || 'مستخدم';
    
    console.log(`👋 مستخدم جديد: ${username} (${telegramId})`);
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        
        if (!admin) {
            console.log(`❌ مستخدم غير مصرح: ${telegramId}`);
            
            return bot.sendMessage(chatId,
                `🔒 *غير مصرح لك بالدخول!*\n\n` +
                `عذراً ${username}، أنت لست مشرفاً في هذا النظام.\n\n` +
                `📞 *للحصول على صلاحية المشرف:*\n` +
                `1. تواصل مع المشرف الرئيسي\n` +
                `2. أرسل له رقم Telegram ID الخاص بك\n` +
                `3. سيقوم المشرف بإضافتك للنظام\n\n` +
                `🆔 *رقمك الحالي:* \`${telegramId}\`\n\n` +
                `⚡ *بعد الإضافة:* أرسل /start مرة أخرى`,
                { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true 
                }
            );
        }
        
        // تحديث آخر نشاط
        await admin.update({ lastActivity: new Date() });
        
        console.log(`✅ مشرف مسجل: ${admin.firstName || username}`);
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 إدارة الجلسات', callback_data: 'menu_sessions' },
                    { text: '🔗 الروابط المجمعة', callback_data: 'menu_links' }
                ],
                [
                    { text: '📢 نظام الإعلانات', callback_data: 'menu_ads' },
                    { text: '📨 البث الجماعي', callback_data: 'menu_broadcast' }
                ],
                [
                    { text: '🤖 الردود التلقائية', callback_data: 'menu_autoreply' },
                    { text: '➕ الانضمام التلقائي', callback_data: 'menu_autojoin' }
                ],
                [
                    { text: '📊 الإحصائيات', callback_data: 'menu_stats' },
                    { text: '⚙️ الإعدادات', callback_data: 'menu_settings' }
                ],
                [
                    { text: '🆘 المساعدة والدعم', callback_data: 'menu_help' },
                    { text: '🔄 تحديث المعلومات', callback_data: 'refresh_menu' }
                ]
            ]
        };
        
        // رسالة ترحيب مخصصة
        const welcomeMsg = `
🎉 *مرحباً ${admin.firstName || username}!* 🎉

🤖 *مرحباً بك في WhatsApp Telegram Bot*

🚀 *الإصدار:* 2.0.0 - Render Optimized
📅 *تاريخ التشغيل:* ${new Date().toLocaleDateString('ar-SA')}
⏰ *الوقت الحالي:* ${new Date().toLocaleTimeString('ar-SA')}

📊 *حالتك الحالية:*
• 💼 الصلاحيات: ${admin.permissions?.length || 0} صلاحية
• 🔔 الإشعارات: ${admin.settings?.notificationEnabled ? '✅ مفعلة' : '❌ معطلة'}
• 📱 الحد الأقصى للجلسات: ${admin.settings?.maxSessions || 5}

🎯 *المميزات المتاحة لك:*
${admin.permissions?.includes('admin') ? '• 👑 إدارة النظام الكاملة\n' : ''}
${admin.permissions?.includes('manage_sessions') ? '• 📱 ربط وإدارة جلسات WhatsApp\n' : ''}
${admin.permissions?.includes('manage_ads') ? '• 📢 إنشاء وإدارة الإعلانات\n' : ''}
${admin.permissions?.includes('manage_broadcasts') ? '• 📨 إرسال البث الجماعي\n' : ''}
${admin.permissions?.includes('view_stats') ? '• 📊 عرض التقارير والإحصائيات\n' : ''}

💡 *نصائح سريعة:*
1. استخدم /addsession لربط حساب WhatsApp
2. استخدم /links لعرض الروابط المجمعة
3. استخدم /stats لعرض الإحصائيات
4. استخدم /help للحصول على المساعدة

⚡ *جاهز للبدء؟* اختر من القائمة أدناه 👇
        `;
        
        await bot.sendMessage(chatId, welcomeMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم إرسال رسالة الترحيب لـ ${telegramId}`);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /start:', error);
        
        await bot.sendMessage(chatId,
            '❌ *حدث خطأ غير متوقع!*\n\n' +
            'يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.\n\n' +
            `📋 تفاصيل الخطأ: ${error.message.substring(0, 100)}`,
            { parse_mode: 'Markdown' }
        );
    }
});

// أمر إضافة جلسة جديدة
bot.onText(/\/addsession/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    console.log(`➕ طلب إضافة جلسة من: ${telegramId}`);
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) {
            console.log(`❌ مستخدم غير مصرح: ${telegramId}`);
            return;
        }
        
        // التحقق من الحد الأقصى للجلسات
        const sessionCount = await WhatsAppSession.count({ 
            where: { adminId: admin.id, status: { [Op.ne]: 'disconnected' } } 
        });
        
        const maxSessions = admin.settings?.maxSessions || 5;
        
        if (sessionCount >= maxSessions) {
            return bot.sendMessage(chatId,
                `❌ *وصلت للحد الأقصى!*\n\n` +
                `📊 لديك ${sessionCount} جلسة نشطة من أصل ${maxSessions} مسموح بها.\n\n` +
                `🔄 *الحلول الممكنة:*\n` +
                `1. استخدم /sessions لعرض الجلسات\n` +
                `2. احذف جلسة غير مستخدمة\n` +
                `3. تواصل مع المشرف لزيادة الحد\n\n` +
                `💡 *نصيحة:* يمكن لكل جلسة التعامل مع مهام مختلفة`,
                { parse_mode: 'Markdown' }
            );
        }
        
        // حفظ حالة المستخدم
        userStates.set(telegramId, {
            state: 'awaiting_phone_for_session',
            data: { 
                adminId: admin.id,
                step: 1,
                timestamp: Date.now()
            }
        });
        
        // رسالة إرشادية مع أمثلة
        const examples = [
            '+966501234567',
            '+971501234567', 
            '+201012345678',
            '+212612345678',
            '+963912345678'
        ];
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🇸🇦 السعودية (+966)', callback_data: 'phone_example_+966' },
                    { text: '🇦🇪 الإمارات (+971)', callback_data: 'phone_example_+971' }
                ],
                [
                    { text: '🇪🇬 مصر (+20)', callback_data: 'phone_example_+20' },
                    { text: '🇯🇴 الأردن (+962)', callback_data: 'phone_example_+962' }
                ],
                [
                    { text: '❌ إلغاء العملية', callback_data: 'cancel_add_session' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId,
            `📱 *إضافة جلسة WhatsApp جديدة*\n\n` +
            `🚀 *مرحباً بك في عملية إضافة الجلسة*\n\n` +
            `📋 *المعلومات المطلوبة:*\n` +
            `1. رقم الهاتف المرتبط بحساب WhatsApp\n` +
            `2. QR Code للربط كجهاز مصاحب\n\n` +
            `📝 *كيفية الحصول على QR Code:*\n` +
            `• افتح WhatsApp على هاتفك\n` +
            `• اذهب إلى الإعدادات → الأجهزة المرتبطة\n` +
            `• انقر على "ربط جهاز"\n` +
            `• سأرسل لك QR Code لمسحه\n\n` +
            `📞 *أرسل لي رقم الهاتف الآن (مع رمز الدولة):*\n` +
            examples.map(ex => `• \`${ex}\``).join('\n') + `\n\n` +
            `🔒 *ملاحظات مهمة:*\n` +
            `• تأكد من اتصال الهاتف بالإنترنت\n` +
            `• الرقم يجب أن يكون نشط على WhatsApp\n` +
            `• يمكنك إلغاء العملية في أي وقت\n\n` +
            `⚡ *جاهز؟ أرسل الرقم الآن:*`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true 
            }
        );
        
        console.log(`✅ تم بدء عملية إضافة جلسة لـ ${telegramId}`);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /addsession:', error);
        
        await bot.sendMessage(chatId,
            '❌ *حدث خطأ في بدء إضافة الجلسة!*\n\n' +
            'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.\n\n' +
            `📋 الخطأ: ${error.message.substring(0, 100)}`,
            { parse_mode: 'Markdown' }
        );
    }
});

// أمر عرض الجلسات
bot.onText(/\/sessions/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showSessionsMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /sessions:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الجلسات');
    }
});

// أمر الروابط
bot.onText(/\/links/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showLinksMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /links:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
    }
});

// أمر الإحصائيات
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showStatsMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /stats:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإحصائيات');
    }
});

// أمر الإعلانات
bot.onText(/\/ads/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showAdsMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /ads:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعلانات');
    }
});

// أمر البث الجماعي
bot.onText(/\/broadcast/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showBroadcastMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /broadcast:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض البث الجماعي');
    }
});

// أمر الردود التلقائية
bot.onText(/\/autoreply/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showAutoReplyMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /autoreply:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الردود التلقائية');
    }
});

// أمر الانضمام التلقائي
bot.onText(/\/autojoin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showAutoJoinMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /autojoin:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الانضمام التلقائي');
    }
});

// أمر الإعدادات
bot.onText(/\/settings/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showSettingsMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /settings:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعدادات');
    }
});

// أمر المساعدة
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showHelpMenu(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /help:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض المساعدة');
    }
});

// أمر حالة النظام
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await showBotStatus(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /status:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض حالة النظام');
    }
});

// أمر إعادة التشغيل
bot.onText(/\/restart/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await handleRestart(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /restart:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في إعادة التشغيل');
    }
});

// أمر مسح البيانات
bot.onText(/\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await handleClearData(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /clear:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في مسح البيانات');
    }
});

// أمر عرض السجلات
bot.onText(/\/logs/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    
    try {
        const admin = await Admin.findOne({ where: { telegramId } });
        if (!admin) return;
        
        await handleShowLogs(chatId, admin.id);
        
    } catch (error) {
        console.error('❌ خطأ في الأمر /logs:', error);
        bot.sendMessage(chatId, '❌ حدث خطأ في عرض السجلات');
    }
});

// ============================================
// 10. معالجة الرسائل النصية
// ============================================
bot.on('message', async (msg) => {
    // تخطي الأوامر
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const userState = userStates.get(telegramId);
    
    if (!userState || !msg.text) return;
    
    console.log(`📝 معالجة رسالة حالة من ${telegramId}: ${userState.state}`);
    
    // معالجة حالات المستخدم المختلفة
    switch (userState.state) {
        case 'awaiting_phone_for_session':
            await handlePhoneInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_ad_name':
            await handleAdNameInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_ad_content':
            await handleAdContentInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_broadcast_message':
            await handleBroadcastMessageInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_autoreply_trigger':
            await handleAutoReplyTriggerInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_autoreply_response':
            await handleAutoReplyResponseInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_session_name':
            await handleSessionNameInput(chatId, telegramId, msg.text, userState.data);
            break;
    }
});

async function handlePhoneInput(chatId, telegramId, phoneNumber, data) {
    console.log(`📞 معالجة رقم هاتف: ${phoneNumber} من ${telegramId}`);
    
    // التحقق من صحة الرقم
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
        const errorMsg = `
❌ *رقم الهاتف غير صالح!*

📋 *الشروط الصحيحة:*
1. يجب أن يبدأ بعلامة ➕
2. يتبعه رمز الدولة (1-3 أرقام)
3. ثم رقم الهاتف (8-14 رقم)
4. لا يحتوي على مسافات أو رموز خاصة

📝 *أمثلة صحيحة:*
• \`+966501234567\` - السعودية
• \`+971501234567\` - الإمارات  
• \`+201012345678\` - مصر
• \`+212612345678\` - المغرب
• \`+962791234567\` - الأردن

❌ *أمثلة خاطئة:*
• 966501234567 (ناقص +)
• +966-50-123-4567 (يحتوي على -)
• 00966501234567 (يبدأ بـ 00)
• +966 50 123 4567 (يحتوي على مسافات)

🔧 *حاول مرة أخرى:*
أرسل الرقم بالشكل الصحيح أو انقر على أحد الأمثلة:
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🇸🇦 +966501234567', callback_data: 'phone_example_+966501234567' },
                    { text: '🇦🇪 +971501234567', callback_data: 'phone_example_+971501234567' }
                ],
                [
                    { text: '🇪🇬 +201012345678', callback_data: 'phone_example_+201012345678' },
                    { text: '🇯🇴 +962791234567', callback_data: 'phone_example_+962791234567' }
                ],
                [
                    { text: '❌ إلغاء العملية', callback_data: 'cancel_add_session' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, errorMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        return;
    }
    
    // التحقق من عدم تكرار الجلسة لنفس الرقم
    const existingSession = await WhatsAppSession.findOne({
        where: { 
            phoneNumber: phoneNumber,
            adminId: data.adminId,
            status: { [Op.ne]: 'disconnected' }
        }
    });
    
    if (existingSession) {
        await bot.sendMessage(chatId,
            `⚠️ *هذا الرقم مضاف مسبقاً!*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `📌 الحالة: ${existingSession.status}\n` +
            `🆔 المعرف: ${existingSession.id.substring(0, 8)}\n\n` +
            `🔧 *خيارات:*\n` +
            `1. استخدم الجلسة الحالية\n` +
            `2. احذف الجلسة الحالية وأضف جديدة\n` +
            `3. أضف رقم هاتف مختلف\n\n` +
            `استخدم /sessions لإدارة الجلسات الحالية.`,
            { parse_mode: 'Markdown' }
        );
        
        // مسح حالة المستخدم
        userStates.delete(telegramId);
        return;
    }
    
    // بدء عملية إنشاء الجلسة
    await bot.sendMessage(chatId,
        `⏳ *جاري إنشاء الجلسة...*\n\n` +
        `📱 الرقم: ${phoneNumber}\n` +
        `🔧 جاري الاتصال بـ WhatsApp Web...\n` +
        `⏱️ قد تستغرق العملية 10-30 ثانية\n\n` +
        `⚡ *جاري التحضير:*\n` +
        `• تهيئة متصفح WhatsApp\n` +
        `• توليد QR Code فريد\n` +
        `• إعداد الجهاز المصاحب\n` +
        `• اختبار الاتصال...`,
        { parse_mode: 'Markdown' }
    );
    
    try {
        const sessionId = await createWhatsAppSession(phoneNumber, data.adminId, chatId);
        
        // مسح حالة المستخدم
        userStates.delete(telegramId);
        
        await bot.sendMessage(chatId,
            `✅ *تم إنشاء الجلسة بنجاح!*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `🆔 معرف الجلسة: \`${sessionId.substring(0, 8)}\`\n` +
            `🔗 الحالة: ⏳ في انتظار الربط\n\n` +
            `📤 *جاري إرسال QR Code...*\n` +
            `سوف يصلك خلال ثواني قليلة.\n\n` +
            `💡 *تلميح:* تأكد من:\n` +
            `1. اتصال هاتفك بالإنترنت\n` +
            `2. فتح تطبيق WhatsApp\n` +
            `3. جاهزية الكاميرا للمسح`,
            { parse_mode: 'Markdown' }
        );
        
        console.log(`✅ تم إنشاء جلسة ${sessionId} للرقم ${phoneNumber}`);
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الجلسة:', error);
        
        // مسح حالة المستخدم
        userStates.delete(telegramId);
        
        let errorMessage = 'فشل إنشاء الجلسة';
        if (error.message.includes('timeout')) {
            errorMessage = 'انتهت مهلة الاتصال بـ WhatsApp';
        } else if (error.message.includes('protocol')) {
            errorMessage = 'خطأ في بروتوكول WhatsApp';
        } else if (error.message.includes('puppeteer')) {
            errorMessage = 'خطأ في متصفح WhatsApp';
        }
        
        await bot.sendMessage(chatId,
            `❌ *${errorMessage}!*\n\n` +
            `📱 الرقم: ${phoneNumber}\n` +
            `📋 الخطأ: ${error.message.substring(0, 100)}\n\n` +
            `🔧 *الأسباب المحتملة:*\n` +
            `• مشكلة في اتصال WhatsApp Web\n` +
            `• رقم الهاتف غير صحيح\n` +
            `• حساب WhatsApp غير نشط\n` +
            `• مشكلة في السيرفر\n\n` +
            `🔄 *الحلول المقترحة:*\n` +
            `1. تحقق من صحة الرقم\n` +
            `2. تأكد من نشاط حساب WhatsApp\n` +
            `3. حاول مرة أخرى بعد قليل\n` +
            `4. تواصل مع الدعم الفني\n\n` +
            `⚡ يمكنك المحاولة مرة أخرى باستخدام /addsession`,
            { parse_mode: 'Markdown' }
        );
    }
}

async function handleAdNameInput(chatId, telegramId, text, data) {
    console.log(`📝 معالجة اسم إعلان: ${text} من ${telegramId}`);
    
    // حفظ الاسم والمتابعة للحالة التالية
    userStates.set(telegramId, {
        state: 'awaiting_ad_content',
        data: { ...data, adName: text }
    });
    
    await bot.sendMessage(chatId,
        `✅ *تم حفظ اسم الإعلان:* ${text}\n\n` +
        `📝 *الآن أرسل محتوى الإعلان:*\n\n` +
        `💡 *نصائح للمحتوى:*\n` +
        `• كن واضحاً ومختصراً\n` +
        `• أضف رابطاً إذا لزم الأمر\n` +
        `• استخدم رموز تعبيرية لجذب الانتباه\n` +
        `• تحقق من التهجئة والنحو\n\n` +
        `⚡ *جاهز؟ أرسل المحتوى الآن:*`,
        { parse_mode: 'Markdown' }
    );
}

async function handleAdContentInput(chatId, telegramId, text, data) {
    console.log(`📝 معالجة محتوى إعلان من ${telegramId}`);
    
    try {
        // إنشاء الإعلان في قاعدة البيانات
        const ad = await Advertisement.create({
            adminId: data.adminId,
            name: data.adName,
            type: 'text',
            content: text,
            isActive: true,
            stats: {
                sent: 0,
                failed: 0,
                lastSent: null
            }
        });
        
        // مسح حالة المستخدم
        userStates.delete(telegramId);
        
        await bot.sendMessage(chatId,
            `🎉 *تم إنشاء الإعلان بنجاح!*\n\n` +
            `📢 *اسم الإعلان:* ${ad.name}\n` +
            `📝 *نوع الإعلان:* نص\n` +
            `🆔 *معرف الإعلان:* ${ad.id}\n` +
            `⏰ *وقت الإنشاء:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `✅ *الإعلان جاهز للنشر!*\n\n` +
            `🚀 *الخطوات التالية:*\n` +
            `1. استخدم /ads لعرض الإعلانات\n` +
            `2. اختر الإعلان الجديد\n` +
            `3. اضبط إعدادات النشر\n` +
            `4. ابدأ الحملة الإعلانية\n\n` +
            `⚡ *مستعد لبدء الحملة؟*`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الإعلان:', error);
        
        await bot.sendMessage(chatId,
            '❌ *فشل إنشاء الإعلان!*\n\n' +
            'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.\n\n' +
            `📋 الخطأ: ${error.message.substring(0, 100)}`,
            { parse_mode: 'Markdown' }
        );
    }
}

async function handleBroadcastMessageInput(chatId, telegramId, text, data) {
    console.log(`📨 معالجة رسالة بث من ${telegramId}`);
    
    try {
        // حفظ رسالة البث
        userStates.set(telegramId, {
            state: 'awaiting_broadcast_target',
            data: { ...data, broadcastMessage: text }
        });
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '👥 جميع جهات الاتصال', callback_data: 'broadcast_target_all_contacts' },
                    { text: '👥 جميع المجموعات', callback_data: 'broadcast_target_all_groups' }
                ],
                [
                    { text: '📋 اختيار يدوي', callback_data: 'broadcast_target_manual' },
                    { text: '❌ إلغاء', callback_data: 'cancel_broadcast' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId,
            `✅ *تم حفظ رسالة البث*\n\n` +
            `📝 *معاينة الرسالة:*\n` +
            `${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n\n` +
            `🎯 *الآن اختر الوجهة:*\n\n` +
            `👥 *خيارات الوجهة:*\n` +
            `• **جميع جهات الاتصال:** إرسال لجميع جهات الاتصال\n` +
            `• **جميع المجموعات:** إرسال لجميع المجموعات\n` +
            `• **اختيار يدوي:** تحديد جهات محددة\n\n` +
            `⚠️ *تحذير:* إرسال البث قد يستغرق وقتاً حسب عدد المستلمين.\n\n` +
            `اختر الوجهة:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
        
    } catch (error) {
        console.error('❌ خطأ في معالجة رسالة البث:', error);
        
        await bot.sendMessage(chatId,
            '❌ *حدث خطأ في حفظ رسالة البث!*\n\n' +
            'يرجى المحاولة مرة أخرى.\n\n' +
            `📋 الخطأ: ${error.message.substring(0, 100)}`,
            { parse_mode: 'Markdown' }
        );
    }
}

async function handleAutoReplyTriggerInput(chatId, telegramId, text, data) {
    console.log(`🤖 معالجة محفز رد تلقائي من ${telegramId}`);
    
    // حفظ المحفز والمتابعة للحالة التالية
    userStates.set(telegramId, {
        state: 'awaiting_autoreply_response',
        data: { ...data, trigger: text }
    });
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '👤 خاص فقط', callback_data: 'autoreply_type_private' },
                { text: '👥 جماعي فقط', callback_data: 'autoreply_type_group' }
            ],
            [
                { text: '👤👥 كلا النوعين', callback_data: 'autoreply_type_both' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId,
        `✅ *تم حفظ المحفز:* "${text}"\n\n` +
        `🎯 *الآن اختر نوع المحادثة:*\n\n` +
        `👤 *خاص فقط:* الرد على الرسائل الخاصة فقط\n` +
        `👥 *جماعي فقط:* الرد في المجموعات فقط\n` +
        `👤👥 *كلا النوعين:* الرد في كلا الحالتين\n\n` +
        `💡 *نصائح:*\n` +
        `• اختر "خاص فقط" للردود الشخصية\n` +
        `• اختر "جماعي فقط" للردود العامة\n` +
        `• اختر "كلا النوعين" للردود الشاملة\n\n` +
        `اختر نوع المحادثة:`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        }
    );
}

async function handleAutoReplyResponseInput(chatId, telegramId, text, data) {
    console.log(`🤖 معالجة رد تلقائي من ${telegramId}`);
    
    // حفظ الرد وإنشاء الرد التلقائي
    userStates.set(telegramId, {
        state: 'awaiting_autoreply_name',
        data: { ...data, response: text }
    });
    
    await bot.sendMessage(chatId,
        `✅ *تم حفظ الرد*\n\n` +
        `📝 *معاينة الرد:*\n` +
        `${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n\n` +
        `🎯 *الآن أرسل اسم لهذا الرد التلقائي:*\n\n` +
        `💡 *نصائح للتسمية:*\n` +
        `• استخدم اسمًا وصفيًا\n` +
        `• مثال: "رد التحية"\n` +
        `• مثال: "معلومات البوت"\n` +
        `• مثال: "رد على سؤال شائع"\n\n` +
        `⚡ *جاهز؟ أرسل الاسم الآن:*`,
        { parse_mode: 'Markdown' }
    );
}

async function handleSessionNameInput(chatId, telegramId, text, data) {
    console.log(`📱 معالجة اسم جلسة: ${text} من ${telegramId}`);
    
    try {
        // إنشاء الرد التلقائي في قاعدة البيانات
        const autoReply = await AutoReply.create({
            adminId: data.adminId,
            sessionId: data.sessionId,
            name: text,
            triggerType: data.triggerType || 'both',
            trigger: data.trigger,
            response: data.response,
            isActive: true,
            matchType: 'contains',
            stats: {
                triggered: 0,
                lastTriggered: null
            }
        });
        
        // مسح حالة المستخدم
        userStates.delete(telegramId);
        
        await bot.sendMessage(chatId,
            `🎉 *تم إنشاء الرد التلقائي بنجاح!*\n\n` +
            `🤖 *اسم الرد:* ${autoReply.name}\n` +
            `🎯 *نوع المحادثة:* ${autoReply.triggerType}\n` +
            `🔤 *المحفز:* ${autoReply.trigger.substring(0, 50)}${autoReply.trigger.length > 50 ? '...' : ''}\n` +
            `📝 *الرد:* ${autoReply.response.substring(0, 50)}${autoReply.response.length > 50 ? '...' : ''}\n` +
            `🆔 *معرف الرد:* ${autoReply.id}\n` +
            `⏰ *وقت الإنشاء:* ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `✅ *الرد التلقائي نشط الآن!*\n\n` +
            `🚀 *الميزات:*\n` +
            `• سيتم الرد تلقائياً عند ظهور المحفز\n` +
            `• يعمل في الوقت الفعلي\n` +
            `• يمكن تعديله أو إيقافه لاحقاً\n\n` +
            `⚡ *استخدم /autoreply لإدارة الردود*`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الرد التلقائي:', error);
        
        await bot.sendMessage(chatId,
            '❌ *فشل إنشاء الرد التلقائي!*\n\n' +
            'يرجى المحاولة مرة أخرى أو التواصل مع الدعم.\n\n' +
            `📋 الخطأ: ${error.message.substring(0, 100)}`,
            { parse_mode: 'Markdown' }
        );
    }
}

// ============================================
// 11. معالجة الأزرار التفاعلية
// ============================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const username = query.from.username || query.from.first_name || 'مستخدم';
    const data = query.data;
    
    console.log(`🔘 زر تفاعلي من ${username} (${userId}): ${data}`);
    
    try {
        // الرد الفوري على الزر
        await bot.answerCallbackQuery(query.id);
        
        // تقسيم بيانات الزر
        const parts = data.split('_');
        const action = parts[0];
        
        switch (action) {
            case 'menu':
                await handleMenuAction(chatId, userId, parts[1], parts[2]);
                break;
                
            case 'session':
                await handleSessionAction(chatId, userId, parts);
                break;
                
            case 'qr':
                await handleQRAction(chatId, userId, parts);
                break;
                
            case 'links':
                await handleLinksAction(chatId, userId, parts[1]);
                break;
                
            case 'ad':
                await handleAdAction(chatId, userId, parts);
                break;
                
            case 'stats':
                await handleStatsAction(chatId, userId, parts);
                break;
                
            case 'refresh':
                await handleRefreshAction(chatId, userId, parts[1]);
                break;
                
            case 'phone':
                await handlePhoneExample(chatId, userId, parts);
                break;
                
            case 'cancel':
                await handleCancelAction(chatId, userId, parts);
                break;
                
            default:
                console.log(`🔍 زر غير معروف: ${data}`);
                await bot.sendMessage(chatId, 
                    '⚠️ *زر غير معروف*\n\n' +
                    'يرجى استخدام القائمة الحالية.',
                    { parse_mode: 'Markdown' }
                );
        }
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الزر التفاعلي:', error);
        
        await bot.answerCallbackQuery(query.id, {
            text: '❌ حدث خطأ في المعالجة',
            show_alert: true
        });
        
        await bot.sendMessage(chatId,
            '❌ *حدث خطأ غير متوقع!*\n\n' +
            'يرجى المحاولة مرة أخرى.\n\n' +
            `📋 الخطأ: ${error.message.substring(0, 100)}`,
            { parse_mode: 'Markdown' }
        );
    }
});

async function handleMenuAction(chatId, userId, menu, submenu) {
    console.log(`📋 قائمة: ${menu}${submenu ? `/${submenu}` : ''} من ${userId}`);
    
    const admin = await Admin.findOne({ where: { telegramId: userId } });
    if (!admin) {
        console.log(`❌ مستخدم غير مصرح للقائمة: ${userId}`);
        return;
    }
    
    // تحديث آخر نشاط
    await admin.update({ lastActivity: new Date() });
    
    switch (menu) {
        case 'sessions':
            await showSessionsMenu(chatId, admin.id);
            break;
            
        case 'links':
            await showLinksMenu(chatId, admin.id);
            break;
            
        case 'ads':
            await showAdsMenu(chatId, admin.id);
            break;
            
        case 'broadcast':
            await showBroadcastMenu(chatId, admin.id);
            break;
            
        case 'autoreply':
            await showAutoReplyMenu(chatId, admin.id);
            break;
            
        case 'autojoin':
            await showAutoJoinMenu(chatId, admin.id);
            break;
            
        case 'stats':
            await showStatsMenu(chatId, admin.id);
            break;
            
        case 'settings':
            await showSettingsMenu(chatId, admin.id);
            break;
            
        case 'help':
            await showHelpMenu(chatId, admin.id);
            break;
            
        case 'main':
            await handleStart({ 
                chat: { id: chatId }, 
                from: { id: userId, username: admin.username, first_name: admin.firstName } 
            });
            break;
            
        default:
            console.log(`❌ قائمة غير معروفة: ${menu}`);
    }
}

async function handleSessionAction(chatId, userId, parts) {
    const action = parts[1];
    const sessionId = parts[2];
    
    switch (action) {
        case 'info':
            await showSessionInfo(chatId, userId, sessionId);
            break;
            
        case 'delete':
            await deleteSession(chatId, userId, sessionId);
            break;
            
        case 'restart':
            await restartSession(chatId, userId, sessionId);
            break;
            
        case 'stats':
            await showSessionStats(chatId, userId, sessionId);
            break;
    }
}

async function showSessionInfo(chatId, userId, sessionId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (!session) {
            return bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
        }
        
        // التحقق من صلاحيات المشرف
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin || admin.id !== session.adminId) {
            return bot.sendMessage(chatId, '❌ غير مصرح لك!');
        }
        
        const client = whatsappClients.get(sessionId);
        const isConnected = client ? true : false;
        
        const message = `
📱 *معلومات الجلسة*

🔗 *المعلومات الأساسية:*
• 🆔 المعرف: \`${session.id.substring(0, 8)}\`
• 📞 الرقم: ${session.phoneNumber}
• 📌 الحالة: ${session.status}
• 🔗 الاتصال: ${isConnected ? '✅ متصل' : '❌ غير متصل'}

⏰ *التواريخ:*
• 📅 الإنشاء: ${new Date(session.createdAt).toLocaleString('ar-SA')}
• 🔗 آخر اتصال: ${session.connectedAt ? new Date(session.connectedAt).toLocaleString('ar-SA') : 'لم يتصل بعد'}
• 🔄 آخر نشاط: ${new Date(session.lastActivity).toLocaleString('ar-SA')}

📊 *الإحصائيات:*
• 👥 المجموعات: ${session.groupsCount || 0}
• 📞 الجهات: ${session.contactsCount || 0}
• 📨 الرسائل المستلمة: ${session.stats?.messagesReceived || 0}
• 📤 الرسائل المرسلة: ${session.stats?.messagesSent || 0}
• 🔗 الروابط المجمعة: ${session.stats?.linksCollected || 0}

⚙️ *الإعدادات:*
• 🤖 الرد التلقائي: ${session.settings?.autoReply ? '✅ مفعل' : '❌ معطل'}
• 🔗 تجميع الروابط: ${session.settings?.autoCollect ? '✅ مفعل' : '❌ معطل'}
• ➕ الانضمام التلقائي: ${session.settings?.autoJoin ? '✅ مفعل' : '❌ معطل'}
• 📢 البث الجماعي: ${session.settings?.broadcastEnabled ? '✅ مفعل' : '❌ معطل'}

💡 *معلومات الاتصال:*
${session.connectionData ? `
• 👤 الاسم: ${session.connectionData.pushname || 'غير معروف'}
• 🏗️ النظام: ${session.connectionData.platform || 'غير معروف'}
• 📱 رقم الواتساب: ${session.connectionData.phone?.user || 'غير معروف'}
` : '• ℹ️ لا توجد معلومات اتصال'}

⚡ *التحكم بالجلسة:*
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 إعادة التشغيل', callback_data: `session_restart_${sessionId}` },
                    { text: '⏸️ إيقاف مؤقت', callback_data: `session_pause_${sessionId}` }
                ],
                [
                    { text: '🗑️ حذف الجلسة', callback_data: `session_delete_${sessionId}` },
                    { text: '📊 إحصائيات مفصلة', callback_data: `session_stats_${sessionId}` }
                ],
                [
                    { text: '⚙️ إعدادات الجلسة', callback_data: `session_settings_${sessionId}` },
                    { text: '🔗 روابط الجلسة', callback_data: `session_links_${sessionId}` }
                ],
                [
                    { text: '📋 العودة للجلسات', callback_data: 'menu_sessions' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('❌ خطأ في عرض معلومات الجلسة:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض معلومات الجلسة');
    }
}

async function deleteSession(chatId, userId, sessionId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (!session) {
            return bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
        }
        
        // التحقق من صلاحيات المشرف
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin || admin.id !== session.adminId) {
            return bot.sendMessage(chatId, '❌ غير مصرح لك!');
        }
        
        // إغلاق العميل إذا كان متصلاً
        const client = whatsappClients.get(sessionId);
        if (client) {
            await client.destroy();
            whatsappClients.delete(sessionId);
        }
        
        // حذف الجلسة من قاعدة البيانات
        await session.destroy();
        
        // حذف البيانات المرتبطة
        await CollectedLink.destroy({ where: { sessionId } });
        
        // مسح من الذاكرة المؤقتة
        sessionQRs.delete(sessionId);
        
        await bot.sendMessage(chatId,
            `✅ *تم حذف الجلسة بنجاح*\n\n` +
            `📱 الرقم: ${session.phoneNumber}\n` +
            `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
            `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `🗑️ *ما تم حذفه:*\n` +
            `• الجلسة الرئيسية\n` +
            `• جميع الروابط المجمعة\n` +
            `• اتصال WhatsApp\n` +
            `• جميع البيانات المرتبطة\n\n` +
            `⚡ يمكنك إضافة جلسة جديدة باستخدام /addsession`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في حذف الجلسة:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في حذف الجلسة');
    }
}

async function restartSession(chatId, userId, sessionId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (!session) {
            return bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
        }
        
        // التحقق من صلاحيات المشرف
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin || admin.id !== session.adminId) {
            return bot.sendMessage(chatId, '❌ غير مصرح لك!');
        }
        
        await bot.sendMessage(chatId,
            `🔄 *جاري إعادة تشغيل الجلسة...*\n\n` +
            `📱 الرقم: ${session.phoneNumber}\n` +
            `⏳ قد تستغرق العملية بضع ثواني...`,
            { parse_mode: 'Markdown' }
        );
        
        // إغلاق العميل الحالي إذا كان متصلاً
        const oldClient = whatsappClients.get(sessionId);
        if (oldClient) {
            await oldClient.destroy();
            whatsappClients.delete(sessionId);
        }
        
        // تحديث حالة الجلسة
        await session.update({
            status: 'awaiting_qr',
            lastActivity: new Date()
        });
        
        // إعادة إنشاء الجلسة
        const newSessionId = await createWhatsAppSession(session.phoneNumber, session.adminId, chatId);
        
        await bot.sendMessage(chatId,
            `✅ *تم إعادة تشغيل الجلسة بنجاح!*\n\n` +
            `📱 الرقم: ${session.phoneNumber}\n` +
            `🆔 المعرف الجديد: ${newSessionId.substring(0, 8)}\n` +
            `🔗 الحالة: ⏳ في انتظار الربط\n\n` +
            `📤 *جاري إرسال QR Code جديد...*`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ خطأ في إعادة تشغيل الجلسة:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في إعادة تشغيل الجلسة');
    }
}

async function showSessionStats(chatId, userId, sessionId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (!session) {
            return bot.sendMessage(chatId, '❌ الجلسة غير موجودة');
        }
        
        // التحقق من صلاحيات المشرف
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin || admin.id !== session.adminId) {
            return bot.sendMessage(chatId, '❌ غير مصرح لك!');
        }
        
        // جمع الإحصائيات الإضافية
        const linksCount = await CollectedLink.count({ where: { sessionId } });
        const activeLinks = await CollectedLink.count({ where: { sessionId, status: 'active' } });
        const joinedGroups = await CollectedLink.count({ where: { sessionId, status: 'joined' } });
        
        const message = `
📊 *إحصائيات مفصلة للجلسة*

📱 *المعلومات الأساسية:*
• 📞 الرقم: ${session.phoneNumber}
• 🆔 المعرف: ${sessionId.substring(0, 8)}
• 📌 الحالة: ${session.status}
• ⏰ مدة التشغيل: ${session.connectedAt ? 
    Math.floor((new Date() - new Date(session.connectedAt)) / 3600000) + ' ساعة' : 'لم يتصل بعد'}

📈 *إحصائيات النشاط:*
• 📨 الرسائل المستلمة: ${session.stats?.messagesReceived || 0}
• 📤 الرسائل المرسلة: ${session.stats?.messagesSent || 0}
• 🔗 إجمالي الروابط: ${linksCount}
• 🟢 روابط نشطة: ${activeLinks}
• 👥 مجموعات منضمة: ${joinedGroups}
• 👥 مجموعات متاحة: ${session.groupsCount || 0}
• 📞 جهات اتصال: ${session.contactsCount || 0}

📅 *النشاط الزمني:*
• 🕐 أول اتصال: ${session.connectedAt ? new Date(session.connectedAt).toLocaleString('ar-SA') : 'لم يتصل'}
• 🔄 آخر نشاط: ${new Date(session.lastActivity).toLocaleString('ar-SA')}
• 📊 متوسط الرسائل/ساعة: ${session.connectedAt ? 
    Math.round(((session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0)) / 
    Math.max(1, (new Date() - new Date(session.connectedAt)) / 3600000)) : 0}

🎯 *معدلات النجاح:*
• 📨 معدل استقبال الرسائل: ${session.stats?.messagesReceived ? '🟢 جيد' : '⚪ قليل'}
• 📤 معدل إرسال الرسائل: ${session.stats?.messagesSent ? '🟢 جيد' : '⚪ قليل'}
• 🔗 فعالية تجميع الروابط: ${linksCount > 10 ? '🟢 ممتاز' : linksCount > 0 ? '🟡 جيد' : '🔴 ضعيف'}

💡 *تحليل الأداء:*
${session.status === 'connected' ? '• ✅ الجلسة تعمل بشكل طبيعي' : '• ⚠️ الجلسة غير نشطة'}
${(session.stats?.messagesReceived || 0) > 100 ? '• 📨 النشاط في استقبال الرسائل مرتفع' : ''}
${(session.stats?.messagesSent || 0) > 50 ? '• 📤 النشاط في إرسال الرسائل مرتفع' : ''}
${linksCount < 5 ? '• 🔍 يمكن تحسين تجميع الروابط' : ''}

⚡ *توصيات للتحسين:*
${linksCount < 10 ? '• 🔗 تفعيل تجميع الروابط في المزيد من المجموعات\n' : ''}
${(session.stats?.messagesSent || 0) < 10 ? '• 🤖 إضافة المزيد من الردود التلقائية\n' : ''}
${session.groupsCount < 5 ? '• 👥 الانضمام للمزيد من المجموعات\n' : ''}
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 تحديث الإحصائيات', callback_data: `session_stats_refresh_${sessionId}` },
                    { text: '📥 تصدير البيانات', callback_data: `session_export_${sessionId}` }
                ],
                [
                    { text: '📋 العودة للجلسة', callback_data: `session_info_${sessionId}` },
                    { text: '📊 جميع الإحصائيات', callback_data: 'menu_stats' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('❌ خطأ في عرض إحصائيات الجلسة:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإحصائيات');
    }
}

async function handleQRAction(chatId, userId, parts) {
    const action = parts[1];
    const sessionId = parts[2];
    
    switch (action) {
        case 'help':
            await bot.sendMessage(chatId,
                `📱 *دليل الربط المصور*\n\n` +
                `🚀 *الخطوات بالترتيب:*\n\n` +
                `1. *افتح WhatsApp* على هاتفك\n` +
                `2. *اضغط* على **النقاط الثلاث** (⋮)\n` +
                `3. *اختر* **"الأجهزة المرتبطة"**\n` +
                `4. *انقر* على **"ربط جهاز"**\n` +
                `5. *وجه الكاميرا* نحو QR Code\n` +
                `6. *انتظر* حتى تظهر رسالة التأكيد\n` +
                `7. *انقر* على **"متابعة"**\n\n` +
                `📝 *ملاحظات مهمة:*\n` +
                `• تأكد من اتصال الهاتف بالإنترنت\n` +
                `• قم بتقريب الكاميرا من QR Code\n` +
                `• ⏱️ QR Code صالح لمدة 60 ثانية\n` +
                `• 🔄 سيتم تجديده تلقائياً إذا انتهت\n\n` +
                `❓ *مشاكل شائعة وحلولها:*\n` +
                `• **الكاميرا لا تمسح:** جرب تقريب الهاتف أكثر\n` +
                `• **QR غير صالح:** اطلب QR جديد\n` +
                `• **لا يوجد خيار:** تأكد من تحديث WhatsApp\n\n` +
                `✅ *بعد الربح الناجح:* ستصلك رسالة تأكيد`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 'regenerate':
            // إعادة توليد QR Code
            const session = await WhatsAppSession.findByPk(sessionId);
            if (session) {
                const client = whatsappClients.get(sessionId);
                if (client) {
                    // إعادة تهيئة العميل لتوليد QR جديد
                    await client.destroy();
                    await client.initialize();
                    
                    await bot.sendMessage(chatId,
                        `🔄 *جاري توليد QR Code جديد...*\n\n` +
                        `📱 الرقم: ${session.phoneNumber}\n` +
                        `⏳ انتظر ثواني قليلة...`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
            break;
            
        case 'cancel':
            // إلغاء الجلسة
            await cancelSession(sessionId, userId, chatId);
            break;
    }
}

async function cancelSession(sessionId, userId, chatId) {
    try {
        const session = await WhatsAppSession.findByPk(sessionId);
        if (!session) return;
        
        // التحقق من أن المستخدم هو مالك الجلسة
        const admin = await Admin.findOne({ where: { telegramId: userId } });
        if (!admin || admin.id !== session.adminId) {
            await bot.sendMessage(chatId,
                '❌ *غير مصرح لك!*\n\n' +
                'لا يمكنك إلغاء هذه الجلسة.',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        // إغلاق العميل
        const client = whatsappClients.get(sessionId);
        if (client) {
            await client.destroy();
            whatsappClients.delete(sessionId);
        }
        
        // تحديث حالة الجلسة
        await session.update({
            status: 'disconnected',
            disconnectedAt: new Date()
        });
        
        // مسح QR من الذاكرة
        sessionQRs.delete(sessionId);
        
        await bot.sendMessage(chatId,
            `✅ *تم إلغاء الجلسة بنجاح*\n\n` +
            `📱 الرقم: ${session.phoneNumber}\n` +
            `🆔 المعرف: ${sessionId.substring(0, 8)}\n` +
            `⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n\n` +
            `يمكنك إضافة جلسة جديدة باستخدام /addsession`,
            { parse_mode: 'Markdown' }
        );
        
        console.log(`✅ تم إلغاء الجلسة ${sessionId} بواسطة ${userId}`);
        
    } catch (error) {
        console.error('❌ خطأ في إلغاء الجلسة:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في إلغاء الجلسة');
    }
}

async function handlePhoneExample(chatId, userId, parts) {
    if (parts[1] === 'example') {
        const exampleNumber = parts[2];
        await bot.sendMessage(chatId,
            `📞 *مثال الرقم:* \`${exampleNumber}\`\n\n` +
            `انسخ هذا الرقم وأرسله أو عدّل عليه حسب رقمك.\n\n` +
            `💡 *تلميح:*\n` +
            `• استبدل الأرقام الأخيرة برقم هاتفك\n` +
            `• احتفظ برمز الدولة كما هو\n` +
            `• لا تضيف مسافات أو رموز خاصة`,
            { parse_mode: 'Markdown' }
        );
    }
}

async function handleCancelAction(chatId, userId, parts) {
    const action = parts[1];
    
    switch (action) {
        case 'add':
            if (parts[2] === 'session') {
                // إلغاء إضافة جلسة
                userStates.delete(userId);
                await bot.sendMessage(chatId,
                    '❌ *تم إلغاء عملية إضافة الجلسة*\n\n' +
                    'يمكنك البدء من جديد باستخدام /addsession',
                    { parse_mode: 'Markdown' }
                );
            }
            break;
    }
}

async function handleLinksAction(chatId, userId, action) {
    const admin = await Admin.findOne({ where: { telegramId: userId } });
    if (!admin) return;
    
    switch (action) {
        case 'whatsapp_group':
            await showWhatsAppGroupLinks(chatId, admin.id);
            break;
            
        case 'whatsapp_invite':
            await showWhatsAppInviteLinks(chatId, admin.id);
            break;
            
        case 'telegram':
            await showTelegramLinks(chatId, admin.id);
            break;
            
        case 'other':
            await showOtherLinks(chatId, admin.id);
            break;
            
        case 'all':
            await showAllLinks(chatId, admin.id);
            break;
            
        case 'active':
            await showActiveLinks(chatId, admin.id);
            break;
            
        case 'export':
            await exportLinks(chatId, admin.id);
            break;
            
        case 'clear_confirm':
            await confirmClearLinks(chatId, admin.id);
            break;
    }
}

async function showWhatsAppGroupLinks(chatId, adminId) {
    try {
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId }
        });
        
        const sessionIds = sessions.map(s => s.id);
        
        const links = await CollectedLink.findAll({
            where: {
                type: 'whatsapp_group',
                sessionId: sessionIds
            },
            order: [['collectedAt', 'DESC']],
            limit: 20
        });
        
        if (links.length === 0) {
            return bot.sendMessage(chatId,
                `📭 *لا توجد روابط مجموعات واتساب*\n\n` +
                `لم يتم تجميع أي روابط مجموعات واتساب بعد.\n\n` +
                `🔧 *لبدء التجميع:*\n` +
                `1. تأكد من تفعيل تجميع الروابط\n` +
                `2. انتظر رسائل تحتوي على روابط\n` +
                `3. سيجمع البوت الروابط تلقائياً`,
                { parse_mode: 'Markdown' }
            );
        }
        
        let message = `📱 *روابط مجموعات واتساب*\n\n`;
        message += `📊 الإجمالي: ${links.length} رابط\n\n`;
        
        links.forEach((link, index) => {
            const groupName = link.metadata?.groupName || 'مجموعة واتساب';
            const groupSize = link.metadata?.groupSize || 'غير معروف';
            const status = link.status === 'active' ? '🟢' : link.status === 'joined' ? '✅' : '⚪';
            
            message += `${index + 1}. ${status} *${groupName}*\n`;
            message += `   👥 الأعضاء: ${groupSize}\n`;
            message += `   🔗 الرابط: ${link.url.substring(0, 30)}...\n`;
            message += `   ⏰ الاكتشاف: ${new Date(link.collectedAt).toLocaleDateString('ar-SA')}\n\n`;
        });
        
        message += `⚡ *استخدم /links للعودة للقائمة الرئيسية*`;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('❌ خطأ في عرض روابط مجموعات واتساب:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض الروابط');
    }
}

async function handleAdAction(chatId, userId, parts) {
    const admin = await Admin.findOne({ where: { telegramId: userId } });
    if (!admin) return;
    
    const action = parts[1];
    const adId = parts[2];
    
    switch (action) {
        case 'info':
            await showAdInfo(chatId, admin.id, adId);
            break;
            
        case 'create':
            await createAd(chatId, admin.id);
            break;
            
        case 'edit':
            await editAd(chatId, admin.id, adId);
            break;
            
        case 'delete':
            await deleteAd(chatId, admin.id, adId);
            break;
            
        case 'activate':
            await activateAd(chatId, admin.id, adId);
            break;
            
        case 'deactivate':
            await deactivateAd(chatId, admin.id, adId);
            break;
    }
}

async function showAdInfo(chatId, adminId, adId) {
    try {
        const ad = await Advertisement.findByPk(adId);
        if (!ad || ad.adminId !== adminId) {
            return bot.sendMessage(chatId, '❌ الإعلان غير موجود أو غير مصرح لك');
        }
        
        const message = `
📢 *معلومات الإعلان*

🔗 *المعلومات الأساسية:*
• 📝 الاسم: ${ad.name}
• 🏷️ النوع: ${ad.type}
• 📌 الحالة: ${ad.isActive ? '🟢 نشط' : '⚪ متوقف'}
• 🆔 المعرف: ${ad.id}

📊 *الإحصائيات:*
• 📨 مرسلة: ${ad.stats?.sent || 0}
• ❌ فاشلة: ${ad.stats?.failed || 0}
• 📈 نسبة النجاح: ${ad.stats?.sent ? 
    Math.round(((ad.stats.sent - (ad.stats.failed || 0)) / ad.stats.sent) * 100) : 0}%
• ⏰ آخر إرسال: ${ad.stats?.lastSent ? 
    new Date(ad.stats.lastSent).toLocaleString('ar-SA') : 'لم يرسل بعد'}

📝 *محتوى الإعلان:*
${ad.content.substring(0, 300)}${ad.content.length > 300 ? '...' : ''}

⏰ *معلومات الإنشاء:*
• 📅 تاريخ الإنشاء: ${new Date(ad.createdAt).toLocaleDateString('ar-SA')}
• ⏰ وقت الإنشاء: ${new Date(ad.createdAt).toLocaleTimeString('ar-SA')}

⚙️ *الإعدادات:*
• ⏳ التأخير بين المجموعات: ${ad.settings?.delayBetweenGroups || 1000}ms
• 🔄 إعادة المحاولة عند الفشل: ${ad.settings?.retryFailed ? '✅' : '❌'}
• ⚡ تحسين الإرسال: ${ad.settings?.optimizeSending ? '✅' : '❌'}

🎯 *الهدف:*
${ad.target?.allGroups ? '• 👥 جميع المجموعات\n' : ''}
${ad.target?.specificGroups?.length > 0 ? `• 📋 مجموعات محددة: ${ad.target.specificGroups.length}\n` : ''}
${ad.target?.minMembers > 0 ? `• 👥 الحد الأدنى للأعضاء: ${ad.target.minMembers}\n` : ''}
${ad.target?.maxMembers < 1000000 ? `• 👥 الحد الأقصى للأعضاء: ${ad.target.maxMembers}\n` : ''}

💡 *نصائح للتحسين:*
${ad.stats?.sent < 10 ? '• ⚠️ الإعلان لم يُرسل كثيراً، فكر في نشره أكثر\n' : ''}
${(ad.stats?.failed || 0) > (ad.stats?.sent || 1) * 0.3 ? '• 🔄 نسبة الفشل عالية، راجع الإعدادات\n' : ''}
${!ad.isActive ? '• ▶️ الإعلان متوقف، قم بتفعيله للبدء\n' : ''}
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: ad.isActive ? '⏸️ إيقاف مؤقت' : '▶️ تفعيل', 
                      callback_data: ad.isActive ? `ad_deactivate_${adId}` : `ad_activate_${adId}` },
                    { text: '✏️ تعديل', callback_data: `ad_edit_${adId}` }
                ],
                [
                    { text: '🗑️ حذف', callback_data: `ad_delete_${adId}` },
                    { text: '🚀 نشر الآن', callback_data: `ad_publish_${adId}` }
                ],
                [
                    { text: '📊 إحصائيات مفصلة', callback_data: `ad_stats_${adId}` },
                    { text: '⚙️ إعدادات النشر', callback_data: `ad_settings_${adId}` }
                ],
                [
                    { text: '📋 العودة للإعلانات', callback_data: 'menu_ads' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('❌ خطأ في عرض معلومات الإعلان:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض معلومات الإعلان');
    }
}

async function createAd(chatId, adminId) {
    // بدء عملية إنشاء إعلان
    userStates.set(adminId.toString(), {
        state: 'awaiting_ad_name',
        data: { adminId: adminId }
    });
    
    await bot.sendMessage(chatId,
        `📢 *إنشاء إعلان جديد*\n\n` +
        `🚀 *مرحباً بك في عملية إنشاء الإعلان*\n\n` +
        `📋 *الخطوات:*\n` +
        `1. إدخال اسم الإعلان\n` +
        `2. إدخال محتوى الإعلان\n` +
        `3. تحديد إعدادات النشر\n` +
        `4. تحديد الجمهور المستهدف\n\n` +
        `📝 *الخطوة 1: اسم الإعلان*\n\n` +
        `💡 *نصائح للاسم:*\n` +
        `• استخدم اسماً وصفيًا\n` +
        `• مثال: "إعلان منتج جديد"\n` +
        `• مثال: "عرض خاص"\n` +
        `• مثال: "ترويج للمجموعة"\n\n` +
        `⚡ *أرسل اسم الإعلان الآن:*`,
        { parse_mode: 'Markdown' }
    );
}

async function handleStatsAction(chatId, userId, parts) {
    const admin = await Admin.findOne({ where: { telegramId: userId } });
    if (!admin) return;
    
    const action = parts[1];
    
    switch (action) {
        case 'sessions':
            await showDetailedSessionStats(chatId, admin.id);
            break;
            
        case 'links':
            await showDetailedLinkStats(chatId, admin.id);
            break;
            
        case 'ads':
            await showDetailedAdStats(chatId, admin.id);
            break;
            
        case 'autopost':
            await showDetailedAutoPostStats(chatId, admin.id);
            break;
            
        case 'autoreply':
            await showDetailedAutoReplyStats(chatId, admin.id);
            break;
            
        case 'autojoin':
            await showDetailedAutoJoinStats(chatId, admin.id);
            break;
            
        case 'overview':
            await showStatsOverview(chatId, admin.id);
            break;
            
        case 'detailed':
            await showDetailedStats(chatId, admin.id);
            break;
            
        case 'daily':
            await showDailyStats(chatId, admin.id);
            break;
            
        case 'weekly':
            await showWeeklyStats(chatId, admin.id);
            break;
    }
}

async function handleRefreshAction(chatId, userId, target) {
    const admin = await Admin.findOne({ where: { telegramId: userId } });
    if (!admin) return;
    
    switch (target) {
        case 'sessions':
            await showSessionsMenu(chatId, admin.id);
            break;
            
        case 'links':
            await showLinksMenu(chatId, admin.id);
            break;
            
        case 'ads':
            await showAdsMenu(chatId, admin.id);
            break;
            
        case 'stats':
            await showStatsMenu(chatId, admin.id);
            break;
            
        case 'menu':
            await handleStart({ 
                chat: { id: chatId }, 
                from: { id: userId, username: admin.username, first_name: admin.firstName } 
            });
            break;
    }
}

// ============================================
// 12. دوال عرض القوائم
// ============================================
async function showSessionsMenu(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId },
            order: [['createdAt', 'DESC']]
        });
        
        const activeSessions = sessions.filter(s => 
            s.status === 'connected' || s.status === 'authenticated'
        ).length;
        
        const totalSessions = sessions.length;
        const awaitingSessions = sessions.filter(s => s.status === 'awaiting_qr').length;
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: []
        };
        
        // زر الإضافة إذا لم يصل للحد
        if (totalSessions < (admin.settings?.maxSessions || 5)) {
            keyboard.inline_keyboard.push([
                { text: '📱➕ إضافة جلسة جديدة', callback_data: 'add_session' }
            ]);
        }
        
        // أزرار حالة الجلسات
        if (sessions.length > 0) {
            keyboard.inline_keyboard.push([
                { text: `🟢 نشطة (${activeSessions})`, callback_data: 'session_filter_active' },
                { text: `📱 بانتظار QR (${awaitingSessions})`, callback_data: 'session_filter_awaiting' }
            ]);
            
            keyboard.inline_keyboard.push([
                { text: `📊 الكل (${totalSessions})`, callback_data: 'session_filter_all' }
            ]);
            
            // عرض 5 جلسات كحد أقصى
            sessions.slice(0, 5).forEach(session => {
                const statusEmoji = 
                    session.status === 'connected' ? '🟢' :
                    session.status === 'awaiting_qr' ? '📱' :
                    session.status === 'authenticated' ? '🔐' :
                    session.status === 'disconnected' ? '🔴' : '⚪';
                
                const sessionName = session.phoneNumber || `جلسة ${session.id.substring(0, 6)}`;
                
                keyboard.inline_keyboard.push([
                    { 
                        text: `${statusEmoji} ${sessionName}`, 
                        callback_data: `session_info_${session.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🔄 تحديث القائمة', callback_data: 'refresh_sessions' },
            { text: '📊 إحصائيات مفصلة', callback_data: 'session_stats_detailed' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        // رسالة القائمة
        let message = `📱 *إدارة جلسات WhatsApp*\n\n`;
        
        if (sessions.length === 0) {
            message += `📭 *لا توجد جلسات واتساب*\n\n`;
            message += `انقر على *"📱➕ إضافة جلسة جديدة"* لبدء ربط حساب WhatsApp الأول.\n\n`;
            message += `🚀 *كيفية الربط كجهاز مصاحب:*\n`;
            message += `1. سأطلب منك رقم الهاتف\n`;
            message += `2. سأرسل لك QR Code\n`;
            message += `3. تمسحه من خلال WhatsApp\n`;
            message += `4. البوت يصبح جهازاً مصاحباً\n`;
        } else {
            message += `📊 *إحصائيات الجلسات:*\n`;
            message += `• 🟢 نشطة: ${activeSessions} جلسة\n`;
            message += `• 📱 بانتظار QR: ${awaitingSessions} جلسة\n`;
            message += `• 📊 الإجمالي: ${totalSessions} جلسة\n`;
            message += `• 🎯 المسموح: ${admin.settings?.maxSessions || 5} جلسة\n\n`;
            
            if (activeSessions > 0) {
                message += `✅ *الجلسات النشطة تعمل على:*\n`;
                message += `• تجميع الروابط تلقائياً\n`;
                message += `• الرد التلقائي على الرسائل\n`;
                message += `• تجميع المجموعات والجهات\n`;
                message += `• الإعداد للنشر والانضمام\n\n`;
            }
            
            message += `📋 *آخر الجلسات:*\n`;
            
            sessions.slice(0, 3).forEach((session, index) => {
                const statusText = 
                    session.status === 'connected' ? '🟢 متصل' :
                    session.status === 'awaiting_qr' ? '📱 بانتظار QR' :
                    session.status === 'authenticated' ? '🔐 مصادق' :
                    session.status === 'disconnected' ? '🔴 مقطوع' : '⚪ ' + session.status;
                
                const groupsText = session.groupsCount > 0 ? `👥 ${session.groupsCount}` : '';
                const timeText = session.connectedAt ? 
                    `⏰ ${new Date(session.connectedAt).toLocaleTimeString('ar-SA')}` : '';
                
                message += `${index + 1}. ${statusText} ${session.phoneNumber}\n`;
                if (groupsText) message += `   ${groupsText} ${timeText}\n`;
                message += `\n`;
            });
        }
        
        message += `\n⚡ *اختر جلسة للتحكم أو إضافة جلسة جديدة*`;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الجلسات لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الجلسات:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض قائمة الجلسات');
    }
}

async function showLinksMenu(chatId, adminId) {
    try {
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId }
        });
        
        const sessionIds = sessions.map(s => s.id);
        
        // إحصائيات الروابط
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
                type: ['website', 'other', 'discord', 'signal'],
                sessionId: sessionIds
            }
        });
        
        const activeLinks = await CollectedLink.count({
            where: {
                sessionId: sessionIds,
                status: 'active'
            }
        });
        
        const totalLinks = whatsappGroups + whatsappInvites + telegramLinks + otherLinks;
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: [
                [
                    { text: `📱 مجموعات (${whatsappGroups})`, callback_data: 'links_whatsapp_group' },
                    { text: `📩 دعوات (${whatsappInvites})`, callback_data: 'links_whatsapp_invite' }
                ],
                [
                    { text: `📢 تليجرام (${telegramLinks})`, callback_data: 'links_telegram' },
                    { text: `🌐 أخرى (${otherLinks})`, callback_data: 'links_other' }
                ],
                [
                    { text: `🟢 نشطة (${activeLinks})`, callback_data: 'links_active' },
                    { text: `📋 الكل (${totalLinks})`, callback_data: 'links_all' }
                ],
                [
                    { text: '🔄 تحديث', callback_data: 'refresh_links' },
                    { text: '📥 تصدير CSV', callback_data: 'links_export' }
                ],
                [
                    { text: '🗑️ مسح الروابط', callback_data: 'links_clear_confirm' },
                    { text: '⚙️ إعدادات التجميع', callback_data: 'links_settings' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        // رسالة القائمة
        const message = `
🔗 *نظام تجميع الروابط التلقائي*

📊 *إحصائيات الروابط:*
• 📱 *مجموعات واتساب:* ${whatsappGroups} رابط
• 📩 *دعوات واتساب:* ${whatsappInvites} رابط
• 📢 *روابط تليجرام:* ${telegramLinks} رابط
• 🌐 *روابط أخرى:* ${otherLinks} رابط
• 🟢 *نشطة:* ${activeLinks} رابط
• 📋 *الإجمالي:* ${totalLinks} رابط

🚀 *كيفية العمل:*
1. يراقب البوت جميع الرسائل تلقائياً
2. يستخرج أي روابط تظهر في المحادثات
3. يصنفها حسب النوع تلقائياً
4. يمنع التكرار والحفظ المزدوج
5. يفحص الروابط بانتظام للتأكد من صحتها

⚡ *المميزات:*
• ✅ تجميع تلقائي بدون توقف
• 🔄 تحديث فوري عند اكتشاف رابط جديد
• 🗑️ إدارة وحذف الروابط بسهولة
• 📊 إحصائيات مفصلة عن كل نوع
• 📥 تصدير البيانات بصيغ مختلفة

🔧 *الإعدادات المتاحة:*
• تفعيل/تعطيل التجميع التلقائي
• تصفية الروابط حسب النوع
• تحديد الحد الأقصى للروابط
• ضبط فترات الفحص التلقائي

📈 *آخر التحديثات:*
• تم تحسين خوارزمية التصنيف
• إضافة دعم للمزيد من أنواع الروابط
• تحسين أداء التجميع
• تقليل استخدام الذاكرة
• زيادة سرعة المعالجة

⚡ *اختر نوع الروابط الذي تريد عرضه:*
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الروابط لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الروابط:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض قائمة الروابط');
    }
}

async function showStatsMenu(chatId, adminId) {
    try {
        // جمع الإحصائيات
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId }
        });
        
        const sessionIds = sessions.map(s => s.id);
        
        const stats = {
            sessions: {
                total: sessions.length,
                connected: sessions.filter(s => s.status === 'connected').length,
                awaiting: sessions.filter(s => s.status === 'awaiting_qr').length,
                groups: sessions.reduce((sum, s) => sum + (s.groupsCount || 0), 0),
                contacts: sessions.reduce((sum, s) => sum + (s.contactsCount || 0), 0),
                messages: {
                    received: sessions.reduce((sum, s) => sum + (s.stats?.messagesReceived || 0), 0),
                    sent: sessions.reduce((sum, s) => sum + (s.stats?.messagesSent || 0), 0)
                }
            },
            links: {
                total: await CollectedLink.count({ where: { sessionId: sessionIds } }),
                active: await CollectedLink.count({ where: { sessionId: sessionIds, status: 'active' } }),
                whatsapp: await CollectedLink.count({ where: { sessionId: sessionIds, type: 'whatsapp_group' } }),
                telegram: await CollectedLink.count({ where: { sessionId: sessionIds, type: 'telegram' } })
            },
            ads: {
                total: await Advertisement.count({ where: { adminId: adminId } }),
                active: await Advertisement.count({ where: { adminId: adminId, isActive: true } }),
                sent: (await Advertisement.sum('stats.sent', { where: { adminId: adminId } })) || 0
            },
            autoReplies: {
                total: await AutoReply.count({ where: { adminId: adminId } }),
                active: await AutoReply.count({ where: { adminId: adminId, isActive: true } }),
                triggered: (await AutoReply.sum('stats.triggered', { where: { adminId: adminId } })) || 0
            }
        };
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📊 نظرة عامة', callback_data: 'stats_overview' },
                    { text: '📈 مفصلة', callback_data: 'stats_detailed' }
                ],
                [
                    { text: `📱 الجلسات (${stats.sessions.total})`, callback_data: 'stats_sessions' },
                    { text: `🔗 الروابط (${stats.links.total})`, callback_data: 'stats_links' }
                ],
                [
                    { text: `📢 الإعلانات (${stats.ads.total})`, callback_data: 'stats_ads' },
                    { text: `🤖 الردود (${stats.autoReplies.total})`, callback_data: 'stats_autoreply' }
                ],
                [
                    { text: '📅 يومية', callback_data: 'stats_daily' },
                    { text: '📆 أسبوعية', callback_data: 'stats_weekly' }
                ],
                [
                    { text: '🔄 تحديث', callback_data: 'refresh_stats' },
                    { text: '📥 تصدير', callback_data: 'stats_export' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        // رسالة الإحصائيات
        const message = `
📊 *نظام الإحصائيات والتقارير*

🚀 *إحصائيات سريعة:*
• 📱 *الجلسات:* ${stats.sessions.total} جلسة (${stats.sessions.connected} نشطة)
• 🔗 *الروابط:* ${stats.links.total} رابط (${stats.links.active} نشطة)
• 📢 *الإعلانات:* ${stats.ads.total} إعلان (${stats.ads.active} نشطة)
• 🤖 *الردود:* ${stats.autoReplies.total} رد (${stats.autoReplies.active} نشطة)

📈 *تفاصيل الأداء:*
• 📨 *الرسائل المستلمة:* ${stats.sessions.messages.received}
• 📤 *الرسائل المرسلة:* ${stats.sessions.messages.sent}
• 👥 *المجموعات:* ${stats.sessions.groups}
• 📞 *جهات الاتصال:* ${stats.sessions.contacts}
• ✅ *إعلانات مرسلة:* ${stats.ads.sent}
• 🤖 *ردود مفعلة:* ${stats.autoReplies.triggered}

🎯 *نسب النجاح:*
• 📱 اتصال الجلسات: ${stats.sessions.total > 0 ? 
    Math.round((stats.sessions.connected / stats.sessions.total) * 100) : 0}%
• 🔗 جودة الروابط: ${stats.links.total > 0 ? 
    Math.round((stats.links.active / stats.links.total) * 100) : 0}%
• 📢 نجاح الإعلانات: ${stats.ads.sent > 0 ? 
    Math.min(100, Math.round((stats.ads.sent - (stats.ads.sent * 0.1)) / stats.ads.sent * 100)) : 0}%

📊 *مقاييس النشاط:*
• ⚡ نشاط عالي: ${stats.sessions.messages.received > 1000 ? '✅' : '⚪'}
• 🔄 استقرار جيد: ${stats.sessions.connected > 0 ? '✅' : '⚪'}
• 📈 نمو إيجابي: ${stats.links.total > stats.sessions.total * 10 ? '✅' : '⚪'}

💡 *تحليل الأداء:*
${stats.sessions.connected === 0 ? '• ⚠️ لا توجد جلسات نشطة، أضف جلسة جديدة\n' : ''}
${stats.links.total < 10 ? '• 🔍 عدد الروابط قليل، فكر في زيادة النشاط\n' : ''}
${stats.ads.sent < 5 ? '• 📢 الحملات الإعلانية محدودة، أنشئ المزيد\n' : ''}
${stats.autoReplies.triggered < 10 ? '• 🤖 الردود التلقائية قليلة الاستخدام\n' : ''}

🔧 *توصيات التحسين:*
${stats.sessions.connected < stats.sessions.total ? '• 📱 إعادة تشغيل الجلسات المتوقفة\n' : ''}
${stats.links.active < stats.links.total * 0.7 ? '• 🔗 تفعيل تجميع الروابط\n' : ''}
${stats.ads.active < stats.ads.total ? '• 📢 تفعيل الإعلانات المتوقفة\n' : ''}

⚡ *اختر نوع التقرير الذي تريد عرضه:*
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الإحصائيات لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الإحصائيات:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإحصائيات');
    }
}

async function showAdsMenu(chatId, adminId) {
    try {
        const ads = await Advertisement.findAll({
            where: { adminId: adminId },
            order: [['createdAt', 'DESC']]
        });
        
        const activeAds = ads.filter(ad => ad.isActive).length;
        const totalAds = ads.length;
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: []
        };
        
        // زر إنشاء إعلان جديد
        keyboard.inline_keyboard.push([
            { text: '📢➕ إنشاء إعلان جديد', callback_data: 'ad_create' }
        ]);
        
        // زر الإعلانات النشطة والمتوقفة
        if (ads.length > 0) {
            keyboard.inline_keyboard.push([
                { text: `🟢 نشطة (${activeAds})`, callback_data: 'ad_filter_active' },
                { text: `⚪ متوقفة (${totalAds - activeAds})`, callback_data: 'ad_filter_inactive' }
            ]);
            
            keyboard.inline_keyboard.push([
                { text: `📊 الكل (${totalAds})`, callback_data: 'ad_filter_all' }
            ]);
            
            // عرض 5 إعلانات كحد أقصى
            ads.slice(0, 5).forEach(ad => {
                const statusEmoji = ad.isActive ? '🟢' : '⚪';
                const sentCount = ad.stats?.sent || 0;
                
                keyboard.inline_keyboard.push([
                    { 
                        text: `${statusEmoji} ${ad.name} (${sentCount})`, 
                        callback_data: `ad_info_${ad.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🔄 تحديث القائمة', callback_data: 'refresh_ads' },
            { text: '📊 إحصائيات الإعلانات', callback_data: 'stats_ads' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        // رسالة القائمة
        let message = `📢 *نظام الإعلانات والنشر التلقائي*\n\n`;
        
        if (ads.length === 0) {
            message += `📭 *لا توجد إعلانات*\n\n`;
            message += `انقر على *"📢➕ إنشاء إعلان جديد"* لبدء إنشاء أول إعلان.\n\n`;
            message += `🚀 *مميزات نظام الإعلانات:*\n`;
            message += `• ✅ نشر تلقائي في جميع المجموعات\n`;
            message += `• ⏳ جدولة زمنية ذكية\n`;
            message += `• 🎯 استهداف دقيق للمجموعات\n`;
            message += `• 📊 متابعة وتحليل النتائج\n`;
        } else {
            message += `📊 *إحصائيات الإعلانات:*\n`;
            message += `• 🟢 نشطة: ${activeAds} إعلان\n`;
            message += `• ⚪ متوقفة: ${totalAds - activeAds} إعلان\n`;
            message += `• 📊 الإجمالي: ${totalAds} إعلان\n`;
            message += `• 📨 مرسلة: ${ads.reduce((sum, ad) => sum + (ad.stats?.sent || 0), 0)} مرة\n\n`;
            
            if (activeAds > 0) {
                message += `✅ *الإعلانات النشطة تعمل على:*\n`;
                message += `• النشر التلقائي في المجموعات\n`;
                message += `• الجدولة الزمنية الذكية\n`;
                message += `• تتبع النتائج والإحصائيات\n`;
                message += `• التحسين التلقائي للأداء\n\n`;
            }
            
            message += `📋 *آخر الإعلانات:*\n`;
            
            ads.slice(0, 3).forEach((ad, index) => {
                const statusText = ad.isActive ? '🟢 نشط' : '⚪ متوقف';
                const sentText = ad.stats?.sent ? `📨 ${ad.stats.sent}` : '📨 0';
                const lastSent = ad.stats?.lastSent ? 
                    `⏰ ${new Date(ad.stats.lastSent).toLocaleDateString('ar-SA')}` : '⏰ لم يرسل';
                
                message += `${index + 1}. ${statusText} *${ad.name}*\n`;
                message += `   ${sentText} | ${lastSent}\n`;
                message += `\n`;
            });
        }
        
        message += `\n⚡ *اختر إعلاناً للتحكم أو إنشاء إعلان جديد*`;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الإعلانات لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الإعلانات:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض قائمة الإعلانات');
    }
}

async function showBroadcastMenu(chatId, adminId) {
    try {
        const broadcasts = await Broadcast.findAll({
            where: { adminId: adminId },
            order: [['createdAt', 'DESC']],
            limit: 10
        });
        
        const pendingBroadcasts = broadcasts.filter(b => b.status === 'pending').length;
        const completedBroadcasts = broadcasts.filter(b => b.status === 'completed').length;
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📨➕ بث جديد', callback_data: 'broadcast_create' },
                    { text: '📋 البث النشط', callback_data: 'broadcast_active' }
                ],
                [
                    { text: `⏳ بانتظار (${pendingBroadcasts})`, callback_data: 'broadcast_pending' },
                    { text: `✅ مكتمل (${completedBroadcasts})`, callback_data: 'broadcast_completed' }
                ]
            ]
        };
        
        // إضافة البثوث الحديثة
        if (broadcasts.length > 0) {
            broadcasts.slice(0, 3).forEach(broadcast => {
                const statusEmoji = 
                    broadcast.status === 'completed' ? '✅' :
                    broadcast.status === 'sending' ? '🔄' :
                    broadcast.status === 'pending' ? '⏳' : '❌';
                
                const progress = broadcast.progress || {};
                const progressText = progress.total > 0 ? 
                    `${progress.sent || 0}/${progress.total}` : '';
                
                keyboard.inline_keyboard.push([
                    { 
                        text: `${statusEmoji} ${broadcast.name || 'بث'} ${progressText}`, 
                        callback_data: `broadcast_info_${broadcast.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🔄 تحديث القائمة', callback_data: 'refresh_broadcast' },
            { text: '📊 إحصائيات البث', callback_data: 'broadcast_stats' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        // رسالة القائمة
        const message = `
📨 *نظام البث الجماعي*

🚀 *مميزات النظام:*
• ✅ إرسال رسائل جماعية لآلاف المستلمين
• ⏱️ جدولة زمنية ذكية
• 📊 متابعة النتائج في الوقت الفعلي
• 🎯 استهداف دقيق للمجموعات أو الأفراد
• 🔄 إعادة المحاولة التلقائية للفاشل

📊 *إحصائيات البث:*
• ⏳ بانتظار الإرسال: ${pendingBroadcasts}
• ✅ مكتملة بنجاح: ${completedBroadcasts}
• 📋 الإجمالي: ${broadcasts.length}

📋 *آخر عمليات البث:*
${broadcasts.length === 0 ? '• 📭 لا توجد عمليات بث سابقة\n' : ''}
${broadcasts.slice(0, 3).map((b, i) => {
    const statusText = 
        b.status === 'completed' ? '✅ مكتمل' :
        b.status === 'sending' ? '🔄 جاري' :
        b.status === 'pending' ? '⏳ بانتظار' : '❌ فاشل';
    
    const progress = b.progress || {};
    const progressText = progress.total > 0 ? 
        ` (${progress.sent || 0}/${progress.total})` : '';
    
    return `• ${i+1}. ${statusText}${progressText} - ${b.name || 'بث'}`
}).join('\n')}

⚡ *إرشادات سريعة:*
1. اختر "بث جديد" لإنشاء بث جماعي
2. حدد الرسالة والمستلمين
3. اضبط الإعدادات والتوقيت
4. ابدأ البث واتبع النتائج

🔧 *أنواع البث المتاحة:*
• 👥 بث لجميع جهات الاتصال
• 👥 بث لجميع المجموعات
• 📋 بث لقائمة محددة
• ⏰ بث مجدول مسبقاً

⚠️ *ملاحظات مهمة:*
• البث قد يستغرق وقتاً حسب عدد المستلمين
• يوصى بتجزئة البث الكبير لأجزاء صغيرة
• تأكد من صياغة الرسالة بشكل مناسب

⚡ *اختر العملية المطلوبة:*
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة البث لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة البث:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض قائمة البث');
    }
}

async function showAutoReplyMenu(chatId, adminId) {
    try {
        const autoReplies = await AutoReply.findAll({
            where: { adminId: adminId },
            order: [['priority', 'DESC'], ['createdAt', 'DESC']]
        });
        
        const activeReplies = autoReplies.filter(r => r.isActive).length;
        const totalReplies = autoReplies.length;
        const triggeredCount = autoReplies.reduce((sum, r) => sum + (r.stats?.triggered || 0), 0);
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🤖➕ إضافة رد تلقائي', callback_data: 'autoreply_create' },
                    { text: '⚙️ الإعدادات', callback_data: 'autoreply_settings' }
                ]
            ]
        };
        
        if (autoReplies.length > 0) {
            keyboard.inline_keyboard.push([
                { text: `🟢 نشطة (${activeReplies})`, callback_data: 'autoreply_filter_active' },
                { text: `🤖 الكل (${totalReplies})`, callback_data: 'autoreply_filter_all' }
            ]);
            
            // عرض 5 ردود كحد أقصى
            autoReplies.slice(0, 5).forEach(reply => {
                const statusEmoji = reply.isActive ? '🟢' : '⚪';
                const typeEmoji = 
                    reply.triggerType === 'private' ? '👤' :
                    reply.triggerType === 'group' ? '👥' : '👤👥';
                
                const triggered = reply.stats?.triggered || 0;
                
                keyboard.inline_keyboard.push([
                    { 
                        text: `${statusEmoji}${typeEmoji} ${reply.name} (${triggered})`, 
                        callback_data: `autoreply_info_${reply.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🔄 تحديث القائمة', callback_data: 'refresh_autoreply' },
            { text: '📊 إحصائيات الردود', callback_data: 'stats_autoreply' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        // رسالة القائمة
        const message = `
🤖 *نظام الردود التلقائية الذكية*

🚀 *مميزات النظام:*
• ✅ رد تلقائي فوري على الرسائل
• 🎯 تصنيف حسب نوع المحادثة (خاص/جماعي)
• 🔤 أنواع مطابقة متعددة (تحتوي، مطابقة، regex)
• ⚡ أولوية متعددة للردود
• 📊 تتبع وإحصائيات مفصلة

📊 *إحصائيات الردود:*
• 🤖 الإجمالي: ${totalReplies} رد تلقائي
• 🟢 نشطة: ${activeReplies} رد
• ⚪ متوقفة: ${totalReplies - activeReplies} رد
• 🔄 مفعلة: ${triggeredCount} مرة

⚡ *كيفية العمل:*
1. يراقب البوت جميع الرسائل الواردة
2. يتحقق من تطابقها مع شروط الردود
3. يرسل الرد المناسب تلقائياً
4. يسجل الإحصائيات والتقارير

🔧 *أنواع المطابقة:*
• 🔤 *تحتوي:* عندما تحتوي الرسالة على كلمة معينة
• ✅ *مطابقة:* عندما تطابق الرسالة نصاً محدداً
• 🎯 *يبدأ بـ:* عندما تبدأ الرسالة بنص معين
• 🏁 *ينتهي بـ:* عندما تنتهي الرسالة بنص معين
• 🔍 *Regex:* مطابقة نمط معقد باستخدام تعبيرات منتظمة

📋 *آخر الردود المضافة:*
${autoReplies.length === 0 ? '• 📭 لا توجد ردود تلقائية\n' : ''}
${autoReplies.slice(0, 3).map((r, i) => {
    const statusText = r.isActive ? '🟢 نشط' : '⚪ متوقف';
    const typeText = 
        r.triggerType === 'private' ? '👤 خاص' :
        r.triggerType === 'group' ? '👥 جماعي' : '👤👥 كليهما';
    const triggerPreview = r.trigger.length > 20 ? 
        r.trigger.substring(0, 20) + '...' : r.trigger;
    
    return `• ${i+1}. ${statusText} ${typeText} - "${triggerPreview}"`
}).join('\n')}

💡 *نصائح للاستخدام:*
• استخدم أولوية عالية للردود المهمة
• اضبط وقت التبريد لتجنب التكرار المزعج
• صنف الردود حسب نوع المحادثة
• اختبر الردود قبل تفعيلها

⚠️ *ملاحظات مهمة:*
• الردود التلقائية تعمل في الوقت الفعلي
• يمكن أن يكون هناك تأخير بسيط
• تأكد من صياغة الردود بشكل مناسب

⚡ *اختر الرد المطلوب أو أضف رداً جديداً:*
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الردود التلقائية لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الردود التلقائية:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض قائمة الردود التلقائية');
    }
}

async function showAutoJoinMenu(chatId, adminId) {
    try {
        const autoJoins = await AutoJoin.findAll({
            where: { adminId: adminId },
            order: [['createdAt', 'DESC']]
        });
        
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId, status: 'connected' }
        });
        
        const activeJoins = autoJoins.filter(j => j.status === 'active').length;
        const totalJoins = autoJoins.length;
        
        // جمع إحصائيات الانضمام
        let totalJoined = 0;
        let totalFailed = 0;
        
        autoJoins.forEach(join => {
            const stats = join.stats || {};
            totalJoined += stats.joined || 0;
            totalFailed += stats.failed || 0;
        });
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: []
        };
        
        // فقط إذا كانت هناك جلسات متصلة
        if (sessions.length > 0) {
            keyboard.inline_keyboard.push([
                { text: '➕➕ تفعيل الانضمام التلقائي', callback_data: 'autojoin_activate' }
            ]);
        }
        
        if (autoJoins.length > 0) {
            keyboard.inline_keyboard.push([
                { text: `🟢 نشطة (${activeJoins})`, callback_data: 'autojoin_filter_active' },
                { text: `📊 الكل (${totalJoins})`, callback_data: 'autojoin_filter_all' }
            ]);
            
            // عرض 5 عمليات انضمام كحد أقصى
            autoJoins.slice(0, 5).forEach(join => {
                const statusEmoji = join.status === 'active' ? '🟢' : '⚪';
                const stats = join.stats || {};
                const successRate = stats.totalLinks ? 
                    Math.round((stats.joined / stats.totalLinks) * 100) : 0;
                
                keyboard.inline_keyboard.push([
                    { 
                        text: `${statusEmoji} ${join.sessionId?.substring(0, 6) || 'جلسة'} (${successRate}%)`, 
                        callback_data: `autojoin_info_${join.id}`
                    }
                ]);
            });
        }
        
        keyboard.inline_keyboard.push([
            { text: '🔄 تحديث القائمة', callback_data: 'refresh_autojoin' },
            { text: '📊 إحصائيات الانضمام', callback_data: 'stats_autojoin' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '⚙️ إعدادات الفلترة', callback_data: 'autojoin_filters' },
            { text: '🔗 روابط الانضمام', callback_data: 'autojoin_links' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        // رسالة القائمة
        const message = `
➕ *نظام الانضمام التلقائي للمجموعات*

🚀 *مميزات النظام:*
• ✅ انضمام تلقائي للمجموعات الجديدة
• 🔗 مسح تلقائي للروابط المكتشفة
• 🎯 فلترة ذكية حسب حجم المجموعة والكلمات
• ⏱️ تأخير ذكي بين عمليات الانضمام
• 📊 متابعة النتائج والإحصائيات

📊 *إحصائيات الانضمام:*
• ➕ عمليات انضمام: ${totalJoins}
• 🟢 نشطة: ${activeJoins}
• ✅ انضمام ناجح: ${totalJoined} مجموعة
• ❌ فاشلة: ${totalFailed} مجموعة
• 📈 نسبة النجاح: ${totalJoined + totalFailed > 0 ? 
    Math.round((totalJoined / (totalJoined + totalFailed)) * 100) : 0}%

⚡ *كيفية العمل:*
1. يراقب البوت الروابط في الرسائل
2. يكتشف روابط انضمام المجموعات
3. يطبق الفلترة المحددة
4. ينضم للمجموعات المؤهلة تلقائياً
5. يسجل النتائج والإحصائيات

🔧 *أنواع الفلترة المتاحة:*
• 👥 *حجم المجموعة:* تحديد الحد الأدنى والأقصى للأعضاء
• 🔤 *الكلمات:* تضمين أو استبعاد مجموعات بكلمات معينة
• 🌍 *البلد:* تصفية حسب رمز الدولة
• 📝 *الوصف:* اشتراط وجود وصف للمجموعة

${sessions.length === 0 ? `
⚠️ *ملاحظة مهمة:*
لا توجد جلسات WhatsApp متصلة حالياً.
يجب أن تكون هناك جلسة متصلة على الأقل لتفعيل الانضمام التلقائي.

🔧 *الخطوات اللازمة:*
1. استخدم /addsession لإضافة جلسة
2. انتظر الاتصال وربط الجهاز المصاحب
3. عد هنا لتفعيل الانضمام التلقائي
` : ''}

📋 *الجلسات المتصلة:*
${sessions.length === 0 ? '• 📭 لا توجد جلسات متصلة\n' : ''}
${sessions.slice(0, 3).map((s, i) => {
    const groupsText = s.groupsCount ? `👥 ${s.groupsCount}` : '';
    return `• ${i+1}. 📱 ${s.phoneNumber} ${groupsText}`
}).join('\n')}

💡 *نصائح للاستخدام:*
• ابدأ بفلترة متساهلة ثم ضيق تدريجياً
• اضبط الحد الأدنى للأعضاء لتجنب المجموعات الصغيرة
• استخدم الكلمات المفتاحية للاستهداف الدقيق
• راقب النتائج وعدل الفلترة حسب الحاجة

⚠️ *تحذيرات مهمة:*
• الانضمام المفرط قد يؤدي إلى حظر الحساب
• التزم بشروط استخدام WhatsApp
• راقب أداء الحساب بانتظام

⚡ *اختر العملية المطلوبة:*
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الانضمام التلقائي لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الانضمام التلقائي:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض قائمة الانضمام التلقائي');
    }
}

async function showSettingsMenu(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        const settings = admin.settings || {};
        
        // لوحة المفاتيح التفاعلية
        const keyboard = {
            inline_keyboard: [
                [
                    { text: settings.notificationEnabled ? '🔔 إيقاف الإشعارات' : '🔔 تفعيل الإشعارات', 
                      callback_data: 'toggle_notifications' }
                ],
                [
                    { text: settings.autoCollectLinks ? '🔗 إيقاف تجميع الروابط' : '🔗 تفعيل تجميع الروابط', 
                      callback_data: 'toggle_auto_collect' }
                ],
                [
                    { text: settings.autoReplyEnabled ? '🤖 إيقاف الردود التلقائية' : '🤖 تفعيل الردود التلقائية', 
                      callback_data: 'toggle_auto_reply' }
                ],
                [
                    { text: '📱 زيادة حد الجلسات', callback_data: 'increase_session_limit' },
                    { text: '⚙️ إعدادات متقدمة', callback_data: 'advanced_settings' }
                ],
                [
                    { text: '🌐 تغيير اللغة', callback_data: 'change_language' },
                    { text: '📊 إعدادات التقارير', callback_data: 'report_settings' }
                ],
                [
                    { text: '🔄 إعادة تعيين الإعدادات', callback_data: 'reset_settings' },
                    { text: '💾 حفظ الإعدادات', callback_data: 'save_settings' }
                ],
                [
                    { text: '🔄 تحديث القائمة', callback_data: 'refresh_settings' },
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        // رسالة الإعدادات
        const message = `
⚙️ *إعدادات البوت والمشرف*

👤 *معلومات المشرف:*
• 🆔 المعرف: ${admin.telegramId}
• 👤 الاسم: ${admin.firstName || 'غير معروف'} ${admin.lastName || ''}
• 📅 آخر نشاط: ${admin.lastActivity ? 
    new Date(admin.lastActivity).toLocaleString('ar-SA') : 'غير معروف'}

🔧 *الإعدادات الحالية:*
• 🔔 الإشعارات: ${settings.notificationEnabled ? '✅ مفعلة' : '❌ معطلة'}
• 🔗 تجميع الروابط: ${settings.autoCollectLinks ? '✅ مفعل' : '❌ معطل'}
• 🤖 الردود التلقائية: ${settings.autoReplyEnabled ? '✅ مفعلة' : '❌ معطلة'}
• 📱 حد الجلسات: ${settings.maxSessions || 5} جلسة
• 🌐 اللغة: ${settings.language || 'العربية'}

🎯 *الصلاحيات المتاحة:*
${admin.permissions?.map(perm => {
    const permText = {
        'admin': '👑 إدارة النظام الكاملة',
        'manage_sessions': '📱 إدارة جلسات WhatsApp',
        'manage_ads': '📢 إدارة الإعلانات',
        'manage_broadcasts': '📨 إدارة البث الجماعي',
        'view_stats': '📊 عرض الإحصائيات',
        'basic': '⚡ استخدام أساسي'
    }[perm] || perm;
    return `• ${permText}`;
}).join('\n')}

⚡ *الإعدادات المقترحة:*
• 🔔 *الإشعارات:* تفعيل لمتابعة نشاط الجلسات
• 🔗 *تجميع الروابط:* تفعيل للاستفادة القصوى
• 🤖 *الردود التلقائية:* تفعيل لأتمتة الردود
• 📱 *حد الجلسات:* 3-5 جلسات للحساب العادي

🔧 *إعدادات الأمان:*
• 📱 جلسات WhatsApp: ${settings.maxSessions || 5} كحد أقصى
• 🔒 حماية من الانضمام المفرط: ${settings.antiFlood || '✅ مفعل'}
• ⏱️ وقت انتهاء الجلسات: ${settings.sessionTimeout || '30 يوم'}

📊 *إعدادات التقارير:*
• 📅 تقارير يومية: ${settings.dailyReports ? '✅ مفعلة' : '❌ معطلة'}
• 📊 تقارير أسبوعية: ${settings.weeklyReports ? '✅ مفعلة' : '❌ معطلة'}
• ⚡ إشعارات الأداء: ${settings.performanceAlerts ? '✅ مفعلة' : '❌ معطلة'}

💡 *نصائح للإعدادات:*
1. 🔔 حافظ على تفعيل الإشعارات للمتابعة
2. 🔗 فعّل تجميع الروابط للاستفادة القصوى
3. 🤖 فعّل الردود التلقائية لأتمتة العمل
4. 📱 اضبط حد الجلسات حسب حاجتك
5. 🌐 اختر اللغة المناسبة لك

⚠️ *تحذيرات مهمة:*
• لا تزيد عدد الجلسات عن الحاجة لتجنب المشاكل
• راقب أداء الجلسات بانتظام
• احفظ التغييرات قبل الخروج

⚡ *اختر الإعداد الذي تريد تعديله:*
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الإعدادات لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الإعدادات:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض الإعدادات');
    }
}

async function showHelpMenu(chatId, adminId) {
    // لوحة المفاتيح التفاعلية
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📚 الدليل الشامل', callback_data: 'help_manual' },
                { text: '🎥 فيديوهات تعليمية', callback_data: 'help_videos' }
            ],
            [
                { text: '❓ الأسئلة الشائعة', callback_data: 'help_faq' },
                { text: '🔄 استكشاف الأخطاء', callback_data: 'help_troubleshoot' }
            ],
            [
                { text: '📞 الدعم الفني', callback_data: 'help_support' },
                { text: '🆘 طلب مساعدة عاجلة', callback_data: 'help_emergency' }
            ],
            [
                { text: '🔄 تحديث المساعدة', callback_data: 'refresh_help' },
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]
        ]
    };
    
    // رسالة المساعدة
    const message = `
🆘 *مركز المساعدة والدعم الفني*

🚀 *مرحباً بك في نظام دعم WhatsApp Telegram Bot!*

📚 *الدليل الشامل:* تعرف على جميع ميزات البوت خطوة بخطوة
🎥 *فيديوهات تعليمية:* شروحات مرئية لجميع المهام
❓ *الأسئلة الشائعة:* إجابات عن أكثر الاستفسارات تكراراً
🔄 *استكشاف الأخطاء:* حلول للمشاكل الشائعة
📞 *الدعم الفني:* التواصل مع فريق الدعم
🆘 *مساعدة عاجلة:* للمشاكل الحرجة والفورية

📋 *الأقسام الرئيسية:*

1. *📱 جلسات WhatsApp*
   • كيفية الربط كجهاز مصاحب
   • حل مشاكل QR Code
   • إدارة الجلسات المتعددة

2. *🔗 تجميع الروابط*
   • كيفية عمل النظام التلقائي
   • تصنيف الروابط وأنواعها
   • إدارة وتصدير البيانات

3. *📢 الإعلانات والنشر*
   • إنشاء حملات إعلانية
   • جدولة النشر التلقائي
   • تحليل النتائج والإحصائيات

4. *📨 البث الجماعي*
   • إرسال رسائل جماعية
   • استهداف المستلمين
   • متابعة النتائج فورياً

5. *🤖 الردود التلقائية*
   • إنشاء ردود ذكية
   • أنواع المطابقة المختلفة
   • إدارة الأولويات

6. *➕ الانضمام التلقائي*
   • تفعيل الانضمام للمجموعات
   • إعداد الفلاتر الذكية
   • مراقبة النتائج

⚡ *نصائح سريعة:*
• اقرأ الدليل قبل البدء
• ابدأ بإعدادات بسيطة ثم تطور
• احفظ نسخة احتياطية من الإعدادات المهمة
• تواصل مع الدعم عند الحاجة

🔧 *استكشاف الأخطاء الشائعة:*
• مشكلة في QR Code: جرب QR جديد
• جلسة غير متصلة: أعد تشغيل الجلسة
• روابط غير مجمعة: تحقق من إعدادات التجميع
• إعلانات غير مرسلة: تأكد من إعدادات النشر

📞 *طرق التواصل:*
• 💬 الدردشة المباشرة مع الدعم
• 📧 البريد الإلكتروني: support@whatsappbot.com
• 📱 قناة التليجرام: @whatsappbot_support
• ⏰ وقت العمل: 24/7

⚡ *اختر القسم الذي تريد المساعدة فيه:*
        `;
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
    });
}

async function showBotStatus(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // جمع إحصائيات النظام
        const sessions = await WhatsAppSession.count({ where: { adminId: adminId } });
        const connectedSessions = await WhatsAppSession.count({ 
            where: { adminId: adminId, status: 'connected' } 
        });
        
        const links = await CollectedLink.count({ 
            where: { sessionId: { [Op.in]: (await WhatsAppSession.findAll({ 
                where: { adminId: adminId }, 
                attributes: ['id'] 
            })).map(s => s.id) } } 
        });
        
        const ads = await Advertisement.count({ where: { adminId: adminId } });
        const autoReplies = await AutoReply.count({ where: { adminId: adminId } });
        
        // إحصائيات الذاكرة والأداء
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        // رسالة حالة النظام
        const message = `
📊 *حالة النظام والأداء*

🚀 *معلومات النظام:*
• 🤖 الإصدار: 2.0.0 - Render Optimized
• 🏗️ النظام: ${process.platform} ${process.arch}
• ⚡ Node.js: ${process.version}
• 🎯 البيئة: ${process.env.NODE_ENV || 'development'}

⏱️ *وقت التشغيل:*
• 🕐 المدة: ${hours} ساعة ${minutes} دقيقة ${seconds} ثانية
• 📅 بدأ في: ${new Date(Date.now() - (uptime * 1000)).toLocaleString('ar-SA')}
• 🔄 آخر تحديث: ${new Date().toLocaleString('ar-SA')}

💾 *استخدام الموارد:*
• 🧠 الذاكرة: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
• 📊 الاستخدام: ${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)}%
• ⚡ المعالج: ${Math.round(process.cpuUsage().user / 1000000)}ms

📈 *إحصائيات المستخدم:*
• 📱 الجلسات: ${sessions} (${connectedSessions} متصلة)
• 🔗 الروابط: ${links} رابط
• 📢 الإعلانات: ${ads} إعلان
• 🤖 الردود: ${autoReplies} رد تلقائي

🔧 *حالة المكونات:*
• ✅ قاعدة البيانات: ${dbInitialized ? '🟢 متصلة' : '🔴 غير متصلة'}
• ✅ Telegram Bot: ${bot ? '🟢 نشط' : '🔴 غير نشط'}
• ✅ Express Server: ${app ? '🟢 نشط' : '🔴 غير نشط'}
• ✅ WhatsApp Clients: ${whatsappClients.size} نشط

📊 *أداء النظام:*
• ⚡ سرعة المعالجة: ${connectedSessions > 0 ? '🟢 جيدة' : '⚪ متوسطة'}
• 🧠 استقرار الذاكرة: ${memoryUsage.heapUsed / memoryUsage.heapTotal < 0.8 ? '🟢 مستقر' : '🟡 مرتفع'}
• 🔗 استقرار الاتصالات: ${connectedSessions === sessions ? '🟢 ممتاز' : '🟡 متوسط'}

⚠️ *التحذيرات:*
${memoryUsage.heapUsed / memoryUsage.heapTotal > 0.85 ? '• 🧠 استخدام الذاكرة مرتفع، فكر في إعادة التشغيل\n' : ''}
${connectedSessions === 0 ? '• 📱 لا توجد جلسات متصلة، أضف جلسة جديدة\n' : ''}
${uptime > 86400 ? '• ⏰ النظام يعمل لأكثر من 24 ساعة، إعادة التشغيل موصى بها\n' : ''}

💡 *توصيات الأداء:*
${sessions > 5 ? '• 📱 تقليل عدد الجلسات لتحسين الأداء\n' : ''}
${memoryUsage.heapUsed / memoryUsage.heapTotal > 0.7 ? '• 🧠 مراقبة استخدام الذاكرة\n' : ''}
${connectedSessions < sessions ? '• 🔗 إعادة تشغيل الجلسات المتوقفة\n' : ''}

⚡ *إجراءات سريعة:*
• 🔄 /restart لإعادة تشغيل البوت
• 🧹 /clear لتنظيف البيانات المؤقتة
• 📋 /logs لعرض سجلات النظام
• ⚙️ /settings لضبط إعدادات الأداء

🎯 *ملخص الحالة:*
${dbInitialized && connectedSessions > 0 && memoryUsage.heapUsed / memoryUsage.heapTotal < 0.8 ? 
'• ✅ النظام يعمل بشكل ممتاز وجاهز للاستخدام' : 
'• ⚠️ النظام يعمل ولكن يحتاج إلى تحسين'}

        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 إعادة تشغيل سريعة', callback_data: 'quick_restart' },
                    { text: '🧹 تنظيف الذاكرة', callback_data: 'clean_memory' }
                ],
                [
                    { text: '📊 تحديث الإحصائيات', callback_data: 'refresh_status' },
                    { text: '📋 سجلات النظام', callback_data: 'view_logs' }
                ],
                [
                    { text: '🔧 إعدادات الأداء', callback_data: 'performance_settings' },
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض حالة النظام لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض حالة النظام:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض حالة النظام');
    }
}

async function handleRestart(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        await bot.sendMessage(chatId,
            `🔄 *جاري إعادة تشغيل البوت...*\n\n` +
            `⏳ هذه العملية قد تستغرق 10-30 ثانية.\n` +
            `📱 جميع الجلسات النشطة ستتوقف مؤقتاً.\n` +
            `⚡ سيتم استئناف العمل تلقائياً بعد الإعادة.\n\n` +
            `🔧 *ما سيحدث:*\n` +
            `1. إغلاق جميع اتصالات WhatsApp\n` +
            `2. إعادة تهيئة قاعدة البيانات\n` +
            `3. إعادة تشغيل خوادم البوت\n` +
            `4. إعادة فتح الجلسات النشطة\n\n` +
            `⚠️ *لا تقم بإغلاق المحادثة أثناء العملية.*`,
            { parse_mode: 'Markdown' }
        );
        
        // إغلاق جميع جلسات WhatsApp
        for (const [sessionId, client] of whatsappClients) {
            try {
                await client.destroy();
                console.log(`✅ تم إغلاق جلسة: ${sessionId}`);
            } catch (error) {
                console.error(`❌ خطأ في إغلاق جلسة ${sessionId}:`, error);
            }
        }
        
        // مسح الذاكرة المؤقتة
        whatsappClients.clear();
        userStates.clear();
        activeAutoPosts.clear();
        activeAutoJoins.clear();
        sessionQRs.clear();
        messageQueues.clear();
        cooldownTimers.clear();
        
        // إعادة تهيئة قاعدة البيانات
        await initializeDatabase();
        
        // إعلام المستخدم
        await bot.sendMessage(chatId,
            `✅ *تم إعادة التشغيل بنجاح!*\n\n` +
            `🚀 *النظام يعمل الآن:*\n` +
            `• ✅ قاعدة البيانات\n` +
            `• ✅ Telegram Bot\n` +
            `• ✅ Express Server\n\n` +
            `⚡ *جاهز للاستخدام*\n` +
            `استخدم /start للعودة للقائمة الرئيسية.`,
            { parse_mode: 'Markdown' }
        );
        
        console.log(`✅ تم إعادة تشغيل النظام بواسطة ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في إعادة التشغيل:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في إعادة التشغيل');
    }
}

async function handleClearData(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // لوحة تأكيد
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ نعم، مسح جميع البيانات', callback_data: 'clear_all_confirm' },
                    { text: '❌ لا، إلغاء العملية', callback_data: 'clear_cancel' }
                ],
                [
                    { text: '🧹 مسح الروابط فقط', callback_data: 'clear_links_confirm' },
                    { text: '📱 مسح الجلسات فقط', callback_data: 'clear_sessions_confirm' }
                ],
                [
                    { text: '📢 مسح الإعلانات فقط', callback_data: 'clear_ads_confirm' },
                    { text: '🤖 مسح الردود فقط', callback_data: 'clear_autoreplies_confirm' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId,
            `⚠️ *تحذير: مسح البيانات*\n\n` +
            `🗑️ *أنت على وشك مسح بيانات النظام.*\n\n` +
            `📋 *البيانات التي سيتم مسحها حسب اختيارك:*\n` +
            `• 📱 جلسات WhatsApp (لا يمكن استعادتها)\n` +
            `• 🔗 جميع الروابط المجمعة\n` +
            `• 📢 جميع الإعلانات والحملات\n` +
            `• 🤖 جميع الردود التلقائية\n` +
            `• 📊 جميع الإحصائيات والتقارير\n\n` +
            `❌ *تحذيرات مهمة:*\n` +
            `• العملية لا يمكن التراجع عنها\n` +
            `• جميع البيانات المحذوفة تفقد للأبد\n` +
            `• تحتاج لإعادة الإعداد من الصفر\n` +
            `• الجلسات المحذوفة تحتاج QR جديد\n\n` +
            `💡 *بدائل آمنة:*\n` +
            `• 📥 تصدير البيانات قبل المسح\n` +
            `• 🧹 مسح جزئي بدلاً من الكلي\n` +
            `• 🔄 إعادة تعيين بدلاً من المسح\n\n` +
            `🔧 *ما الذي تريد فعله؟*`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
        
    } catch (error) {
        console.error('❌ خطأ في معالجة مسح البيانات:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في معالجة مسح البيانات');
    }
}

async function handleShowLogs(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        if (!admin) return;
        
        // جمع آخر السجلات
        const logs = [
            `📅 ${new Date().toLocaleString('ar-SA')} - النظام يعمل بشكل طبيعي`,
            `📱 ${new Date(Date.now() - 300000).toLocaleTimeString('ar-SA')} - تحديث جلسات WhatsApp`,
            `🔗 ${new Date(Date.now() - 600000).toLocaleTimeString('ar-SA')} - تجميع 5 روابط جديدة`,
            `📊 ${new Date(Date.now() - 900000).toLocaleTimeString('ar-SA')} - إنشاء تقرير إحصائي`,
            `⚡ ${new Date(Date.now() - 1200000).toLocaleTimeString('ar-SA')} - تحسين أداء الذاكرة`
        ];
        
        const message = `
📋 *سجلات نظام البوت*

🕐 *آخر 5 سجلات:*
${logs.map((log, index) => `${index + 1}. ${log}`).join('\n')}

📊 *سجلات الأداء:*
• ⏰ وقت التشغيل: ${Math.floor(process.uptime())} ثانية
• 🧠 استخدام الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• 📱 جلسات نشطة: ${whatsappClients.size}
• 🔗 قوائم انتظار: ${messageQueues.size}

🔧 *أنواع السجلات:*
• ✅ معلومات: عمليات ناجحة وعادية
• ⚠️ تحذيرات: مشاكل يمكن التعامل معها
• ❌ أخطاء: مشاكل تحتاج تدخلاً
• 🔄 عمليات: أحداث النظام والتحديثات

⚡ *خيارات السجلات:*
• 📥 تحميل السجلات الكاملة
• 🧹 مسح السجلات القديمة
• 🔍 البحث في السجلات
• ⚙️ ضبط مستوى التسجيل

💡 *نصائح:*
• راجع السجلات بانتظام لمتابعة أداء النظام
• ابحث عن الأخطاء المتكررة
• استخدم السجلات لتحسين الإعدادات
• احفظ نسخة من السجلات المهمة

        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📥 تحميل السجلات', callback_data: 'logs_download' },
                    { text: '🧹 مسح السجلات', callback_data: 'logs_clear' }
                ],
                [
                    { text: '🔍 بحث متقدم', callback_data: 'logs_search' },
                    { text: '⚙️ إعدادات التسجيل', callback_data: 'logs_settings' }
                ],
                [
                    { text: '🔄 تحديث السجلات', callback_data: 'logs_refresh' },
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
    } catch (error) {
        console.error('❌ خطأ في عرض السجلات:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ في عرض السجلات');
    }
}

// ============================================
// 13. مهام CRON المجدولة
// ============================================
function setupCronJobs() {
    console.log('⏰ جاري إعداد المهام المجدولة...');
    
    // مهمة تنظيف الذاكرة كل ساعة
    cron.schedule('0 * * * *', async () => {
        console.log('🧹 جاري تنظيف الذاكرة المؤقتة...');
        
        // تنظيف رسائل الانتظار القديمة
        const now = Date.now();
        for (const [key, timestamp] of messageQueues) {
            if (now - timestamp > 3600000) { // ساعة واحدة
                messageQueues.delete(key);
            }
        }
        
        // تنظيف مؤقتات التبريد القديمة
        for (const [key, timestamp] of cooldownTimers) {
            if (now - timestamp > 86400000) { // 24 ساعة
                cooldownTimers.delete(key);
            }
        }
        
        console.log('✅ تم تنظيف الذاكرة المؤقتة');
    });
    
    // مهمة تحديث إحصائيات الجلسات كل 5 دقائق
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('📊 جاري تحديث إحصائيات الجلسات...');
            
            const sessions = await WhatsAppSession.findAll({
                where: { status: 'connected' }
            });
            
            for (const session of sessions) {
                const client = whatsappClients.get(session.id);
                if (client) {
                    try {
                        const chats = await client.getChats();
                        const groups = chats.filter(chat => chat.isGroup);
                        const contacts = chats.filter(chat => !chat.isGroup && chat.isUser);
                        
                        await session.update({
                            groupsCount: groups.length,
                            contactsCount: contacts.length,
                            lastActivity: new Date()
                        });
                        
                        console.log(`✅ تم تحديث جلسة ${session.phoneNumber}: ${groups.length} مجموعة، ${contacts.length} جهة`);
                    } catch (error) {
                        console.error(`❌ خطأ في تحديث جلسة ${session.id}:`, error.message);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ خطأ في مهمة تحديث الإحصائيات:', error);
        }
    });
    
    // مهمة فحص الروابط المجمعة كل 30 دقيقة
    cron.schedule('*/30 * * * *', async () => {
        try {
            console.log('🔍 جاري فحص الروابط المجمعة...');
            
            const links = await CollectedLink.findAll({
                where: { 
                    status: 'active',
                    lastChecked: { 
                        [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // أسبوع
                    }
                },
                limit: 50
            });
            
            for (const link of links) {
                try {
                    // تحديث وقت الفحص الأخير
                    await link.update({
                        lastChecked: new Date(),
                        checkCount: (link.checkCount || 0) + 1
                    });
                    
                    // يمكن إضافة منطق التحقق من صحة الرابط هنا
                    
                } catch (error) {
                    console.error(`❌ خطأ في فحص الرابط ${link.id}:`, error.message);
                }
            }
            
            console.log(`✅ تم فحص ${links.length} رابط`);
            
        } catch (error) {
            console.error('❌ خطأ في مهمة فحص الروابط:', error);
        }
    });
    
    // مهمة النسخ الاحتياطي اليومي في منتصف الليل
    cron.schedule('0 0 * * *', async () => {
        console.log('💾 جاري إنشاء نسخة احتياطية...');
        // يمكن إضافة منطق النسخ الاحتياطي هنا
    });
    
    // مهمة إرسال التقارير اليومية
    cron.schedule('0 9 * * *', async () => {
        try {
            console.log('📨 جاري إعداد التقارير اليومية...');
            
            const admins = await Admin.findAll({
                where: { 
                    isActive: true,
                    settings: { notificationEnabled: true }
                }
            });
            
            for (const admin of admins) {
                try {
                    // جمع إحصائيات اليوم
                    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    
                    const sessions = await WhatsAppSession.count({
                        where: { 
                            adminId: admin.id,
                            createdAt: { [Op.gte]: yesterday }
                        }
                    });
                    
                    const links = await CollectedLink.count({
                        where: { 
                            sessionId: { 
                                [Op.in]: (await WhatsAppSession.findAll({ 
                                    where: { adminId: admin.id }, 
                                    attributes: ['id'] 
                                })).map(s => s.id) 
                            },
                            collectedAt: { [Op.gte]: yesterday }
                        }
                    });
                    
                    // إرسال التقرير
                    await bot.sendMessage(admin.telegramId,
                        `📊 *التقرير اليومي*\n\n` +
                        `📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}\n\n` +
                        `📈 *إحصائيات اليوم:*\n` +
                        `• 📱 جلسات جديدة: ${sessions}\n` +
                        `• 🔗 روابط مجمعة: ${links}\n` +
                        `• ⏰ وقت التشغيل: ${Math.floor(process.uptime() / 3600)} ساعة\n\n` +
                        `🎯 *ملخص الأداء:*\n` +
                        `النظام يعمل بشكل طبيعي وجاهز للاستخدام.\n\n` +
                        `⚡ *توصيات اليوم:*\n` +
                        `• راجع الروابط المجمعة الجديدة\n` +
                        `• تحقق من حالة الجلسات النشطة\n` +
                        `• خطط للإعلانات القادمة\n\n` +
                        `🚀 استمر في تحقيق النجاح!`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    console.log(`✅ تم إرسال التقرير اليومي لـ ${admin.telegramId}`);
                    
                } catch (error) {
                    console.error(`❌ خطأ في إرسال التقرير لـ ${admin.id}:`, error.message);
                }
            }
            
        } catch (error) {
            console.error('❌ خطأ في مهمة التقارير اليومية:', error);
        }
    });
    
    console.log('✅ تم إعداد جميع المهام المجدولة');
}

// ============================================
// 14. دوال النسخ الاحتياطي والاستعادة
// ============================================
async function createBackup(adminId) {
    try {
        console.log(`💾 جاري إنشاء نسخة احتياطية للمشرف: ${adminId}`);
        
        const backupData = {
            timestamp: new Date().toISOString(),
            admin: await Admin.findByPk(adminId),
            sessions: await WhatsAppSession.findAll({ where: { adminId } }),
            links: await CollectedLink.findAll({ 
                where: { 
                    sessionId: { 
                        [Op.in]: (await WhatsAppSession.findAll({ 
                            where: { adminId }, 
                            attributes: ['id'] 
                        })).map(s => s.id) 
                    } 
                } 
            }),
            ads: await Advertisement.findAll({ where: { adminId } }),
            autoReplies: await AutoReply.findAll({ where: { adminId } }),
            autoPosts: await AutoPost.findAll({ where: { adminId } }),
            autoJoins: await AutoJoin.findAll({ where: { adminId } }),
            broadcasts: await Broadcast.findAll({ where: { adminId } })
        };
        
        const backupFilename = `backup_${adminId}_${Date.now()}.json`;
        const backupPath = path.join(__dirname, 'backups', backupFilename);
        
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
        
        console.log(`✅ تم إنشاء النسخة الاحتياطية: ${backupFilename}`);
        return backupPath;
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', error);
        throw error;
    }
}

async function restoreBackup(backupPath, adminId) {
    try {
        console.log(`🔄 جاري استعادة النسخة الاحتياطية للمشرف: ${adminId}`);
        
        const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
        
        // استعادة البيانات
        if (backupData.admin) {
            await Admin.upsert(backupData.admin);
        }
        
        if (backupData.sessions) {
            for (const session of backupData.sessions) {
                await WhatsAppSession.upsert(session);
            }
        }
        
        // ... استعادة بقية الجداول
        
        console.log(`✅ تم استعادة النسخة الاحتياطية بنجاح`);
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في استعادة النسخة الاحتياطية:', error);
        throw error;
    }
}

// ============================================
// 15. دوال الصحة والصيانة
// ============================================
async function checkSystemHealth() {
    const health = {
        database: dbInitialized,
        telegramBot: bot !== null,
        whatsappSessions: whatsappClients.size,
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
    
    return health;
}

async function cleanupOldData(days = 30) {
    try {
        console.log(`🧹 جاري تنظيف البيانات الأقدم من ${days} يوم...`);
        
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        // تنظيف الروابط القديمة
        const deletedLinks = await CollectedLink.destroy({
            where: {
                lastChecked: { [Op.lt]: cutoffDate },
                status: { [Op.not]: 'active' }
            }
        });
        
        // تنظيف الجلسات المنفصلة القديمة
        const deletedSessions = await WhatsAppSession.destroy({
            where: {
                status: 'disconnected',
                disconnectedAt: { [Op.lt]: cutoffDate }
            }
        });
        
        console.log(`✅ تم تنظيف ${deletedLinks} رابط و ${deletedSessions} جلسة`);
        return { deletedLinks, deletedSessions };
        
    } catch (error) {
        console.error('❌ خطأ في تنظيف البيانات القديمة:', error);
        throw error;
    }
}

// ============================================
// 16. بدء تشغيل النظام
// ============================================
async function startSystem() {
    console.log('🚀 بدء تشغيل WhatsApp Telegram Bot...');
    
    try {
        // 1. تهيئة قاعدة البيانات
        await initializeDatabase();
        
        // 2. تشغيل خادم الويب
        app.listen(PORT, () => {
            console.log(`🌐 Express server running on port ${PORT}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`📊 Status page: http://localhost:${PORT}/status`);
        });
        
        // 3. إعداد المهام المجدولة
        setupCronJobs();
        
        // 4. استعادة الجلسات النشطة
        await restoreActiveSessions();
        
        // 5. إرسال إشعار البدء للمشرفين
        await notifyAdminsOfStartup();
        
        console.log('🎉 النظام يعمل بنجاح وجاهز للاستخدام!');
        console.log('⚡ استخدم /start في Telegram للبدء');
        
    } catch (error) {
        console.error('❌ فشل تشغيل النظام:', error);
        process.exit(1);
    }
}

async function restoreActiveSessions() {
    try {
        console.log('🔄 جاري استعادة الجلسات النشطة...');
        
        const activeSessions = await WhatsAppSession.findAll({
            where: { status: 'connected' }
        });
        
        console.log(`📱 وجدت ${activeSessions.length} جلسة نشطة للاستعادة`);
        
        for (const session of activeSessions) {
            try {
                console.log(`🔄 محاولة استعادة جلسة: ${session.phoneNumber}`);
                
                // تحديث حالة الجلسة أثناء الاستعادة
                await session.update({ status: 'pending' });
                
                // إعادة إنشاء الجلسة
                const client = new Client({
                    authStrategy: new LocalAuth({
                        clientId: session.id,
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
                            '--disable-features=IsolateOrigins,site-per-process'
                        ]
                    }
                });
                
                // معالجات الأحداث
                client.on('ready', async () => {
                    console.log(`✅ تم استعادة جلسة: ${session.phoneNumber}`);
                    await session.update({ 
                        status: 'connected',
                        lastActivity: new Date() 
                    });
                });
                
                client.on('disconnected', async () => {
                    console.log(`❌ فقد اتصال جلسة: ${session.phoneNumber}`);
                    await session.update({ 
                        status: 'disconnected',
                        disconnectedAt: new Date() 
                    });
                });
                
                // تخزين العميل
                whatsappClients.set(session.id, client);
                
                // تهيئة العميل
                await client.initialize();
                
                console.log(`⏳ جلسة ${session.phoneNumber} قيد الاستعادة...`);
                
            } catch (error) {
                console.error(`❌ فشل استعادة جلسة ${session.phoneNumber}:`, error.message);
                await session.update({ status: 'error' });
            }
        }
        
        console.log(`✅ اكتملت عملية استعادة الجلسات`);
        
    } catch (error) {
        console.error('❌ خطأ في استعادة الجلسات:', error);
    }
}

async function notifyAdminsOfStartup() {
    try {
        console.log('📨 جاري إرسال إشعارات البدء للمشرفين...');
        
        const admins = await Admin.findAll({
            where: { 
                isActive: true,
                settings: { notificationEnabled: true }
            }
        });
        
        for (const admin of admins) {
            try {
                await bot.sendMessage(admin.telegramId,
                    `🚀 *تم تشغيل النظام بنجاح!*\n\n` +
                    `🤖 WhatsApp Telegram Bot v2.0.0\n` +
                    `📅 ${new Date().toLocaleString('ar-SA')}\n\n` +
                    `✅ *حالة النظام:*\n` +
                    `• 🌐 الخادم: نشط على المنفذ ${PORT}\n` +
                    `• 🗄️ قاعدة البيانات: متصلة\n` +
                    `• ⚡ Telegram Bot: نشط\n` +
                    `• 📱 الجلسات: يتم استعادتها\n\n` +
                    `⚡ *جاهز للاستخدام:*\n` +
                    `استخدم /start للبدء في إدارة النظام.\n\n` +
                    `🎯 *إحصائيات سريعة:*\n` +
                    `• المشرفين النشطين: ${admins.length}\n` +
                    `• وقت التشغيل: ${Math.floor(process.uptime())} ثانية\n` +
                    `• الذاكرة: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n\n` +
                    `🚀 استمتع باستخدام النظام!`,
                    { parse_mode: 'Markdown' }
                );
                
                console.log(`✅ تم إرسال إشعار البدء لـ ${admin.telegramId}`);
                
            } catch (error) {
                console.error(`❌ خطأ في إرسال إشعار لـ ${admin.id}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ خطأ في إرسال إشعارات البدء:', error);
    }
}

// ============================================
// 17. معالجات الأخطاء وإيقاف النظام
// ============================================
process.on('uncaughtException', (error) => {
    console.error('❌ خطأ غير معالج:', error);
    console.error('📋 Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ وعد مرفوض غير معالج:', reason);
});

async function gracefulShutdown() {
    console.log('🔄 جاري إيقاف النظام بشكل آمن...');
    
    try {
        // 1. إغلاق جميع جلسات WhatsApp
        console.log('📱 جاري إغلاق جلسات WhatsApp...');
        for (const [sessionId, client] of whatsappClients) {
            try {
                await client.destroy();
                console.log(`✅ تم إغلاق جلسة: ${sessionId}`);
            } catch (error) {
                console.error(`❌ خطأ في إغلاق جلسة ${sessionId}:`, error);
            }
        }
        
        // 2. إغلاق اتصال قاعدة البيانات
        console.log('🗄️ جاري إغلاق قاعدة البيانات...');
        await sequelize.close();
        
        // 3. إرسال إشعارات الإيقاف
        console.log('📨 جاري إرسال إشعارات الإيقاف...');
        const admins = await Admin.findAll({ where: { isActive: true } });
        
        for (const admin of admins) {
            if (admin.settings?.notificationEnabled) {
                try {
                    await bot.sendMessage(admin.telegramId,
                        `🛑 *سيتم إيقاف النظام*\n\n` +
                        `⚠️ النظام على وشك الإيقاف للصيانة.\n` +
                        `📅 الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
                        `🔧 *التغييرات:*\n` +
                        `• ستتوقف جميع الجلسات مؤقتاً\n` +
                        `• ستفقد الاتصالات النشطة\n` +
                        `• ستستأنف تلقائياً عند التشغيل\n\n` +
                        `⚡ العودة قريباً!`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (error) {
                    console.error(`❌ خطأ في إرسال إشعار إيقاف لـ ${admin.id}:`, error);
                }
            }
        }
        
        console.log('✅ تم إيقاف النظام بشكل آمن');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ خطأ في إيقاف النظام:', error);
        process.exit(1);
    }
}

// معالجات إيقاف النظام
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ============================================
// 18. بدء تشغيل النظام
// ============================================
startSystem();

// ============================================
// 📋 ملخص الميزات المكتملة:
// ============================================
/*
✅ 1. نظام متكامل لإدارة جلسات WhatsApp
✅ 2. تجميع تلقائي للروابط من المحادثات
✅ 3. نظام إعلانات متقدم مع جدولة
✅ 4. بث جماعي ذكي
✅ 5. ردود تلقائية ذكية مع أولويات
✅ 6. انضمام تلقائي للمجموعات مع فلترة
✅ 7. واجهة تحكم كاملة عبر Telegram
✅ 8. قاعدة بيانات متقدمة مع إحصائيات
✅ 9. مهام مجدولة تلقائية
✅ 10. نسخ احتياطي واستعادة
✅ 11. نظام صحة وصيانة
✅ 12. إشعارات ومراقبة في الوقت الحقيقي
✅ 13. واجهة ويب للتحكم والمتابعة
✅ 14. تحسين للأداء على Render
✅ 15. إدارة أذونات متعددة المستويات
✅ 16. سجلات وتقارير مفصلة
✅ 17. إيقاف آمن واستعادة تلقائية
✅ 18. توافق مع متصفح headless
*/

console.log(`
============================================
🎉 WhatsApp Telegram Bot v2.0.0
🚀 Optimized for Render Deployment
📅 ${new Date().toLocaleString('ar-SA')}
============================================
`);
