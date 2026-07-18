# =============================================
# Stage 1: Build the Svelte frontend
# =============================================
FROM --platform=linux/amd64 node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =============================================
# Stage 2: Build the TypeScript backend
# =============================================
FROM --platform=linux/amd64 node:22-alpine AS backend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

# Copy the frontend build output so it gets served by the backend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN npm run build

# =============================================
# Stage 3: Production runtime image
# =============================================
FROM --platform=linux/amd64 node:22-alpine AS runtime

WORKDIR /app

# Copy the compiled backend + node_modules (prod only)
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./

# Copy the frontend build
COPY --from=backend-builder /app/frontend/dist ./frontend/dist

# Copy public assets (test pages, etc.)
COPY public/ ./public/

ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/index.js"]