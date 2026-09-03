import { Boxes, FlaskConical, Trash2, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { guardPage } from "@/lib/guard";
import { AdminPageHeader, Card, EmptyState } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/action-button";
import { InventoryForm } from "@/components/admin/forms/inventory-form";
import { StockForm } from "@/components/admin/forms/stock-form";
import { ServiceMaterialForm } from "@/components/admin/forms/service-material-form";
import { deleteInventoryItem, deleteServiceMaterial } from "@/app/actions/finance";
import { COMMON_UNITS, listInventory, MOVEMENT_META } from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";
import { formatJalaliLong } from "@/lib/date";
import { formatToman, toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await guardPage("payroll");

  const [items, movements, materials, services] = await Promise.all([
    listInventory(true),
    prisma.stockMovement.findMany({
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.serviceMaterial.findMany({
      include: {
        service: { select: { title: true } },
        item: { select: { name: true, unit: true, unitCost: true } },
      },
      orderBy: { service: { order: "asc" } },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const active = items.filter((i) => i.isActive);
  const low = active.filter((i) => i.isLow || i.isOut);
  const totalValue = active.reduce((sum, i) => sum + i.stockValue, 0);

  return (
    <>
      <AdminPageHeader
        title="انبار مواد"
        description={`${toFa(active.length)} قلم فعال • ارزش موجودی ${formatToman(totalValue)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <ServiceMaterialForm
              services={services}
              items={active.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
            />
            <InventoryForm units={COMMON_UNITS} />
          </div>
        }
      />

      {low.length > 0 && (
        <div className="mb-6 rounded-3xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-400/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 font-bold">
            <TriangleAlert className="size-5 text-amber-600 dark:text-amber-300" />
            {toFa(low.length)} قلم رو به اتمام است
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {low.map((item) => (
              <li
                key={item.id}
                className="rounded-lg bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs font-medium"
              >
                {item.name}: {toFa(item.stock)} {item.unit}
                {item.isOut && " (تمام شد)"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title="انبار خالی است"
            description="اقلام مصرفی (ژل، ویال، سرسوزن...) را اضافه کنید تا مصرف و سود واقعی حساب شود."
          />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[color:var(--line)] text-right text-xs text-[color:var(--fg-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">قلم</th>
                  <th className="px-5 py-3 font-medium">موجودی</th>
                  <th className="px-5 py-3 font-medium">بهای واحد</th>
                  <th className="px-5 py-3 font-medium">ارزش</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {items.map((item) => (
                  <tr key={item.id} className={item.isActive ? "" : "opacity-50"}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{item.name}</p>
                      {item.supplier && (
                        <p className="mt-0.5 text-xs text-[color:var(--fg-muted)]">{item.supplier}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tabular-nums">
                          {toFa(item.stock)} {item.unit}
                        </span>
                        {item.isOut ? (
                          <Badge tone="red">تمام شد</Badge>
                        ) : item.isLow ? (
                          <Badge tone="amber">رو به اتمام</Badge>
                        ) : null}
                      </span>
                      {item.minStock > 0 && (
                        <p className="mt-0.5 text-xs text-[color:var(--fg-muted)]">
                          مرز هشدار: {toFa(item.minStock)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 tabular-nums">{formatToman(item.unitCost, false)}</td>
                    <td className="px-5 py-4 tabular-nums font-medium">
                      {formatToman(item.stockValue, false)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StockForm
                          itemId={item.id}
                          itemName={item.name}
                          unit={item.unit}
                          stock={item.stock}
                          unitCost={item.unitCost}
                        />
                        <InventoryForm
                          units={COMMON_UNITS}
                          item={{
                            id: item.id,
                            name: item.name,
                            unit: item.unit,
                            minStock: item.minStock,
                            unitCost: item.unitCost,
                            supplier: item.supplier,
                            note: item.note,
                            isActive: item.isActive,
                          }}
                        />
                        <ActionButton
                          action={deleteInventoryItem.bind(null, item.id)}
                          confirm={`«${item.name}» حذف شود؟`}
                          title="حذف"
                          className="size-8 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <div className="border-b border-[color:var(--line)] p-6">
            <h2 className="font-bold">مصرف استاندارد خدمات</h2>
            <p className="mt-1.5 text-xs leading-6 text-[color:var(--fg-muted)]">
              با ثبت هر جلسه‌ی درمان، این مقدارها خودکار از انبار کم می‌شوند و بهای
              تمام‌شده‌ی هر خدمت از همین‌جا حساب می‌شود.
            </p>
          </div>
          {materials.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FlaskConical}
                title="هنوز تعریف نشده"
                description="تا وقتی تعریف نشود، سود هر خدمت بدون بهای مواد حساب می‌شود."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {materials.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.service.title}</p>
                    <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                      {toFa(row.quantity)} {row.item.unit} {row.item.name} •{" "}
                      {formatToman(Math.round(row.quantity * row.item.unitCost))}
                    </p>
                  </div>
                  <ActionButton
                    action={deleteServiceMaterial.bind(null, row.id)}
                    confirm="این ماده از فهرست خدمت حذف شود؟"
                    title="حذف"
                    className="size-8 shrink-0 p-0 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <h2 className="border-b border-[color:var(--line)] p-6 font-bold">آخرین حرکت‌های انبار</h2>
          {movements.length === 0 ? (
            <p className="p-6 text-sm text-[color:var(--fg-muted)]">هنوز حرکتی ثبت نشده است.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--line)]">
              {movements.map((m) => {
                const meta = MOVEMENT_META[m.kind];
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.item.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--fg-muted)]">
                        {formatJalaliLong(m.createdAt)}
                        {m.note && ` • ${m.note}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="text-sm font-medium tabular-nums">
                        {meta.sign > 0 ? "+" : "−"}
                        {toFa(m.quantity)} {m.item.unit}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
