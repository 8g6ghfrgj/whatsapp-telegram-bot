// تنظيف الجلسات المنتهية
require('dotenv').config();
const { WhatsAppSession } = require('../database/models');

async function cleanupSessions() {
    console.log('🧹 بدء تنظيف الجلسات...');
    
    try {
        // حذف الجلسات الأقدم من 24 ساعة
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const deleted = await WhatsAppSession.destroy({
            where: {
                status: 'disconnected',
                updatedAt: { [Op.lt]: cutoff }
            }
        });
        
        console.log(`✅ تم تنظيف ${deleted} جلسة`);
        process.exit(0);
    } catch (error) {
        console.error('❌ خطأ في التنظيف:', error);
        process.exit(1);
    }
}

cleanupSessions();
