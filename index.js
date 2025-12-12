// ============================================
// الملف الرئيسي: WhatsApp-Telegram Bot النسخة الشاملة
// مصمم خصيصاً للعمل على Render.com
// النسخة: 2.0.0 - Optimized for Render
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
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const axios = require('axios');

// ============================================
// 4. المتغيرات العامة والذاكرة
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
        
        dbInitialized = true;
        console.log('🎉 تم تهيئة قاعدة البيانات بنجاح');
        
        // تشغيل مهام الصيانة
        startMaintenanceTasks();
        
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
// 6. أوامر تليجرام المتقدمة
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
    { command: 'help', description: '🆘 المساعدة والدعم' }
]);

// أمر /start المحسن
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

// ============================================
// 7. معالجة الرسائل النصية المتقدمة
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
            
        case 'awaiting_admin_id':
            await handleAdminIdInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_autoreply_trigger':
            await handleAutoReplyTriggerInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_autoreply_response':
            await handleAutoReplyResponseInput(chatId, telegramId, msg.text, userState.data);
            break;
            
        case 'awaiting_broadcast_message':
            await handleBroadcastMessageInput(chatId, telegramId, msg.text, userState.data);
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

// ============================================
// 8. معالجة الأزرار التفاعلية المتقدمة
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
        throw error;
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
• إضافة تقارير مفصلة

اختر نوع الروابط الذي تريد عرضه:
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الروابط لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الروابط:', error);
        throw error;
    }
}

