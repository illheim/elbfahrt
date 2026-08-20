# ============================================================
#  Strapi 5 backend — elb-fahrt.de
#  Multi-stage: deps → builder → runtime
#  Base: node:20-slim (Debian; node:20-alpine causes SWC build failures
#  on arm64 — see PLAN.md decisions log)
# ============================================================

# -----------------------------------------------------------
# Stage 1: deps — install all deps (build toolchain present)
# -----------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app

# Native build toolchain for sqlite3 / sharp / etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------
# Stage 2: builder — compile admin panel + TypeScript
# -----------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN npm run build

# -----------------------------------------------------------
# Stage 3: runtime — minimal image, runs `strapi start`
# -----------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy the entire built tree. Strapi 5 needs config/, src/, database/migrations,
# the compiled dist/, the admin build under build/, plus node_modules.
# Slimming this later is an M5 optimisation, not an M1 blocker.
COPY --from=builder /app /app

EXPOSE 1337
CMD ["npm", "run", "start"]
