/**
 * ───────────────────────────────────────────────────────────────
 *  نقشه‌ی مهاجرت از برنامه‌ی قدیمی کلینیک (shahrzadclinicnappcontext)
 * ───────────────────────────────────────────────────────────────
 *
 *  این نقشه از روی دیتابیس واقعی نوشته شده، نه حدس. جدول‌های برنامه‌ی
 *  قدیمی و معنی‌شان:
 *
 *    moshtaries    مشتری‌ها          → Customer
 *    allref        شماره‌ی پرونده    → Customer.legacyFileNo
 *    hozes         «حوزه» = خدمت     → Service (با خدمات موجود تطبیق داده می‌شود)
 *    days          روزها             → فقط برای تاریخِ harbaroomade
 *    harbaroomades «هر بار آمده»     → TreatmentRecord + Payment
 *    rezervvaghts  رزرو وقت          → Appointment
 *    rizdaramads   ریز درآمد         → Payment (بدون مشتری، نادیده گرفته می‌شود)
 *    rizkhargs     ریز خرج           → Expense
 *    karmandans    کارمندان          → Staff
 *
 *  نکته‌های مهمی که در داده‌ی واقعی پیدا شد و در import-legacy.ts رعایت می‌شوند:
 *
 *   • allref.beref شماره‌ی پرونده‌ای است که منشی می‌بیند و allref.anotherid
 *     کلید واقعی مشتری. این نگاشت در برنامه‌ی قدیمی خراب بود: یک شماره برای
 *     دو نفر، و یک نفر با چند شماره. پس شماره فقط برای جستجو نگه داشته
 *     می‌شود و کلیدِ هویت نیست.
 *
 *   • rezervvaght.beky اسم متخصص نیست؛ کپی نام کوچک مشتری است. استفاده نمی‌شود.
 *
 *   • rezervvaght.idmoshtary در یک‌سومِ رکوردها صفر است، چون برنامه‌ی قدیمی
 *     مشتری را با نامِ تقریبی پیدا می‌کرد. با نام نرمال‌شده دوباره وصل می‌شود.
 *
 *   • rezervvaght.dayid همیشه خالی است. تاریخ فقط در khodevaght است.
 */

/** نام جدول‌های برنامه‌ی قدیمی */
export const TABLES = {
  customers: "moshtaries",
  fileNumbers: "allref",
  services: "hozes",
  days: "days",
  visits: "harbaroomades",
  reservations: "rezervvaghts",
  income: "rizdaramads",
  expenses: "rizkhargs",
  staff: "karmandans",
} as const;

/**
 * خدمات برنامه‌ی قدیمی → نامک خدمت در سایت جدید.
 *
 * برنامه‌ی قدیمی فقط دو «حوزه» داشت. اگر نامی اینجا نباشد، خدمت تازه‌ای
 * در دسته‌ی «عمومی» ساخته می‌شود تا هیچ سابقه‌ای گم نشود.
 */
export const SERVICE_SLUG_BY_NAME: Record<string, string> = {
  "لیزر": "laser",
  "بوتاکس": "botox",
};

/**
 * وضعیت نوبت‌های منتقل‌شده.
 *
 * برنامه‌ی قدیمی وضعیت نداشت — نوبت لغوشده را پاک می‌کرد. پس هر نوبتی که
 * مانده، یعنی برگزار شده. DONE هم امن‌ترین انتخاب است: NO_SHOW باعث می‌شد
 * گزارش «مشتری‌های بدقول» با داده‌ی قدیمیِ نامطمئن پر شود.
 */
export const IMPORTED_APPOINTMENT_STATUS = "DONE" as const;

/** طول پیش‌فرض نوبت‌های قدیمی، وقتی خدمت طول مشخصی ندارد */
export const DEFAULT_DURATION_MINUTES = 30;
