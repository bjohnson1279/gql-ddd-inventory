FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (will use package-lock.json if present)
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --silent

# Copy source
COPY . .

# Expose GraphQL default port
EXPOSE 4000

# Use the start script (uses ts-node in this project)
CMD ["pnpm", "start"]
