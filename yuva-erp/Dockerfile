# AcademiaOS in one container: the app is built first, then the Flask server serves it together with /api.
# Used by Render (Runtime: Docker). The database (MongoDB Atlas) stays outside; its address comes in MONGODB_URI.

FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server_py/requirements.txt server_py/requirements.txt
RUN pip install --no-cache-dir -r server_py/requirements.txt
COPY server_py server_py
COPY --from=web /app/dist dist
ENV DIST_DIR=/app/dist TRUST_PROXY=1 PYTHONUNBUFFERED=1
CMD ["python", "server_py/run.py"]
