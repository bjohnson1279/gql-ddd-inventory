FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (will use package-lock.json if present)
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --silent

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose GraphQL default port
EXPOSE 4000

# Use the start script (uses ts-node in this project)
CMD ["npm", "start"]
