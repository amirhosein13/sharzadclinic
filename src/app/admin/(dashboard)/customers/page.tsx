import Link from "next/link";
import { Ban, CircleCheck, Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { toggleCustomerBlock } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { nationalCode: { contains: q } },
          { legacyId: { contains: q } },
        ],
      }
    : {};

  const [customers, total, legacyCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { appointments: true, treatments: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
    prisma.customer.count({ where: { legacyId: { not: null } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminPageHeader
        title="مشتریان"
        description={`${toFa(total)} مشتری${
          legacyCount > 0 ? ` — از این تعداد ${toFa(legacyCount)} نفر از اپلیکیشن قبلی منتقل شده‌اند.` : "."
        }`}
      />

      <Card className="mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--fg-muted)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="نام، شماره موبایل، کد ملی یا شناسه‌ی قدیمی..."
              className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-elevated)] py-3 pr-11 pl-4 text-sm focus:border-rose-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-rose-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-600"
          >
            جستجو
          </button>
        </form>
      </Card>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="مشتری‌ای پیدا نشد" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-[color:var(--bg-sunken)] text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-right font-medium">نام</th>
                  <th className="px-5 py-3 text-right font-medium">موبایل</th>
                  <th className="px-5 py-3 text-right font-medium">نوبت‌ها</th>
                  <th className="px-5 py-3 text-right font-medium">پرونده</th>
                  <th className="px-5 py-3 text-right font-medium">عضویت</th>
                  <th className="px-5 py-3 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {customers.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-[color:var(--bg-sunken)]">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-medium hover:text-rose-500"
                      >
                        {customer.firstName} {customer.lastName}
                      </Link>
                      <div className="mt-1 flex gap-1.5">
                        {customer.legacyId && <Badge tone="plum">منتقل‌شده</Badge>}
                        {customer.isBlocked && <Badge tone="red">محدود</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-4" dir="ltr">
                      <span className="text-right">{toFa(customer.phone)}</span>
                    </td>
                    <td className="px-5 py-4">{toFa(customer._count.appointments)}</td>
                    <td className="px-5 py-4">{toFa(customer._count.treatments)}</td>
                    <td className="px-5 py-4 text-xs text-[color:var(--fg-muted)]">
                      {formatJalaliLong(customer.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <ActionButton
                        action={toggleCustomerBlock.bind(null, customer.id)}
                        title={customer.isBlocked ? "برداشتن محدودیت" : "محدودکردن رزرو آنلاین"}
                        className={
                          customer.isBlocked
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-[color:var(--fg-muted)]"
                        }
                      >
                        {customer.isBlocked ? (
                          <CircleCheck className="size-3.5" />
                        ) : (
                          <Ban className="size-3.5" />
                        )}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[color:var(--line)] px-5 py-4">
              <p className="text-xs text-[color:var(--fg-muted)]">
                صفحه {toFa(page)} از {toFa(totalPages)}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
                    className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-xs hover:bg-[color:var(--bg-sunken)]"
                  >
                    قبلی
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
                    className="rounded-xl border border-[color:var(--line)] px-4 py-2 text-xs hover:bg-[color:var(--bg-sunken)]"
                  >
                    بعدی
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
