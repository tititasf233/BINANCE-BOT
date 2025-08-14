FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm config set fetch-retry-maxtimeout 600000 \
  && npm config set fetch-timeout 600000 \
  && npm config set registry https://registry.npmjs.org/ \
  && npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]