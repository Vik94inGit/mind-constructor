# 1. Build the app.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The site's public address — live updates (Socket.IO) connect to it.
ARG PUBLIC_URL
# Optional: "Sign in with Google" (the same client id as the backend's GOOGLE_CLIENT_ID).
ARG GOOGLE_CLIENT_ID=""
ENV VITE_SOCKET_URL=$PUBLIC_URL VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
RUN npm run build

# 2. Serve it on port 3000 — the app's files, plus /api and live updates
# passed on to the backend, so everything is one address (one domain: the
# sign-in cookie is first-party everywhere, Safari included).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
