# Multi-stage Dockerfile for Media Cataloger Web UI & REST Server
FROM node:22-alpine AS builder

WORKDIR /app

# Ensure latest supported npm version
RUN npm install -g npm@12.2.1

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build React frontend & NestJS server
COPY . .
RUN npm run build
RUN npm run server:build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Install runtime dependencies for video thumbnail generation and EXIF metadata handling
RUN apk add --no-cache ffmpeg perl

# Ensure latest supported npm version
RUN npm install -g npm@12.2.1

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/public ./public
COPY --from=builder /app/assets ./assets

# Default volume mount points
RUN mkdir -p /app/data/config /app/media_input /app/media_output

EXPOSE 8000

CMD ["node", "dist-server/main.js"]
