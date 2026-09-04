import { Trash2, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { UserForm } from "@/components/admin/forms/user-form";
import { deleteUser } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/permissions";
import { timeAgoFa } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const current = await guardPage("users");

  const [users, staff] = await Promise.all([
    prisma.user.findMany({
      include: { staff: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const linkedStaffIds = new Set(users.map((u) => u.staffId).filter(Boolean));

  return (
    <>
      <AdminPageHeader
        title="کاربران پنل"
        description={`${toFa(users.length)} حساب کاربری. برای هر منشی و اپراتور یک حساب جدا بسازید تا فعالیت‌ها قابل پیگیری باشد.`}
        action={<UserForm staff={staff} />}
      />

      {users.length === 0 ? (
        <EmptyState icon={Users} title="کاربری ثبت نشده" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-right font-medium">نام</th>
                  <th className="px-5 py-3 text-right font-medium">ایمیل</th>
                  <th className="px-5 py-3 text-right font-medium">نقش</th>
                  <th className="px-5 py-3 text-right font-medium">آخرین ورود</th>
                  <th className="px-5 py-3 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {user.name}
                        {user.id === current.id && (
                          <span className="mr-2 text-xs text-[color:var(--fg-muted)]">(شما)</span>
                        )}
                      </p>
                      {!user.isActive && <Badge tone="red">غیرفعال</Badge>}
                    </td>
                    <td className="px-5 py-4 text-xs" dir="ltr">
                      <span className="block text-right">{user.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={user.role === "ADMIN" ? "gold" : "plum"}>{ROLE_LABELS[user.role]}</Badge>
                      {user.staff && (
                        <p className="mt-1 text-[11px] text-[color:var(--fg-muted)]">{user.staff.name}</p>
                      )}
                      {user.role === "OPERATOR" && !user.staff && (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          ⚠️ به پرسنلی متصل نیست
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-[color:var(--fg-muted)]">
                      {user.lastLoginAt ? timeAgoFa(user.lastLoginAt) : "هرگز"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <UserForm
                          staff={staff}
                          user={{
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            phone: user.phone,
                            role: user.role,
                            staffId: user.staffId,
                            isActive: user.isActive,
                          }}
                        />
                        {user.id !== current.id && (
                          <ActionButton
                            action={deleteUser.bind(null, user.id)}
                            confirm={`حساب «${user.name}» حذف شود؟`}
                            title="حذف کاربر"
                            className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {staff.length > linkedStaffIds.size && (
        <Card className="mt-6">
          <p className="text-sm leading-7 text-[color:var(--fg-muted)]">
            💡 {toFa(staff.length - linkedStaffIds.size)} پرسنل هنوز حساب کاربری ندارند. اگر می‌خواهید
            خودشان نوبت‌ها و درآمدشان را ببینند، برایشان کاربر با نقش «اپراتور» بسازید.
          </p>
        </Card>
      )}
    </>
  );
}
