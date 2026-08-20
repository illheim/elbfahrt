# ============================================================
#  Next.js 15 frontend — elb-fahrt.de
#  Multi-stage: deps → builder → runtime
#  Base: node:20-slim (Debian) — Alpine + SWC arm64 is unreliable
# ============================================================

# -----------------------------------------------------------
# Stage 1: deps
# -----------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------
# Stage 2: builder
# -----------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so the API URL
# must be a build ARG — setting it only in compose `environment` has no effect
# on the browser bundle. Passed from docker-compose.yml build.args.
ARG NEXT_PUBLIC_STRAPI_URL
ENV NEXT_PUBLIC_STRAPI_URL=$NEXT_PUBLIC_STRAPI_URL
RUN npm run build

# -----------------------------------------------------------
# Stage 3: runtime — `next start`
# -----------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# We're not using next.js standalone output to keep the scaffold unmodified.
# Bigger image (~600 MB vs ~150 MB) but no source changes needed.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "run", "start"]
