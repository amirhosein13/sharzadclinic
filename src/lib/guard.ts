import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./auth";
import { can, type Permission } from "./permissions";

/**
 * محافظ صفحات پنل. اگر کاربر وارد نشده باشد به صفحه‌ی ورود
 * و اگر دسترسی نداشته باشد به صفحه‌ی خانه‌ی مناسب نقشش می‌رود.
 */
export async function guardPage(permission: Permission): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/admin/login");
  if (!can(user.role, permission)) redirect(homeFor(user));
  return user;
}

/**
 * صفحه‌ی خانه‌ی هر نقش پس از ورود.
 *
 * منشی و اپراتور روی «کارهای امروز» می‌افتند، نه داشبورد: داشبورد
 * آمارِ کلینیک را نشان می‌دهد و برای کسی که آمده کارش را انجام دهد
 * جوابِ سؤال «امروز چه کار کنم؟» نیست. مدیر برعکس — او واقعاً آمده
 * وضعیت کلی را ببیند.
 *
 * ملاک «duties» است نه «dashboard»: منشی هم داشبورد را می‌بیند، پس
 * dashboard این دو را از هم جدا نمی‌کند. کسی که مسئولیت تعریف
 * می‌کند همان کسی است که باید نمای کلی ببیند.
 */
export function homeFor(user: Pick<SessionUser, "role">): string {
  return can(user.role, "duties") ? "/admin" : "/admin/today";
}
