# ---- Stage 1: Build frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy package files and install
COPY frontend/package.json frontend/yarn.lock* ./

# Remove emergent devDependency before install
RUN sed -i '/@emergentbase\/visual-edits/d' package.json || true
RUN yarn install --frozen-lockfile 2>/dev/null || yarn install

# Copy frontend source
COPY frontend/ ./

# Build with backend URL pointing to same origin (relative /api)
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# ---- Stage 2: Python backend ----
FROM python:3.11-slim
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy frontend build into backend's static dir
COPY --from=frontend-build /app/frontend/build ./backend/static

# Expose port
ENV PORT=8000
EXPOSE 8000

# Start
CMD ["sh", "-c", "uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
