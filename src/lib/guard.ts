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

/** صفحه‌ی خانه‌ی هر نقش پس از ورود */
export function homeFor(user: Pick<SessionUser, "role">): string {
  return user.role === "OPERATOR" ? "/admin/my" : "/admin";
}
