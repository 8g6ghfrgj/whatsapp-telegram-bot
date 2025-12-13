// ============================================
// 📦 WhatsApp Bot Migration Script
// هجرة البيانات والترقيات بين الإصدارات
// ============================================

const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MigrationManager {
    constructor() {
        this.migrations = [];
        this.currentVersion = '3.0.0';
        this.migrationLog = [];
        this.stats = {
            tablesCreated: 0,
            tablesAltered: 0,
            tablesDropped: 0,
            columnsAdded: 0,
            columnsModified: 0,
            columnsDropped: 0,
            indexesCreated: 0,
            indexesDropped: 0,
            dataMigrated: 0,
            errors: 0
        };
    }

    // ============================================
    // 1. تهيئة المدير
    // ============================================
    async initialize(sequelize) {
        this.sequelize = sequelize;
        
        // تحميل الملفات المطلوبة من index.js
        this.loadModels();
        
        // تسجيل الهجرات المتاحة
        this.registerMigrations();
        
        console.log(`📦 مدير الهجرة مهيأ (الإصدار: ${this.currentVersion})`);
    }

    loadModels() {
        try {
            const models = require('../index');
            this.models = {
                Admin: models.Admin,
                WhatsAppSession: models.WhatsAppSession,
                CollectedLink: models.CollectedLink,
                Advertisement: models.Advertisement,
                AutoPost: models.AutoPost,
                AutoReply: models.AutoReply,
                AutoJoin: models.AutoJoin,
                Broadcast: models.Broadcast
            };
            
            console.log('✅ تم تحميل النماذج بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تحميل النماذج:', error);
            throw error;
        }
    }

    // ============================================
    // 2. تسجيل جميع الهجرات
    // ============================================
    registerMigrations() {
        // الهجرات الأساسية - إنشاء الجداول
        this.migrations.push({
            version: '1.0.0',
            name: 'إنشاء الجداول الأساسية',
            description: 'إنشاء جميع الجداول الأساسية للنظام',
            up: async () => await this.createInitialTables(),
            down: async () => await this.dropAllTables()
        });

        // إضافة أعمدة إضافية
        this.migrations.push({
            version: '2.0.0',
            name: 'إضافة أعمدة إضافية',
            description: 'إضافة أعمدة جديدة للتحسينات',
            up: async () => await this.addAdditionalColumns(),
            down: async () => await this.removeAdditionalColumns()
        });

        // إنشاء الفهارس
        this.migrations.push({
            version: '2.1.0',
            name: 'تحسين الفهارس',
            description: 'إنشاء فهارس لتحسين الأداء',
            up: async () => await this.createIndexes(),
            down: async () => await this.dropIndexes()
        });

        // هجرة البيانات من الإصدارات القديمة
        this.migrations.push({
            version: '2.2.0',
            name: 'هجرة البيانات',
            description: 'هجرة البيانات من الإصدارات القديمة',
            up: async () => await this.migrateOldData(),
            down: async () => await this.revertDataMigration()
        });

        // الترقية للإصدار 3.0.0
        this.migrations.push({
            version: '3.0.0',
            name: 'الترقية للإصدار 3.0.0',
            description: 'إضافة مميزات جديدة وتحسين الهيكل',
            up: async () => await this.upgradeToV3(),
            down: async () => await this.downgradeFromV3()
        });

        // إصلاحات الأمان
        this.migrations.push({
            version: '3.0.1',
            name: 'إصلاحات الأمان',
            description: 'إصلاح ثغرات أمان وتحسين الحماية',
            up: async () => await this.applySecurityFixes(),
            down: async () => await this.revertSecurityFixes()
        });

        console.log(`✅ تم تسجيل ${this.migrations.length} هجرة`);
    }

    // ============================================
    // 3. الدالة الرئيسية للهجرة
    // ============================================
    async migrate(targetVersion = this.currentVersion) {
        console.log(`🚀 بدء عملية الهجرة إلى الإصدار ${targetVersion}\n`);

        try {
            // التحقق من اتصال قاعدة البيانات
            await this.checkDatabaseConnection();

            // إنشاء جدول سجلات الهجرة إذا لم يكن موجوداً
            await this.createMigrationTable();

            // الحصول على الإصدار الحالي
            const currentVersion = await this.getCurrentVersion();
            console.log(`📋 الإصدار الحالي: ${currentVersion || 'غير مثبت'}`);

            // ترتيب الهجرات حسب الإصدار
            const sortedMigrations = this.migrations
                .sort((a, b) => this.compareVersions(a.version, b.version))
                .filter(migration => 
                    this.compareVersions(migration.version, currentVersion || '0.0.0') > 0 &&
                    this.compareVersions(migration.version, targetVersion) <= 0
                );

            if (sortedMigrations.length === 0) {
                console.log('✅ النظام محدث بالفعل');
                return this.stats;
            }

            console.log(`📦 عدد الهجرات المطلوبة: ${sortedMigrations.length}\n`);

            // تنفيذ الهجرات بالترتيب
            for (const migration of sortedMigrations) {
                await this.executeMigration(migration);
            }

            // تحديث الإصدار الحالي
            await this.updateCurrentVersion(targetVersion);

            console.log('\n============================================');
            console.log(`✅ تمت الهجرة بنجاح إلى الإصدار ${targetVersion}`);
            console.log('============================================\n');

            this.printStats();
            await this.saveMigrationLog();

            return this.stats;

        } catch (error) {
            console.error('\n❌ فشلت عملية الهجرة:', error);
            await this.saveErrorLog(error);
            throw error;
        }
    }

    // ============================================
    // 4. التراجع عن الهجرة
    // ============================================
    async rollback(targetVersion = '1.0.0') {
        console.log(`↩️ بدء التراجع عن الهجرة إلى الإصدار ${targetVersion}\n`);

        try {
            // الحصول على الإصدار الحالي
            const currentVersion = await this.getCurrentVersion();
            
            if (!currentVersion) {
                throw new Error('لم يتم العثور على إصدار مثبت');
            }

            console.log(`📋 الإصدار الحالي: ${currentVersion}`);

            // ترتيب الهجرات للتراجع (من الأعلى للأسفل)
            const sortedMigrations = this.migrations
                .sort((a, b) => this.compareVersions(b.version, a.version))
                .filter(migration => 
                    this.compareVersions(migration.version, currentVersion) <= 0 &&
                    this.compareVersions(migration.version, targetVersion) > 0
                );

            if (sortedMigrations.length === 0) {
                console.log('✅ لا توجد هجرات للتراجع عنها');
                return;
            }

            console.log(`📦 عدد الهجرات للتراجع: ${sortedMigrations.length}\n`);

            // تنفيذ التراجع بالترتيب
            for (const migration of sortedMigrations) {
                await this.executeRollback(migration);
            }

            // تحديث الإصدار الحالي
            await this.updateCurrentVersion(targetVersion);

            console.log('\n============================================');
            console.log(`✅ تم التراجع بنجاح إلى الإصدار ${targetVersion}`);
            console.log('============================================\n');

            this.printStats();

        } catch (error) {
            console.error('\n❌ فشل التراجع:', error);
            throw error;
        }
    }

    // ============================================
    // 5. تنفيذ هجرة واحدة
    // ============================================
    async executeMigration(migration) {
        console.log(`⬆️  جاري الهجرة: ${migration.name} (${migration.version})`);
        console.log(`   📝 ${migration.description}`);

        const startTime = Date.now();

        try {
            // تسجيل بداية الهجرة
            await this.logMigrationStart(migration);

            // تنفيذ الهجرة
            await migration.up();

            // تسجيل نجاح الهجرة
            await this.logMigrationSuccess(migration);

            const duration = Date.now() - startTime;
            console.log(`   ✅ تمت الهجرة بنجاح (${duration}ms)`);

        } catch (error) {
            // تسجيل فشل الهجرة
            await this.logMigrationFailure(migration, error);
            
            console.error(`   ❌ فشلت الهجرة: ${error.message}`);
            this.stats.errors++;
            
            throw error;
        }
    }

    async executeRollback(migration) {
        console.log(`⬇️  جاري التراجع: ${migration.name} (${migration.version})`);

        const startTime = Date.now();

        try {
            // تسجيل بداية التراجع
            await this.logRollbackStart(migration);

            // تنفيذ التراجع
            await migration.down();

            // تسجيل نجاح التراجع
            await this.logRollbackSuccess(migration);

            const duration = Date.now() - startTime;
            console.log(`   ✅ تم التراجع بنجاح (${duration}ms)`);

        } catch (error) {
            console.error(`   ❌ فشل التراجع: ${error.message}`);
            this.stats.errors++;
            
            throw error;
        }
    }

    // ============================================
    // 6. إنشاء الجداول الأساسية
    // ============================================
    async createInitialTables() {
        const transaction = await this.sequelize.transaction();

        try {
            console.log('   🗄️  جاري إنشاء الجداول الأساسية...');

            // 1. جدول المشرفين
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS admins (
                    id VARCHAR(50) PRIMARY KEY,
                    telegram_id VARCHAR(50) UNIQUE NOT NULL,
                    username VARCHAR(100),
                    first_name VARCHAR(100) NOT NULL DEFAULT 'مشرف',
                    last_name VARCHAR(100),
                    permissions JSON NOT NULL DEFAULT '["manage_sessions", "manage_ads", "view_stats"]',
                    settings JSON NOT NULL DEFAULT '{
                        "notificationEnabled": true,
                        "language": "ar",
                        "maxSessions": 10,
                        "autoCollectLinks": true,
                        "autoReplyEnabled": true
                    }',
                    last_activity DATETIME,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_admins_telegram_id (telegram_id),
                    INDEX idx_admins_is_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول admins');

            // 2. جدول جلسات WhatsApp
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                    id VARCHAR(50) PRIMARY KEY,
                    session_id VARCHAR(100) UNIQUE NOT NULL,
                    phone_number VARCHAR(20) NOT NULL,
                    admin_id VARCHAR(50) NOT NULL,
                    status ENUM('awaiting_qr', 'connected', 'authenticated', 'disconnected', 'error') NOT NULL DEFAULT 'awaiting_qr',
                    qr_code TEXT,
                    qr_sent_at DATETIME,
                    connected_at DATETIME,
                    disconnected_at DATETIME,
                    groups_count INT NOT NULL DEFAULT 0,
                    contacts_count INT NOT NULL DEFAULT 0,
                    connection_data JSON,
                    settings JSON NOT NULL DEFAULT '{
                        "autoReply": true,
                        "autoCollect": true,
                        "autoJoin": false,
                        "broadcastEnabled": true
                    }',
                    stats JSON NOT NULL DEFAULT '{
                        "messagesReceived": 0,
                        "messagesSent": 0,
                        "linksCollected": 0,
                        "groupsJoined": 0
                    }',
                    last_activity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_sessions_admin_id (admin_id),
                    INDEX idx_sessions_status (status),
                    INDEX idx_sessions_session_id (session_id),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول whatsapp_sessions');

            // 3. جدول الروابط المجمعة
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS collected_links (
                    id VARCHAR(50) PRIMARY KEY,
                    url VARCHAR(500) NOT NULL,
                    type ENUM('whatsapp_group', 'whatsapp_invite', 'telegram', 'discord', 'signal', 'website', 'other') NOT NULL DEFAULT 'other',
                    title VARCHAR(255),
                    description TEXT,
                    source VARCHAR(255),
                    session_id VARCHAR(50) NOT NULL,
                    status ENUM('active', 'inactive', 'joined', 'failed', 'pending') NOT NULL DEFAULT 'active',
                    collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_checked DATETIME,
                    check_count INT NOT NULL DEFAULT 0,
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    UNIQUE INDEX idx_links_url (url),
                    INDEX idx_links_type (type),
                    INDEX idx_links_session_id (session_id),
                    INDEX idx_links_status (status),
                    INDEX idx_links_collected_at (collected_at),
                    FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول collected_links');

            // 4. جدول الإعلانات
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS advertisements (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type ENUM('text', 'image', 'video', 'contact', 'document') NOT NULL DEFAULT 'text',
                    content LONGTEXT NOT NULL,
                    admin_id VARCHAR(50) NOT NULL,
                    target JSON DEFAULT '{
                        "allGroups": true,
                        "specificGroups": [],
                        "minMembers": 0,
                        "maxMembers": 1000000
                    }',
                    schedule JSON DEFAULT '{
                        "startTime": null,
                        "endTime": null,
                        "repeat": false,
                        "interval": 3600,
                        "daysOfWeek": [0,1,2,3,4,5,6]
                    }',
                    settings JSON NOT NULL DEFAULT '{
                        "delayBetweenGroups": 1000,
                        "retryFailed": true,
                        "optimizeSending": true,
                        "maxRetries": 3
                    }',
                    stats JSON NOT NULL DEFAULT '{
                        "sent": 0,
                        "failed": 0,
                        "lastSent": null,
                        "successRate": 0
                    }',
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_ads_admin_id (admin_id),
                    INDEX idx_ads_is_active (is_active),
                    INDEX idx_ads_type (type),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول advertisements');

            // 5. جدول النشر التلقائي
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS auto_posts (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    ad_id VARCHAR(50) NOT NULL,
                    admin_id VARCHAR(50) NOT NULL,
                    target JSON DEFAULT '{
                        "allGroups": true,
                        "specificSessions": [],
                        "excludeGroups": []
                    }',
                    schedule JSON NOT NULL DEFAULT '{
                        "startTime": null,
                        "endTime": null,
                        "repeat": true,
                        "interval": 3600,
                        "daysOfWeek": [0,1,2,3,4,5,6],
                        "timezone": "Asia/Riyadh"
                    }',
                    status ENUM('active', 'paused', 'completed', 'error') NOT NULL DEFAULT 'active',
                    settings JSON NOT NULL DEFAULT '{
                        "delayBetweenGroups": 1000,
                        "delayBetweenSessions": 5000,
                        "maxGroupsPerCycle": 50,
                        "retryFailed": true
                    }',
                    stats JSON NOT NULL DEFAULT '{
                        "cyclesCompleted": 0,
                        "totalSent": 0,
                        "totalFailed": 0,
                        "lastCycleAt": null,
                        "successRate": 0
                    }',
                    last_run_at DATETIME,
                    next_run_at DATETIME,
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_posts_admin_id (admin_id),
                    INDEX idx_posts_status (status),
                    INDEX idx_posts_ad_id (ad_id),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                    FOREIGN KEY (ad_id) REFERENCES advertisements(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول auto_posts');

            // 6. جدول الردود التلقائية
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS auto_replies (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    trigger_type ENUM('private', 'group', 'both') NOT NULL DEFAULT 'both',
                    trigger TEXT NOT NULL,
                    response LONGTEXT NOT NULL,
                    response_type ENUM('text', 'image', 'video', 'contact', 'document') NOT NULL DEFAULT 'text',
                    match_type ENUM('exact', 'contains', 'regex', 'starts_with', 'ends_with') NOT NULL DEFAULT 'contains',
                    admin_id VARCHAR(50) NOT NULL,
                    session_id VARCHAR(50),
                    conditions JSON DEFAULT '{
                        "requireKeywords": [],
                        "excludeKeywords": [],
                        "timeRange": null,
                        "daysOfWeek": [0,1,2,3,4,5,6]
                    }',
                    priority INT NOT NULL DEFAULT 5,
                    cooldown INT NOT NULL DEFAULT 30,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    stats JSON NOT NULL DEFAULT '{
                        "triggered": 0,
                        "failed": 0,
                        "lastTriggered": null,
                        "bySession": {}
                    }',
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_replies_admin_id (admin_id),
                    INDEX idx_replies_session_id (session_id),
                    INDEX idx_replies_is_active (is_active),
                    INDEX idx_replies_trigger_type (trigger_type),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                    FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول auto_replies');

            // 7. جدول الانضمام التلقائي
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS auto_joins (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    admin_id VARCHAR(50) NOT NULL,
                    session_id VARCHAR(50) NOT NULL,
                    links JSON NOT NULL DEFAULT '[]',
                    filters JSON DEFAULT '{
                        "minMembers": 0,
                        "maxMembers": 1000000,
                        "allowedKeywords": [],
                        "excludedKeywords": []
                    }',
                    status ENUM('active', 'paused', 'completed', 'error') NOT NULL DEFAULT 'active',
                    settings JSON NOT NULL DEFAULT '{
                        "delayBetweenJoins": 120000,
                        "maxJoinsPerDay": 50,
                        "notifyOnJoin": true,
                        "stopOnError": false
                    }',
                    stats JSON NOT NULL DEFAULT '{
                        "totalLinks": 0,
                        "joined": 0,
                        "failed": 0,
                        "successRate": 0,
                        "lastJoinAt": null,
                        "lastError": null,
                        "lastLinks": []
                    }',
                    last_run_at DATETIME,
                    next_run_at DATETIME,
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_joins_admin_id (admin_id),
                    INDEX idx_joins_session_id (session_id),
                    INDEX idx_joins_status (status),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
                    FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول auto_joins');

            // 8. جدول البث الجماعي
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS broadcasts (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type ENUM('contacts', 'groups', 'both', 'specific') NOT NULL DEFAULT 'groups',
                    content LONGTEXT NOT NULL,
                    admin_id VARCHAR(50) NOT NULL,
                    target JSON DEFAULT '{
                        "allContacts": true,
                        "allGroups": true,
                        "specificContacts": [],
                        "specificGroups": []
                    }',
                    schedule JSON DEFAULT '{
                        "sendAt": null,
                        "repeat": false,
                        "interval": 0
                    }',
                    status ENUM('scheduled', 'sending', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'scheduled',
                    stats JSON NOT NULL DEFAULT '{
                        "total": 0,
                        "sent": 0,
                        "failed": 0,
                        "progress": 0,
                        "startTime": null,
                        "endTime": null
                    }',
                    metadata JSON,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at DATETIME,
                    INDEX idx_broadcasts_admin_id (admin_id),
                    INDEX idx_broadcasts_status (status),
                    INDEX idx_broadcasts_type (type),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `, { transaction });

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول broadcasts');

            await transaction.commit();
            console.log('   ✅ تم إنشاء جميع الجداول بنجاح');

        } catch (error) {
            await transaction.rollback();
            console.error('   ❌ فشل إنشاء الجداول:', error.message);
            throw error;
        }
    }

    async dropAllTables() {
        try {
            console.log('   🗑️  جاري حذف جميع الجداول...');

            // ترتيب الحذف حسب العلاقات
            const tables = [
                'broadcasts',
                'auto_joins',
                'auto_replies',
                'auto_posts',
                'advertisements',
                'collected_links',
                'whatsapp_sessions',
                'admins',
                'migrations'
            ];

            for (const table of tables) {
                try {
                    await this.sequelize.query(`DROP TABLE IF EXISTS ${table}`);
                    this.stats.tablesDropped++;
                    this.logMigrationStep(`تم حذف جدول ${table}`);
                } catch (error) {
                    console.log(`   ⚠️  تعذر حذف جدول ${table}: ${error.message}`);
                }
            }

            console.log('   ✅ تم حذف جميع الجداول');

        } catch (error) {
            console.error('   ❌ فشل حذف الجداول:', error.message);
            throw error;
        }
    }

    // ============================================
    // 7. إضافة أعمدة إضافية
    // ============================================
    async addAdditionalColumns() {
        try {
            console.log('   ➕ جاري إضافة أعمدة إضافية...');

            // 1. إضافة عمولات للمشرفين
            await this.sequelize.query(`
                ALTER TABLE admins 
                ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS last_payment_date DATETIME,
                ADD INDEX idx_admins_commission (commission_rate);
            `);

            this.stats.columnsAdded += 4;
            this.logMigrationStep('تم إضافة أعمدة العمولات للمشرفين');

            // 2. إضافة إعدادات متقدمة للجلسات
            await this.sequelize.query(`
                ALTER TABLE whatsapp_sessions
                ADD COLUMN IF NOT EXISTS max_groups_per_day INT DEFAULT 50,
                ADD COLUMN IF NOT EXISTS max_messages_per_day INT DEFAULT 1000,
                ADD COLUMN IF NOT EXISTS auto_leave_inactive BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS inactive_days_threshold INT DEFAULT 30,
                ADD INDEX idx_sessions_limits (max_groups_per_day, max_messages_per_day);
            `);

            this.stats.columnsAdded += 4;
            this.logMigrationStep('تم إضافة إعدادات متقدمة للجلسات');

            // 3. إضافة تصنيف للروابط
            await this.sequelize.query(`
                ALTER TABLE collected_links
                ADD COLUMN IF NOT EXISTS category VARCHAR(100),
                ADD COLUMN IF NOT EXISTS quality_score INT DEFAULT 50,
                ADD COLUMN IF NOT EXISTS last_activity_score INT DEFAULT 0,
                ADD INDEX idx_links_category (category),
                ADD INDEX idx_links_quality (quality_score);
            `);

            this.stats.columnsAdded += 3;
            this.logMigrationStep('تم إضافة تصنيف للروابط');

            // 4. إضافة إحصائيات متقدمة للإعلانات
            await this.sequelize.query(`
                ALTER TABLE advertisements
                ADD COLUMN IF NOT EXISTS cost_per_message DECIMAL(10,4) DEFAULT 0.0000,
                ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS roi DECIMAL(5,2) DEFAULT 0.00,
                ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,2) DEFAULT 0.00;
            `);

            this.stats.columnsAdded += 4;
            this.logMigrationStep('تم إضافة إحصائيات متقدمة للإعلانات');

            console.log('   ✅ تم إضافة جميع الأعمدة الإضافية');

        } catch (error) {
            console.error('   ❌ فشل إضافة الأعمدة:', error.message);
            throw error;
        }
    }

    async removeAdditionalColumns() {
        try {
            console.log('   ➖ جاري إزالة الأعمدة الإضافية...');

            const queries = [
                `ALTER TABLE admins 
                 DROP COLUMN IF EXISTS commission_rate,
                 DROP COLUMN IF EXISTS total_earnings,
                 DROP COLUMN IF EXISTS last_payment_date`,

                `ALTER TABLE whatsapp_sessions
                 DROP COLUMN IF EXISTS max_groups_per_day,
                 DROP COLUMN IF EXISTS max_messages_per_day,
                 DROP COLUMN IF EXISTS auto_leave_inactive,
                 DROP COLUMN IF EXISTS inactive_days_threshold`,

                `ALTER TABLE collected_links
                 DROP COLUMN IF EXISTS category,
                 DROP COLUMN IF EXISTS quality_score,
                 DROP COLUMN IF EXISTS last_activity_score`,

                `ALTER TABLE advertisements
                 DROP COLUMN IF EXISTS cost_per_message,
                 DROP COLUMN IF EXISTS total_cost,
                 DROP COLUMN IF EXISTS roi,
                 DROP COLUMN IF EXISTS engagement_rate`
            ];

            for (const query of queries) {
                await this.sequelize.query(query);
            }

            this.stats.columnsDropped += 15;
            console.log('   ✅ تم إزالة جميع الأعمدة الإضافية');

        } catch (error) {
            console.error('   ❌ فشل إزالة الأعمدة:', error.message);
            throw error;
        }
    }

    // ============================================
    // 8. إنشاء الفهارس
    // ============================================
    async createIndexes() {
        try {
            console.log('   🔍 جاري إنشاء الفهارس...');

            // فهارس الأداء
            const indexes = [
                // فهارس admins
                `CREATE INDEX IF NOT EXISTS idx_admins_created_at ON admins(created_at)`,
                `CREATE INDEX IF NOT EXISTS idx_admins_last_activity ON admins(last_activity)`,

                // فهارس whatsapp_sessions
                `CREATE INDEX IF NOT EXISTS idx_sessions_phone ON whatsapp_sessions(phone_number)`,
                `CREATE INDEX IF NOT EXISTS idx_sessions_connected_at ON whatsapp_sessions(connected_at)`,

                // فهارس collected_links
                `CREATE INDEX IF NOT EXISTS idx_links_created_at ON collected_links(created_at)`,
                `CREATE INDEX IF NOT EXISTS idx_links_session_status ON collected_links(session_id, status)`,

                // فهارس advertisements
                `CREATE INDEX IF NOT EXISTS idx_ads_created_at ON advertisements(created_at)`,
                `CREATE INDEX IF NOT EXISTS idx_ads_admin_active ON advertisements(admin_id, is_active)`,

                // فهارس auto_replies
                `CREATE INDEX IF NOT EXISTS idx_replies_priority ON auto_replies(priority)`,
                `CREATE INDEX IF NOT EXISTS idx_replies_trigger ON auto_replies(trigger(100))`,

                // فهارس auto_joins
                `CREATE INDEX IF NOT EXISTS idx_joins_last_run ON auto_joins(last_run_at)`,
                `CREATE INDEX IF NOT EXISTS idx_joins_next_run ON auto_joins(next_run_at)`,

                // فهارس broadcasts
                `CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at)`,
                `CREATE INDEX IF NOT EXISTS idx_broadcasts_schedule ON broadcasts((CAST(schedule->'$.sendAt' AS DATETIME)))`
            ];

            for (const query of indexes) {
                await this.sequelize.query(query);
                this.stats.indexesCreated++;
            }

            console.log(`   ✅ تم إنشاء ${indexes.length} فهرس`);

        } catch (error) {
            console.error('   ❌ فشل إنشاء الفهارس:', error.message);
            throw error;
        }
    }

    async dropIndexes() {
        try {
            console.log('   🔍 جاري حذف الفهارس...');

            const indexes = [
                'idx_admins_created_at',
                'idx_admins_last_activity',
                'idx_sessions_phone',
                'idx_sessions_connected_at',
                'idx_links_created_at',
                'idx_links_session_status',
                'idx_ads_created_at',
                'idx_ads_admin_active',
                'idx_replies_priority',
                'idx_replies_trigger',
                'idx_joins_last_run',
                'idx_joins_next_run',
                'idx_broadcasts_created_at',
                'idx_broadcasts_schedule'
            ];

            for (const index of indexes) {
                try {
                    await this.sequelize.query(`DROP INDEX IF EXISTS ${index}`);
                    this.stats.indexesDropped++;
                } catch (error) {
                    // تجاهل إذا كان الفهرس غير موجود
                }
            }

            console.log(`   ✅ تم حذف ${indexes.length} فهرس`);

        } catch (error) {
            console.error('   ❌ فشل حذف الفهارس:', error.message);
            throw error;
        }
    }

    // ============================================
    // 9. هجرة البيانات من الإصدارات القديمة
    // ============================================
    async migrateOldData() {
        try {
            console.log('   📊 جاري هجرة البيانات القديمة...');

            // التحقق من وجود جداول قديمة
            const oldTables = await this.checkOldTables();
            
            if (oldTables.length === 0) {
                console.log('   ℹ️ لا توجد بيانات قديمة للهجرة');
                return;
            }

            console.log(`   📦 وجد ${oldTables.length} جدول قديم`);

            // هنا يمكن إضافة منطق هجرة البيانات من الإصدارات القديمة
            // مثال: هجرة من جدول users إلى admins
            await this.migrateUsersToAdmins();
            
            // مثال: هجرة من جدول whatsapp_accounts إلى whatsapp_sessions
            await this.migrateAccountsToSessions();

            this.stats.dataMigrated++;
            console.log('   ✅ تمت هجرة البيانات القديمة');

        } catch (error) {
            console.error('   ❌ فشل هجرة البيانات:', error.message);
            throw error;
        }
    }

    async checkOldTables() {
        try {
            const [tables] = await this.sequelize.query(`
                SHOW TABLES LIKE 'users' 
                OR LIKE 'whatsapp_accounts' 
                OR LIKE 'messages' 
                OR LIKE 'groups'
            `);
            
            return tables;
        } catch (error) {
            return [];
        }
    }

    async migrateUsersToAdmins() {
        try {
            // التحقق من وجود جدول users القديم
            const [exists] = await this.sequelize.query(`
                SELECT COUNT(*) as count FROM information_schema.tables 
                WHERE table_schema = DATABASE() AND table_name = 'users'
            `);

            if (exists[0].count === 0) {
                return;
            }

            // هجرة البيانات
            await this.sequelize.query(`
                INSERT INTO admins (id, telegram_id, username, first_name, permissions, settings, created_at)
                SELECT 
                    CONCAT('admin_', UNIX_TIMESTAMP(), '_', UUID()),
                    telegram_id,
                    username,
                    COALESCE(first_name, 'مستخدم قديم'),
                    '["manage_sessions", "manage_ads", "view_stats"]',
                    '{"notificationEnabled": true, "language": "ar", "maxSessions": 5}',
                    COALESCE(created_at, NOW())
                FROM users
                WHERE telegram_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM admins a WHERE a.telegram_id = users.telegram_id)
            `);

            this.logMigrationStep('تم هجرة المستخدمين إلى المشرفين');

        } catch (error) {
            console.log(`   ⚠️  تعذر هجرة المستخدمين: ${error.message}`);
        }
    }

    async migrateAccountsToSessions() {
        try {
            // التحقق من وجود جدول whatsapp_accounts القديم
            const [exists] = await this.sequelize.query(`
                SELECT COUNT(*) as count FROM information_schema.tables 
                WHERE table_schema = DATABASE() AND table_name = 'whatsapp_accounts'
            `);

            if (exists[0].count === 0) {
                return;
            }

            // هنا يمكن إضافة منطق الهجرة
            this.logMigrationStep('تم هجرة الحسابات إلى الجلسات');

        } catch (error) {
            console.log(`   ⚠️  تعذر هجرة الحسابات: ${error.message}`);
        }
    }

    async revertDataMigration() {
        try {
            console.log('   ↩️ جاري التراجع عن هجرة البيانات...');
            
            // لا نقوم بحذف البيانات الحالية، فقط نسجل التراجع
            this.logMigrationStep('تم التراجع عن هجرة البيانات');
            
            console.log('   ✅ تم التراجع عن هجرة البيانات');

        } catch (error) {
            console.error('   ❌ فشل التراجع عن هجرة البيانات:', error.message);
            throw error;
        }
    }

    // ============================================
    // 10. الترقية للإصدار 3.0.0
    // ============================================
    async upgradeToV3() {
        try {
            console.log('   ⬆️  جاري الترقية للإصدار 3.0.0...');

            // 1. إضافة دعم الصور والفيديوهات في الردود التلقائية
            await this.sequelize.query(`
                ALTER TABLE auto_replies 
                MODIFY COLUMN response LONGTEXT NOT NULL,
                ADD COLUMN IF NOT EXISTS media_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
                ADD COLUMN IF NOT EXISTS media_size INT;
            `);

            // 2. إضافة نظام الأرشفة
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS archives (
                    id VARCHAR(50) PRIMARY KEY,
                    table_name VARCHAR(100) NOT NULL,
                    record_id VARCHAR(50) NOT NULL,
                    data JSON NOT NULL,
                    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    archived_by VARCHAR(50),
                    reason VARCHAR(255),
                    INDEX idx_archives_table (table_name),
                    INDEX idx_archives_record (record_id),
                    INDEX idx_archives_date (archived_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول الأرشفة');

            // 3. إضافة سجلات النشاطات
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id VARCHAR(50) PRIMARY KEY,
                    admin_id VARCHAR(50),
                    session_id VARCHAR(50),
                    action VARCHAR(100) NOT NULL,
                    details JSON,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_logs_admin (admin_id),
                    INDEX idx_logs_action (action),
                    INDEX idx_logs_created_at (created_at),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
                    FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول سجلات النشاطات');

            // 4. إضافة نظام الإشعارات
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id VARCHAR(50) PRIMARY KEY,
                    admin_id VARCHAR(50) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    data JSON,
                    is_read BOOLEAN NOT NULL DEFAULT false,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    read_at DATETIME,
                    INDEX idx_notifications_admin (admin_id),
                    INDEX idx_notifications_read (is_read),
                    INDEX idx_notifications_created_at (created_at),
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول الإشعارات');

            console.log('   ✅ تمت الترقية للإصدار 3.0.0 بنجاح');

        } catch (error) {
            console.error('   ❌ فشل الترقية:', error.message);
            throw error;
        }
    }

    async downgradeFromV3() {
        try {
            console.log('   ⬇️  جاري التراجع من الإصدار 3.0.0...');

            // حذف الجداول المضافة
            const tables = ['notifications', 'activity_logs', 'archives'];
            
            for (const table of tables) {
                try {
                    await this.sequelize.query(`DROP TABLE IF EXISTS ${table}`);
                    this.stats.tablesDropped++;
                } catch (error) {
                    console.log(`   ⚠️  تعذر حذف جدول ${table}: ${error.message}`);
                }
            }

            // إزالة الأعمدة المضافة
            await this.sequelize.query(`
                ALTER TABLE auto_replies 
                DROP COLUMN IF EXISTS media_url,
                DROP COLUMN IF EXISTS media_type,
                DROP COLUMN IF EXISTS media_size;
            `);

            this.stats.columnsDropped += 3;

            console.log('   ✅ تم التراجع من الإصدار 3.0.0 بنجاح');

        } catch (error) {
            console.error('   ❌ فشل التراجع:', error.message);
            throw error;
        }
    }

    // ============================================
    // 11. إصلاحات الأمان
    // ============================================
    async applySecurityFixes() {
        try {
            console.log('   🔒 جاري تطبيق إصلاحات الأمان...');

            // 1. تشفير البيانات الحساسة
            await this.sequelize.query(`
                ALTER TABLE whatsapp_sessions
                ADD COLUMN IF NOT EXISTS encrypted_data TEXT,
                ADD COLUMN IF NOT EXISTS encryption_key VARCHAR(255);
            `);

            // 2. إضافة سجلات الدخول
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS login_attempts (
                    id VARCHAR(50) PRIMARY KEY,
                    telegram_id VARCHAR(50) NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    success BOOLEAN NOT NULL DEFAULT false,
                    attempt_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_login_telegram (telegram_id),
                    INDEX idx_login_time (attempt_time),
                    INDEX idx_login_success (success)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            this.stats.tablesCreated++;
            this.logMigrationStep('تم إنشاء جدول محاولات الدخول');

            // 3. إضافة صلاحيات متقدمة
            await this.sequelize.query(`
                ALTER TABLE admins
                ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(100),
                ADD COLUMN IF NOT EXISTS last_password_change DATETIME,
                ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS account_locked_until DATETIME;
            `);

            this.stats.columnsAdded += 5;
            this.logMigrationStep('تم إضافة إعدادات الأمان المتقدمة');

            console.log('   ✅ تم تطبيق إصلاحات الأمان');

        } catch (error) {
            console.error('   ❌ فشل تطبيق إصلاحات الأمان:', error.message);
            throw error;
        }
    }

    async revertSecurityFixes() {
        try {
            console.log('   🔓 جاري التراجع عن إصلاحات الأمان...');

            await this.sequelize.query(`DROP TABLE IF EXISTS login_attempts`);
            this.stats.tablesDropped++;

            await this.sequelize.query(`
                ALTER TABLE admins
                DROP COLUMN IF EXISTS two_factor_enabled,
                DROP COLUMN IF EXISTS two_factor_secret,
                DROP COLUMN IF EXISTS last_password_change,
                DROP COLUMN IF EXISTS failed_login_attempts,
                DROP COLUMN IF EXISTS account_locked_until;
            `);

            this.stats.columnsDropped += 5;

            console.log('   ✅ تم التراجع عن إصلاحات الأمان');

        } catch (error) {
            console.error('   ❌ فشل التراجع عن إصلاحات الأمان:', error.message);
            throw error;
        }
    }

    // ============================================
    // 12. إدارة سجلات الهجرة
    // ============================================
    async createMigrationTable() {
        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id VARCHAR(50) PRIMARY KEY,
                    version VARCHAR(20) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    execution_time_ms INT,
                    status ENUM('pending', 'success', 'failed', 'rolled_back') DEFAULT 'pending',
                    error_message TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_migrations_version (version),
                    INDEX idx_migrations_status (status),
                    INDEX idx_migrations_executed_at (executed_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

        } catch (error) {
            console.error('❌ فشل إنشاء جدول الهجرات:', error);
            throw error;
        }
    }

    async logMigrationStart(migration) {
        const migrationId = `mig_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        
        await this.sequelize.query(`
            INSERT INTO migrations (id, version, name, description, status, executed_at)
            VALUES (?, ?, ?, ?, 'pending', NOW())
        `, {
            replacements: [migrationId, migration.version, migration.name, migration.description]
        });

        this.migrationLog.push({
            id: migrationId,
            migration,
            startTime: Date.now()
        });
    }

    async logMigrationSuccess(migration) {
        const logEntry = this.migrationLog.find(log => log.migration === migration);
        if (!logEntry) return;

        const executionTime = Date.now() - logEntry.startTime;

        await this.sequelize.query(`
            UPDATE migrations 
            SET status = 'success', execution_time_ms = ?
            WHERE id = ?
        `, {
            replacements: [executionTime, logEntry.id]
        });
    }

    async logMigrationFailure(migration, error) {
        const logEntry = this.migrationLog.find(log => log.migration === migration);
        if (!logEntry) return;

        await this.sequelize.query(`
            UPDATE migrations 
            SET status = 'failed', error_message = ?
            WHERE id = ?
        `, {
            replacements: [error.message.substring(0, 500), logEntry.id]
        });
    }

    async logRollbackStart(migration) {
        await this.logMigrationStart(migration);
    }

    async logRollbackSuccess(migration) {
        const logEntry = this.migrationLog.find(log => log.migration === migration);
        if (!logEntry) return;

        await this.sequelize.query(`
            UPDATE migrations 
            SET status = 'rolled_back'
            WHERE id = ?
        `, {
            replacements: [logEntry.id]
        });
    }

    async getCurrentVersion() {
        try {
            const [rows] = await this.sequelize.query(`
                SELECT version FROM migrations 
                WHERE status = 'success' 
                ORDER BY executed_at DESC 
                LIMIT 1
            `);

            return rows.length > 0 ? rows[0].version : null;
        } catch (error) {
            return null;
        }
    }

    async updateCurrentVersion(version) {
        try {
            await this.sequelize.query(`
                INSERT INTO migrations (id, version, name, description, status, executed_at)
                VALUES (?, ?, 'تحديث الإصدار', 'تم تحديث النظام إلى إصدار جديد', 'success', NOW())
            `, {
                replacements: [`ver_${Date.now()}`, version]
            });
        } catch (error) {
            console.error('❌ فشل تحديث الإصدار:', error);
        }
    }

    // ============================================
    // 13. دوال مساعدة
    // ============================================
    logMigrationStep(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        this.migrationLog.push({ type: 'step', message: logEntry });
    }

    async checkDatabaseConnection() {
        try {
            await this.sequelize.authenticate();
            console.log('✅ الاتصال بقاعدة البيانات ناجح');
            return true;
        } catch (error) {
            console.error('❌ فشل الاتصال بقاعدة البيانات:', error);
            throw error;
        }
    }

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            
            if (part1 > part2) return 1;
            if (part1 < part2) return -1;
        }
        
        return 0;
    }

    printStats() {
        console.log('\n📊 إحصائيات الهجرة:');
        console.log('============================================');
        console.log(`🗄️  الجداول المنشأة: ${this.stats.tablesCreated}`);
        console.log(`✏️  الجداول المعدلة: ${this.stats.tablesAltered}`);
        console.log(`🗑️  الجداول المحذوفة: ${this.stats.tablesDropped}`);
        console.log(`➕ الأعمدة المضافة: ${this.stats.columnsAdded}`);
        console.log(`✏️  الأعمدة المعدلة: ${this.stats.columnsModified}`);
        console.log(`➖ الأعمدة المحذوفة: ${this.stats.columnsDropped}`);
        console.log(`🔍 الفهارس المنشأة: ${this.stats.indexesCreated}`);
        console.log(`🗑️  الفهارس المحذوفة: ${this.stats.indexesDropped}`);
        console.log(`📊 البيانات المهجرة: ${this.stats.dataMigrated}`);
        console.log(`❌ الأخطاء: ${this.stats.errors}`);
        console.log('============================================');
    }

    async saveMigrationLog() {
        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            
            // إنشاء مجلد logs إذا لم يكن موجوداً
            try {
                await fs.access(logsDir);
            } catch {
                await fs.mkdir(logsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFile = path.join(logsDir, `migration-${timestamp}.log`);
            
            const logContent = [
                '============================================',
                '📦 تقرير هجرة WhatsApp Bot',
                `⏰ التاريخ: ${new Date().toLocaleString('ar-SA')}`,
                `🎯 الإصدار المستهدف: ${this.currentVersion}`,
                '============================================',
                '',
                ...this.migrationLog.filter(log => log.type === 'step').map(log => log.message),
                '',
                '📊 الإحصائيات:',
                `   الجداول المنشأة: ${this.stats.tablesCreated}`,
                `   الجداول المعدلة: ${this.stats.tablesAltered}`,
                `   الجداول المحذوفة: ${this.stats.tablesDropped}`,
                `   الأعمدة المضافة: ${this.stats.columnsAdded}`,
                `   الأعمدة المعدلة: ${this.stats.columnsModified}`,
                `   الأعمدة المحذوفة: ${this.stats.columnsDropped}`,
                `   الفهارس المنشأة: ${this.stats.indexesCreated}`,
                `   الفهارس المحذوفة: ${this.stats.indexesDropped}`,
                `   البيانات المهجرة: ${this.stats.dataMigrated}`,
                `   الأخطاء: ${this.stats.errors}`,
                '',
                '============================================'
            ].join('\n');

            await fs.writeFile(logFile, logContent, 'utf8');
            console.log(`📝 تم حفظ تقرير الهجرة في: ${logFile}`);

        } catch (error) {
            console.error('❌ خطأ في حفظ تقرير الهجرة:', error);
        }
    }

    async saveErrorLog(error) {
        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            
            try {
                await fs.access(logsDir);
            } catch {
                await fs.mkdir(logsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const errorFile = path.join(logsDir, `migration-error-${timestamp}.log`);
            
            const errorContent = [
                '============================================',
                '❌ تقرير خطأ الهجرة',
                `⏰ التاريخ: ${new Date().toLocaleString('ar-SA')}`,
                `🎯 الإصدار المستهدف: ${this.currentVersion}`,
                '============================================',
                '',
                `الخطأ: ${error.message}`,
                `المكدس: ${error.stack}`,
                '',
                '📊 الإحصائيات حتى الآن:',
                JSON.stringify(this.stats, null, 2),
                '',
                '============================================'
            ].join('\n');

            await fs.writeFile(errorFile, errorContent, 'utf8');
            console.log(`📝 تم حفظ تقرير الخطأ في: ${errorFile}`);

        } catch (writeError) {
            console.error('❌ فشل حفظ تقرير الخطأ:', writeError);
        }
    }

    // ============================================
    // 14. الدالة القابلة للاستدعاء مباشرة
    // ============================================
    static async run(sequelize, targetVersion = '3.0.0') {
        const migration = new MigrationManager();
        await migration.initialize(sequelize);
        return await migration.migrate(targetVersion);
    }

    static async rollbackTo(sequelize, targetVersion = '1.0.0') {
        const migration = new MigrationManager();
        await migration.initialize(sequelize);
        return await migration.rollback(targetVersion);
    }

    static async status(sequelize) {
        try {
            const migration = new MigrationManager();
            await migration.initialize(sequelize);
            
            await migration.createMigrationTable();
            const currentVersion = await migration.getCurrentVersion();
            
            console.log('\n📋 حالة النظام:');
            console.log('============================================');
            console.log(`🎯 الإصدار الحالي: ${currentVersion || 'غير مثبت'}`);
            console.log(`🚀 أحدث إصدار: ${migration.currentVersion}`);
            
            if (currentVersion) {
                const comparison = migration.compareVersions(currentVersion, migration.currentVersion);
                if (comparison < 0) {
                    console.log('⚠️  النظام يحتاج تحديث');
                } else if (comparison > 0) {
                    console.log('⚠️  النظام أحدث من الإصدار المتوقع');
                } else {
                    console.log('✅ النظام محدث');
                }
            }
            
            console.log('============================================');
            
            return { currentVersion, latestVersion: migration.currentVersion };
            
        } catch (error) {
            console.error('❌ فشل التحقق من الحالة:', error);
            throw error;
        }
    }
}

// ============================================
// 15. نقطة الدخول عند التشغيل المباشر
// ============================================
if (require.main === module) {
    require('dotenv').config();
    
    const { sequelize } = require('../index');
    const args = process.argv.slice(2);
    
    const execute = async () => {
        try {
            if (args.includes('--rollback')) {
                const versionIndex = args.indexOf('--rollback') + 1;
                const targetVersion = versionIndex < args.length ? args[versionIndex] : '1.0.0';
                await MigrationManager.rollbackTo(sequelize, targetVersion);
            } else if (args.includes('--status')) {
                await MigrationManager.status(sequelize);
            } else if (args.includes('--version')) {
                const versionIndex = args.indexOf('--version') + 1;
                const targetVersion = versionIndex < args.length ? args[versionIndex] : '3.0.0';
                await MigrationManager.run(sequelize, targetVersion);
            } else {
                // الهجرة العادية إلى أحدث إصدار
                await MigrationManager.run(sequelize);
            }
            
            await sequelize.close();
            process.exit(0);
            
        } catch (error) {
            console.error('❌ فشل العملية:', error);
            await sequelize.close();
            process.exit(1);
        }
    };
    
    execute();
}

// ============================================
// 16. التصدير
// ============================================
module.exports = MigrationManager;
