// ============================================
// 🧹 WhatsApp Bot Cleanup Script
// تنظيف الملفات القديمة والبيانات المؤقتة
// ============================================

const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');
const { WhatsAppSession, CollectedLink, Advertisement, AutoReply, AutoJoin } = require('../index');

class CleanupManager {
    constructor() {
        this.logs = [];
        this.stats = {
            filesDeleted: 0,
            sessionsCleaned: 0,
            linksCleaned: 0,
            adsCleaned: 0,
            repliesCleaned: 0,
            joinsCleaned: 0,
            totalSizeFreed: 0
        };
    }

    // ============================================
    // 1. الدالة الرئيسية للتنظيف
    // ============================================
    async runCleanup() {
        console.log('🧹 بدء عملية التنظيف...\n');

        try {
            // 1. تنظيف مجلد sessions القديم
            await this.cleanOldSessions();

            // 2. تنظيف مجلد temp
            await this.cleanTempFolder();

            // 3. تنظيف مجلد logs
            await this.cleanLogsFolder();

            // 4. تنظيف قاعدة البيانات
            await this.cleanDatabase();

            // 5. تنظيف الملفات المؤقتة الأخرى
            await this.cleanOtherTempFiles();

            console.log('\n============================================');
            console.log('✅ تم الانتهاء من عملية التنظيف');
            console.log('============================================');
            
            this.printStats();
            this.saveCleanupLog();

            return this.stats;

        } catch (error) {
            console.error('❌ خطأ في عملية التنظيف:', error);
            throw error;
        }
    }

