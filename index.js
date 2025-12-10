// في بداية الملف بعد استدعاء المكتبات
const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;

// === الحل: استخدم Webhook في الإنتاج ===
if (process.env.NODE_ENV === 'production') {
    // تكوين Webhook
    const WEBHOOK_DOMAIN = process.env.RENDER_EXTERNAL_URL || `https://whatsapp-bot-exj1.onrender.com`;
    
    app.use(express.json());
    
    // ضبط Webhook
    app.use(async (req, res, next) => {
        await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}/bot${process.env.BOT_TOKEN}`);
        next();
    });
    
    // معالجة Webhook
    app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
        bot.handleUpdate(req.body, res);
    });
    
    // بدء الخادم بدون bot.launch()
    app.listen(PORT, () => {
        console.log(`🚀 Server running with Webhook on port ${PORT}`);
    });
    
} else {
    // التطوير المحلي: استخدم Polling
    bot.launch();
    app.listen(PORT, () => {
        console.log(`🚀 Server running with Polling on port ${PORT}`);
    });
}