async function showStatsMenu(chatId, adminId) {
    try {
        const admin = await Admin.findByPk(adminId);
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: adminId }
        });
        
        const sessionIds = sessions.map(s => s.id);
        
        // جمع الإحصائيات
        const totalSessions = sessions.length;
        const activeSessions = sessions.filter(s => 
            s.status === 'connected' || s.status === 'authenticated'
        ).length;
        
        const totalMessages = sessions.reduce((sum, session) => 
            sum + (session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0), 0
        );
        
        const totalGroups = sessions.reduce((sum, session) => 
            sum + (session.groupsCount || 0), 0
        );
        
        const totalContacts = sessions.reduce((sum, session) => 
            sum + (session.contactsCount || 0), 0
        );
        
        const totalLinks = await CollectedLink.count({
            where: { sessionId: sessionIds }
        });
        
        const whatsappLinks = await CollectedLink.count({
            where: { 
                type: ['whatsapp_group', 'whatsapp_invite'],
                sessionId: sessionIds
            }
        });
        
        const totalAds = await Advertisement.count({ where: { adminId: adminId } });
        const activeAds = await Advertisement.count({ 
            where: { 
                adminId: adminId,
                isActive: true
            }
        });
        
        const totalAutoPosts = await AutoPost.count({ where: { adminId: adminId } });
        const activeAutoPostsCount = await AutoPost.count({
            where: {
                adminId: adminId,
                status: 'active'
            }
        });
        
        const totalAutoReplies = await AutoReply.count({ where: { adminId: adminId } });
        const activeAutoReplies = await AutoReply.count({
            where: {
                adminId: adminId,
                isActive: true
            }
        });
        
        const totalAutoJoins = await AutoJoin.count({ where: { adminId: adminId } });
        const activeAutoJoinsCount = await AutoJoin.count({
            where: {
                adminId: adminId,
                status: 'active'
            }
        });
        
        // حساب النسب
        const sessionActivityRate = totalSessions > 0 ? 
            Math.round((activeSessions / totalSessions) * 100) : 0;
        
        const linkWhatsappRate = totalLinks > 0 ?
            Math.round((whatsappLinks / totalLinks) * 100) : 0;
        
        // لوحة المفاتيح
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 جلسات واتساب', callback_data: 'stats_sessions' },
                    { text: '🔗 الروابط', callback_data: 'stats_links' }
                ],
                [
                    { text: '📢 الإعلانات', callback_data: 'stats_ads' },
                    { text: '🔄 النشر التلقائي', callback_data: 'stats_autopost' }
                ],
                [
                    { text: '🤖 الردود التلقائية', callback_data: 'stats_autoreply' },
                    { text: '➕ الانضمام التلقائي', callback_data: 'stats_autojoin' }
                ],
                [
                    { text: '📊 نظرة عامة', callback_data: 'stats_overview' },
                    { text: '📈 تقرير مفصل', callback_data: 'stats_detailed' }
                ],
                [
                    { text: '📅 تقرير يومي', callback_data: 'stats_daily' },
                    { text: '📆 تقرير أسبوعي', callback_data: 'stats_weekly' }
                ],
                [
                    { text: '🔄 تحديث الإحصائيات', callback_data: 'refresh_stats' },
                    { text: '📥 تصدير التقرير', callback_data: 'stats_export' }
                ],
                [
                    { text: '🏠 الرئيسية', callback_data: 'menu_main' }
                ]
            ]
        };
        
        // رسالة الإحصائيات
        const message = `
📊 *إحصائيات النظام الشاملة*

🎯 *نظرة عامة:*
• 🤖 وقت التشغيل: ${Math.floor(process.uptime() / 3600)} ساعة
• 👤 المشرف: ${admin.firstName || admin.username || 'غير معروف'}
• 📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}
• ⏰ وقت التقرير: ${new Date().toLocaleTimeString('ar-SA')}

📱 *جلسات WhatsApp:*
• 🟢 نشطة: ${activeSessions} جلسة
• 📊 الإجمالي: ${totalSessions} جلسة
• 📈 نسبة النشاط: ${sessionActivityRate}%
• 💬 الرسائل: ${totalMessages.toLocaleString()}
• 👥 المجموعات: ${totalGroups.toLocaleString()}
• 📞 الجهات: ${totalContacts.toLocaleString()}

🔗 *الروابط المجمعة:*
• 📋 الإجمالي: ${totalLinks.toLocaleString()} رابط
• 📱 واتساب: ${whatsappLinks.toLocaleString()} رابط (${linkWhatsappRate}%)
• 🔄 آخر تجميع: ${sessions.length > 0 ? 
    new Date(sessions[0].lastActivity).toLocaleTimeString('ar-SA') : 'لم يبدأ'}

📢 *نظام الإعلانات:*
• 🟢 نشطة: ${activeAds} إعلان
• 📊 الإجمالي: ${totalAds} إعلان
• 🎯 نسبة النشاط: ${totalAds > 0 ? Math.round((activeAds / totalAds) * 100) : 0}%

🔄 *النشر التلقائي:*
• 🟢 نشطة: ${activeAutoPostsCount} عملية
• 📊 الإجمالي: ${totalAutoPosts} عملية

🤖 *الردود التلقائية:*
• 🟢 نشطة: ${activeAutoReplies} رد
• 📊 الإجمالي: ${totalAutoReplies} رد

➕ *الانضمام التلقائي:*
• 🟢 نشطة: ${activeAutoJoinsCount} عملية
• 📊 الإجمالي: ${totalAutoJoins} عملية

📈 *تحليل الأداء:*
• ⚡ السرعة: جيدة
• 🔄 الاستقرار: ${activeSessions > 0 ? 'ممتاز' : 'مطلوب تشغيل'}
• 📊 الفعالية: ${totalMessages > 1000 ? 'عالية' : totalMessages > 100 ? 'متوسطة' : 'منخفضة'}

💡 *توصيات:*
${activeSessions === 0 ? '• ⚠️ قم بإضافة جلسة WhatsApp لبدء العمل\n' : ''}
${totalLinks < 10 ? '• 🔍 قم بتفعيل تجميع الروابط لاكتشاف المزيد\n' : ''}
${activeAds === 0 ? '• 📢 أنشئ إعلاناً لبدء الحملات\n' : ''}

اختر قسم الإحصائيات لعرض التفاصيل:
        `;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض الإحصائيات لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض الإحصائيات:', error);
        throw error;
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
        
        // لوحة المفاتيح
        const keyboard = {
            inline_keyboard: []
        };
        
        // زر الإضافة
        keyboard.inline_keyboard.push([
            { text: '📢➕ إنشاء إعلان جديد', callback_data: 'ad_create' },
            { text: '🔄 تحديث', callback_data: 'refresh_ads' }
        ]);
        
        // عرض الإعلانات النشطة أولاً
        const activeAdsList = ads.filter(ad => ad.isActive).slice(0, 3);
        const inactiveAdsList = ads.filter(ad => !ad.isActive).slice(0, 2);
        
        if (activeAdsList.length > 0) {
            keyboard.inline_keyboard.push([
                { text: `🟢 الإعلانات النشطة (${activeAds})`, callback_data: 'ad_filter_active' }
            ]);
            
            activeAdsList.forEach(ad => {
                keyboard.inline_keyboard.push([
                    { 
                        text: `📢 ${ad.name}`, 
                        callback_data: `ad_info_${ad.id}`
                    }
                ]);
            });
        }
        
        if (inactiveAdsList.length > 0) {
            keyboard.inline_keyboard.push([
                { text: `⚪ الإعلانات المتوقفة (${totalAds - activeAds})`, callback_data: 'ad_filter_inactive' }
            ]);
            
            inactiveAdsList.forEach(ad => {
                keyboard.inline_keyboard.push([
                    { 
                        text: `⏸️ ${ad.name}`, 
                        callback_data: `ad_info_${ad.id}`
                    }
                ]);
            });
        }
        
        // أزرار إضافية
        keyboard.inline_keyboard.push([
            { text: '📊 إحصائيات الإعلانات', callback_data: 'ad_stats_overview' },
            { text: '⚙️ إعدادات النشر', callback_data: 'ad_settings' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '📨 البث الجماعي', callback_data: 'menu_broadcast' },
            { text: '🔄 النشر التلقائي', callback_data: 'menu_autopost' }
        ]);
        
        keyboard.inline_keyboard.push([
            { text: '🏠 الرئيسية', callback_data: 'menu_main' }
        ]);
        
        // رسالة القائمة
        let message = `📢 *نظام الإعلانات المتكامل*\n\n`;
        message += `📊 *الإحصائيات:*\n`;
        message += `• 🟢 نشطة: ${activeAds} إعلان\n`;
        message += `• 📊 الإجمالي: ${totalAds} إعلان\n`;
        message += `• 🎯 نسبة النشاط: ${totalAds > 0 ? Math.round((activeAds / totalAds) * 100) : 0}%\n\n`;
        
        if (ads.length === 0) {
            message += `📭 *لا توجد إعلانات*\n\n`;
            message += `انقر على *"📢➕ إنشاء إعلان جديد"* لبدء أول حملة إعلانية.\n\n`;
            message += `🚀 *مميزات نظام الإعلانات:*\n`;
            message += `• 📨 نشر في جميع المجموعات تلقائياً\n`;
            message += `• ⏰ جدولة زمنية ذكية\n`;
            message += `• 📊 متابعة الإحصائيات بشكل مفصل\n`;
            message += `• 🔄 تكرار النشر بعد اكتمال الدورة\n`;
        } else {
            message += `📋 *آخر الإعلانات:*\n`;
            
            ads.slice(0, 3).forEach((ad, index) => {
                const typeEmoji = ad.type === 'text' ? '📝' :
                                ad.type === 'image' ? '🖼️' :
                                ad.type === 'video' ? '🎥' : '📎';
                
                const statusEmoji = ad.isActive ? '🟢' : '⚪';
                const sentCount = ad.stats?.sent || 0;
                
                message += `${index + 1}. ${typeEmoji} ${statusEmoji} *${ad.name}*\n`;
                message += `   📌 النوع: ${ad.type}\n`;
                message += `   📊 المرسلة: ${sentCount.toLocaleString()}\n`;
                message += `   ⏰ الإنشاء: ${new Date(ad.createdAt).toLocaleDateString('ar-SA')}\n\n`;
            });
            
            message += `💡 *نصائح للإعلانات الفعالة:*\n`;
            message += `• استخدم نصوصاً جذابة وواضحة\n`;
            message += `• أضف صوراً أو فيديوهات إن أمكن\n`;
            message += `• حدد أوقات الذروة للنشر\n`;
            message += `• تابع الإحصائيات بانتظام\n`;
        }
        
        message += `\n⚡ *اختر إعلاناً للتحكم أو أنشئ إعلاناً جديداً*`;
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم عرض قائمة الإعلانات لـ ${adminId}`);
        
    } catch (error) {
        console.error('❌ خطأ في عرض قائمة الإعلانات:', error);
        throw error;
    }
}

// ============================================
// 9. مهام الصيانة والتحديث التلقائي
// ============================================
function startMaintenanceTasks() {
    console.log('🔧 بدء مهام الصيانة التلقائية...');
    
    // مهمة تنظيف ذاكرة التبريد كل ساعة
    cron.schedule('0 * * * *', () => {
        console.log('🧹 جاري تنظيف ذاكرة التبريد...');
        const now = Date.now();
        for (const [key, timestamp] of cooldownTimers.entries()) {
            if (now - timestamp > 3600000) { // ساعة واحدة
                cooldownTimers.delete(key);
            }
        }
        console.log(`✅ تم تنظيف ذاكرة التبريد: ${cooldownTimers.size} مدة باقية`);
    });
    
    // مهمة تحديث حالة الجلسات كل 5 دقائق
    cron.schedule('*/5 * * * *', async () => {
        console.log('🔄 جاري تحديث حالة الجلسات...');
        
        try {
            const sessions = await WhatsAppSession.findAll({
                where: {
                    status: ['connected', 'authenticated'],
                    lastActivity: {
                        [Op.lt]: new Date(Date.now() - 300000) // 5 دقائق
                    }
                }
            });
            
            for (const session of sessions) {
                const client = whatsappClients.get(session.id);
                if (client) {
                    try {
                        // اختبار الاتصال
                        await client.getState();
                        await session.update({ lastActivity: new Date() });
                        console.log(`✅ جلسة ${session.id} لا تزال نشطة`);
                    } catch (error) {
                        console.log(`❌ جلسة ${session.id} فقدت الاتصال`);
                        await session.update({ status: 'disconnected' });
                        whatsappClients.delete(session.id);
                    }
                }
            }
        } catch (error) {
            console.error('❌ خطأ في تحديث حالة الجلسات:', error);
        }
    });
    
    // مهمة إرسال تقرير يومي
    cron.schedule('0 9 * * *', async () => {
        console.log('📊 جاري إعداد التقرير اليومي...');
        
        try {
            const admins = await Admin.findAll({
                where: { 
                    isActive: true,
                    settings: { notificationEnabled: true }
                }
            });
            
            for (const admin of admins) {
                await sendDailyReport(admin);
            }
        } catch (error) {
            console.error('❌ خطأ في إرسال التقرير اليومي:', error);
        }
    });
    
    console.log('✅ تم جدولة مهام الصيانة');
}

async function sendDailyReport(admin) {
    try {
        const sessions = await WhatsAppSession.findAll({
            where: { adminId: admin.id }
        });
        
        const sessionIds = sessions.map(s => s.id);
        
        // جمع الإحصائيات
        const activeSessions = sessions.filter(s => 
            s.status === 'connected' || s.status === 'authenticated'
        ).length;
        
        const yesterday = new Date(Date.now() - 86400000);
        const newLinks = await CollectedLink.count({
            where: {
                sessionId: sessionIds,
                collectedAt: { [Op.gte]: yesterday }
            }
        });
        
        const totalMessages = sessions.reduce((sum, session) => {
            const sessionMessages = (session.stats?.messagesReceived || 0) + (session.stats?.messagesSent || 0);
            return sum + sessionMessages;
        }, 0);
        
        const yesterdayMessages = sessions.reduce((sum, session) => {
            // هذا مثال مبسط، في الإنتاج تحتاج لتتبع الرسائل يومياً
            return sum + Math.floor((session.stats?.messagesReceived || 0) / 30);
        }, 0);
        
        const message = `
