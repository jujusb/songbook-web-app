FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM alpine:3.24 AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
ENV PUPPETEER_CACHE_DIR=/tmp/puppeteer-cache
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/lib/chromium/chromium-headless-shell
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache \
    nodejs-current \
    chromium-headless-shell \
    font-noto \
    font-noto-cjk \
    font-noto-emoji \
    util-linux \
    ca-certificates && \
    rm -f /usr/lib/libLLVM.so.* /usr/lib/libgallium-26*.so

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /tmp/puppeteer-cache && chown nextjs:nodejs /tmp/puppeteer-cache

WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Content directory will be mounted as a volume
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
EXPOSE 3000
CMD ["node", "server.js"]
