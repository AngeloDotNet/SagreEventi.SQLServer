# Frontend image: static files of the Angular build served by an unprivileged nginx.
# Only the internal static server: HTTPS, the /api routing and the public entry point belong to the "proxy" container (deploy/nginx).
# Build context: src/SagreEventi.Web.Angular, e.g.
#   docker build -t sagreeventi-web src/SagreEventi.Web.Angular
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginxinc/nginx-unprivileged:stable-alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/sagre-eventi-web/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
