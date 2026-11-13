# ------------------------------------------------------------------------------
# Production Multi-Stage Dockerfile for All-in-One Accounting ERP Backend
# ------------------------------------------------------------------------------

# 1. Builder Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine binary compatibility
RUN apk add --no-cache openssl

# Install dependencies based on lockfile
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy TypeScript source code and build config
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client binary
RUN npx prisma generate

# Compile TypeScript to dist/
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# ------------------------------------------------------------------------------
# 2. Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install runtime OpenSSL library for Prisma
RUN apk add --no-cache openssl curl

# Create non-root system user and group
RUN addgroup --system --gid 1001 erpgroup && \
    adduser --system --uid 1001 erpuser

# Copy runtime node_modules, generated Prisma client, and compiled JavaScript
COPY --from=builder --chown=erpuser:erpgroup /app/node_modules ./node_modules
COPY --from=builder --chown=erpuser:erpgroup /app/dist ./dist
COPY --from=builder --chown=erpuser:erpgroup /app/prisma ./prisma
COPY --from=builder --chown=erpuser:erpgroup /app/package.json ./package.json

USER erpuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
