import "server-only";
import type { Prisma, StockMovementKind } from "@prisma/client";
import { prisma } from "./prisma";

/** دسته‌ی سیستمیِ هزینه که مصرف انبار در آن ثبت می‌شود */
export const MATERIALS_CATEGORY_SLUG = "materials";

export const MOVEMENT_META: Record<
  StockMovementKind,
  { label: string; tone: "green" | "amber" | "neutral" | "red"; sign: 1 | -1 }
> = {
  IN: { label: "خرید", tone: "green", sign: 1 },
  OUT: { label: "مصرف", tone: "amber", sign: -1 },
  ADJUST: { label: "اصلاح شمارش", tone: "neutral", sign: 1 },
  WASTE: { label: "ضایعات", tone: "red", sign: -1 },
};

export const COMMON_UNITS = ["عدد", "سی‌سی", "میلی‌لیتر", "گرم", "بسته", "جفت"] as const;

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  unitCost: number;
  supplier: string | null;
  note: string | null;
  isActive: boolean;
  /** ارزش ریالی موجودی فعلی */
  stockValue: number;
  isLow: boolean;
  isOut: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function toStockItem(row: {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  unitCost: number;
  supplier: string | null;
  note: string | null;
  isActive: boolean;
}): StockItem {
  return {
    ...row,
    stock: round2(row.stock),
    minStock: round2(row.minStock),
    stockValue: Math.round(row.stock * row.unitCost),
    isOut: row.stock <= 0,
    isLow: row.minStock > 0 && row.stock <= row.minStock,
  };
}

export async function listInventory(includeInactive = false): Promise<StockItem[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(toStockItem);
}

/** اقلامی که تمام شده‌اند یا به مرز هشدار رسیده‌اند — کم‌موجودترین اول */
export async function lowStockItems(): Promise<StockItem[]> {
  const rows = await prisma.inventoryItem.findMany({ where: { isActive: true } });
  return rows
    .map(toStockItem)
    .filter((i) => i.isOut || i.isLow)
    .sort((a, b) => a.stock - b.stock);
}

export async function lowStockCount(): Promise<number> {
  return (await lowStockItems()).length;
}

/**
 * ثبت یک حرکت انبار و به‌روزرسانی موجودی، به‌صورت اتمی.
 * خرید، علاوه بر موجودی، بهای واحد را هم به‌روز می‌کند و یک هزینه ثبت
 * می‌کند تا سود واقعی درست دربیاید.
 */
export async function recordMovement(input: {
  itemId: string;
  kind: StockMovementKind;
  quantity: number;
  unitCost?: number;
  treatmentId?: string | null;
  note?: string | null;
  /** برای ADJUST: مقدار نهایی موجودی، نه تفاضل */
  absoluteStock?: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const run = async (db: Prisma.TransactionClient) => {
    const item = await db.inventoryItem.findUniqueOrThrow({ where: { id: input.itemId } });

    let delta: number;
    let quantity = Math.abs(input.quantity);

    if (input.kind === "ADJUST" && input.absoluteStock !== undefined) {
      delta = input.absoluteStock - item.stock;
      quantity = Math.abs(delta);
    } else {
      delta = MOVEMENT_META[input.kind].sign * quantity;
    }

    const movement = await db.stockMovement.create({
      data: {
        itemId: item.id,
        kind: input.kind,
        quantity,
        unitCost: input.unitCost ?? item.unitCost,
        treatmentId: input.treatmentId ?? null,
        note: input.note ?? null,
      },
    });

    await db.inventoryItem.update({
      where: { id: item.id },
      data: {
        // موجودی منفی معنی ندارد؛ اگر کسی بیشتر از موجودی مصرف ثبت کند صفر می‌شود
        stock: Math.max(0, round2(item.stock + delta)),
        ...(input.kind === "IN" && input.unitCost ? { unitCost: input.unitCost } : {}),
      },
    });

    // خرید مواد یک هزینه‌ی واقعی است و باید در سود دیده شود
    if (input.kind === "IN") {
      const cost = Math.round(quantity * (input.unitCost ?? item.unitCost));
      if (cost > 0) {
        const category = await db.expenseCategory.findUnique({
          where: { slug: MATERIALS_CATEGORY_SLUG },
        });
        if (category) {
          await db.expense.create({
            data: {
              categoryId: category.id,
              title: `خرید ${item.name}`,
              amount: cost,
              spentAt: new Date(),
              note: input.note ?? null,
              stockMovementId: movement.id,
            },
          });
        }
      }
    }
  };

  if (input.tx) await run(input.tx);
  else await prisma.$transaction(run);
}

/**
 * کسر خودکار موادِ یک خدمت پس از ثبت جلسه‌ی درمان.
 * اگر خدمت مواد تعریف‌شده نداشته باشد، هیچ کاری نمی‌کند.
 */
export async function consumeForService(
  serviceId: string,
  treatmentId: string,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const db = tx ?? prisma;
  const materials = await db.serviceMaterial.findMany({
    where: { serviceId },
    include: { item: { select: { id: true, isActive: true } } },
  });

  let consumed = 0;
  for (const material of materials) {
    if (!material.item.isActive || material.quantity <= 0) continue;
    await recordMovement({
      itemId: material.itemId,
      kind: "OUT",
      quantity: material.quantity,
      treatmentId,
      note: "مصرف خودکار جلسه",
      tx: db as Prisma.TransactionClient,
    });
    consumed++;
  }
  return consumed;
}

/** بهای تمام‌شده‌ی مواد برای یک بار انجام هر خدمت */
export async function materialCostByService(): Promise<Map<string, number>> {
  const rows = await prisma.serviceMaterial.findMany({
    include: { item: { select: { unitCost: true } } },
  });
  const costs = new Map<string, number>();
  for (const row of rows) {
    costs.set(row.serviceId, (costs.get(row.serviceId) ?? 0) + row.quantity * row.item.unitCost);
  }
  return costs;
}
