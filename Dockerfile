FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
# Kita tidak pakai --only=production agar drizzle-kit tetap bisa jalan jika ada di devDeps,
# ATAU pindahkan drizzle-kit ke 'dependencies' di package.json
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/db ./src/db

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Jalankan aplikasi langsung
# Rekomendasi: Lakukan 'push' secara manual atau lewat CI/CD,
# tapi jika ingin otomatis saat start, pastikan script 'deploy' benar.
CMD ["npm", "run", "deploy"]
