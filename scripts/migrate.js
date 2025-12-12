// ============================================
// 🚀 Database Migration & Upgrade Manager
// الإصدار: 2.0.0 - WhatsApp Telegram Bot
// الغرض: إدارة هجرة وترحيل قاعدة البيانات
// ============================================

const fs = require('fs').promises;
const path = require('path');
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
const crypto = require('crypto');
const readline = require('readline');
const { exec } = require('child_process');
const moment = require('moment');

class MigrationManager {
    constructor() {
        console.log('🚀 بدء مدير الهجرة والترحيل...');
        
        this.projectRoot = process.cwd();
        this.migrationsDir = path.join(this.projectRoot, 'migrations');
        this.backupDir = path.join(this.projectRoot, 'backups', 'database');
        this.logsDir = path.join(this.projectRoot, 'logs', 'migrations');
        
        // أنواع قواعد البيانات المدعومة
        this.supportedDatabases = {
            'sqlite': 'SQLite',
            'postgres': 'PostgreSQL',
            'mysql': 'MySQL',
            'mariadb': 'MariaDB'
        };
        
        // مسارات الملفات
        this.dbFiles = {
            sqlite: path.join(this.projectRoot, 'database', 'bot.db'),
            postgres: process.env.DATABASE_URL,
            mysql: null,
            mariadb: null
        };
        
        this.currentDbType = this.detectDatabaseType();
        
        console.log(`🔍 قاعدة البيانات المكتشفة: ${this.currentDbType}`);
        console.log('✅ مدير الهجرة مهيأ وجاهز');
    }
    
    // ============================================
    // 1. اكتشاف نوع قاعدة البيانات
    // ============================================
    detectDatabaseType() {
        if (process.env.DATABASE_URL) {
            if (process.env.DATABASE_URL.includes('postgres')) {
                return 'postgres';
            } else if (process.env.DATABASE_URL.includes('mysql')) {
                return 'mysql';
            } else if (process.env.DATABASE_URL.includes('mariadb')) {
                return 'mariadb';
            }
        }
        
        // التحقق من وجود ملف SQLite
        try {
            const sqlitePath = path.join(this.projectRoot, 'database', 'bot.db');
            if (fs.existsSync(sqlitePath)) {
                return 'sqlite';
            }
        } catch (error) {
            // تجاهل الخطأ
        }
        
        return 'unknown';
    }
    
    // ============================================
    // 2. إنشاء اتصال بقاعدة البيانات
    // ============================================
    async createConnection(dbType = null) {
        const type = dbType || this.currentDbType;
        
        console.log(`🔌 جاري الاتصال بقاعدة البيانات (${type})...`);
        
        try {
            let sequelize;
            
            switch (type) {
                case 'sqlite':
                    sequelize = new Sequelize({
                        dialect: 'sqlite',
                        storage: this.dbFiles.sqlite,
                        logging: false,
                        pool: {
                            max: 5,
                            min: 0,
                            acquire: 30000,
                            idle: 10000
                        }
                    });
                    break;
                    
                case 'postgres':
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
                            ssl: process.env.NODE_ENV === 'production' ? {
                                require: true,
                                rejectUnauthorized: false
                            } : false
                        }
                    });
                    break;
                    
                case 'mysql':
                case 'mariadb':
                    sequelize = new Sequelize(
                        process.env.DB_NAME || 'whatsapp_bot',
                        process.env.DB_USER || 'root',
                        process.env.DB_PASSWORD || '',
                        {
                            host: process.env.DB_HOST || 'localhost',
                            port: process.env.DB_PORT || 3306,
                            dialect: type,
                            logging: false,
                            pool: {
                                max: 10,
                                min: 0,
                                acquire: 30000,
                                idle: 10000
                            }
                        }
                    );
                    break;
                    