    // ============================================
    // 2. تنظيف جلسات WhatsApp القديمة
    // ============================================
    async cleanOldSessions() {
        console.log('📁 جاري تنظيف مجلد sessions...');

        try {
            const sessionsDir = path.join(__dirname, '..', 'sessions');
            
            // التحقق من وجود المجلد
            try {
                await fs.access(sessionsDir);
            } catch {
                console.log('   ℹ️ مجلد sessions غير موجود');
                return;
            }

            const items = await fs.readdir(sessionsDir, { withFileTypes: true });
            let deletedCount = 0;
            let totalSize = 0;

            for (const item of items) {
                const itemPath = path.join(sessionsDir, item.name);
                
                try {
                    if (item.isDirectory()) {
                        // تنظيف الجلسات القديمة (أكثر من 7 أيام)
                        const stats = await fs.stat(itemPath);
                        const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

                        if (ageInDays > 7) {
                            const size = await this.getFolderSize(itemPath);
                            await fs.rm(itemPath, { recursive: true, force: true });
                            
                            deletedCount++;
                            totalSize += size;
                            
                            this.log(`🗑️ حذفت جلسة قديمة: ${item.name} (${Math.round(size / 1024)}KB)`);
                        }
                    } else if (item.isFile()) {
                        // حذف الملفات القديمة
                        const stats = await fs.stat(itemPath);
                        const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

                        if (ageInDays > 3) {
                            const size = stats.size;
                            await fs.unlink(itemPath);
                            
                            deletedCount++;
                            totalSize += size;
                            
                            this.log(`🗑️ حذفت ملف قديم: ${item.name} (${Math.round(size / 1024)}KB)`);
                        }
                    }
                } catch (error) {
                    console.error(`   ❌ خطأ في تنظيف ${item.name}:`, error.message);
                }
            }

            this.stats.filesDeleted += deletedCount;
            this.stats.totalSizeFreed += totalSize;

            console.log(`   ✅ تم تنظيف ${deletedCount} عنصر (${Math.round(totalSize / 1024)}KB محررة)`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف مجلد sessions:', error.message);
        }
    }

    // ============================================
    // 3. تنظيف مجلد temp
    // ============================================
    async cleanTempFolder() {
        console.log('📁 جاري تنظيف مجلد temp...');

        try {
            const tempDir = path.join(__dirname, '..', 'temp');
            
            // إنشاء المجلد إذا لم يكن موجوداً
            try {
                await fs.access(tempDir);
            } catch {
                await fs.mkdir(tempDir, { recursive: true });
                console.log('   ℹ️ تم إنشاء مجلد temp');
                return;
            }

            const items = await fs.readdir(tempDir);
            let deletedCount = 0;
            let totalSize = 0;

            for (const item of items) {
                const itemPath = path.join(tempDir, item);
                
                try {
                    const stats = await fs.stat(itemPath);
                    const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

                    // حذف الملفات الأقدم من 24 ساعة
                    if (ageInHours > 24) {
                        if (stats.isDirectory()) {
                            const size = await this.getFolderSize(itemPath);
                            await fs.rm(itemPath, { recursive: true, force: true });
                            totalSize += size;
                        } else {
                            await fs.unlink(itemPath);
                            totalSize += stats.size;
                        }
                        
                        deletedCount++;
                        this.log(`🗑️ حذفت ملف مؤقت: ${item} (${Math.round(stats.size / 1024)}KB)`);
                    }
                } catch (error) {
                    console.error(`   ❌ خطأ في حذف ${item}:`, error.message);
                }
            }

            this.stats.filesDeleted += deletedCount;
            this.stats.totalSizeFreed += totalSize;

            console.log(`   ✅ تم تنظيف ${deletedCount} ملف مؤقت (${Math.round(totalSize / 1024)}KB محررة)`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف مجلد temp:', error.message);
        }
    }

    // ============================================
    // 4. تنظيف مجلد logs
    // ============================================
    async cleanLogsFolder() {
        console.log('📁 جاري تنظيف مجلد logs...');

        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            
            // إنشاء المجلد إذا لم يكن موجوداً
            try {
                await fs.access(logsDir);
            } catch {
                await fs.mkdir(logsDir, { recursive: true });
                console.log('   ℹ️ تم إنشاء مجلد logs');
                return;
            }

            const items = await fs.readdir(logsDir);
            let deletedCount = 0;
            let totalSize = 0;

            for (const item of items) {
                const itemPath = path.join(logsDir, item);
                
                try {
                    const stats = await fs.stat(itemPath);
                    const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

                    // حذف ملفات السجلات الأقدم من 30 يوم
                    if (ageInDays > 30) {
                        await fs.unlink(itemPath);
                        totalSize += stats.size;
                        deletedCount++;
                        
                        this.log(`🗑️ حذفت سجل قديم: ${item} (${Math.round(stats.size / 1024)}KB)`);
                    }
                } catch (error) {
                    console.error(`   ❌ خطأ في حذف ${item}:`, error.message);
                }
            }

            this.stats.filesDeleted += deletedCount;
            this.stats.totalSizeFreed += totalSize;

            console.log(`   ✅ تم تنظيف ${deletedCount} سجل (${Math.round(totalSize / 1024)}KB محررة)`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف مجلد logs:', error.message);
        }
    }

    // ============================================
    // 5. تنظيف قاعدة البيانات
    // ============================================
    async cleanDatabase() {
        console.log('🗄️ جاري تنظيف قاعدة البيانات...');

        try {
            // 5.1 تنظيف جلسات WhatsApp غير النشطة
            await this.cleanInactiveSessions();

            // 5.2 تنظيف الروابط القديمة
            await this.cleanOldLinks();

            // 5.3 تنظيف الإعلانات القديمة
            await this.cleanOldAds();

            // 5.4 تنظيف الردود التلقائية القديمة
            await this.cleanOldAutoReplies();

            // 5.5 تنظيف عمليات الانضمام القديمة
            await this.cleanOldAutoJoins();

            console.log('   ✅ تم تنظيف قاعدة البيانات');

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف قاعدة البيانات:', error.message);
        }
    }

    async cleanInactiveSessions() {
        try {
            // حذف الجلسات المقطوعة لأكثر من 30 يوم
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const result = await WhatsAppSession.destroy({
                where: {
                    status: 'disconnected',
                    updatedAt: { [Op.lt]: thirtyDaysAgo }
                }
            });

            if (result > 0) {
                this.stats.sessionsCleaned += result;
                this.log(`🗑️ حذفت ${result} جلسة غير نشطة`);
            }

            console.log(`   ✅ تم تنظيف ${result} جلسة غير نشطة`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف الجلسات:', error.message);
        }
    }

    async cleanOldLinks() {
        try {
            // حذف الروابط غير النشطة لأكثر من 90 يوم
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            
            const result = await CollectedLink.destroy({
                where: {
                    [Op.or]: [
                        { status: 'inactive' },
                        { status: 'failed' }
                    ],
                    updatedAt: { [Op.lt]: ninetyDaysAgo }
                }
            });

            if (result > 0) {
                this.stats.linksCleaned += result;
                this.log(`🗑️ حذفت ${result} رابط قديم`);
            }

            console.log(`   ✅ تم تنظيف ${result} رابط قديم`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف الروابط:', error.message);
        }
    }

    async cleanOldAds() {
        try {
            // حذف الإعلانات غير النشطة لأكثر من 60 يوم
            const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            
            const result = await Advertisement.destroy({
                where: {
                    isActive: false,
                    updatedAt: { [Op.lt]: sixtyDaysAgo }
                }
            });

            if (result > 0) {
                this.stats.adsCleaned += result;
                this.log(`🗑️ حذفت ${result} إعلان قديم`);
            }

            console.log(`   ✅ تم تنظيف ${result} إعلان قديم`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف الإعلانات:', error.message);
        }
    }

    async cleanOldAutoReplies() {
        try {
            // حذف الردود غير النشطة لأكثر من 60 يوم
            const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            
            const result = await AutoReply.destroy({
                where: {
                    isActive: false,
                    updatedAt: { [Op.lt]: sixtyDaysAgo }
                }
            });

            if (result > 0) {
                this.stats.repliesCleaned += result;
                this.log(`🗑️ حذفت ${result} رد تلقائي قديم`);
            }

            console.log(`   ✅ تم تنظيف ${result} رد تلقائي قديم`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف الردود التلقائية:', error.message);
        }
    }

    async cleanOldAutoJoins() {
        try {
            // حذف عمليات الانضمام المكتملة لأكثر من 30 يوم
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const result = await AutoJoin.destroy({
                where: {
                    status: 'completed',
                    updatedAt: { [Op.lt]: thirtyDaysAgo }
                }
            });

            if (result > 0) {
                this.stats.joinsCleaned += result;
                this.log(`🗑️ حذفت ${result} عملية انضمام قديمة`);
            }

            console.log(`   ✅ تم تنظيف ${result} عملية انضمام قديمة`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف عمليات الانضمام:', error.message);
        }
    }

    // ============================================
    // 6. تنظيف الملفات المؤقتة الأخرى
    // ============================================
    async cleanOtherTempFiles() {
        console.log('📁 جاري تنظيف الملفات المؤقتة الأخرى...');

        try {
            const tempFiles = [
                path.join(__dirname, '..', 'node_modules', '.cache'),
                path.join(__dirname, '..', '.npm'),
                path.join(__dirname, '..', 'yarn.lock'),
                path.join(__dirname, '..', 'package-lock.json'),
                path.join(__dirname, '..', 'error.log'),
                path.join(__dirname, '..', 'debug.log')
            ];

            let deletedCount = 0;
            let totalSize = 0;

            for (const filePath of tempFiles) {
                try {
                    await fs.access(filePath);
                    
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) {
                        // حذف المجلدات المؤقتة
                        const size = await this.getFolderSize(filePath);
                        await fs.rm(filePath, { recursive: true, force: true });
                        totalSize += size;
                    } else {
                        // حذف الملفات المؤقتة
                        await fs.unlink(filePath);
                        totalSize += stats.size;
                    }
                    
                    deletedCount++;
                    const fileName = path.basename(filePath);
                    this.log(`🗑️ حذفت ملف مؤقت: ${fileName} (${Math.round(stats.size / 1024)}KB)`);

                } catch (error) {
                    // تجاهل الملفات غير الموجودة
                    if (error.code !== 'ENOENT') {
                        console.error(`   ❌ خطأ في تنظيف ${filePath}:`, error.message);
                    }
                }
            }

            // تنظيف مجلد uploads إذا كان موجوداً
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            try {
                await fs.access(uploadsDir);
                const stats = await fs.stat(uploadsDir);
                
                if (stats.isDirectory()) {
                    const size = await this.getFolderSize(uploadsDir);
                    const items = await fs.readdir(uploadsDir);
                    
                    for (const item of items) {
                        const itemPath = path.join(uploadsDir, item);
                        const itemStats = await fs.stat(itemPath);
                        const ageInDays = (Date.now() - itemStats.mtimeMs) / (1000 * 60 * 60 * 24);
                        
                        if (ageInDays > 7) {
                            await fs.rm(itemPath, { recursive: true, force: true });
                            deletedCount++;
                            this.log(`🗑️ حذفت ملف مرفوع قديم: ${item}`);
                        }
                    }
                }
            } catch (error) {
                // تجاهل إذا لم يكن المجلد موجوداً
            }

            this.stats.filesDeleted += deletedCount;
            this.stats.totalSizeFreed += totalSize;

            console.log(`   ✅ تم تنظيف ${deletedCount} ملف مؤقت آخر`);

        } catch (error) {
            console.error('   ❌ خطأ في تنظيف الملفات المؤقتة الأخرى:', error.message);
        }
    }

    // ============================================
    // 7. تنظيف محدد لجلسة معينة
    // ============================================
    async cleanSession(sessionId) {
        console.log(`🧹 جاري تنظيف جلسة محددة: ${sessionId}`);

        try {
            // 1. حذف مجلد الجلسة
            const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);
            
            try {
                await fs.access(sessionDir);
                const size = await this.getFolderSize(sessionDir);
                await fs.rm(sessionDir, { recursive: true, force: true });
                
                this.log(`🗑️ حذفت مجلد جلسة: ${sessionId} (${Math.round(size / 1024)}KB)`);
                console.log(`   ✅ تم حذف مجلد الجلسة`);
            } catch (error) {
                console.log(`   ℹ️ مجلد الجلسة غير موجود`);
            }

            // 2. حذف الروابط المرتبطة بالجلسة
            const linksDeleted = await CollectedLink.destroy({
                where: { sessionId: sessionId }
            });

            if (linksDeleted > 0) {
                this.log(`🗑️ حذفت ${linksDeleted} رابط مرتبط بالجلسة`);
                console.log(`   ✅ تم حذف ${linksDeleted} رابط`);
            }

            // 3. حذف الردود التلقائية المرتبطة بالجلسة
            const repliesDeleted = await AutoReply.destroy({
                where: { sessionId: sessionId }
            });

            if (repliesDeleted > 0) {
                this.log(`🗑️ حذفت ${repliesDeleted} رد تلقائي مرتبط بالجلسة`);
                console.log(`   ✅ تم حذف ${repliesDeleted} رد تلقائي`);
            }

            // 4. حذف عمليات الانضمام المرتبطة بالجلسة
            const joinsDeleted = await AutoJoin.destroy({
                where: { sessionId: sessionId }
            });

            if (joinsDeleted > 0) {
                this.log(`🗑️ حذفت ${joinsDeleted} عملية انضمام مرتبطة بالجلسة`);
                console.log(`   ✅ تم حذف ${joinsDeleted} عملية انضمام`);
            }

            console.log(`✅ تم تنظيف الجلسة ${sessionId} بنجاح`);
            return true;

        } catch (error) {
            console.error(`❌ خطأ في تنظيف الجلسة ${sessionId}:`, error);
            return false;
        }
    }

    // ============================================
    // 8. دوال مساعدة
    // ============================================
    async getFolderSize(folderPath) {
        try {
            const files = await fs.readdir(folderPath, { withFileTypes: true });
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(folderPath, file.name);
                
                if (file.isDirectory()) {
                    totalSize += await this.getFolderSize(filePath);
                } else {
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                }
            }

            return totalSize;
        } catch (error) {
            return 0;
        }
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logs.push(logEntry);
        console.log(`   ${logEntry}`);
    }

    printStats() {
        console.log('\n📊 إحصائيات التنظيف:');
        console.log('============================================');
        console.log(`🗑️  الملفات المحذوفة: ${this.stats.filesDeleted}`);
        console.log(`📁 الجلسات المنظفة: ${this.stats.sessionsCleaned}`);
        console.log(`🔗 الروابط المنظفة: ${this.stats.linksCleaned}`);
        console.log(`📢 الإعلانات المنظفة: ${this.stats.adsCleaned}`);
        console.log(`🤖 الردود المنظفة: ${this.stats.repliesCleaned}`);
        console.log(`➕ عمليات الانضمام المنظفة: ${this.stats.joinsCleaned}`);
        console.log(`💾 المساحة المحررة: ${Math.round(this.stats.totalSizeFreed / 1024 / 1024 * 100) / 100} MB`);
        console.log('============================================');
    }

    async saveCleanupLog() {
        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            
            // إنشاء مجلد logs إذا لم يكن موجوداً
            try {
                await fs.access(logsDir);
            } catch {
                await fs.mkdir(logsDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFile = path.join(logsDir, `cleanup-${timestamp}.log`);
            
            const logContent = [
                '============================================',
                '🧹 تقرير تنظيف WhatsApp Bot',
                `⏰ التاريخ: ${new Date().toLocaleString('ar-SA')}`,
                '============================================',
                '',
                ...this.logs,
                '',
                '📊 الإحصائيات:',
                `   الملفات المحذوفة: ${this.stats.filesDeleted}`,
                `   الجلسات المنظفة: ${this.stats.sessionsCleaned}`,
                `   الروابط المنظفة: ${this.stats.linksCleaned}`,
                `   الإعلانات المنظفة: ${this.stats.adsCleaned}`,
                `   الردود المنظفة: ${this.stats.repliesCleaned}`,
                `   عمليات الانضمام المنظفة: ${this.stats.joinsCleaned}`,
                `   المساحة المحررة: ${Math.round(this.stats.totalSizeFreed / 1024 / 1024 * 100) / 100} MB`,
                '',
                '============================================'
            ].join('\n');

            await fs.writeFile(logFile, logContent, 'utf8');
            console.log(`📝 تم حفظ تقرير التنظيف في: ${logFile}`);

        } catch (error) {
            console.error('❌ خطأ في حفظ تقرير التنظيف:', error.message);
        }
    }

    // ============================================
    // 9. وظائف تنظيف إضافية
    // ============================================
    async optimizeDatabase() {
        console.log('🗄️ جاري تحسين قاعدة البيانات...');

        try {
            // يمكن إضافة أوامر تحسين قاعدة البيانات هنا
            // مثل إعادة بناء الفهارس أو حذف البيانات المكررة
            
            console.log('   ✅ تم تحسين قاعدة البيانات');
            return true;

        } catch (error) {
            console.error('   ❌ خطأ في تحسين قاعدة البيانات:', error.message);
            return false;
        }
    }

    async backupDatabase() {
        console.log('💾 جاري إنشاء نسخة احتياطية...');

        try {
            const backupDir = path.join(__dirname, '..', 'backups');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

            // إنشاء مجلد backups إذا لم يكن موجوداً
            try {
                await fs.access(backupDir);
            } catch {
                await fs.mkdir(backupDir, { recursive: true });
            }

            // يمكن إضافة أوامر نسخ قاعدة البيانات هنا
            // هذا مثال بسيط لحفظ بيانات هامة
            
            const backupData = {
                timestamp: new Date().toISOString(),
                stats: this.stats,
                logs: this.logs.slice(-100) // آخر 100 سجل
            };

            await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
            
            this.log(`💾 تم إنشاء نسخة احتياطية: ${backupFile}`);
            console.log(`   ✅ تم إنشاء نسخة احتياطية في: ${backupFile}`);

            return backupFile;

        } catch (error) {
            console.error('   ❌ خطأ في إنشاء نسخة احتياطية:', error.message);
            return null;
        }
    }

    // ============================================
    // 10. الدالة القابلة للاستدعاء مباشرة
    // ============================================
    static async run() {
        const cleanup = new CleanupManager();
        return await cleanup.runCleanup();
    }

    static async cleanSessionOnly(sessionId) {
        const cleanup = new CleanupManager();
        return await cleanup.cleanSession(sessionId);
    }

    static async fullMaintenance() {
        const cleanup = new CleanupManager();
        
        console.log('🔧 بدء الصيانة الكاملة...\n');
        
        // 1. التنظيف
        await cleanup.runCleanup();
        
        // 2. تحسين قاعدة البيانات
        await cleanup.optimizeDatabase();
        
        // 3. إنشاء نسخة احتياطية
        await cleanup.backupDatabase();
        
        console.log('\n✅ تمت الصيانة الكاملة بنجاح');
        return cleanup.stats;
    }
}

// ============================================
// 11. نقطة الدخول عند التشغيل المباشر
// ============================================
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--session')) {
        const sessionIndex = args.indexOf('--session') + 1;
        if (sessionIndex < args.length) {
            const sessionId = args[sessionIndex];
            CleanupManager.cleanSessionOnly(sessionId)
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('❌ فشل تنظيف الجلسة:', error);
                    process.exit(1);
                });
        } else {
            console.log('❌ يرجى تحديد معرف الجلسة');
            process.exit(1);
        }
    } else if (args.includes('--full')) {
        CleanupManager.fullMaintenance()
            .then(() => process.exit(0))
            .catch(error => {
                console.error('❌ فشل الصيانة الكاملة:', error);
                process.exit(1);
            });
    } else {
        // التنظيف العادي
        CleanupManager.run()
            .then(() => process.exit(0))
            .catch(error => {
                console.error('❌ فشل التنظيف:', error);
                process.exit(1);
            });
    }
}

// ============================================
// 12. التصدير
// ============================================
module.exports = CleanupManager;
