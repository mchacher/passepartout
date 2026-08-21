# syntax=docker/dockerfile:1

# Passepartout self-hosting image (spec 022, step A): build the static SPA, then serve it
# with nginx. Step B will add a backend build stage + service alongside this one.

# Stage 1 - build the static app.
FROM node:20-alpine AS build
WORKDIR /app
# Install deps against the committed lockfile first, so this layer caches across source edits.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 - serve the built app.
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# The nginx:alpine base already runs nginx in the foreground as its default command.
