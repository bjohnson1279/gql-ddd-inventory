# Stage 1: Build React/Vite assets
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 2: Serve assets using Nginx
FROM nginx:alpine

# Copy built dist files
COPY --from=build /app/dist /usr/share/nginx/html

# Custom Nginx config to support React SPA routing fallback if needed
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
