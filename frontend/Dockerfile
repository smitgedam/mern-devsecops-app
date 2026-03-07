# ── Stage 1: Build the React app ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# This compiles React JSX → plain HTML/CSS/JS into the /app/dist folder.
# After this stage, we no longer need Node.js at all.
RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
# nginx:alpine is ~23MB. We're serving static files — no Node.js needed at runtime.
# This is the power of multi-stage: the final image has zero Node.js, zero npm,
# zero source code — just the compiled output and a web server.
FROM nginx:alpine AS runtime

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled React output from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config to handle React Router (single-page app)
# Without this, refreshing on /tasks would return a 404
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
