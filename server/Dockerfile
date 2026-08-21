# syntax=docker/dockerfile:1

# Passepartout server image (spec 024): the Fastify API, run with tsx. Two stages so the
# native better-sqlite3 build toolchain stays out of the runtime image.

FROM node:20-slim AS build
WORKDIR /app
# Build tools for any better-sqlite3 native compile (prebuilds usually cover glibc x64).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/tsconfig.json ./
COPY --from=build /app/src ./src
EXPOSE 3000
VOLUME ["/data"]
CMD ["npm", "start"]
