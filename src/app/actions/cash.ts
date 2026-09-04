"use server";

import { prisma } from "@/lib/prisma";
import { logAction, requireRole } from "@/lib/auth";
import { closeCashDay } from "@/lib/cash";
import { safeRevalidate } from "@/lib/revalidate";
import { toEn, formatToman } from "@/lib/utils";
import type { FormResult } from "./content";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function submitCashClose(formData: FormData): Promise<FormResult> {
  try {
    const user = await requireRole("ADMIN", "MANAGER");

    const dateKey = text(formData.get("dateKey"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return { ok: false, message: "روز نامعتبر است." };
    }

    // ارقام فارسی و جداکننده‌ی هزارگان را کاربر می‌نویسد، ما پاکش می‌کنیم
    const raw = toEn(text(formData.get("countedCash"))).replace(/[,٬\s]/g, "");
    if (raw === "") {
      return {
        ok: false,
        message: "مبلغ شمرده‌شده را وارد کنید.",
        errors: { countedCash: "مبلغ را وارد کنید" },
      };
    }
    const countedCash = Math.round(Number(raw));
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return {
        ok: false,
        message: "مبلغ شمرده‌شده را درست وارد کنید.",
        errors: { countedCash: "عدد نامعتبر" },
      };
    }

    const result = await closeCashDay({
      dateKey,
      countedCash,
      note: text(formData.get("note")),
      userId: user.id,
    });
    if (!result.ok) return { ok: false, message: result.message };

    await logAction({
      userId: user.id,
      action: "cash.close",
      entity: "CashClose",
      detail: `${dateKey} — شمرده ${formatToman(countedCash)} — اختلاف ${formatToman(result.difference)}`,
    });

    safeRevalidate("/admin/cash");
    safeRevalidate("/admin");

    if (result.difference === 0) return { ok: true, message: "صندوق بسته شد و دقیقاً خواند. 🎉" };
    return {
      ok: true,
      message:
        result.difference > 0
          ? `صندوق بسته شد. ${formatToman(result.difference)} بیشتر از انتظار در کشو بود.`
          : `صندوق بسته شد. ${formatToman(Math.abs(result.difference))} کسری دارید.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return { ok: false, message: "برای این کار باید وارد شوید." };
    if (message === "FORBIDDEN") return { ok: false, message: "فقط مدیر می‌تواند صندوق را ببندد." };
    console.error(error);
    return { ok: false, message: "ثبت با خطا مواجه شد. دوباره تلاش کنید." };
  }
}

export async function reopenCashDay(id: string): Promise<FormResult> {
  try {
    const user = await requireRole("ADMIN");
    const removed = await prisma.cashClose.delete({ where: { id } });
    await logAction({
      userId: user.id,
      action: "cash.reopen",
      entity: "CashClose",
      entityId: id,
      detail: `${removed.day.toISOString().slice(0, 10)} — شمارش قبلی ${formatToman(removed.countedCash)}`,
    });
    safeRevalidate("/admin/cash");
    return { ok: true, message: "صندوق آن روز باز شد و می‌توانید دوباره بشمارید." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FORBIDDEN") return { ok: false, message: "فقط مدیر کل می‌تواند صندوق بسته را باز کند." };
    console.error(error);
    return { ok: false, message: "این کار انجام نشد." };
  }
}
