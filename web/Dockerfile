FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS worker
ENV NODE_ENV=production
COPY src/lib ./src/lib
COPY src/config/prequalification.json ./src/config/prequalification.json
COPY scripts ./scripts
COPY db ./db
USER node
CMD ["node", "scripts/worker.mjs"]

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
