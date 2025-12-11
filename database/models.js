// models.js - تعريف نماذج قاعدة البيانات
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// المسار لقاعدة البيانات
const dbPath = process.env.NODE_ENV === 'production' 
    ? process.env.DATABASE_URL
    : `sqlite:${path.join(__dirname, '../database/bot.db')}`;

const sequelize = new Sequelize(dbPath, {
    logging: process.env.DB_LOGGING === 'true' ? console.log : false
});

// تعريف النماذج
const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    telegramId: { type: DataTypes.STRING, unique: true, allowNull: false },
    username: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    passwordHash: DataTypes.STRING,
    permissions: { type: DataTypes.JSON, defaultValue: ['basic'] },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true });

const WhatsAppSession = sequelize.define('WhatsAppSession', {
    id: { type: DataTypes.STRING, primaryKey: true },
    sessionId: { type: DataTypes.STRING, unique: true },
    phoneNumber: DataTypes.STRING,
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    sessionData: DataTypes.TEXT,
    status: { 
        type: DataTypes.ENUM('pending', 'authenticating', 'active', 'disconnected', 'error'),
        defaultValue: 'pending'
    },
    qrCode: DataTypes.TEXT,
    lastActivity: DataTypes.DATE
}, { timestamps: true });

const CollectedLink = sequelize.define('CollectedLink', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: DataTypes.STRING, unique: true, allowNull: false },
    category: { 
        type: DataTypes.ENUM('whatsapp', 'telegram', 'website', 'other'),
        defaultValue: 'other'
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    sourceChat: DataTypes.STRING,
    sessionId: DataTypes.STRING
}, { timestamps: true });

const Advertisement = sequelize.define('Advertisement', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    type: { 
        type: DataTypes.ENUM('text', 'image', 'video', 'contact', 'document'),
        defaultValue: 'text'
    },
    content: { type: DataTypes.TEXT, allowNull: false },
    fileId: DataTypes.STRING,
    caption: DataTypes.TEXT,
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    schedule: DataTypes.JSON,
    stats: { type: DataTypes.JSON, defaultValue: { sent: 0, failed: 0 } }
}, { timestamps: true });

const AutoReply = sequelize.define('AutoReply', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    triggerType: { 
        type: DataTypes.ENUM('private', 'group', 'both'),
        defaultValue: 'both'
    },
    trigger: { type: DataTypes.STRING, allowNull: false },
    response: { type: DataTypes.TEXT, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    matchType: { 
        type: DataTypes.ENUM('exact', 'contains', 'regex'),
        defaultValue: 'contains'
    },
    stats: { type: DataTypes.JSON, defaultValue: { triggered: 0 } }
}, { timestamps: true });

// مزامنة النماذج
async function syncModels() {
    try {
        await sequelize.sync({ alter: true });
        console.log('✅ تم مزامنة نماذج قاعدة البيانات');
        return true;
    } catch (error) {
        console.error('❌ خطأ في مزامنة النماذج:', error);
        return false;
    }
}

module.exports = {
    sequelize,
    Admin,
    WhatsAppSession,
    CollectedLink,
    Advertisement,
    AutoReply,
    syncModels
};