📊 *التقرير اليومي - ${new Date().toLocaleDateString('ar-SA')}*

🎯 *ملخص الأداء:*
• 📱 الجلسات النشطة: ${activeSessions}/${sessions.length}
• 🔗 روابط جديدة: ${newLinks} رابط
• 💬 إجمالي الرسائل: ${totalMessages.toLocaleString()}
• 📨 رسائل الأمس: ${yesterdayMessages.toLocaleString()}

📈 *تحليل النشاط:*
${activeSessions > 0 ? '• ✅ النظام يعمل بشكل طبيعي' : '• ⚠️ لا توجد جلسات نشطة'}
${newLinks > 10 ? '• 🔗 تم اكتشاف العديد من الروابط' : newLinks > 0 ? '• 🔍 تم اكتشاف بعض الروابط' : '• 🔎 لم يتم اكتشاف روابط جديدة'}

💡 *توصيات اليوم:*
${activeSessions === 0 ? '• 📱 أضف جلسة WhatsApp لبدء العمل\n' : ''}
${sessions.length > 0 && newLinks === 0 ? '• 🔍 تفقد إعدادات تجميع الروابط\n' : ''}
${yesterdayMessages < 10 ? '• 💬 تفاعل أكثر لزيادة الفعالية\n' : ''}

