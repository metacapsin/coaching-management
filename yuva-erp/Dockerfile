# AcademiaOS in one container: the app is built first, then the Node server serves it together with /api.
# Used by Render (Runtime: Docker). The database (MongoDB Atlas) stays outside; its address comes in MONGODB_URI.

FROM node:24-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM node:24-slim
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/src src
COPY --from=web /app/frontend/dist /app/frontend/dist
ENV DIST_DIR=/app/frontend/dist TRUST_PROXY=1
CMD ["node", "src/index.ts"]
