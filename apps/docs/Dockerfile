# Build context is the repo root: the docs take their tokens, fonts and favicons from apps/web.
FROM node:24-alpine AS build
WORKDIR /repo/apps/docs
COPY apps/docs/package.json apps/docs/package-lock.json ./
RUN npm ci
COPY apps/web/src/styles/tokens.css /repo/apps/web/src/styles/tokens.css
COPY apps/web/public /repo/apps/web/public
COPY apps/docs ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/docs/.output/public /usr/share/nginx/html
EXPOSE 8080
