FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for TypeScript)
RUN npm config set fetch-retry-maxtimeout 600000 \
  && npm config set fetch-timeout 600000 \
  && npm config set registry https://registry.npmjs.org/ \
  && npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application in development mode
CMD ["npm", "run", "dev"]