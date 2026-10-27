# ── Production Multi-Stage Dockerfile ────────────────────────
FROM node:20-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source files
COPY server.js config.js db.js db-supervisor.js ./
COPY auth/ ./auth/
COPY routes/ ./routes/
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY queries/ ./queries/
COPY data/ ./data/

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