🚀 *مهام مقترحة:*
1. تفقد حالة الجلسات (/sessions)
2. مراجعة الروابط المجمعة (/links)
3. متابعة الإحصائيات (/stats)
4. التخطيط لحملات جديدة (/ads)

⚡ *حافظ على نشاط النظام لتكون النتائج أفضل!*

📞 *للحصول على مساعدة:* /help
        `;
        
        await bot.sendMessage(admin.telegramId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
        console.log(`✅ تم إرسال التقرير اليومي إلى ${admin.telegramId}`);
        
    } catch (error) {
        console.error(`❌ خطأ في إرسال التقرير لـ ${admin.telegramId}:`, error);
    }
}

// ============================================
// 10. دوال المساعدة الإضافية
// ============================================
async function showBroadcastMenu(chatId, adminId) {
    // قائمة البث الجماعي
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📨➕ بث جديد', callback_data: 'broadcast_create' },
                { text: '📋 قائمة البث', callback_data: 'broadcast_list' }
            ],
            [
                { text: '👥 جهات اتصال', callback_data: 'broadcast_contacts' },
                { text: '👥 مجموعات', callback_data: 'broadcast_groups' }
            ],
            [
                { text: '⏰ بث مجدول', callback_data: 'broadcast_scheduled' },
                { text: '📊 إحصائيات', callback_data: 'broadcast_stats' }
            ],
            [
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId,
        `📨 *نظام البث الجماعي*\n\n` +
        `🚀 *المميزات:*\n` +
        `• إرسال رسائل لجميع جهات الاتصال\n` +
        `• إرسال رسائل لجميع المجموعات\n` +
        `• جدولة البث في أوقات محددة\n` +
        `• متابعة النتائج والإحصائيات\n\n` +
        `💡 *كيفية العمل:*\n` +
        `1. اختر نوع البث (جهات/مجموعات)\n` +
        `2. اكتب الرسالة التي تريد إرسالها\n` +
        `3. حدد وقت الإرسال (فوري/مجدول)\n` +
        `4. تابع النتائج في الوقت الفعلي\n\n` +
        `اختر من القائمة:`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        }
    );
}

async function showAutoReplyMenu(chatId, adminId) {
    // قائمة الردود التلقائية
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🤖➕ رد تلقائي جديد', callback_data: 'autoreply_create' },
                { text: '📋 قائمة الردود', callback_data: 'autoreply_list' }
            ],
            [
                { text: '👤 ردود خاصة', callback_data: 'autoreply_private' },
                { text: '👥 ردود جماعية', callback_data: 'autoreply_group' }
            ],
            [
                { text: '⚙️ إعدادات', callback_data: 'autoreply_settings' },
                { text: '📊 إحصائيات', callback_data: 'autoreply_stats' }
            ],
            [
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId,
        `🤖 *نظام الردود التلقائية*\n\n` +
        `🚀 *المميزات:*\n` +
        `• ردود تلقائية للمحادثات الخاصة\n` +
        `• ردود تلقائية للمجموعات\n` +
        `• محفزات نصية متقدمة\n` +
        `• إدارة متقدمة للردود\n\n` +
        `💡 *أنواع المحفزات:*\n` +
        `• **مطابق تماماً:** النص مطابق تماماً\n` +
        `• **يحتوي:** النص يحتوي على الكلمة\n` +
        `• **نمط:** مطابقة نمط معين (regex)\n` +
        `• **يبدأ بـ:** النص يبدأ بالكلمة\n` +
        `• **ينتهي بـ:** النص ينتهي بالكلمة\n\n` +
        `🎯 *الاستخدامات:*\n` +
        `• الرد على التحية تلقائياً\n` +
        `• الرد على أسئلة شائعة\n` +
        `• إرسال معلومات تلقائية\n` +
        `• الرد على كلمات محددة\n\n` +
        `اختر من القائمة:`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        }
    );
}

async function showAutoJoinMenu(chatId, adminId) {
    // قائمة الانضمام التلقائي
    const keyboard = {
        inline_keyboard: [
            [
                { text: '➕ تفعيل الانضمام', callback_data: 'autojoin_start' },
                { text: '⏸️ إيقاف الانضمام', callback_data: 'autojoin_stop' }
            ],
            [
                { text: '📊 إحصائيات الانضمام', callback_data: 'autojoin_stats' },
                { text: '🔗 عرض الروابط', callback_data: 'links_whatsapp_group' }
            ],
            [
                { text: '⚙️ إعدادات', callback_data: 'autojoin_settings' },
                { text: '📝 سجلات الانضمام', callback_data: 'autojoin_logs' }
            ],
            [
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId,
        `➕ *نظام الانضمام التلقائي*\n\n` +
        `🚀 *المميزات:*\n` +
        `• اكتشاف تلقائي لروابط واتساب\n` +
        `• انضمام تلقائي للمجموعات\n` +
        `• تقارير مفصلة عن الانضمام\n` +
        `• إحصائيات في الوقت الفعلي\n\n` +
        `💡 *كيفية العمل:*\n` +
        `1. يراقب البوت جميع الرسائل\n` +
        `2. يكتشف روابط دعوة واتساب\n` +
        `3. ينضم للمجموعات تلقائياً\n` +
        `4. يرسل تقريراً عن المجموعات\n` +
        `5. يسجل المجموعات التي فشل الانضمام إليها\n\n` +
        `🔧 *الإعدادات:*\n` +
        `• تصفية المجموعات حسب الحجم\n` +
        `• تحديد الكلمات المسموح بها\n` +
        `• ضبط فترات الانضمام\n` +
        `• إعدادات الإشعارات\n\n` +
        `اختر من القائمة:`,
        { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        }
    );
}

async function showSettingsMenu(chatId, adminId) {
    const admin = await Admin.findByPk(adminId);
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔔 الإشعارات', callback_data: 'settings_notifications' },
                { text: '🌐 اللغة', callback_data: 'settings_language' }
            ],
            [
                { text: '📱 حد الجلسات', callback_data: 'settings_max_sessions' },
                { text: '🔗 تجميع الروابط', callback_data: 'settings_link_collection' }
            ],
            [
                { text: '🤖 الرد التلقائي', callback_data: 'settings_auto_reply' },
                { text: '➕ الانضمام التلقائي', callback_data: 'settings_auto_join' }
            ],
            [
                { text: '📊 التقارير', callback_data: 'settings_reports' },
                { text: '🔒 الأمان', callback_data: 'settings_security' }
            ],
            [
                { text: '🔄 إعادة التعيين', callback_data: 'settings_reset' },
                { text: '📋 معلومات الحساب', callback_data: 'settings_account' }
            ],
            [
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]
        ]
    };
    
    const message = `
