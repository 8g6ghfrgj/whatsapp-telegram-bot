// migrate.js - تحديث قاعدة البيانات تلقائياً
require('dotenv').config();
const { syncModels } = require('../database/models');

async function runMigrations() {
    console.log('🚀 بدء تحديث قاعدة البيانات...');
    
    try {
        const success = await syncModels();
        
        if (success) {
            console.log('✅ تم تحديث قاعدة البيانات بنجاح');
            process.exit(0);
        } else {
            console.log('❌ فشل تحديث قاعدة البيانات');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
        process.exit(1);
    }
}

runMigrations();
