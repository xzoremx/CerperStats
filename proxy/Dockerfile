FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      python3-venv \
      python3-pip \
      libfreetype6 \
      libpng16-16 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps (prod only). We ignore scripts to avoid running Electron postinstall hooks.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Install Python deps into a venv that matches proxy/lib/runEvaluator.js expectations.
COPY proxy/requirements.txt proxy/requirements.txt
RUN python3 -m venv .env \
    && ./.env/bin/pip install --upgrade pip \
    && ./.env/bin/pip install -r proxy/requirements.txt

COPY proxy ./proxy
COPY modules ./modules

EXPOSE 4000

CMD ["node", "proxy/server.js"]