⚙️ *إعدادات النظام*

👤 *معلومات الحساب:*
• 🆔 المعرف: \`${admin.telegramId}\`
• 👤 الاسم: ${admin.firstName || 'غير معروف'}
• 💼 الصلاحيات: ${admin.permissions?.length || 0} صلاحية
• 📅 تاريخ التسجيل: ${new Date(admin.createdAt).toLocaleDateString('ar-SA')}

⚡ *الإعدادات الحالية:*
• 🔔 الإشعارات: ${admin.settings?.notificationEnabled ? '✅ مفعلة' : '❌ معطلة'}
• 🌐 اللغة: ${admin.settings?.language || 'العربية'}
• 📱 الحد الأقصى للجلسات: ${admin.settings?.maxSessions || 5}
• 🔗 تجميع الروابط: ${admin.settings?.autoCollectLinks ? '✅ مفعل' : '❌ معطل'}
• 🤖 الرد التلقائي: ${admin.settings?.autoReplyEnabled ? '✅ مفعل' : '❌ معطل'}

🔧 *خيارات الإعدادات:*
• **🔔 الإشعارات:** التحكم في الإشعارات اليومية والفورية
• **🌐 اللغة:** تغيير لغة واجهة البوت
• **📱 حد الجلسات:** تحديد الحد الأقصى لعدد الجلسات
• **🔗 تجميع الروابط:** تفعيل/تعطيل التجميع التلقائي
• **🤖 الرد التلقائي:** إدارة نظام الردود التلقائية
• **➕ الانضمام التلقائي:** إعدادات الانضمام للمجموعات
• **📊 التقارير:** تخصيص التقارير والإحصائيات
• **🔒 الأمان:** إعدادات الأمان والحماية
• **🔄 إعادة التعيين:** إعادة تعيين الإعدادات للافتراضية
• **📋 معلومات الحساب:** عرض وتعديل معلومات الحساب

💡 *تلميح:* يمكنك تعديل أي إعداد بالنقر عليه
    `;
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
    });
}

