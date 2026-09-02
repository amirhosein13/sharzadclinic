# ───────────────────────────────────────────────────────────────
#  ایمیج پروداکشن — روی لیارا، آروان، هر VPS یا هر PaaS دیگری کار می‌کند
#  ساخت:  docker build -t sharzad-clinic .
#  اجرا:  docker run -p 3000:3000 --env-file .env sharzad-clinic
# ───────────────────────────────────────────────────────────────

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
# در زمان build فقط اسکیمای Prisma لازم است، نه اتصال واقعی به دیتابیس
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build_time_placeholder_secret_value_32chars"
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Tehran

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# اسکیما و مایگریشن‌ها برای اجرای `prisma migrate deploy` روی سرور
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# آپلودهای عمومی و عکس‌های پرونده‌ی مشتری. روی هاست، این دو مسیر را به یک
# دیسک ماندگار وصل کنید وگرنه با هر بار دیپلوی پاک می‌شوند.
RUN mkdir -p /app/public/uploads /app/storage/private \
  && chown -R nextjs:nodejs /app/public/uploads /app/storage
VOLUME ["/app/public/uploads", "/app/storage"]

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
