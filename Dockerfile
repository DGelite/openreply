# ==============================================================================
# OPENREPLY SAAS - PRODUCTION CONTAINER (Node.js 20 Alpine)
# Multi-stage build supporting both Web Application and Dedicated Worker
# ==============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install native build tools & OpenSSL required by Prisma engine
RUN apk add --no-cache libc6-compat openssl

# Install exact dependencies from package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Application Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for MySQL/MariaDB
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
RUN npx prisma generate

# Build Next.js with optimized production bundle
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime Runner (Web & Worker)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies: OpenSSL, curl (healthchecks), tini (PID 1 signals)
RUN apk add --no-cache openssl curl bash tzdata tini

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user and group for security hardening
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime assets and built bundles for both Web and Worker services
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/types ./types

# Ensure proper permissions for non-root execution
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Web healthcheck against cached /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/health?probe=liveness || exit 1

# Tini handles PID 1 zombie reaping and proper SIGTERM/SIGINT signal forwarding
ENTRYPOINT ["/sbin/tini", "--"]

# Default command starts Next.js web server. Standalone worker overrides command.
CMD ["npm", "run", "start"]