async function showHelpMenu(chatId, adminId) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📚 الأوامر', callback_data: 'help_commands' },
                { text: '📱 الجلسات', callback_data: 'help_sessions' }
            ],
            [
                { text: '🔗 الروابط', callback_data: 'help_links' },
                { text: '📢 الإعلانات', callback_data: 'help_ads' }
            ],
            [
                { text: '🔄 النشر التلقائي', callback_data: 'help_autopost' },
                { text: '➕ الانضمام', callback_data: 'help_autojoin' }
            ],
            [
                { text: '🤖 الردود', callback_data: 'help_autoreply' },
                { text: '📨 البث', callback_data: 'help_broadcast' }
            ],
            [
                { text: '📊 الإحصائيات', callback_data: 'help_stats' },
                { text: '⚙️ الإعدادات', callback_data: 'help_settings' }
            ],
            [
                { text: '🆘 الدعم الفني', callback_data: 'help_support' },
                { text: '📞 التواصل', callback_data: 'help_contact' }
            ],
            [
                { text: '🏠 الرئيسية', callback_data: 'menu_main' }
            ]
        ]
    };
    
    const message = `
🆘 *مركز المساعدة والدعم*

🤖 *عن البوت:*
• **الاسم:** WhatsApp Telegram Bot
• **الإصدار:** 2.0.0 - Render Optimized
• **النوع:** نظام إدارة WhatsApp عبر Telegram
• **الحالة:** ✅ نشط ومستقر

🚀 *الميزات الرئيسية:*
• 📱 *ربط حسابات WhatsApp كجهاز مصاحب*
  - ربط متعدد للحسابات
  - QR Code تلقائي
  - إدارة مركزية

• 🔗 *تجميع الروابع تلقائياً*
  - اكتشاف ذكي للروابط
  - تصنيف تلقائي
  - منع التكرار

• 📢 *نظام إعلانات متكامل*
  - إعلانات نصية وصورية
  - نشر تلقائي
  - إحصائيات مفصلة

• 🔄 *النشر التلقائي*
  - نشر في جميع المجموعات
  - توقيت قابل للتعديل
  - استمرارية النشر

• ➕ *الانضمام التلقائي*
  - اكتشاف روابط واتساب
  - انضمام تلقائي
  - تقارير مفصلة

• 🤖 *الردود التلقائية*
  - ردود خاصة وجماعية
  - محفزات نصية متقدمة
  - إدارة متقدمة

• 📊 *إحصائيات وتقارير*
  - إحصائيات مفصلة
  - تقارير أداء
  - سجلات النشاطات

🔧 *الدعم الفني:*
• للأخطاء التقنية: تواصل مع المطور
• للاستفسارات: راجع الأسئلة الشائعة
• للاقتراحات: أرسل اقتراحك عبر زر التواصل

📞 *التواصل:*
• المطور: متاح عبر زر التواصل
• القناة: قناة التحديثات والإعلانات
• المجموعة: مجموعة الدعم والمناقشة

⚡ *نصائح مهمة:*
1. حافظ على تحديث البوت
2. احتفظ بنسخة احتياطية من البيانات
3. استخدم إعدادات الأمان
4. راجع التقارير بانتظام

اختر القسم الذي تريد مساعدة فيه:
    `;
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true
    });
}

