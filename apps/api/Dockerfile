# syntax=docker/dockerfile:1
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @mathitis/api exec prisma generate \
    && pnpm --filter @mathitis/api build

FROM base AS runner
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nodejs
COPY --from=build --chown=nodejs:nodejs /app/node_modules /app/node_modules
COPY --from=build --chown=nodejs:nodejs /app/packages/schemas /app/packages/schemas
COPY --from=build --chown=nodejs:nodejs /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist /app/apps/api/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json /app/apps/api/package.json
USER nodejs
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "pnpm db:deploy && node dist/main.js"]