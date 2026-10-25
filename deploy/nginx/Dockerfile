# Dedicated reverse-proxy image: public entry point (HTTPS), routes "/" to the web container and "/api/" to the API.
# Build context: deploy/nginx. The template is rendered at start by the image's envsubst (variables: SERVER_NAME).
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY default.conf.template /etc/nginx/templates/default.conf.template
# Only SERVER_NAME is substituted: the nginx variables ($host, $remote_addr, ...) are left alone
ENV NGINX_ENVSUBST_FILTER=SERVER_NAME
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/healthz-proxy || exit 1
