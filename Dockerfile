# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
# Includes the PWA worker generated from the same production build.
RUN npm run build
RUN ./node_modules/.bin/tsc --project tsconfig.docker-tools.json --outDir /tmp/docker-tools

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    CONFIG_ROOT=/config \
    MEDIA_ROOT=/app/media
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /tmp/docker-tools ./tools
COPY --from=builder --chown=node:node /app/migrations ./migrations
COPY --from=builder --chown=node:node /app/deploy/entrypoint.mjs ./deploy/entrypoint.mjs
# These CLI tools use pg from Next.js's traced production dependencies.
RUN node -e "require('./tools/src/lib/server/catalog.js'); require('./tools/src/lib/server/migrations.js'); require('sharp')"
USER node
EXPOSE 3000
ENTRYPOINT ["node", "deploy/entrypoint.mjs"]
CMD ["serve"]