// ============================================
// 11. معالجات إضافية للأزرار
// ============================================
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

// ============================================
// 12. بدء التشغيل الرئيسي
// ============================================
async function startBot() {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 بدء تشغيل WhatsApp Telegram Bot المتقدم');
    console.log('='.repeat(50) + '\n');
    
    try {
        // 1. إنشاء المجلدات الضرورية
        console.log('📁 جاري إنشاء المجلدات...');
        const folders = ['database', 'sessions', 'logs', 'temp'];
        
        for (const folder of folders) {
            try {
                await fs.mkdir(folder, { recursive: true });
                console.log(`   ✅ ${folder}/`);
            } catch (error) {
                console.log(`   ⚠️ ${folder}/: ${error.message}`);
            }
        }
        
        // 2. تهيئة قاعدة البيانات
        console.log('\n🗄️  جاري تهيئة قاعدة البيانات...');
        const dbSuccess = await initializeDatabase();
        if (!dbSuccess) {
            console.error('❌ فشل تهيئة قاعدة البيانات!');
            process.exit(1);
        }
        
        // 3. بدء سيرفر Express
        console.log('\n🌐 جاري تشغيل سيرفر الويب...');
        const server = app.listen(PORT, () => {
            console.log(`   ✅ السيرفر يعمل على: http://localhost:${PORT}`);
            console.log(`   ✅ صفحة الصحة: http://localhost:${PORT}/health`);
            console.log(`   ✅ صفحة الحالة: http://localhost:${PORT}/status`);
        });
        
        // 4. إعداد معالجات الأخطاء للسيرفر
        server.on('error', (error) => {
            console.error('❌ خطأ في سيرفر الويب:', error);
        });
        
        // 5. إعلام المشرفين
        console.log('\n👥 جاري إعلام المشرفين...');
        const adminIds = process.env.TELEGRAM_ADMIN_IDS ? 
            process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()) : 
            [];
        
        let notifiedCount = 0;
        for (const adminId of adminIds) {
            try {
                await bot.sendMessage(adminId,
                    '🚀 *البوت يعمل الآن!*\n\n' +
                    '✅ *تم تشغيل WhatsApp Telegram Bot بنجاح.*\n\n' +
                    '📋 *معلومات التشغيل:*\n' +
                    `• 🏗️ Platform: ${process.env.NODE_ENV || 'development'}\n` +
                    `• 🌐 Port: ${PORT}\n` +
                    `• ⏰ الوقت: ${new Date().toLocaleTimeString('ar-SA')}\n` +
                    `• 📅 التاريخ: ${new Date().toLocaleDateString('ar-SA')}\n\n` +
                    '🚀 *المميزات الجاهزة:*\n' +
                    '• 📱 ربط حسابات WhatsApp كجهاز مصاحب\n' +
                    '• 🔗 تجميع الروابط تلقائياً\n' +
                    '• 📢 نظام إعلانات متكامل\n' +
                    '• 🤖 ردود تلقائية ذكية\n\n' +
                    '⚡ *للبدء:* أرسل /start',
                    { parse_mode: 'Markdown' }
                );
                notifiedCount++;
                console.log(`   ✅ ${adminId}`);
            } catch (error) {
                console.log(`   ⚠️ ${adminId}: ${error.message}`);
            }
        }
        
        // 6. عرض رسالة النجاح
        console.log('\n' + '='.repeat(50));
        console.log('✅ ✅ ✅ البوت يعمل بنجاح! ✅ ✅ ✅');
        console.log('='.repeat(50));
        console.log('\n📋 *معلومات التشغيل:*');
        console.log(`🤖 Telegram Bot: ✅ جاهز (${notifiedCount}/${adminIds.length} مشرف)`);
        console.log(`📱 WhatsApp Manager: ✅ جاهز`);
        console.log(`🗄️  Database: ✅ ${dbInitialized ? 'جاهزة' : 'غير جاهزة'}`);
        console.log(`🌐 Web Server: ✅ جاهز (Port: ${PORT})`);
        console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📊 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log(`⏱️  Uptime: ${Math.floor(process.uptime())}s`);
        console.log('\n' + '='.repeat(50));
        console.log('⚡ *نصائح التشغيل:*');
        console.log('• استخدم /start في بوت التليجرام للبدء');
        console.log('• تابع الـ logs للاطلاع على الأحداث');
        console.log('• تفقد صفحة /health لمراقبة الحالة');
        console.log('• استخدم /help للحصول على المساعدة');
        console.log('='.repeat(50) + '\n');
        
        // 7. بدء مراقبة الذاكرة
        setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            
            if (heapUsed > 500) { // 500MB حد تحذير
                console.warn(`⚠️  تحذير: استخدام عالي للذاكرة: ${heapUsed}MB/${heapTotal}MB`);
            }
        }, 60000); // كل دقيقة
        
        return true;
        
    } catch (error) {
        console.error('\n❌ ❌ ❌ فشل بدء التشغيل! ❌ ❌ ❌');
        console.error('📋 الخطأ:', error);
        console.error('\n🔧 *الأسباب المحتملة:*');
        console.error('• توكن بوت التليجرام غير صالح');
        console.error('• مشكلة في اتصال قاعدة البيانات');
        console.error('• منفذ السيرفر مشغول مسبقاً');
        console.error('• نقص في صلاحيات النظام');
        console.error('\n🔄 *الحلول المقترحة:*');
        console.error('1. تحقق من متغيرات البيئة');
        console.error('2. تأكد من اتصال الإنترنت');
        console.error('3. جرب تغيير منفذ السيرفر');
        console.error('4. راجع الـ logs للحصول على تفاصيل أكثر');
        
        process.exit(1);
    }
}

