# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
# We use node:18-alpine because Alpine Linux is ~5MB vs ~900MB for full Ubuntu.
# Smaller base = fewer packages = fewer vulnerabilities for Trivy to find.
FROM node:18-alpine AS deps

WORKDIR /app

# Copy dependency manifests first. Docker caches layers — if package.json
# hasn't changed, this expensive npm install step is skipped on rebuilds.
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:18-alpine AS runtime

# Create a non-root user — running as root inside containers is a security risk
# that both OWASP and Trivy will flag. This is a DevSecOps best practice.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only the production node_modules from Stage 1 (not dev tools)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Switch to non-root user before starting the app
USER appuser

EXPOSE 5000

# Use node directly (not npm start) — avoids spawning a child process,
# making signals (like SIGTERM from Kubernetes) reach the app directly
CMD ["node", "server.js"]
