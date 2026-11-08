# Build from the repository root: docker build -f apps/no-group-web/server/Dockerfile .
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/no-group-web/package.json apps/no-group-web/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY apps/no-group-web/server apps/no-group-web/server
COPY apps/no-group-web/platform apps/no-group-web/platform
COPY apps/no-group-web/src/lib/search-results.ts apps/no-group-web/src/lib/search-results.ts
COPY apps/no-group-web/src/lib/search-options.ts apps/no-group-web/src/lib/search-options.ts
COPY apps/no-group-web/src/lib/insights.ts apps/no-group-web/src/lib/insights.ts
COPY apps/no-group-web/migrations apps/no-group-web/migrations
WORKDIR /app/apps/no-group-web
RUN mkdir -p .data && chown -R node:node .data
USER node
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8788/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","--import","tsx","server/index.ts"]
