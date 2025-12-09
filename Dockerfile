# Use Python slim as base
FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install dependencies for Chromium + Chromedriver + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    gnupg \
    unzip \
    xvfb \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgtk-3-0 \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium
RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*

# Install chromedriver that matches chromium package
# On some distros chromedriver package exists; try apt-get chromedriver, otherwise install manually
RUN apt-get update && apt-get install -y chromium-driver || true && rm -rf /var/lib/apt/lists/*

# Create app dir
WORKDIR /app

# Copy requirements and code
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

# Make start script executable
RUN chmod +x /app/start.sh

# Environment variables recommended
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/lib/chromium/chromedriver

# Create session dir (persist via Render disk)
RUN mkdir -p /tmp/whatsapp_session
VOLUME ["/tmp/whatsapp_session"]

# Expose nothing (bot uses polling)
CMD ["/app/start.sh"]
