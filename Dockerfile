# 1. Build stage
FROM node:22 AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with exact versions and clean cache to reduce size
RUN npm ci && npm cache clean --force

COPY . .

# Set environment variable for Next.js to build in production mode
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run build
RUN npm run build

# 2. Runner stage
FROM node:22-slim AS runner

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Requires output: standalone in next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]