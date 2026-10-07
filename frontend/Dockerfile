# AcademicFlow Frontend Dockerfile
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source
COPY . ./

# Build Next.js application with ARG support
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/public ./public
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