                default:
                    throw new Error(`نوع قاعدة البيانات غير مدعوم: ${type}`);
            }
            
            // اختبار الاتصال
            await sequelize.authenticate();
            console.log(`✅ تم الاتصال بنجاح بقاعدة البيانات (${type})`);
            
            return sequelize;
            
        } catch (error) {
            console.error(`❌ فشل الاتصال بقاعدة البيانات (${type}):`, error.message);
            throw error;
        }
    }
    
    // ============================================
    // 3. النسخ الاحتياطي لقاعدة البيانات
    // ============================================
    async backupDatabase() {
        console.log('💾 جاري إنشاء نسخة احتياطية لقاعدة البيانات...');
        
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const backupFolder = path.join(this.backupDir, `backup_${timestamp}`);
        
        try {
            // إنشاء مجلد النسخ الاحتياطي
            await fs.mkdir(backupFolder, { recursive: true });
            
            let backupInfo = {
                timestamp: new Date().toISOString(),
                databaseType: this.currentDbType,
                backupMethod: 'manual',
                files: []
            };
            
            switch (this.currentDbType) {
                case 'sqlite':
                    await this.backupSQLite(backupFolder, backupInfo);
                    break;
                    
                case 'postgres':
                    await this.backupPostgreSQL(backupFolder, backupInfo);
                    break;
                    
                case 'mysql':
                case 'mariadb':
                    await this.backupMySQL(backupFolder, backupInfo);
                    break;
                    
                default:
                    throw new Error(`لا يمكن عمل نسخة احتياطية لنوع قاعدة البيانات: ${this.currentDbType}`);
            }
            
            // حفظ معلومات النسخ الاحتياطي
            await fs.writeFile(
                path.join(backupFolder, 'backup_info.json'),
                JSON.stringify(backupInfo, null, 2),
                'utf8'
            );
            
            // حفظ نسخة من مخطط قاعدة البيانات
            await this.exportSchema(backupFolder);
            
            console.log(`✅ تم إنشاء النسخة الاحتياطية في: ${backupFolder}`);
            console.log(`📊 حجم النسخة الاحتياطية: ${await this.getFolderSize(backupFolder)}`);
            
            return backupFolder;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء النسخة الاحتياطية:', error);
            throw error;
        }
    }
    
    async backupSQLite(backupFolder, backupInfo) {
        const sourcePath = this.dbFiles.sqlite;
        const destPath = path.join(backupFolder, 'bot.db');
        
        // نسخ ملف SQLite
        await fs.copyFile(sourcePath, destPath);
        backupInfo.files.push('bot.db');
        
        // نسخ مجلد sessions إذا وجد
        const sessionsPath = path.join(this.projectRoot, 'sessions');
        try {
            const stats = await fs.stat(sessionsPath);
            if (stats.isDirectory()) {
                const sessionsDest = path.join(backupFolder, 'sessions');
                await this.copyDirectory(sessionsPath, sessionsDest);
                backupInfo.files.push('sessions/');
                console.log('   ✅ تم نسخ جلسات WhatsApp');
            }
        } catch (error) {
            console.log('   ⚠️ لا يوجد مجلد sessions');
        }
    }
    
    async backupPostgreSQL(backupFolder, backupInfo) {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const dumpFile = path.join(backupFolder, `pg_dump_${timestamp}.sql`);
        
        // استخدام pg_dump لعمل dump لقاعدة البيانات
        const command = `pg_dump "${process.env.DATABASE_URL}" > "${dumpFile}"`;
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ فشل في عمل dump لقاعدة البيانات:', error);
                    
                    // محاولة بديلة: نسخ البيانات عبر Sequelize
                    this.backupPostgreSQLViaSequelize(backupFolder, backupInfo)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                
                backupInfo.files.push(`pg_dump_${timestamp}.sql`);
                backupInfo.backupMethod = 'pg_dump';
                console.log('   ✅ تم عمل dump لقاعدة البيانات PostgreSQL');
                resolve();
            });
        });
    }
    
    async backupPostgreSQLViaSequelize(backupFolder, backupInfo) {
        console.log('   🔄 استخدام Sequelize للنسخ الاحتياطي...');
        
        const sequelize = await this.createConnection('postgres');
        
        try {
            // الحصول على قائمة الجداول
            const tables = await sequelize.query(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
                { type: QueryTypes.SELECT }
            );
            
            const data = {};
            
            for (const table of tables) {
                const tableName = table.tablename;
                
                // الحصول على بيانات الجدول
                const rows = await sequelize.query(
                    `SELECT * FROM "${tableName}"`,
                    { type: QueryTypes.SELECT }
                );
                
                if (rows.length > 0) {
                    data[tableName] = rows;
                    console.log(`     📊 ${tableName}: ${rows.length} سجل`);
                }
            }
            
            // حفظ البيانات في ملف JSON
            const jsonFile = path.join(backupFolder, 'database_data.json');
            await fs.writeFile(jsonFile, JSON.stringify(data, null, 2), 'utf8');
            
            backupInfo.files.push('database_data.json');
            backupInfo.backupMethod = 'sequelize_json';
            backupInfo.tables = Object.keys(data);
            
            console.log('   ✅ تم حفظ البيانات في ملف JSON');
            
        } finally {
            await sequelize.close();
        }
    }
    
    async backupMySQL(backupFolder, backupInfo) {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        const dumpFile = path.join(backupFolder, `mysql_dump_${timestamp}.sql`);
        
        const command = `mysqldump -h ${process.env.DB_HOST || 'localhost'} ` +
                       `-u ${process.env.DB_USER || 'root'} ` +
                       `-p${process.env.DB_PASSWORD || ''} ` +
                       `${process.env.DB_NAME || 'whatsapp_bot'} > "${dumpFile}"`;
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ فشل في عمل dump لقاعدة البيانات MySQL:', error);
                    
                    // محاولة بديلة
                    this.backupMySQLViaSequelize(backupFolder, backupInfo)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                
                backupInfo.files.push(`mysql_dump_${timestamp}.sql`);
                backupInfo.backupMethod = 'mysqldump';
                console.log('   ✅ تم عمل dump لقاعدة البيانات MySQL');
                resolve();
            });
        });
    }
    
    async backupMySQLViaSequelize(backupFolder, backupInfo) {
        console.log('   🔄 استخدام Sequelize للنسخ الاحتياطي MySQL...');
        
        const sequelize = await this.createConnection(this.currentDbType);
        
        try {
            // الحصول على قائمة الجداول
            const tables = await sequelize.query(
                "SHOW TABLES",
                { type: QueryTypes.SELECT }
            );
            
            const data = {};
            
            for (const table of tables) {
                const tableName = Object.values(table)[0];
                
                // الحصول على بيانات الجدول
                const rows = await sequelize.query(
                    `SELECT * FROM \`${tableName}\``,
                    { type: QueryTypes.SELECT }
                );
                
                if (rows.length > 0) {
                    data[tableName] = rows;
                    console.log(`     📊 ${tableName}: ${rows.length} سجل`);
                }
            }
            
            // حفظ البيانات في ملف JSON
            const jsonFile = path.join(backupFolder, 'database_data.json');
            await fs.writeFile(jsonFile, JSON.stringify(data, null, 2), 'utf8');
            
            backupInfo.files.push('database_data.json');
            backupInfo.backupMethod = 'sequelize_json';
            backupInfo.tables = Object.keys(data);
            
            console.log('   ✅ تم حفظ البيانات في ملف JSON');
            
        } finally {
            await sequelize.close();
        }
    }
    
    async copyDirectory(source, destination) {
        await fs.mkdir(destination, { recursive: true });
        
        const entries = await fs.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }
    
    async getFolderSize(folderPath) {
        let totalSize = 0;
        
        const getSize = async (dir) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    await getSize(fullPath);
                } else {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                }
            }
        };
        
        await getSize(folderPath);
        
        if (totalSize < 1024) {
            return `${totalSize} bytes`;
        } else if (totalSize < 1024 * 1024) {
            return `${(totalSize / 1024).toFixed(2)} KB`;
        } else {
            return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
        }
    }
    
    // ============================================
    // 4. تصدير مخطط قاعدة البيانات
    // ============================================
    async exportSchema(outputDir) {
        console.log('📋 جاري تصدير مخطط قاعدة البيانات...');
        
        try {
            const sequelize = await this.createConnection();
            
            let schema = {
                timestamp: new Date().toISOString(),
                databaseType: this.currentDbType,
                tables: {}
            };
            
            // الحصول على معلومات الجداول حسب نوع قاعدة البيانات
            switch (this.currentDbType) {
                case 'sqlite':
                    const tables = await sequelize.query(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                        { type: QueryTypes.SELECT }
                    );
                    
                    for (const table of tables) {
                        const tableName = table.name;
                        const columns = await sequelize.query(
                            `PRAGMA table_info("${tableName}")`,
                            { type: QueryTypes.SELECT }
                        );
                        
                        schema.tables[tableName] = {
                            columns: columns.map(col => ({
                                name: col.name,
                                type: col.type,
                                notnull: col.notnull === 1,
                                dflt_value: col.dflt_value,
                                pk: col.pk === 1
                            }))
                        };
                    }
                    break;
                    
                case 'postgres':
                    const pgTables = await sequelize.query(
                        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
                        { type: QueryTypes.SELECT }
                    );
                    
                    for (const table of pgTables) {
                        const tableName = table.tablename;
                        const columns = await sequelize.query(
                            `SELECT column_name, data_type, is_nullable, column_default 
                             FROM information_schema.columns 
                             WHERE table_name = '${tableName}' 
                             ORDER BY ordinal_position`,
                            { type: QueryTypes.SELECT }
                        );
                        
                        schema.tables[tableName] = {
                            columns: columns.map(col => ({
                                name: col.column_name,
                                type: col.data_type,
                                nullable: col.is_nullable === 'YES',
                                default: col.column_default
                            }))
                        };
                    }
                    break;
                    
                case 'mysql':
                case 'mariadb':
                    const mysqlTables = await sequelize.query(
                        "SHOW TABLES",
                        { type: QueryTypes.SELECT }
                    );
                    
                    for (const table of mysqlTables) {
                        const tableName = Object.values(table)[0];
                        const columns = await sequelize.query(
                            `DESCRIBE \`${tableName}\``,
                            { type: QueryTypes.SELECT }
                        );
                        
                        schema.tables[tableName] = {
                            columns: columns.map(col => ({
                                name: col.Field,
                                type: col.Type,
                                nullable: col.Null === 'YES',
                                key: col.Key,
                                default: col.Default,
                                extra: col.Extra
                            }))
                        };
                    }
                    break;
            }
            
            await sequelize.close();
            
            // حفظ المخطط في ملف
            const schemaFile = path.join(outputDir, 'database_schema.json');
            await fs.writeFile(schemaFile, JSON.stringify(schema, null, 2), 'utf8');
            
            console.log(`✅ تم تصدير المخطط إلى: ${schemaFile}`);
            console.log(`📊 عدد الجداول: ${Object.keys(schema.tables).length}`);
            
            // إنشاء مخطط بصيغة SQL أيضًا
            await this.exportSQLSchema(outputDir, schema);
            
            return schema;
            
        } catch (error) {
            console.error('❌ خطأ في تصدير المخطط:', error);
            throw error;
        }
    }
    
    async exportSQLSchema(outputDir, schema) {
        const sqlFile = path.join(outputDir, 'database_schema.sql');
        let sqlContent = `-- WhatsApp Telegram Bot Database Schema\n`;
        sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
        sqlContent += `-- Database: ${this.currentDbType}\n\n`;
        
        switch (this.currentDbType) {
            case 'sqlite':
                for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
                    sqlContent += `-- Table: ${tableName}\n`;
                    sqlContent += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
                    
                    const columns = tableInfo.columns.map(col => {
                        let columnDef = `  "${col.name}" ${col.type}`;
                        if (col.notnull) columnDef += ' NOT NULL';
                        if (col.dflt_value !== null) columnDef += ` DEFAULT ${col.dflt_value}`;
                        if (col.pk) columnDef += ' PRIMARY KEY';
                        return columnDef;
                    });
                    
                    sqlContent += columns.join(',\n') + '\n);\n\n';
                }
                break;
                
            case 'postgres':
                for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
                    sqlContent += `-- Table: ${tableName}\n`;
                    sqlContent += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
                    
                    const columns = tableInfo.columns.map(col => {
                        let columnDef = `  "${col.name}" ${col.type}`;
                        if (col.nullable === false) columnDef += ' NOT NULL';
                        if (col.default) columnDef += ` DEFAULT ${col.default}`;
                        return columnDef;
                    });
                    
                    sqlContent += columns.join(',\n') + '\n);\n\n';
                }
                break;
        }
        
        await fs.writeFile(sqlFile, sqlContent, 'utf8');
        console.log(`   📝 تم إنشاء ملف SQL: ${sqlFile}`);
    }
    
    // ============================================
    // 5. هجرة من SQLite إلى PostgreSQL
    // ============================================
    async migrateToPostgreSQL() {
        console.log('🚀 بدء الهجرة من SQLite إلى PostgreSQL...');
        
        try {
            // 1. التحقق من الإعدادات
            if (!process.env.DATABASE_URL) {
                throw new Error('لم يتم تعيين DATABASE_URL في متغيرات البيئة');
            }
            
            if (!process.env.DATABASE_URL.includes('postgres')) {
                throw new Error('DATABASE_URL يجب أن يكون لـ PostgreSQL');
            }
            
            // 2. النسخ الاحتياطي للبيانات الحالية
            console.log('📋 الخطوة 1: النسخ الاحتياطي للبيانات الحالية');
            const backupPath = await this.backupDatabase();
            
            // 3. الاتصال بقاعدة البيانات المصدر (SQLite)
            console.log('📋 الخطوة 2: الاتصال بقاعدة البيانات المصدر');
            const sourceSequelize = await this.createConnection('sqlite');
            
            // 4. الاتصال بقاعدة البيانات الهدف (PostgreSQL)
            console.log('📋 الخطوة 3: الاتصال بقاعدة البيانات الهدف');
            const targetSequelize = await this.createConnection('postgres');
            
            // 5. الحصول على قائمة الجداول من SQLite
            console.log('📋 الخطوة 4: قراءة هيكل البيانات');
            const tables = await sourceSequelize.query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                { type: QueryTypes.SELECT }
            );
            
            console.log(`📊 عدد الجداول للهجرة: ${tables.length}`);
            
            // 6. إنشاء جداول في PostgreSQL
            console.log('📋 الخطوة 5: إنشاء الجداول في PostgreSQL');
            await this.createPostgreSQLTables(targetSequelize);
            
            // 7. نقل البيانات
            console.log('📋 الخطوة 6: نقل البيانات');
            const migrationReport = {
                startedAt: new Date().toISOString(),
                source: 'sqlite',
                target: 'postgres',
                tables: {},
                statistics: {
                    totalTables: tables.length,
                    migratedTables: 0,
                    totalRecords: 0,
                    migratedRecords: 0,
                    failedRecords: 0
                }
            };
            
            for (const table of tables) {
                const tableName = table.name;
                
                console.log(`   📊 جدول: ${tableName}`);
                
                try {
                    // الحصول على البيانات من SQLite
                    const rows = await sourceSequelize.query(
                        `SELECT * FROM "${tableName}"`,
                        { type: QueryTypes.SELECT }
                    );
                    
                    migrationReport.tables[tableName] = {
                        sourceCount: rows.length,
                        migratedCount: 0,
                        failedCount: 0,
                        errors: []
                    };
                    
                    if (rows.length === 0) {
                        console.log(`     ⚪ لا توجد بيانات`);
                        migrationReport.statistics.migratedTables++;
                        continue;
                    }
                    
                    // إدخال البيانات في PostgreSQL
                    let migrated = 0;
                    let failed = 0;
                    
                    for (const row of rows) {
                        try {
                            // تنظيف البيانات إذا لزم الأمر
                            const cleanedRow = this.cleanDataForPostgreSQL(row, tableName);
                            
                            // بناء استعلام INSERT
                            const columns = Object.keys(cleanedRow).map(col => `"${col}"`).join(', ');
                            const values = Object.values(cleanedRow).map(val => {
                                if (val === null) return 'NULL';
                                if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                                if (typeof val === 'number') return val;
                                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                                return `'${val.toString().replace(/'/g, "''")}'`;
                            }).join(', ');
                            
                            const insertQuery = `INSERT INTO "${tableName}" (${columns}) VALUES (${values})`;
                            
                            await targetSequelize.query(insertQuery, { type: QueryTypes.INSERT });
                            
                            migrated++;
                            migrationReport.statistics.migratedRecords++;
                            
                        } catch (error) {
                            failed++;
                            migrationReport.statistics.failedRecords++;
                            migrationReport.tables[tableName].errors.push({
                                record: row.id || 'unknown',
                                error: error.message.substring(0, 100)
                            });
                        }
                    }
                    
                    migrationReport.tables[tableName].migratedCount = migrated;
                    migrationReport.tables[tableName].failedCount = failed;
                    migrationReport.statistics.migratedTables++;
                    
                    console.log(`     ✅ ${migrated} سجل، ❌ ${failed} فاشل`);
                    
                } catch (error) {
                    console.error(`     ❌ خطأ في هجرة جدول ${tableName}:`, error.message);
                    migrationReport.tables[tableName].errors.push(error.message);
                }
            }
            
            // 8. إغلاق الاتصالات
            await sourceSequelize.close();
            await targetSequelize.close();
            
            // 9. تحديث إعدادات النظام
            migrationReport.completedAt = new Date().toISOString();
            migrationReport.duration = new Date(migrationReport.completedAt) - new Date(migrationReport.startedAt);
            
            // 10. حفظ تقرير الهجرة
            const reportFile = path.join(backupPath, 'migration_report.json');
            await fs.writeFile(reportFile, JSON.stringify(migrationReport, null, 2), 'utf8');
            
            // 11. إنشاء ملف .env جديد
            await this.updateEnvFileForPostgreSQL();
            
            console.log('\n' + '='.repeat(50));
            console.log('🎉 تم إكمال الهجرة بنجاح!');
            console.log('='.repeat(50));
            console.log(`📊 الإحصائيات:`);
            console.log(`• الجداول: ${migrationReport.statistics.migratedTables}/${migrationReport.statistics.totalTables}`);
            console.log(`• السجلات: ${migrationReport.statistics.migratedRecords} من ${migrationReport.statistics.totalRecords}`);
            console.log(`• الفاشلة: ${migrationReport.statistics.failedRecords}`);
            console.log(`• المدة: ${Math.round(migrationReport.duration / 1000)} ثانية`);
            console.log(`• التقرير: ${reportFile}`);
            console.log('='.repeat(50));
            
            console.log('\n💡 التعليمات التالية:');
            console.log('1. قم بإعادة تشغيل البوت');
            console.log('2. تحقق من قاعدة البيانات الجديدة');
            console.log('3. احتفظ بملف SQLite للنسخ الاحتياطي');
            console.log('4. راجع تقرير الهجرة لأي أخطاء');
            
            return migrationReport;
            
        } catch (error) {
            console.error('❌ خطأ في الهجرة:', error);
            throw error;
        }
    }
    
    async createPostgreSQLTables(sequelize) {
        // تعريف النماذج (مطابق لما في index.js)
        const models = {
            Admin: {
                tableName: 'Admins',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    telegramId: { type: DataTypes.STRING, unique: true, allowNull: false },
                    username: DataTypes.STRING,
                    firstName: DataTypes.STRING,
                    lastName: DataTypes.STRING,
                    phoneNumber: DataTypes.STRING,
                    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
                    permissions: { type: DataTypes.JSON, defaultValue: ['basic'] },
                    settings: { type: DataTypes.JSON, defaultValue: {} },
                    lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            },
            
            WhatsAppSession: {
                tableName: 'WhatsAppSessions',
                columns: {
                    id: { type: DataTypes.STRING, primaryKey: true },
                    sessionId: { type: DataTypes.STRING, unique: true },
                    phoneNumber: { type: DataTypes.STRING, allowNull: false },
                    adminId: { type: DataTypes.INTEGER, allowNull: false },
                    sessionData: DataTypes.TEXT,
                    status: { 
                        type: DataTypes.ENUM('pending', 'awaiting_qr', 'connected', 'disconnected', 'error', 'authenticated'),
                        defaultValue: 'pending'
                    },
                    qrCode: DataTypes.TEXT,
                    qrSentAt: DataTypes.DATE,
                    connectionData: { type: DataTypes.JSON, defaultValue: {} },
                    lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                    connectedAt: DataTypes.DATE,
                    disconnectedAt: DataTypes.DATE,
                    groupsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
                    contactsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
                    stats: { type: DataTypes.JSON, defaultValue: {} },
                    settings: { type: DataTypes.JSON, defaultValue: {} },
                    metadata: { type: DataTypes.JSON, defaultValue: {} },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            },
            
            CollectedLink: {
                tableName: 'CollectedLinks',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    url: { type: DataTypes.STRING, unique: true, allowNull: false },
                    type: { 
                        type: DataTypes.ENUM('whatsapp_group', 'whatsapp_invite', 'telegram', 'website', 'other', 'whatsapp_channel', 'discord', 'signal'),
                        defaultValue: 'other'
                    },
                    title: DataTypes.STRING,
                    description: DataTypes.TEXT,
                    source: DataTypes.STRING,
                    sessionId: DataTypes.STRING,
                    metadata: { type: DataTypes.JSON, defaultValue: {} },
                    status: { type: DataTypes.ENUM('active', 'expired', 'invalid', 'joined'), defaultValue: 'active' },
                    collectedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                    lastChecked: DataTypes.DATE,
                    checkCount: { type: DataTypes.INTEGER, defaultValue: 0 }
                }
            },
            
            Advertisement: {
                tableName: 'Advertisements',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    adminId: { type: DataTypes.INTEGER, allowNull: false },
                    name: { type: DataTypes.STRING, allowNull: false },
                    type: { 
                        type: DataTypes.ENUM('text', 'image', 'video', 'contact', 'document', 'location', 'poll'),
                        defaultValue: 'text'
                    },
                    content: { type: DataTypes.TEXT, allowNull: false },
                    fileId: DataTypes.STRING,
                    fileUrl: DataTypes.STRING,
                    caption: DataTypes.TEXT,
                    buttons: { type: DataTypes.JSON, defaultValue: [] },
                    schedule: { type: DataTypes.JSON, defaultValue: {} },
                    target: { type: DataTypes.JSON, defaultValue: {} },
                    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
                    stats: { type: DataTypes.JSON, defaultValue: {} },
                    settings: { type: DataTypes.JSON, defaultValue: {} },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            },
            
            AutoPost: {
                tableName: 'AutoPosts',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    adminId: { type: DataTypes.INTEGER, allowNull: false },
                    sessionId: { type: DataTypes.STRING, allowNull: false },
                    adId: { type: DataTypes.INTEGER, allowNull: false },
                    status: { 
                        type: DataTypes.ENUM('active', 'paused', 'completed', 'error', 'waiting'),
                        defaultValue: 'active'
                    },
                    interval: { type: DataTypes.INTEGER, defaultValue: 1 },
                    lastPostAt: DataTypes.DATE,
                    nextPostAt: DataTypes.DATE,
                    stats: { type: DataTypes.JSON, defaultValue: {} },
                    settings: { type: DataTypes.JSON, defaultValue: {} },
                    logs: { type: DataTypes.JSON, defaultValue: [] },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            },
            
            AutoReply: {
                tableName: 'AutoReplies',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    adminId: { type: DataTypes.INTEGER, allowNull: false },
                    sessionId: DataTypes.STRING,
                    name: { type: DataTypes.STRING, allowNull: false },
                    triggerType: { 
                        type: DataTypes.ENUM('private', 'group', 'both', 'broadcast'),
                        defaultValue: 'both'
                    },
                    trigger: { type: DataTypes.TEXT, allowNull: false },
                    response: { type: DataTypes.TEXT, allowNull: false },
                    responseType: { type: DataTypes.ENUM('text', 'image', 'file', 'contact'), defaultValue: 'text' },
                    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
                    matchType: { 
                        type: DataTypes.ENUM('exact', 'contains', 'regex', 'starts_with', 'ends_with'),
                        defaultValue: 'contains'
                    },
                    priority: { type: DataTypes.INTEGER, defaultValue: 1 },
                    cooldown: { type: DataTypes.INTEGER, defaultValue: 0 },
                    conditions: { type: DataTypes.JSON, defaultValue: {} },
                    stats: { type: DataTypes.JSON, defaultValue: {} },
                    metadata: { type: DataTypes.JSON, defaultValue: {} },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            },
            
            AutoJoin: {
                tableName: 'AutoJoins',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    adminId: { type: DataTypes.INTEGER, allowNull: false },
                    sessionId: { type: DataTypes.STRING, allowNull: false },
                    status: { 
                        type: DataTypes.ENUM('active', 'paused', 'completed', 'error'),
                        defaultValue: 'active'
                    },
                    lastJoinAt: DataTypes.DATE,
                    nextJoinAt: DataTypes.DATE,
                    stats: { type: DataTypes.JSON, defaultValue: {} },
                    filters: { type: DataTypes.JSON, defaultValue: {} },
                    settings: { type: DataTypes.JSON, defaultValue: {} },
                    logs: { type: DataTypes.JSON, defaultValue: [] },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            },
            
            Broadcast: {
                tableName: 'Broadcasts',
                columns: {
                    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                    adminId: { type: DataTypes.INTEGER, allowNull: false },
                    sessionId: DataTypes.STRING,
                    name: DataTypes.STRING,
                    message: DataTypes.TEXT,
                    type: { type: DataTypes.ENUM('text', 'image', 'document', 'video'), defaultValue: 'text' },
                    targetType: { type: DataTypes.ENUM('contacts', 'groups', 'specific'), defaultValue: 'contacts' },
                    targets: { type: DataTypes.JSON, defaultValue: [] },
                    status: { type: DataTypes.ENUM('pending', 'sending', 'completed', 'failed'), defaultValue: 'pending' },
                    progress: { type: DataTypes.JSON, defaultValue: {} },
                    scheduledAt: DataTypes.DATE,
                    startedAt: DataTypes.DATE,
                    completedAt: DataTypes.DATE,
                    results: { type: DataTypes.JSON, defaultValue: [] },
                    settings: { type: DataTypes.JSON, defaultValue: {} },
                    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
                }
            }
        };
        
        // إنشاء الجداول
        for (const [modelName, modelDef] of Object.entries(models)) {
            console.log(`   🏗️ إنشاء جدول: ${modelDef.tableName}`);
            
            try {
                // التحقق مما إذا كان الجدول موجوداً بالفعل
                const tableExists = await sequelize.query(
                    `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = '${modelDef.tableName}')`,
                    { type: QueryTypes.SELECT }
                );
                
                if (tableExists[0].exists) {
                    console.log(`     ⚪ الجدول موجود بالفعل، تخطي`);
                    continue;
                }
                
                // إنشاء الجدول
                await sequelize.getQueryInterface().createTable(modelDef.tableName, modelDef.columns);
                console.log(`     ✅ تم إنشاء الجدول`);
                
            } catch (error) {
                console.error(`     ❌ خطأ في إنشاء جدول ${modelDef.tableName}:`, error.message);
                // الاستمرار في محاولة الجداول الأخرى
            }
        }
    }
    
    cleanDataForPostgreSQL(data, tableName) {
        const cleaned = { ...data };
        
        // تحويل التواريخ
        for (const [key, value] of Object.entries(cleaned)) {
            if (value instanceof Date) {
                cleaned[key] = value.toISOString();
            } else if (typeof value === 'boolean') {
                // PostgreSQL يتعامل مع القيم المنطقية بشكل مختلف
                cleaned[key] = value;
            } else if (typeof value === 'object' && value !== null) {
                // تحويل الكائنات إلى JSON
                cleaned[key] = JSON.stringify(value);
            }
        }
        
        // معالجات خاصة لكل جدول
        switch (tableName) {
            case 'Admins':
                if (cleaned.settings && typeof cleaned.settings === 'string') {
                    try {
                        cleaned.settings = JSON.parse(cleaned.settings);
                    } catch {
                        cleaned.settings = {};
                    }
                }
                break;
                
            case 'WhatsAppSessions':
                // تنظيف بيانات الاتصال
                if (cleaned.connectionData && typeof cleaned.connectionData === 'string') {
                    try {
                        cleaned.connectionData = JSON.parse(cleaned.connectionData);
                    } catch {
                        cleaned.connectionData = {};
                    }
                }
                break;
        }
        
        return cleaned;
    }
    
    async updateEnvFileForPostgreSQL() {
        const envPath = path.join(this.projectRoot, '.env');
        
        try {
            let envContent = await fs.readFile(envPath, 'utf8');
            
            // تحديث متغير DATABASE_URL إذا كان موجوداً
            if (envContent.includes('DATABASE_URL=')) {
                envContent = envContent.replace(
                    /DATABASE_URL=.*/,
                    `DATABASE_URL=${process.env.DATABASE_URL}`
                );
            } else {
                envContent += `\nDATABASE_URL=${process.env.DATABASE_URL}\n`;
            }
            
            // إضافة متغير NODE_ENV إذا لم يكن موجوداً
            if (!envContent.includes('NODE_ENV=')) {
                envContent += 'NODE_ENV=production\n';
            }
            
            // إضافة تعليق توضيحي
            const timestamp = new Date().toISOString();
            envContent = `# تم التحديث تلقائياً بواسطة Migration Manager\n# التاريخ: ${timestamp}\n\n${envContent}`;
            
            await fs.writeFile(envPath, envContent, 'utf8');
            
            console.log('✅ تم تحديث ملف .env لإعدادات PostgreSQL');
            
            // إنشاء نسخة احتياطية من ملف .env القديم
            const envBackup = path.join(this.projectRoot, '.env.backup');
            await fs.copyFile(envPath, envBackup);
            
        } catch (error) {
            console.error('⚠️ لا يمكن تحديث ملف .env:', error.message);
        }
    }
    
    // ============================================
    // 6. هجرة من PostgreSQL إلى SQLite (للتنمية)
    // ============================================
    async migrateToSQLite() {
        console.log('🔙 الهجرة من PostgreSQL إلى SQLite (للتنمية)...');
        
        // هذه الوظيفة مفيدة للتنمية المحلية
        // حيث يمكن للمطورين العمل على SQLite محلياً
        
        console.log('🚧 هذه الميزة قيد التطوير...');
        console.log('💡 يمكنك استخدام backup/restore بدلاً من ذلك');
        
        // يمكن تنفيذ هذه الوظيفة بشكل مشابه لـ migrateToPostgreSQL
        // ولكن بالعكس (من PostgreSQL إلى SQLite)
    }
    
    // ============================================
    // 7. استعادة قاعدة البيانات من نسخة احتياطية
    // ============================================
    async restoreDatabase(backupPath = null) {
        console.log('🔄 جاري استعادة قاعدة البيانات من نسخة احتياطية...');
        
        try {
            // إذا لم يتم تحديد مسار النسخة الاحتياطية، ابحث عن أحدث نسخة
            if (!backupPath) {
                backupPath = await this.findLatestBackup();
            }
            
            if (!backupPath) {
                throw new Error('لم يتم العثور على نسخ احتياطية');
            }
            
            console.log(`📂 مسار النسخة الاحتياطية: ${backupPath}`);
            
            // قراءة معلومات النسخة الاحتياطية
            const backupInfoPath = path.join(backupPath, 'backup_info.json');
            const backupInfo = JSON.parse(await fs.readFile(backupInfoPath, 'utf8'));
            
            console.log(`🗄️ نوع قاعدة البيانات: ${backupInfo.databaseType}`);
            console.log(`📅 تاريخ النسخة: ${new Date(backupInfo.timestamp).toLocaleString('ar-SA')}`);
            
            // التحقق من التوافق
            if (backupInfo.databaseType !== this.currentDbType) {
                console.warn(`⚠️ تحذير: نوع قاعدة البيانات مختلف (${backupInfo.databaseType} → ${this.currentDbType})`);
                
                if (!await this.confirmAction('هل تريد المتابعة مع تحويل الأنواع؟')) {
                    console.log('❌ تم إلغاء الاستعادة');
                    return;
                }
            }
            
            // النسخ الاحتياطي للبيانات الحالية قبل الاستعادة
            console.log('💾 جاري عمل نسخة احتياطية من البيانات الحالية...');
            const preRestoreBackup = await this.backupDatabase();
            console.log(`✅ النسخة الاحتياطية قبل الاستعادة: ${preRestoreBackup}`);
            
            // استعادة البيانات حسب نوع قاعدة البيانات
            switch (this.currentDbType) {
                case 'sqlite':
                    await this.restoreSQLite(backupPath, backupInfo);
                    break;
                    
                case 'postgres':
                    await this.restorePostgreSQL(backupPath, backupInfo);
                    break;
                    
                default:
                    throw new Error(`لا يمكن استعادة نوع قاعدة البيانات: ${this.currentDbType}`);
            }
            
            console.log('\n' + '='.repeat(50));
            console.log('✅ تم استعادة قاعدة البيانات بنجاح!');
            console.log('='.repeat(50));
            console.log('💡 التعليمات:');
            console.log('1. قم بإعادة تشغيل البوت');
            console.log('2. تحقق من البيانات المستعادة');
            console.log('3. النسخة الاحتياطية الأصلية محفوظة في:', preRestoreBackup);
            
            return {
                success: true,
                backupPath: backupPath,
                preRestoreBackup: preRestoreBackup
            };
            
        } catch (error) {
            console.error('❌ خطأ في استعادة قاعدة البيانات:', error);
            throw error;
        }
    }
    
    async findLatestBackup() {
        try {
            const backups = await fs.readdir(this.backupDir);
            
            if (backups.length === 0) {
                return null;
            }
            
            // فرز النسخ الاحتياطية من الأحدث إلى الأقدم
            const sortedBackups = backups.sort().reverse();
            
            // البحث عن أحدث نسخة تحتوي على ملف backup_info.json
            for (const backup of sortedBackups) {
                const backupPath = path.join(this.backupDir, backup);
                const infoFile = path.join(backupPath, 'backup_info.json');
                
                try {
                    await fs.access(infoFile);
                    return backupPath;
                } catch {
                    // تجاهل النسخ التي لا تحتوي على ملف info
                    continue;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ خطأ في البحث عن النسخ الاحتياطية:', error);
            return null;
        }
    }
    
    async restoreSQLite(backupPath, backupInfo) {
        console.log('🔁 استعادة قاعدة بيانات SQLite...');
        
        const sourceDb = path.join(backupPath, 'bot.db');
        const targetDb = this.dbFiles.sqlite;
        
        // التحقق من وجود ملف النسخة الاحتياطية
        try {
            await fs.access(sourceDb);
        } catch {
            throw new Error(`ملف قاعدة البيانات غير موجود في النسخة الاحتياطية: ${sourceDb}`);
        }
        
        // نسخ ملف قاعدة البيانات
        await fs.copyFile(sourceDb, targetDb);
        console.log(`✅ تم نسخ ملف قاعدة البيانات إلى: ${targetDb}`);
        
        // استعادة مجلد sessions إذا كان موجوداً
        const sourceSessions = path.join(backupPath, 'sessions');
        const targetSessions = path.join(this.projectRoot, 'sessions');
        
        try {
            await fs.access(sourceSessions);
            await fs.rm(targetSessions, { recursive: true, force: true });
            await this.copyDirectory(sourceSessions, targetSessions);
            console.log('✅ تم استعادة جلسات WhatsApp');
        } catch {
            console.log('⚠️ لا يوجد مجلد sessions في النسخة الاحتياطية');
        }
    }
    
    async restorePostgreSQL(backupPath, backupInfo) {
        console.log('🔁 استعادة قاعدة بيانات PostgreSQL...');
        
        // البحث عن ملف dump
        const dumpFiles = await fs.readdir(backupPath);
        const sqlFile = dumpFiles.find(f => f.endsWith('.sql'));
        
        if (sqlFile) {
            // استعادة باستخدام psql
            const dumpPath = path.join(backupPath, sqlFile);
            const command = `psql "${process.env.DATABASE_URL}" < "${dumpPath}"`;
            
            console.log(`📂 استخدام ملف: ${sqlFile}`);
            
            return new Promise((resolve, reject) => {
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ فشل استعادة PostgreSQL:', error);
                        
                        // محاولة باستخدام Sequelize
                        this.restorePostgreSQLViaSequelize(backupPath, backupInfo)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                    
                    console.log('✅ تم استعادة PostgreSQL بنجاح');
                    resolve();
                });
            });
        } else {
            // استخدام طريقة Sequelize
            await this.restorePostgreSQLViaSequelize(backupPath, backupInfo);
        }
    }
    
    async restorePostgreSQLViaSequelize(backupPath, backupInfo) {
        console.log('🔄 استخدام Sequelize للاستعادة...');
        
        const sequelize = await this.createConnection('postgres');
        
        try {
            // البحث عن ملف بيانات JSON
            const dataFile = path.join(backupPath, 'database_data.json');
            
            try {
                await fs.access(dataFile);
            } catch {
                throw new Error(`ملف البيانات غير موجود: ${dataFile}`);
            }
            
            // قراءة البيانات
            const data = JSON.parse(await fs.readFile(dataFile, 'utf8'));
            
            // مسح الجداول الحالية
            console.log('🧹 جاري مسح الجداول الحالية...');
            const tables = Object.keys(data).reverse(); // عكسي لحذف الجداول الفرعية أولاً
            
            for (const tableName of tables) {
                try {
                    await sequelize.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
                    console.log(`   🗑️ تم مسح جدول: ${tableName}`);
                } catch (error) {
                    console.log(`   ⚠️ لا يمكن مسح جدول ${tableName}: ${error.message}`);
                }
            }
            
            // إدخال البيانات
            console.log('📥 جاري إدخال البيانات...');
            
            for (const [tableName, records] of Object.entries(data)) {
                if (!Array.isArray(records) || records.length === 0) {
                    continue;
                }
                
                console.log(`   📊 جدول: ${tableName} (${records.length} سجل)`);
                
                let inserted = 0;
                let failed = 0;
                
                for (const record of records) {
                    try {
                        const columns = Object.keys(record).map(col => `"${col}"`).join(', ');
                        const values = Object.values(record).map(val => {
                            if (val === null) return 'NULL';
                            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                            if (typeof val === 'number') return val;
                            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                            return `'${val.toString().replace(/'/g, "''")}'`;
                        }).join(', ');
                        
                        const insertQuery = `INSERT INTO "${tableName}" (${columns}) VALUES (${values})`;
                        
                        await sequelize.query(insertQuery, { type: QueryTypes.INSERT });
                        inserted++;
                        
                    } catch (error) {
                        failed++;
                        console.log(`     ❌ خطأ في سجل: ${error.message.substring(0, 100)}`);
                    }
                }
                
                console.log(`     ✅ ${inserted}، ❌ ${failed}`);
            }
            
            console.log('✅ تم استعادة البيانات بنجاح');
            
        } finally {
            await sequelize.close();
        }
    }
    
    // ============================================
    // 8. التحقق من صحة قاعدة البيانات
    // ============================================
    async validateDatabase() {
        console.log('🔍 جاري التحقق من صحة قاعدة البيانات...');
        
        const validationReport = {
            timestamp: new Date().toISOString(),
            databaseType: this.currentDbType,
            checks: [],
            issues: [],
            recommendations: []
        };
        
        try {
            const sequelize = await this.createConnection();
            
            // 1. التحقق من الاتصال
            validationReport.checks.push({
                name: 'اتصال قاعدة البيانات',
                status: '✅',
                message: 'تم الاتصال بنجاح'
            });
            
            // 2. التحقق من الجداول الأساسية
            const requiredTables = [
                'Admins',
                'WhatsAppSessions', 
                'CollectedLinks',
                'Advertisements'
            ];
            
            let tablesExist = 0;
            
            for (const table of requiredTables) {
                try {
                    const exists = await this.checkTableExists(sequelize, table);
                    
                    if (exists) {
                        validationReport.checks.push({
                            name: `جدول ${table}`,
                            status: '✅',
                            message: 'موجود'
                        });
                        tablesExist++;
                    } else {
                        validationReport.checks.push({
                            name: `جدول ${table}`,
                            status: '❌',
                            message: 'مفقود'
                        });
                        validationReport.issues.push(`جدول ${table} مفقود`);
                    }
                } catch (error) {
                    validationReport.checks.push({
                        name: `جدول ${table}`,
                        status: '⚠️',
                        message: `خطأ: ${error.message}`
                    });
                }
            }
            
            // 3. التحقق من عدد السجلات
            if (tablesExist > 0) {
                await this.checkRecordCounts(sequelize, validationReport);
            }
            
            // 4. التحقق من الفهارس
            await this.checkIndexes(sequelize, validationReport);
            
            // 5. التحقق من الأداء
            await this.checkPerformance(sequelize, validationReport);
            
            await sequelize.close();
            
            // 6. التوصيات
            if (validationReport.issues.length === 0) {
                validationReport.recommendations.push('✅ قاعدة البيانات في حالة ممتازة');
            } else {
                validationReport.recommendations.push('🔧 قم بإصلاح المشكلات المذكورة أعلاه');
                
                if (validationReport.issues.some(i => i.includes('مفقود'))) {
                    validationReport.recommendations.push('🔄 قد تحتاج إلى تشغيل تهيئة قاعدة البيانات');
                }
            }
            
            // 7. عرض التقرير
            console.log('\n📊 تقرير التحقق من الصحة:');
            console.log('='.repeat(50));
            
            for (const check of validationReport.checks) {
                console.log(`${check.status} ${check.name}: ${check.message}`);
            }
            
            if (validationReport.issues.length > 0) {
                console.log('\n⚠️ المشكلات المكتشفة:');
                validationReport.issues.forEach(issue => console.log(`• ${issue}`));
            }
            
            if (validationReport.recommendations.length > 0) {
                console.log('\n💡 التوصيات:');
                validationReport.recommendations.forEach(rec => console.log(`• ${rec}`));
            }
            
            console.log('='.repeat(50));
            
            // حفظ التقرير
            const reportFile = path.join(this.logsDir, `validation_${Date.now()}.json`);
            await fs.mkdir(path.dirname(reportFile), { recursive: true });
            await fs.writeFile(reportFile, JSON.stringify(validationReport, null, 2), 'utf8');
            
            console.log(`📝 التقرير الكامل: ${reportFile}`);
            
            return validationReport;
            
        } catch (error) {
            console.error('❌ خطأ في التحقق من صحة قاعدة البيانات:', error);
            
            validationReport.checks.push({
                name: 'الاتصال بقاعدة البيانات',
                status: '❌',
                message: `فشل: ${error.message}`
            });
            
            validationReport.issues.push(`فشل الاتصال: ${error.message}`);
            validationReport.recommendations.push('🔧 تحقق من إعدادات قاعدة البيانات');
            
            return validationReport;
        }
    }
    
    async checkTableExists(sequelize, tableName) {
        switch (this.currentDbType) {
            case 'sqlite':
                const sqliteResult = await sequelize.query(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
                    { type: QueryTypes.SELECT }
                );
                return sqliteResult.length > 0;
                
            case 'postgres':
                const pgResult = await sequelize.query(
                    `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = '${tableName}')`,
                    { type: QueryTypes.SELECT }
                );
                return pgResult[0].exists;
                
            default:
                return false;
        }
    }
    
    async checkRecordCounts(sequelize, report) {
        const tablesToCheck = ['Admins', 'WhatsAppSessions', 'CollectedLinks'];
        
        for (const table of tablesToCheck) {
            try {
                const result = await sequelize.query(
                    `SELECT COUNT(*) as count FROM "${table}"`,
                    { type: QueryTypes.SELECT }
                );
                
                const count = result[0]?.count || 0;
                
                report.checks.push({
                    name: `سجلات ${table}`,
                    status: count > 0 ? '✅' : '⚠️',
                    message: `${count} سجل`
                });
                
                if (count === 0) {
                    report.issues.push(`جدول ${table} فارغ`);
                }
                
            } catch (error) {
                report.checks.push({
                    name: `سجلات ${table}`,
                    status: '❌',
                    message: `خطأ: ${error.message}`
                });
            }
        }
    }
    
    async checkIndexes(sequelize, report) {
        // التحقق من الفهارس المهمة
        const importantIndexes = [
            { table: 'Admins', column: 'telegramId' },
            { table: 'WhatsAppSessions', column: 'sessionId' },
            { table: 'CollectedLinks', column: 'url' }
        ];
        
        for (const index of importantIndexes) {
            try {
                let hasIndex = false;
                
                if (this.currentDbType === 'postgres') {
                    const result = await sequelize.query(
                        `SELECT COUNT(*) as count FROM pg_indexes 
                         WHERE tablename = '${index.table}' 
                         AND indexdef LIKE '%${index.column}%'`,
                        { type: QueryTypes.SELECT }
                    );
                    
                    hasIndex = result[0]?.count > 0;
                }
                
                report.checks.push({
                    name: `فهرس ${index.table}.${index.column}`,
                    status: hasIndex ? '✅' : '⚠️',
                    message: hasIndex ? 'موجود' : 'مستحسن إضافته'
                });
                
                if (!hasIndex) {
                    report.recommendations.push(`أضف فهرساً لـ ${index.table}.${index.column}`);
                }
                
            } catch (error) {
                // تجاهل الأخطاء في هذه المرحلة
            }
        }
    }
    
    async checkPerformance(sequelize, report) {
        try {
            // فحص أداء استعلام بسيط
            const startTime = Date.now();
            
            await sequelize.query(
                'SELECT 1 as test',
                { type: QueryTypes.SELECT }
            );
            
            const queryTime = Date.now() - startTime;
            
            report.checks.push({
                name: 'أداء الاستعلام',
                status: queryTime < 100 ? '✅' : queryTime < 500 ? '⚠️' : '❌',
                message: `${queryTime}ms`
            });
            
            if (queryTime > 500) {
                report.issues.push('زمن استجابة قاعدة البيانات بطيء');
                report.recommendations.push('🔧 تحقق من أداء قاعدة البيانات');
            }
            
        } catch (error) {
            // تجاهل الأخطاء
        }
    }
    
    // ============================================
    // 9. وظائف مساعدة
    // ============================================
    async confirmAction(message) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question(`${message} (y/n): `, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
            });
        });
    }
    
    async promptForInput(message) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            rl.question(`${message}: `, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }
    
    // ============================================
    // 10. الوظيفة الرئيسية
    // ============================================
    async runMigration(action, options = {}) {
        console.log(`🚀 مدير الهجرة والترحيل - ${action}`);
        console.log('='.repeat(50));
        
        try {
            switch (action) {
                case 'backup':
                    return await this.backupDatabase();
                    
                case 'migrate-to-postgres':
                    return await this.migrateToPostgreSQL();
                    
                case 'migrate-to-sqlite':
                    return await this.migrateToSQLite();
                    
                case 'restore':
                    return await this.restoreDatabase(options.backupPath);
                    
                case 'validate':
                    return await this.validateDatabase();
                    
                case 'export-schema':
                    const outputDir = options.outputDir || this.backupDir;
                    return await this.exportSchema(outputDir);
                    
                case 'info':
                    return await this.showDatabaseInfo();
                    
                default:
                    throw new Error(`إجراء غير معروف: ${action}`);
            }
            
        } catch (error) {
            console.error(`❌ فشل في تنفيذ ${action}:`, error);
            throw error;
        }
    }
    
    async showDatabaseInfo() {
        console.log('📊 معلومات قاعدة البيانات');
        console.log('='.repeat(50));
        
        const info = {
            databaseType: this.currentDbType,
            detectedAt: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            settings: {}
        };
        
        console.log(`🗄️ نوع قاعدة البيانات: ${info.databaseType}`);
        console.log(`🌐 البيئة: ${info.environment}`);
        console.log(`📅 وقت الاكتشاف: ${new Date().toLocaleString('ar-SA')}`);
        
        // معلومات إضافية حسب نوع قاعدة البيانات
        switch (this.currentDbType) {
            case 'sqlite':
                try {
                    const stats = await fs.stat(this.dbFiles.sqlite);
                    info.settings.fileSize = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
                    info.settings.lastModified = stats.mtime;
                    
                    console.log(`💾 حجم الملف: ${info.settings.fileSize}`);
                    console.log(`📅 آخر تعديل: ${stats.mtime.toLocaleString('ar-SA')}`);
                } catch (error) {
                    console.log(`⚠️ لا يمكن قراءة معلومات ملف SQLite: ${error.message}`);
                }
                break;
                
            case 'postgres':
                if (process.env.DATABASE_URL) {
                    const url = process.env.DATABASE_URL;
                    // إخفاء كلمة المرور للأمان
                    const safeUrl = url.replace(/:[^:@]+@/, ':****@');
                    info.settings.url = safeUrl;
                    
                    console.log(`🔗 رابط الاتصال: ${safeUrl}`);
                }
                break;
        }
        
        // عرض إحصائيات إذا كان هناك اتصال
        try {
            const sequelize = await this.createConnection();
            const tableCount = await this.getTableCount(sequelize);
            await sequelize.close();
            
            console.log(`📋 عدد الجداول: ${tableCount}`);
            info.settings.tableCount = tableCount;
            
        } catch (error) {
            console.log(`⚠️ لا يمكن الاتصال لقاعدة البيانات: ${error.message}`);
        }
        
        return info;
    }
    
    async getTableCount(sequelize) {
        switch (this.currentDbType) {
            case 'sqlite':
                const sqliteResult = await sequelize.query(
                    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                    { type: QueryTypes.SELECT }
                );
                return sqliteResult[0]?.count || 0;
                
            case 'postgres':
                const pgResult = await sequelize.query(
                    "SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'",
                    { type: QueryTypes.SELECT }
                );
                return pgResult[0]?.count || 0;
                
            default:
                return 0;
        }
    }
}

