# 1. Build stage
FROM node:22 AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

COPY . .

# Build the static SPA to /app/dist
RUN npm run build

# 2. Static serve stage — no Node at runtime, just nginx serving static files.
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
