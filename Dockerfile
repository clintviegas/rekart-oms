FROM node:20-slim

# Install build deps for better-sqlite3 (native addon)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY rekart_oms_design_2.html ./
COPY src/ ./src/

# Data dir is mounted as a Fly volume at runtime
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "server.js"]