// ============================================
// 11. الواجهة الرئيسية
// ============================================
if (require.main === module) {
    async function main() {
        const manager = new MigrationManager();
        
        // معالجة وسيطات سطر الأوامر
        const args = process.argv.slice(2);
        const action = args[0] || 'help';
        const options = {};
        
        // تحليل الخيارات
        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--backup-path' && args[i + 1]) {
                options.backupPath = args[i + 1];
                i++;
            } else if (args[i] === '--output-dir' && args[i + 1]) {
                options.outputDir = args[i + 1];
                i++;
            }
        }
        
        // عرض القائمة إذا كان الأمر help أو بدون أوامر
        if (action === 'help' || !action) {
            console.log('🤖 مدير هجرة وترحيل قاعدة البيانات');
            console.log('='.repeat(50));
            console.log('\n📋 الأوامر المتاحة:\n');
            console.log('1. backup                     - إنشاء نسخة احتياطية');
            console.log('2. migrate-to-postgres        - الهجرة من SQLite إلى PostgreSQL');
            console.log('3. migrate-to-sqlite          - الهجرة من PostgreSQL إلى SQLite');
            console.log('4. restore [--backup-path]    - استعادة من نسخة احتياطية');
            console.log('5. validate                   - التحقق من صحة قاعدة البيانات');
            console.log('6. export-schema [--output-dir] - تصدير مخطط قاعدة البيانات');
            console.log('7. info                       - عرض معلومات قاعدة البيانات');
            console.log('8. help                       - عرض هذه القائمة');
            console.log('\n📝 أمثلة:');
            console.log('   node scripts/migrate.js backup');
            console.log('   node scripts/migrate.js migrate-to-postgres');
            console.log('   node scripts/migrate.js restore --backup-path ./backups/latest');
            console.log('   node scripts/migrate.js validate');
            console.log('\n⚠️ ملاحظة: دائماً قم بعمل نسخة احتياطية قبل أي عملية هجرة!');
            return;
        }
        
        // تنفيذ الأمر
        try {
            await manager.runMigration(action, options);
        } catch (error) {
            console.error(`❌ فشل تنفيذ الأمر "${action}":`, error.message);
            process.exit(1);
        }
    }
    
    main().catch(error => {
        console.error('❌ خطأ غير متوقع:', error);
        process.exit(1);
    });
}

// ============================================
// 12. التصدير
// ============================================
module.exports = MigrationManager;
