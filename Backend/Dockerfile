# The API + live updates (Express + Socket.IO), run straight from TypeScript
# with tsx — the same way `npm start` runs it on Render.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["npx", "tsx", "server.ts"]