// ============================================
// 13. التعامل مع الإيقاف النظيف
// ============================================
process.on('SIGINT', async () => {
    console.log('\n\n' + '='.repeat(50));
    console.log('🛑 تلقي إشارة إيقاف... جاري الإغلاق النظيف');
    console.log('='.repeat(50));
    
    try {
        // إرسال إشعار للمشرفين
        const adminIds = process.env.TELEGRAM_ADMIN_IDS ? 
            process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => id.trim()) : 
            [];
        
        for (const adminId of adminIds) {
            try {
                await bot.sendMessage(adminId,
                    '⚠️ *البوت يتم إيقافه...*\n\n' +
                    '🛑 تم تلقي إشارة إيقاف.\n' +
                    '🔧 جاري الإغلاق النظيف...\n\n' +
                    '⏰ الوقت: ' + new Date().toLocaleTimeString('ar-SA'),
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                // تجاهل أخطاء الإرسال عند الإيقاف
            }
        }
        
        // إغلاق جميع جلسات WhatsApp
        console.log('\n📱 جاري إغلاق جلسات WhatsApp...');
        let closedSessions = 0;
        
        for (const [sessionId, client] of whatsappClients.entries()) {
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
        console.log(`• 📱 جلسات WhatsApp: ${closedSessions}/${whatsappClients.size}`);
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
// 14. بدء التشغيل
// ============================================
if (require.main === module) {
    startBot().catch(error => {
        console.error('❌ فشل بدء التشغيل:', error);
        process.exit(1);
    });
}

// ============================================
// 15. التصدير للاستخدام الخارجي
// ============================================
module.exports = {
    app,
    bot,
    sequelize,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoPost,
    AutoReply,
    AutoJoin,
    Broadcast,
    whatsappClients,
    userStates,
    activeAutoPosts,
    activeAutoJoins,
    sessionQRs,
    messageQueues,
    cooldownTimers,
    dbInitialized,
    initializeDatabase,
    createWhatsAppSession,
    startBot
};
