# Stage 1: Builder Engine
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vercel.json ./
COPY src ./src
COPY api ./api
COPY public ./public
RUN npm run build

# Stage 2: Lean Production Runtime Container
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/vercel.json ./vercel.json

EXPOSE 3000
CMD ["npm", "start"]
