FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (will use package-lock.json if present)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --silent

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose GraphQL default port
EXPOSE 4000

# Push database schema if needed and start app
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
