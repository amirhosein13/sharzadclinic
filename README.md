# کلینیک زیبایی شهرزاد

سایت کامل کلینیک زیبایی با رزرو نوبت آنلاین، پنل مدیریت و مسیر مهاجرت داده از اپلیکیشن قدیمی.

---

## راه‌اندازی روی لپ‌تاپ (۳ دقیقه)

پیش‌نیاز: **Node.js 22** و **Docker**

```bash
node -v   # باید v22 باشد
```

اگر نسخه‌ات قدیمی‌تر است، بخش [ارتقای Node](#ارتقای-node) را ببین.
فایل `.nvmrc` در مخزن هست، پس با nvm فقط کافی است `nvm use` بزنی.

```bash
npm install          # نصب پکیج‌ها
cp .env.example .env # ساخت فایل تنظیمات
npm run setup        # بالا آوردن دیتابیس + مایگریشن + داده‌ی اولیه
npm run dev          # اجرا
```

سایت: <http://localhost:3000> — پنل مدیریت: <http://localhost:3000/admin>

```
ایمیل: admin@sharzadclinic.ir
رمز:   Admin@12345
```

> **بدون داکر؟** اگر PostgreSQL روی سیستمت نصب است، فقط `DATABASE_URL` را در `.env`
> به دیتابیس خودت تغییر بده و به‌جای `npm run setup` این‌ها را بزن:
> `npx prisma migrate deploy && npm run db:seed`

---

## اگر به مشکل خوردی

### ارتقای Node

Tailwind 4 حداقل Node 20 می‌خواهد و درایور SQL Server (برای مهاجرت دیتای اپ قبلی)
Node 22. پس روی **Node 22** برو.

```bash
# نصب nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
exec $SHELL          # ترمینال را دوباره بخوان

nvm install 22
nvm alias default 22 # از این به بعد پیش‌فرض
node -v              # باید v22.x باشد
```

بعد از ارتقا، حتماً یک نصب تمیز بزن (باینری‌های نیتیو برای نسخه‌ی Node قبلی ساخته شده‌اند):

```bash
rm -rf node_modules
npm ci
```

> داخل پوشه‌ی پروژه `nvm use` هم کافی است — نسخه از `.nvmrc` خوانده می‌شود.

### `Cannot find native binding` هنگام `npm run dev`

باگ شناخته‌شده‌ی npm در نصب وابستگی‌های اختیاری است
([npm/cli#4828](https://github.com/npm/cli/issues/4828)) — ربطی به کد ندارد.
Tailwind 4 یک باینری نیتیو دارد که npm گاهی نصبش نمی‌کند.

```bash
# مک / لینوکس
rm -rf node_modules
npm ci
```

```powershell
# ویندوز (PowerShell)
Remove-Item -Recurse -Force node_modules
npm ci
```

`npm ci` را ترجیح بده به `npm install`؛ لاک‌فایل باینری همه‌ی پلتفرم‌ها را دارد
و نصب تمیز نسخه‌ی درست را برمی‌دارد. اگر باز هم نشد:

```bash
rm -rf node_modules package-lock.json && npm install
```

> **اول از همه `node -v` را چک کن.** روی Node 18 یا پایین‌تر، Tailwind 4 اصلاً
> اجرا نمی‌شود و دقیقاً همین خطا را می‌دهد — بخش [ارتقای Node](#ارتقای-node).

### `npm run setup` گیر می‌کند یا خطای اتصال به دیتابیس می‌دهد

یعنی Docker بالا نیست. Docker Desktop را اجرا کن و دوباره امتحان کن.
اگر داکر نداری ولی PostgreSQL روی سیستمت نصب است، `DATABASE_URL` را در `.env`
به دیتابیس خودت تغییر بده و به‌جای `setup` این‌ها را بزن:

```bash
npx prisma migrate deploy && npm run db:seed
```

### پورت ۳۰۰۰ اشغال است

```bash
npm run dev -- -p 3001
```

---

## امکانات

### بخش عمومی

| صفحه | مسیر | توضیح |
|---|---|---|
| خانه | `/` | هیرو، آمار، دسته‌بندی‌ها، خدمات منتخب، قبل/بعد، نظرات، مجله، سوالات متداول |
| خدمات | `/services` | فیلتر بر اساس دسته‌بندی، قیمت و مدت هر خدمت |
| جزئیات خدمت | `/services/[slug]` | توضیح کامل، مراقبت‌های قبل و بعد، سوالات متداول، متخصصان |
| **رزرو نوبت** | `/booking` | ویزارد ۴ مرحله‌ای با تقویم شمسی و ساعت‌های خالیِ واقعی |
| پیگیری نوبت | `/track` | با کد پیگیری + شماره موبایل |
| نمونه کارها | `/gallery` | اسلایدر تعاملی قبل/بعد |
| درباره‌ی ما | `/about` | داستان کلینیک، ارزش‌ها، معرفی تیم |
| مجله | `/blog` | مقالات با دسته‌بندی |
| تماس با ما | `/contact` | فرم تماس + نقشه |

سایر: حالت شب، ریسپانسیو کامل، RTL، اعداد فارسی، تاریخ شمسی، `sitemap.xml`،
`robots.txt`، داده‌ی ساختاریافته‌ی JSON-LD (MedicalBusiness / Service / Article / FAQPage)،
صفحه‌ی ۴۰۴ اختصاصی.

### پنل مدیریت (`/admin`)

- **داشبورد** — نوبت‌های امروز، در انتظار تأیید، تعداد مشتریان، درآمد ۳۰ روز، نمودار ۱۴ روزه
- **نوبت‌ها** — جستجو، فیلتر (امروز / پیش‌رو / وضعیت)، تغییر وضعیت، حذف، صفحه‌بندی
- **مشتریان** — جستجو، پرونده‌ی کامل هر مشتری (نوبت‌ها، سوابق درمان، پرداخت‌ها)، یادداشت، محدودسازی
- **خدمات** — ویرایش قیمت و مدت، فعال/غیرفعال، افزودن به منتخب
- **پرسنل** — برنامه‌ی هفتگی، خدمات هر نفر، فعال/غیرفعال
- **گالری / مجله / نظرات / پیام‌ها** — انتشار، پنهان‌سازی، حذف
- **تنظیمات** — اطلاعات تماس، شبکه‌های اجتماعی، ساعات کاری، قوانین رزرو

---

## مهاجرت داده از اپلیکیشن قدیمی (SQL Server)

داده‌های اپ قبلی (مشتریان، نوبت‌ها، سوابق درمان، پرداخت‌ها) با یک اسکریپت اختصاصی منتقل می‌شوند.

### گام ۱ — اتصال

مقادیر `LEGACY_MSSQL_*` را در `.env` پر کن:

```env
LEGACY_MSSQL_SERVER="192.168.1.10"
LEGACY_MSSQL_DATABASE="ClinicOld"
LEGACY_MSSQL_USER="sa"
LEGACY_MSSQL_PASSWORD="..."
```

### گام ۲ — دیدن ساختار دیتابیس قدیمی

```bash
npm run import:legacy -- --inspect
```

همه‌ی جدول‌ها، ستون‌ها و تعداد رکوردها چاپ می‌شود.

### گام ۳ — تنظیم نگاشت

بر اساس خروجی بالا، فایل **`scripts/legacy-mapping.ts`** را ویرایش کن.
تنها فایلی است که باید دست بزنی؛ نام جدول‌ها و ستون‌ها آن‌جاست.
تبدیل مقادیر (جنسیت، وضعیت نوبت، روش پرداخت) هم در همان فایل قابل تنظیم است.

> اگر مبالغ در اپ قدیمی به **ریال** ذخیره شده‌اند، `AMOUNT_DIVISOR` را روی `10` بگذار.

### گام ۴ — تست بدون نوشتن

```bash
npm run import:legacy -- --dry-run
```

### گام ۵ — اجرای واقعی

```bash
npm run import:legacy
```

```bash
# فقط بخش‌های مشخص
npm run import:legacy -- --only=customers,payments
```

**نکات مهم**

- مهاجرت **idempotent** است: هر رکورد با `legacyId` یکتا ثبت می‌شود، پس اجرای
  چندباره رکورد تکراری نمی‌سازد و فقط به‌روزرسانی می‌کند.
- مشتری‌هایی که شماره‌ی موبایل نامعتبر یا تکراری دارند با شناسه‌ی `LEGACY-<id>`
  ثبت می‌شوند تا هیچ رکوردی از دست نرود؛ بعداً در پنل قابل اصلاح‌اند.
- خدمات منتقل‌شده در دسته‌ی «منتقل‌شده از اپ قبلی» و **غیرفعال** می‌نشینند
  تا با محتوای سایت قاطی نشوند. خودت بررسی و فعالشان کن.
- ترتیب اجرا خودکار رعایت می‌شود: خدمات → مشتریان → نوبت‌ها → سوابق → پرداخت‌ها.

---

## انتشار (Publish)

پروژه به هیچ سرویسی قفل نیست. `DATABASE_URL` و `AUTH_SECRET` تنها چیزی است که هر جا لازم داری.

> `AUTH_SECRET` را حتماً عوض کن: `openssl rand -base64 32`

### لیارا / ابرآروان / هر PaaS ایرانی

```bash
# یک دیتابیس PostgreSQL از پنل سرویس بساز و connection string را بگیر
liara deploy   # فایل liara.json از قبل آماده است
```

متغیرهای محیطی روی پنل سرویس: `DATABASE_URL`، `AUTH_SECRET`، `NEXT_PUBLIC_SITE_URL`.
بعد از اولین دیپلوی یک بار `npx prisma migrate deploy` را روی سرور اجرا کن.

### VPS با داکر

```bash
docker build -t sharzad-clinic .
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped sharzad-clinic
```

### Vercel

ریپو را وصل کن و یک PostgreSQL خارجی (Neon / Supabase) بده.
⚠️ Vercel روی IP ایران بلاک است؛ برای مخاطب ایرانی گزینه‌ی خوبی نیست.

---

## دستورات

| دستور | کار |
|---|---|
| `npm run dev` | اجرای حالت توسعه |
| `npm run build` | بیلد پروداکشن |
| `npm start` | اجرای بیلد |
| `npm run setup` | راه‌اندازی کامل دیتابیس از صفر |
| `npm run db:studio` | ویرایشگر گرافیکی دیتابیس (Prisma Studio) |
| `npm run db:seed` | پرکردن داده‌ی نمونه |
| `npm run db:migrate` | ساخت مایگریشن جدید بعد از تغییر اسکیما |
| `npm run test:smoke` | تست خودکار مسیر رزرو نوبت |
| `npm run lint` / `npm run typecheck` | بررسی کیفیت کد |
| `npm run import:legacy` | مهاجرت از SQL Server |

---

## جایگزینی عکس‌ها

همه‌ی تصاویر فعلی **placeholder** هستند (فایل SVG با گرادیان). برای عکس واقعی کافی است
فایل را با همان نام در `public/images/` جایگزین کنی (پسوند را هم می‌توانی به `.jpg` تغییر
دهی؛ فقط مسیر را در پنل یا `prisma/seed-data.ts` به‌روز کن):

```
public/images/
├── hero.svg              عکس اصلی صفحه‌ی خانه
├── about.svg, clinic-1.svg, clinic-2.svg
├── services/<slug>.svg   عکس هر خدمت
├── staff/<slug>.svg      عکس پرسنل
├── gallery/before-N.svg, after-N.svg
└── blog/<slug>.svg
```

برای ساخت دوباره‌ی placeholderها: `node scripts/generate-placeholders.mjs`

---

## ساختار پروژه

```
prisma/
  schema.prisma        اسکیمای دیتابیس
  seed.ts, seed-data.ts   داده‌ی اولیه و محتوای سایت
scripts/
  import-legacy.ts     مهاجرت از SQL Server
  legacy-mapping.ts    ← تنها فایلی که برای مهاجرت ویرایش می‌کنی
  smoke-test.ts        تست خودکار رزرو
src/
  app/(site)/          صفحات عمومی
  app/admin/           پنل مدیریت
  app/actions/         Server Actionها
  app/api/slots/       API ساعت‌های خالی
  components/          کامپوننت‌های UI
  lib/
    availability.ts    موتور محاسبه‌ی نوبت‌های خالی
    auth.ts            احراز هویت (JWT در کوکی httpOnly)
    date.ts            تاریخ و تقویم شمسی
    settings.ts        تنظیمات سایت
    validators.ts      اعتبارسنجی فرم‌ها (Zod)
```

---

## نکات فنی

- **تکنولوژی:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma · PostgreSQL
- **منطقه‌ی زمانی:** سرور روی `Asia/Tehran` قفل شده تا محاسبات نوبت قطعی باشد.
- **رزرو هم‌زمان:** پیش از ثبت نهایی، اسلات دوباره سمت سرور اعتبارسنجی می‌شود؛
  اگر بین انتخاب و ثبت کسی همان ساعت را گرفته باشد، خطای مشخص برمی‌گردد.
- **احراز هویت:** JWT امضاشده در کوکی `httpOnly` + محافظت مسیرها در middleware.
- **فونت:** Vazirmatn به‌صورت لوکال (بدون CDN خارجی) — سایت آفلاین هم درست نمایش داده می‌شود.
