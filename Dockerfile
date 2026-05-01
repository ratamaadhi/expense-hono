FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create directory for migrations
RUN mkdir -p /app/src/db

# Copy migrations and schema
COPY src/db ./src/db
COPY drizzle.config.ts .

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Install drizzle-kit for migrations in production
RUN npm install -g drizzle-kit

# Start the application with migrations
CMD ["npm", "run", "deploy"]
