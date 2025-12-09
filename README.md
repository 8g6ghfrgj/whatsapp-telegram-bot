# WhatsApp Telegram Bot (Selenium + WhatsApp Web)

This project runs a Telegram bot that controls WhatsApp Web via Selenium (Chromium).
Deploy-ready for Render using Docker.

## Setup
1. Add repository to GitHub.
2. On Render create a new **Web Service** with Docker (connect to GitHub repo).
3. Set Environment Variables:
   - BOT_TOKEN = your telegram bot token
   - (optional) WHATSAPP_SESSION_DIR = /tmp/whatsapp_session
4. Deploy.

## Notes
- Uses WhatsApp Web via Selenium. Use with caution (may lead to account restrictions).
- Ensure your Render plan allows Chromium (enough memory).
