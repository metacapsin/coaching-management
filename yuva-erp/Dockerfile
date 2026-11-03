# AcademiaOS in one container: the app is built first, then the Node server serves it together with /api.
# Used by Render (Runtime: Docker). The database (MongoDB Atlas) stays outside; its address comes in MONGODB_URI.

FROM node:24-slim AS web
WORKDIR /app
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server_node/src server_node/src
COPY --from=web /app/dist dist
ENV DIST_DIR=/app/dist TRUST_PROXY=1
CMD ["node", "server_node/src/index.ts"]
