import { Eye, EyeOff, TicketPercent, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { DiscountForm } from "@/components/admin/forms/discount-form";
import { deleteDiscount, toggleDiscount } from "@/app/actions/discounts";
import { describeDiscount } from "@/lib/discounts";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong, toJalaliInput } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await guardPage("content");

  const codes = await prisma.discountCode.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { uses: true } } },
  });

  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="کدهای تخفیف"
        description="هر مشتری از هر کد فقط یک بار می‌تواند استفاده کند."
        action={<DiscountForm />}
      />

      {codes.length === 0 ? (
        <Card>
          <EmptyState
            icon={TicketPercent}
            title="هنوز کد تخفیفی نساخته‌اید"
            description="مثلاً یک کد نوروزی یا کد معرفی دوست بسازید."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {codes.map((c) => {
            const expired = !!c.expiresAt && c.expiresAt < now;
            const notStarted = !!c.startsAt && c.startsAt > now;
            const full = c.maxUses !== null && c.usedCount >= c.maxUses;
            const usable = c.isActive && !expired && !notStarted && !full;

            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-[color:var(--bg-sunken)] px-2.5 py-1 font-mono text-sm font-bold" dir="ltr">
                        {c.code}
                      </code>
                      <span className="text-sm font-medium">{describeDiscount(c)}</span>
                      {usable ? (
                        <Badge tone="green">قابل استفاده</Badge>
                      ) : expired ? (
                        <Badge tone="red">منقضی</Badge>
                      ) : notStarted ? (
                        <Badge tone="amber">هنوز شروع نشده</Badge>
                      ) : full ? (
                        <Badge tone="amber">ظرفیت تکمیل</Badge>
                      ) : (
                        <Badge>غیرفعال</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-xs leading-6 text-[color:var(--fg-muted)]">
                      {c.minAmount ? `حداقل خرید ${formatToman(c.minAmount)} • ` : ""}
                      {toFa(c.usedCount)}
                      {c.maxUses ? ` از ${toFa(c.maxUses)}` : ""} بار استفاده شده
                      {c.startsAt ? ` • از ${formatJalaliLong(c.startsAt)}` : ""}
                      {c.expiresAt ? ` • تا ${formatJalaliLong(c.expiresAt)}` : ""}
                    </p>
                    {c.note && (
                      <p className="mt-1.5 text-xs text-[color:var(--fg-muted)]">{c.note}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <DiscountForm
                      discount={{
                        id: c.id,
                        code: c.code,
                        kind: c.kind,
                        value: c.value,
                        minAmount: c.minAmount,
                        maxDiscount: c.maxDiscount,
                        maxUses: c.maxUses,
                        startsAt: c.startsAt ? toJalaliInput(c.startsAt) : null,
                        expiresAt: c.expiresAt ? toJalaliInput(c.expiresAt) : null,
                        isActive: c.isActive,
                        note: c.note,
                      }}
                    />
                    <ActionButton
                      action={toggleDiscount.bind(null, c.id)}
                      title={c.isActive ? "غیرفعال کردن" : "فعال کردن"}
                      className="size-9 p-0"
                    >
                      {c.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </ActionButton>
                    <ActionButton
                      action={deleteDiscount.bind(null, c.id)}
                      confirm="این کد تخفیف حذف شود؟"
                      title="حذف"
                      className="size-9 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="size-4" />
                    </ActionButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
