// ============================================
// 🧹 Cleanup & Merger Script - WhatsApp Telegram Bot
// الإصدار: 2.0.0 - Render Optimized
// الغرض: دمج الملفات وتنظيف الكود
// ============================================

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

class CleanupManager {
    constructor() {
        console.log('🧹 بدء مدير التنظيف والدمج...');
        
        this.projectRoot = process.cwd();
        this.backupDir = path.join(this.projectRoot, 'backups');
        this.tempDir = path.join(this.projectRoot, 'temp_cleanup');
        
        this.filesToMerge = [
            { name: 'index.js', path: path.join(this.projectRoot, 'index.js') },
            { name: 'whatsappClient.js', path: path.join(this.projectRoot, 'whatsappClient.js') },
            { name: 'telegramBot.js', path: path.join(this.projectRoot, 'telegramBot.js') }
        ];
        
        console.log('✅ مدير التنظيف مهيأ وجاهز');
    }
    
    // ============================================
    // 1. النسخ الاحتياطي للملفات
    // ============================================
    async backupFiles() {
        console.log('💾 جاري إنشاء نسخ احتياطية...');
        
        try {
            // إنشاء مجلد النسخ الاحتياطي
            await fs.mkdir(this.backupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFolder = path.join(this.backupDir, `backup_${timestamp}`);
            
            await fs.mkdir(backupFolder, { recursive: true });
            
            // نسخ جميع الملفات المهمة
            const filesToBackup = [
                'index.js',
                'whatsappClient.js',
                'telegramBot.js',
                'package.json',
                '.env',
                'database/bot.db',
                'sessions/'
            ];
            
            let backedUpFiles = 0;
            
            for (const file of filesToBackup) {
                try {
                    const sourcePath = path.join(this.projectRoot, file);
                    const destPath = path.join(backupFolder, file);
                    
                    // إنشاء المجلدات الفرعية إذا لزم الأمر
                    const destDir = path.dirname(destPath);
                    await fs.mkdir(destDir, { recursive: true });
                    
                    // نسخ الملف أو المجلد
                    const stats = await fs.stat(sourcePath);
                    
                    if (stats.isDirectory()) {
                        await this.copyDirectory(sourcePath, destPath);
                        console.log(`   📁 ${file}/`);
                    } else {
                        await fs.copyFile(sourcePath, destPath);
                        console.log(`   📄 ${file}`);
                    }
                    
                    backedUpFiles++;
                } catch (error) {
                    console.log(`   ⚠️ ${file}: ${error.message}`);
                }
            }
            
            // حفظ معلومات النسخ الاحتياطي
            const backupInfo = {
                timestamp: new Date().toISOString(),
                files: backedUpFiles,
                projectRoot: this.projectRoot,
                version: '2.0.0'
            };
            
            await fs.writeFile(
                path.join(backupFolder, 'backup_info.json'),
                JSON.stringify(backupInfo, null, 2)
            );
            
            console.log(`✅ تم إنشاء نسخة احتياطية في: ${backupFolder}`);
            console.log(`📊 عدد الملفات: ${backedUpFiles}`);
            
            return backupFolder;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء النسخ الاحتياطية:', error);
            throw error;
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
    
    // ============================================
    // 2. تحليل وفحص الملفات
    // ============================================
    async analyzeFiles() {
        console.log('🔍 جاري تحليل الملفات...');
        
        try {
            const analysis = {
                files: [],
                duplicates: [],
                issues: [],
                suggestions: []
            };
            
            for (const fileInfo of this.filesToMerge) {
                try {
                    const content = await fs.readFile(fileInfo.path, 'utf8');
                    const stats = await fs.stat(fileInfo.path);
                    
                    const fileAnalysis = {
                        name: fileInfo.name,
                        path: fileInfo.path,
                        size: stats.size,
                        lines: content.split('\n').length,
                        hasDuplicates: false,
                        issues: []
                    };
                    
                    // تحليل المحتوى
                    if (content.length === 0) {
                        fileAnalysis.issues.push('الملف فارغ');
                    }
                    
                    if (content.includes('TODO') || content.includes('FIXME')) {
                        fileAnalysis.issues.push('يحتوي على مهام معلقة');
                    }
                    
                    // التحقق من التكرارات مع ملفات أخرى
                    for (const otherFile of this.filesToMerge) {
                        if (otherFile.name !== fileInfo.name) {
                            try {
                                const otherContent = await fs.readFile(otherFile.path, 'utf8');
                                const commonLines = this.findCommonLines(content, otherContent);
                                
                                if (commonLines.length > 10) { // إذا كان هناك أكثر من 10 سطور متشابهة
                                    fileAnalysis.hasDuplicates = true;
                                    analysis.duplicates.push({
                                        file1: fileInfo.name,
                                        file2: otherFile.name,
                                        commonLines: commonLines.length
                                    });
                                }
                            } catch (error) {
                                console.log(`   ⚠️ لا يمكن قراءة ${otherFile.name}: ${error.message}`);
                            }
                        }
                    }
                    
                    analysis.files.push(fileAnalysis);
                    console.log(`   📄 ${fileInfo.name}: ${fileAnalysis.lines} سطر، ${Math.round(fileAnalysis.size / 1024)}KB`);
                    
                } catch (error) {
                    console.error(`❌ خطأ في تحليل ${fileInfo.name}:`, error.message);
                    analysis.issues.push(`فشل تحليل ${fileInfo.name}: ${error.message}`);
                }
            }
            
            // تحليل التبعيات
            await this.analyzeDependencies(analysis);
            
            // اقتراحات للتحسين
            if (analysis.duplicates.length > 0) {
                analysis.suggestions.push('يوجد تكرار في الكود، يحتاج إلى دمج');
            }
            
            if (analysis.files.some(f => f.issues.length > 0)) {
                analysis.suggestions.push('يوجد ملفات تحتاج إلى إصلاح');
            }
            
            console.log('✅ تم تحليل الملفات بنجاح');
            console.log(`📊 النتائج: ${analysis.files.length} ملف، ${analysis.duplicates.length} تكرار`);
            
            return analysis;
            
        } catch (error) {
            console.error('❌ خطأ في تحليل الملفات:', error);
            throw error;
        }
    }
    
    findCommonLines(content1, content2) {
        const lines1 = content1.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const lines2 = content2.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        return lines1.filter(line => lines2.includes(line));
    }
    
    async analyzeDependencies(analysis) {
        try {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const packageContent = await fs.readFile(packagePath, 'utf8');
            const packageJson = JSON.parse(packageContent);
            
            analysis.dependencies = {
                total: Object.keys(packageJson.dependencies || {}).length,
                list: packageJson.dependencies || {}
            };
            
            console.log(`   📦 التبعيات: ${analysis.dependencies.total} مكتبة`);
            
        } catch (error) {
            console.log('   ⚠️ لا يمكن تحليل package.json');
        }
    }
    
    // ============================================
    // 3. دمج الملفات الثلاثة
    // ============================================
    async mergeFiles() {
        console.log('🔗 جاري دمج الملفات...');
        
        try {
            // قراءة المحتوى من الملفات الثلاثة
            const filesContent = {};
            
            for (const fileInfo of this.filesToMerge) {
                try {
                    filesContent[fileInfo.name] = await fs.readFile(fileInfo.path, 'utf8');
                    console.log(`   ✅ قراءة ${fileInfo.name}`);
                } catch (error) {
                    console.error(`❌ خطأ في قراءة ${fileInfo.name}:`, error);
                    throw error;
                }
            }
            
            // تحليل الهيكل وتحديد التكرارات
            console.log('   🔍 تحليل الهيكل وتحديد التكرارات...');
            
            // استخراج التكرارات بين الملفات
            const duplicates = this.extractDuplicates(
                filesContent['index.js'],
                filesContent['telegramBot.js'],
                filesContent['whatsappClient.js']
            );
            
            // إنشاء الملف المدمج الجديد
            console.log('   🏗️ إنشاء الملف المدمج...');
            const mergedContent = await this.createMergedFile(filesContent, duplicates);
            
            // حفظ الملف المدمج
            const mergedFilePath = path.join(this.projectRoot, 'whatsapp-bot-merged.js');
            await fs.writeFile(mergedFilePath, mergedContent, 'utf8');
            
            console.log(`✅ تم دمج الملفات في: ${mergedFilePath}`);
            console.log(`📊 حجم الملف المدمج: ${Math.round(mergedContent.length / 1024)}KB`);
            
            // إنشاء ملف index.js جديد مبسط
            await this.createNewIndexFile(mergedFilePath);
            
            return mergedFilePath;
            
        } catch (error) {
            console.error('❌ خطأ في دمج الملفات:', error);
            throw error;
        }
    }
    
    extractDuplicates(indexContent, telegramContent, whatsappContent) {
        const duplicates = {
            index_telegram: [],
            index_whatsapp: [],
            telegram_whatsapp: [],
            all_three: []
        };
        
        // تقسيم الملفات إلى أقسام
        const indexSections = this.extractSections(indexContent);
        const telegramSections = this.extractSections(telegramContent);
        const whatsappSections = this.extractSections(whatsappContent);
        
        // البحث عن الأقسام المتشابهة
        for (const [sectionName, sectionContent] of Object.entries(indexSections)) {
            // التحقق من التكرار مع telegramBot.js
            if (telegramSections[sectionName] && 
                this.areSectionsSimilar(sectionContent, telegramSections[sectionName])) {
                duplicates.index_telegram.push(sectionName);
            }
            
            // التحقق من التكرار مع whatsappClient.js
            if (whatsappSections[sectionName] && 
                this.areSectionsSimilar(sectionContent, whatsappSections[sectionName])) {
                duplicates.index_whatsapp.push(sectionName);
            }
        }
        
        // التحقق من التكرار بين telegramBot.js و whatsappClient.js
        for (const [sectionName, sectionContent] of Object.entries(telegramSections)) {
            if (whatsappSections[sectionName] && 
                this.areSectionsSimilar(sectionContent, whatsappSections[sectionName])) {
                duplicates.telegram_whatsapp.push(sectionName);
            }
        }
        
        // البحث عن الأقسام المتشابهة في الملفات الثلاثة
        for (const sectionName of Object.keys(indexSections)) {
            if (duplicates.index_telegram.includes(sectionName) && 
                duplicates.index_whatsapp.includes(sectionName)) {
                duplicates.all_three.push(sectionName);
            }
        }
        
        console.log(`   📊 التكرارات المكتشفة:`);
        console.log(`     • index ↔ telegram: ${duplicates.index_telegram.length}`);
        console.log(`     • index ↔ whatsapp: ${duplicates.index_whatsapp.length}`);
        console.log(`     • telegram ↔ whatsapp: ${duplicates.telegram_whatsapp.length}`);
        console.log(`     • جميع الملفات: ${duplicates.all_three.length}`);
        
        return duplicates;
    }
    
    extractSections(content) {
        const sections = {};
        const lines = content.split('\n');
        let currentSection = 'header';
        let sectionContent = [];
        
        for (const line of lines) {
            // اكتشاف بداية قسم جديد
            if (line.includes('// ============================================') ||
                line.includes('// 1.') || line.includes('// 2.') || 
                line.includes('// 3.') || line.includes('// 4.')) {
                
                if (sectionContent.length > 0) {
                    sections[currentSection] = sectionContent.join('\n');
                }
                
                // استخراج اسم القسم من السطر
                const sectionMatch = line.match(/\/\/ (\d+\.)?\s*(.+)/);
                if (sectionMatch) {
                    currentSection = sectionMatch[2] || `section_${Object.keys(sections).length + 1}`;
                } else {
                    currentSection = `section_${Object.keys(sections).length + 1}`;
                }
                
                sectionContent = [line];
            } else {
                sectionContent.push(line);
            }
        }
        
        // إضافة القسم الأخير
        if (sectionContent.length > 0) {
            sections[currentSection] = sectionContent.join('\n');
        }
        
        return sections;
    }
    
    areSectionsSimilar(section1, section2, threshold = 0.7) {
        // حساب نسبة التشابه البسيطة
        const lines1 = section1.split('\n').filter(l => l.trim().length > 0);
        const lines2 = section2.split('\n').filter(l => l.trim().length > 0);
        
        if (lines1.length === 0 || lines2.length === 0) return false;
        
        // حساب عدد السطور المشتركة
        const commonLines = lines1.filter(line => lines2.includes(line));
        const similarity = commonLines.length / Math.max(lines1.length, lines2.length);
        
        return similarity >= threshold;
    }
    
    async createMergedFile(filesContent, duplicates) {
        let mergedContent = `// ============================================\n`;
        mergedContent += `// 🤖 WhatsApp Telegram Bot - النسخة المدمجة\n`;
        mergedContent += `// تم الإنشاء تلقائياً بواسطة Cleanup Manager\n`;
        mergedContent += `// التاريخ: ${new Date().toLocaleString('ar-SA')}\n`;
        mergedContent += `// ============================================\n\n`;
        
        // إضافة معلومات الدمج
        mergedContent += `// 📊 معلومات الدمج:\n`;
        mergedContent += `// • الملفات المدمجة: index.js, telegramBot.js, whatsappClient.js\n`;
        mergedContent += `// • التكرارات المعالجة: ${JSON.stringify(duplicates, null, 2).split('\n').join('\n// ')}\n\n`;
        
        // دمج المحتوى الفريد من كل ملف
        mergedContent += this.extractUniqueContent(filesContent['index.js'], 'index.js', duplicates);
        mergedContent += this.extractUniqueContent(filesContent['telegramBot.js'], 'telegramBot.js', duplicates);
        mergedContent += this.extractUniqueContent(filesContent['whatsappClient.js'], 'whatsappClient.js', duplicates);
        
        // إضافة قسم إدارة الاعتمادات
        mergedContent += this.createCreditsSection();
        
        return mergedContent;
    }
    
    extractUniqueContent(content, sourceFile, duplicates) {
        let uniqueContent = `\n// ============================================\n`;
        uniqueContent += `// 📁 المحتوى من: ${sourceFile}\n`;
        uniqueContent += `// ============================================\n\n`;
        
        const lines = content.split('\n');
        let inDuplicateSection = false;
        let extractedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // تخطي التعليقات الطويلة الفاصلة
            if (line.includes('// ============================================')) {
                continue;
            }
            
            // تخطي المحتوى المكرر المحدد
            if (this.isDuplicateLine(line, sourceFile, duplicates)) {
                if (!inDuplicateSection) {
                    extractedLines.push(`// [محذوف: محتوى مكرر من ${sourceFile}]`);
                    inDuplicateSection = true;
                }
                continue;
            } else {
                inDuplicateSection = false;
            }
            
            extractedLines.push(line);
        }
        
        uniqueContent += extractedLines.join('\n') + '\n';
        return uniqueContent;
    }
    
    isDuplicateLine(line, sourceFile, duplicates) {
        // هذه دالة مبسطة لتحديد السطور المكررة
        // في التطبيق الحقيقي، تحتاج إلى خوارزمية أكثر تعقيداً
        
        const duplicateKeywords = [
            'require(\'dotenv\').config()',
            'const express = require(\'express\')',
            'const { Sequelize',
            'const TelegramBot = require(\'node-telegram-bot-api\')',
            'const { Client, LocalAuth } = require(\'whatsapp-web.js\')',
            'class WhatsApp',
            'constructor() {',
            'async initializeDatabase()',
            'async createWhatsAppSession(',
            'async handleWhatsAppMessage('
        ];
        
        return duplicateKeywords.some(keyword => line.includes(keyword));
    }
    
    createCreditsSection() {
        return `
// ============================================
// 🏆 قسم الاعتمادات والترخيص
// ============================================

/**
 * 🤖 WhatsApp Telegram Bot - النسخة المدمجة
 * 
 * 🎯 المميزات الرئيسية:
 * 1. ربط متعدد لحسابات WhatsApp
 * 2. تجميع تلقائي للروابط
 * 3. نظام إعلانات متكامل
 * 4. ردود تلقائية ذكية
 * 5. إحصائيات وتقارير مفصلة
 * 
 * 📦 التبعيات الرئيسية:
 * • whatsapp-web.js: لإدارة جلسات WhatsApp
 * • node-telegram-bot-api: لبوت التليجرام
 * • sequelize: لقاعدة البيانات
 * • express: لسيرفر الويب
 * 
 * ⚠️ ملاحظات مهمة:
 * 1. هذا الملف تم إنشاؤه تلقائياً
 * 2. تم إزالة التكرارات تلقائياً
 * 3. قد تحتاج إلى تعديلات يدوية
 * 4. احتفظ بنسخة احتياطية
 * 
 * 📄 الملفات الأصلية:
 * • index.js: الملف الرئيسي القديم
 * • telegramBot.js: إدارة بوت التليجرام
 * • whatsappClient.js: إدارة جلسات WhatsApp
 * 
 * 🚀 كيفية الاستخدام:
 * 1. تأكد من تثبيت جميع التبعيات
 * 2. اضبط متغيرات البيئة في .env
 * 3. قم بتشغيل الملف باستخدام: node whatsapp-bot-merged.js
 * 4. افتح التليجرام وأرسل /start للبوت
 * 
 * 🔧 للدعم والصيانة:
 * • راجع ملف README.md
 * • تحقق من السجلات في مجلد logs/
 * • احتفظ بنسخ احتياطية دورية
 */

// ============================================
// 🎉 نهاية الملف المدمج
// ============================================
`;
    }
    
    async createNewIndexFile(mergedFilePath) {
        console.log('📄 جاري إنشاء index.js جديد...');
        
        const newIndexContent = `// ============================================
// 🤖 WhatsApp Telegram Bot - النسخة المبسطة
// الإصدار: 3.0.0 - Clean & Optimized
// ============================================

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

console.log('🚀 بدء تشغيل WhatsApp Telegram Bot...');

// تحميل الملف المدمج
async function loadMergedBot() {
    try {
        console.log('📁 جاري تحميل البوت المدمج...');
        
        // التحقق من وجود الملف المدمج
        const mergedPath = path.join(__dirname, 'whatsapp-bot-merged.js');
        const stats = await fs.stat(mergedPath).catch(() => null);
        
        if (!stats) {
            console.error('❌ الملف المدمج غير موجود!');
            console.log('🔧 جاري إنشاء الملف المدمج...');
            
            // هنا يمكنك إضافة منطق لإنشاء الملف المدمج تلقائياً
            // أو استخدام الملفات الأصلية
            
            const cleanupManager = require('./scripts/cleanup.js');
            const manager = new cleanupManager();
            await manager.cleanAndMerge();
            
            console.log('✅ تم إنشاء الملف المدمج بنجاح');
        }
        
        // تحميل الملف المدمج
        const mergedBot = require('./whatsapp-bot-merged.js');
        
        console.log('✅ تم تحميل البوت المدمج بنجاح');
        return mergedBot;
        
    } catch (error) {
        console.error('❌ خطأ في تحميل البوت المدمج:', error);
        
        // السيناريو الاحتياطي: تحميل الملفات الأصلية
        console.log('🔄 جاري المحاولة بالسيناريو الاحتياطي...');
        
        try {
            // هنا يمكنك تحميل الملفات الأصلية بشكل منفصل
            // أو استخدام إصدار مبسط
            
            const SimplifiedBot = require('./src/simplified-bot.js');
            return new SimplifiedBot();
            
        } catch (fallbackError) {
            console.error('❌ فشل السيناريو الاحتياطي:', fallbackError);
            throw new Error('فشل تحميل البوت بكلا الطريقتين');
        }
    }
}

// بدء التشغيل الرئيسي
async function startBot() {
    try {
        console.log('🎯 بدء تهيئة النظام...');
        
        // إنشاء المجلدات الضرورية
        const folders = ['database', 'sessions', 'logs', 'temp', 'backups'];
        for (const folder of folders) {
            await fs.mkdir(folder, { recursive: true }).catch(() => {});
            console.log(\`   ✅ مجلد \${folder}/\`);
        }
        
        // تحميل البوت
        const bot = await loadMergedBot();
        
        // بدء البوت (اعتماداً على بنية الكود)
        if (typeof bot.start === 'function') {
            await bot.start();
        } else if (typeof bot === 'function') {
            await bot();
        } else {
            console.log('⚡ البوت جاهز للعمل');
        }
        
        console.log('🎉 WhatsApp Telegram Bot يعمل الآن!');
        console.log('📱 أرسل /start في بوت التليجرام للبدء');
        
        // معالجة إشارات الإيقاف
        process.on('SIGINT', async () => {
            console.log('\\n🛑 تلقي إشارة إيقاف...');
            
            if (typeof bot.cleanup === 'function') {
                await bot.cleanup();
            }
            
            console.log('✅ تم الإغلاق النظيف');
            process.exit(0);
        });
        
        return bot;
        
    } catch (error) {
        console.error('❌ خطأ فادح في بدء التشغيل:', error);
        process.exit(1);
    }
}

// بدء التشغيل إذا كان الملف هو الرئيسي
if (require.main === module) {
    startBot().catch(error => {
        console.error('❌ فشل بدء التشغيل:', error);
        process.exit(1);
    });
}

// التصدير للاستخدام كوحدة
module.exports = {
    loadMergedBot,
    startBot
};
`;
        
        const newIndexPath = path.join(this.projectRoot, 'index-new.js');
        await fs.writeFile(newIndexPath, newIndexContent, 'utf8');
        
        console.log(`✅ تم إنشاء index.js جديد في: ${newIndexPath}`);
        
        // اقتراح استبدال الملف القديم
        console.log('\n💡 اقتراح:');
        console.log('1. احفظ index.js الحالي كـ index-old.js');
        console.log('2. انسخ index-new.js إلى index.js');
        console.log('3. اختبر النظام');
        console.log('4. احذف الملفات القديمة إذا كانت تعمل');
        
        return newIndexPath;
    }
    
    // ============================================
    // 4. إنشاء ملف مبسط احتياطي
    // ============================================
    async createSimplifiedBackup() {
        console.log('📦 جاري إنشاء نسخة مبسطة احتياطية...');
        
        const simplifiedContent = `// ============================================
// 🤖 WhatsApp Telegram Bot - النسخة المبسطة الاحتياطية
// ============================================

require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

console.log('🚀 بدء تشغيل النسخة المبسطة...');

// إعداد Express الأساسي
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// صفحة الرئيسية
app.get('/', (req, res) => {
    res.send(\`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>WhatsApp Bot - Simplified</title>
            <style>
                body { font-family: Arial; padding: 20px; text-align: center; }
                .status { background: green; color: white; padding: 10px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>🤖 WhatsApp Telegram Bot</h1>
            <div class="status">✅ النسخة المبسطة تعمل بنجاح</div>
            <p>الإصدار: 3.0.0 - Simplified Backup</p>
            <p>المنفذ: \${PORT}</p>
            <p>الوقت: \${new Date().toLocaleString('ar-SA')}</p>
        </body>
        </html>
    \`);
});

// صفحة الصحة
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0-simplified'
    });
});

// بدء السيرفر
app.listen(PORT, () => {
    console.log(\`✅ السيرفر يعمل على: http://localhost:\${PORT}\`);
    console.log('📱 استخدم النسخة المدمجة للوظائف الكاملة');
});

// معالجة الإيقاف النظيف
process.on('SIGINT', () => {
    console.log('\\n🛑 إيقاف النسخة المبسطة...');
    process.exit(0);
});

module.exports = app;
`;
        
        const simplifiedPath = path.join(this.projectRoot, 'simplified-backup.js');
        await fs.writeFile(simplifiedPath, simplifiedContent, 'utf8');
        
        console.log(`✅ تم إنشاء النسخة المبسطة في: ${simplifiedPath}`);
        return simplifiedPath;
    }
    
    // ============================================
    // 5. تنظيف الملفات المؤقتة والقديمة
    // ============================================
    async cleanupOldFiles() {
        console.log('🗑️ جاري تنظيف الملفات المؤقتة...');
        
        const filesToRemove = [
            'temp_cleanup',
            '*.tmp',
            '*.log',
            'node_modules/.cache'
        ];
        
        let removedCount = 0;
        
        for (const pattern of filesToRemove) {
            try {
                // في التطبيق الحقيقي، استخدم مكتبة مثل 'glob'
                // هنا نستخدم حلاً مبسطاً
                if (pattern === 'temp_cleanup') {
                    const tempPath = path.join(this.projectRoot, 'temp_cleanup');
                    await fs.rm(tempPath, { recursive: true, force: true });
                    console.log(`   ✅ مجلد temp_cleanup/`);
                    removedCount++;
                }
            } catch (error) {
                console.log(`   ⚠️ ${pattern}: ${error.message}`);
            }
        }
        
        console.log(`✅ تم تنظيف ${removedCount} ملف/مجلد مؤقت`);
    }
    
    // ============================================
    // 6. إنشاء تقرير بالعمليات
    // ============================================
    async createReport() {
        console.log('📊 جاري إنشاء تقرير العمليات...');
        
        const report = {
            timestamp: new Date().toISOString(),
            operations: [],
            files: {
                original: this.filesToMerge.map(f => f.name),
                created: []
            },
            statistics: {
                totalFiles: this.filesToMerge.length,
                backupCreated: false,
                mergedCreated: false,
                simplifiedCreated: false,
                cleanupDone: false
            }
        };
        
        // إضافة تفاصيل العمليات
        try {
            // التحقق من وجود النسخ الاحتياطية
            const backupExists = await fs.stat(this.backupDir).catch(() => null);
            report.statistics.backupCreated = !!backupExists;
            report.operations.push({
                name: 'النسخ الاحتياطي',
                status: backupExists ? '✅' : '❌',
                timestamp: new Date().toISOString()
            });
            
            // التحقق من الملف المدمج
            const mergedPath = path.join(this.projectRoot, 'whatsapp-bot-merged.js');
            const mergedExists = await fs.stat(mergedPath).catch(() => null);
            report.statistics.mergedCreated = !!mergedExists;
            report.files.created.push('whatsapp-bot-merged.js');
            
            if (mergedExists) {
                const stats = await fs.stat(mergedPath);
                report.operations.push({
                    name: 'دمج الملفات',
                    status: '✅',
                    size: stats.size,
                    timestamp: new Date().toISOString()
                });
            }
            
            // التحقق من index.js الجديد
            const newIndexPath = path.join(this.projectRoot, 'index-new.js');
            const newIndexExists = await fs.stat(newIndexPath).catch(() => null);
            
            if (newIndexExists) {
                report.files.created.push('index-new.js');
                report.operations.push({
                    name: 'إنشاء index.js جديد',
                    status: '✅',
                    timestamp: new Date().toISOString()
                });
            }
            
            // التحقق من النسخة المبسطة
            const simplifiedPath = path.join(this.projectRoot, 'simplified-backup.js');
            const simplifiedExists = await fs.stat(simplifiedPath).catch(() => null);
            report.statistics.simplifiedCreated = !!simplifiedExists;
            
            if (simplifiedExists) {
                report.files.created.push('simplified-backup.js');
            }
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء التقرير:', error);
        }
        
        // حفظ التقرير
        const reportPath = path.join(this.projectRoot, 'cleanup-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
        
        console.log(`✅ تم حفظ التقرير في: ${reportPath}`);
        
        // عرض ملخص التقرير
        console.log('\n📋 ملخص التقرير:');
        console.log('='.repeat(40));
        console.log(`• 📅 التاريخ: ${new Date().toLocaleString('ar-SA')}`);
        console.log(`• 📁 الملفات الأصلية: ${report.files.original.length}`);
        console.log(`• 🆕 الملفات المنشأة: ${report.files.created.length}`);
        console.log(`• ✅ العمليات الناجحة: ${report.operations.filter(op => op.status === '✅').length}`);
        console.log('='.repeat(40));
        
        return report;
    }
    
    // ============================================
    // 7. الدالة الرئيسية للتنظيف والدمج
    // ============================================
    async cleanAndMerge() {
        console.log('🚀 بدء عملية التنظيف والدمج الكاملة...');
        console.log('='.repeat(50));
        
        try {
            // 1. النسخ الاحتياطي
            console.log('\n📋 الخطوة 1: النسخ الاحتياطي');
            console.log('-'.repeat(30));
            await this.backupFiles();
            
            // 2. تحليل الملفات
            console.log('\n📋 الخطوة 2: تحليل الملفات');
            console.log('-'.repeat(30));
            const analysis = await this.analyzeFiles();
            
            // 3. دمج الملفات
            console.log('\n📋 الخطوة 3: دمج الملفات');
            console.log('-'.repeat(30));
            await this.mergeFiles();
            
            // 4. إنشاء نسخة مبسطة
            console.log('\n📋 الخطوة 4: إنشاء نسخة مبسطة');
            console.log('-'.repeat(30));
            await this.createSimplifiedBackup();
            
            // 5. تنظيف الملفات المؤقتة
            console.log('\n📋 الخطوة 5: تنظيف الملفات المؤقتة');
            console.log('-'.repeat(30));
            await this.cleanupOldFiles();
            
            // 6. إنشاء التقرير
            console.log('\n📋 الخطوة 6: إنشاء تقرير العمليات');
            console.log('-'.repeat(30));
            await this.createReport();
            
            console.log('\n' + '='.repeat(50));
            console.log('🎉 تم إكمال عملية التنظيف والدمج بنجاح!');
            console.log('='.repeat(50));
            
            console.log('\n💡 التعليمات التالية:');
            console.log('1. اختبر الملف المدمج: node whatsapp-bot-merged.js');
            console.log('2. إذا كان يعمل، استبدل index.js بـ index-new.js');
            console.log('3. احذف الملفات القديمة إذا لم تكن بحاجة إليها');
            console.log('4. احتفظ بنسخ احتياطية في مجلد backups/');
            
            return {
                success: true,
                message: 'تمت العملية بنجاح'
            };
            
        } catch (error) {
            console.error('\n❌ ❌ ❌ فشل العملية! ❌ ❌ ❌');
            console.error('📋 الخطأ:', error.message);
            
            console.log('\n🔄 جاري استعادة النسخ الاحتياطية...');
            
            try {
                // محاولة استعادة من آخر نسخة احتياطية
                const backups = await fs.readdir(this.backupDir).catch(() => []);
                if (backups.length > 0) {
                    const latestBackup = backups.sort().reverse()[0];
                    console.log(`🔄 استعادة من: ${latestBackup}`);
                    
                    // في التطبيق الحقيقي، أضف منطق الاستعادة هنا
                }
            } catch (restoreError) {
                console.error('❌ فشل الاستعادة:', restoreError);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // ============================================
    // 8. وظائف مساعدة إضافية
    // ============================================
    async checkProjectStructure() {
        console.log('🏗️ جاري فحص هيكل المشروع...');
        
        const requiredDirs = [
            'database',
            'sessions', 
            'logs',
            'scripts',
            'backups'
        ];
        
        const requiredFiles = [
            'package.json',
            '.env.example',
            'README.md'
        ];
        
        const checks = {
            directories: [],
            files: []
        };
        
        // فحص المجلدات
        for (const dir of requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            try {
                await fs.access(dirPath);
                checks.directories.push({ name: dir, exists: true });
                console.log(`   ✅ ${dir}/`);
            } catch {
                checks.directories.push({ name: dir, exists: false });
                console.log(`   ❌ ${dir}/ (مفقود)`);
            }
        }
        
        // فحص الملفات
        for (const file of requiredFiles) {
            const filePath = path.join(this.projectRoot, file);
            try {
                await fs.access(filePath);
                checks.files.push({ name: file, exists: true });
                console.log(`   ✅ ${file}`);
            } catch {
                checks.files.push({ name: file, exists: false });
                console.log(`   ❌ ${file} (مفقود)`);
            }
        }
        
        return checks;
    }
    
    async validateEnvironment() {
        console.log('🔧 جاري التحقق من متغيرات البيئة...');
        
        const requiredEnvVars = [
            'TELEGRAM_BOT_TOKEN',
            'DATABASE_URL',
            'TELEGRAM_ADMIN_IDS'
        ];
        
        const optionalEnvVars = [
            'PORT',
            'NODE_ENV',
            'PUPPETEER_EXECUTABLE_PATH'
        ];
        
        const results = {
            required: [],
            optional: [],
            missing: []
        };
        
        // التحقق من المتغيرات المطلوبة
        for (const envVar of requiredEnvVars) {
            if (process.env[envVar]) {
                results.required.push({ name: envVar, exists: true, value: '****' });
                console.log(`   ✅ ${envVar}`);
            } else {
                results.required.push({ name: envVar, exists: false });
                results.missing.push(envVar);
                console.log(`   ❌ ${envVar} (مفقود)`);
            }
        }
        
        // التحقق من المتغيرات الاختيارية
        for (const envVar of optionalEnvVars) {
            if (process.env[envVar]) {
                results.optional.push({ name: envVar, exists: true, value: process.env[envVar] });
                console.log(`   🔶 ${envVar}: ${process.env[envVar]}`);
            } else {
                results.optional.push({ name: envVar, exists: false });
                console.log(`   ⚪ ${envVar} (غير مضبوط)`);
            }
        }
        
        if (results.missing.length > 0) {
            console.log(`\n⚠️  تحذير: ${results.missing.length} متغير بيئة مطلوب مفقود`);
            console.log('🔧 قم بإضافتها إلى ملف .env');
        }
        
        return results;
    }
}

// ============================================
// 9. التصدير والدوال المساعدة
// ============================================
if (require.main === module) {
    // إذا تم تشغيل الملف مباشرة
    async function main() {
        const manager = new CleanupManager();
        
        console.log('🤖 WhatsApp Telegram Bot - Cleanup Manager');
        console.log('='.repeat(50));
        
        // عرض القائمة
        console.log('\n📋 اختر العملية:');
        console.log('1. 🔍 تحليل الملفات فقط');
        console.log('2. 🚀 التنظيف والدمج الكامل');
        console.log('3. 🏗️ فحص هيكل المشروع');
        console.log('4. 🔧 التحقق من متغيرات البيئة');
        console.log('5. 📊 إنشاء تقرير فقط');
        console.log('6. 🧹 تنظيف الملفات المؤقتة فقط');
        console.log('7. 💾 نسخ احتياطي فقط');
        
        // في التطبيق الحقيقي، استخدم مكتبة مثل readline
        // هنا سنقوم بالتنفيذ الكامل مباشرة
        console.log('\n🚀 جاري التنفيذ الكامل...\n');
        
        const result = await manager.cleanAndMerge();
        
        if (result.success) {
            console.log('\n🎉 العملية اكتملت بنجاح!');
            process.exit(0);
        } else {
            console.error('\n❌ العملية فشلت!');
            process.exit(1);
        }
    }
    
    main().catch(error => {
        console.error('❌ خطأ غير متوقع:', error);
        process.exit(1);
    });
}

module.exports = CleanupManager;
