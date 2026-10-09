"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, logAction, requirePermission } from "@/lib/auth";
import { dayKey } from "@/lib/duties";
import { parseJalaliInput } from "@/lib/date";
import { dutySchema, fieldErrors, taskSchema } from "@/lib/validators";
import { can } from "@/lib/permissions";
import type { FormResult } from "./content";

const OK = (message: string): FormResult => ({ ok: true, message });
const FAIL = (message: string, errors?: Record<string, string>): FormResult => ({
  ok: false,
  message,
  errors,
});

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * تعریف و سپردن کار، کارِ مدیر است. مجوز «duties» را چک می‌کنیم نه
 * نقش خام را، تا اگر روزی نقشی اضافه شد همه‌ی اکشن‌ها یک‌جا درست
 * بمانند.
 *
 * کاربرِ واردشده به تابع پاس داده می‌شود، تا برای «چه کسی ساختش»
 * نشستِ دوباره خوانده نشود.
 */
async function guardManager<T>(
  fn: (me: Awaited<ReturnType<typeof requirePermission>>) => Promise<T>,
): Promise<T | FormResult> {
  try {
    return await fn(await requirePermission("duties"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return FAIL("برای این کار باید وارد حساب شوید.");
    if (message === "FORBIDDEN") return FAIL("فقط مدیر می‌تواند مسئولیت تعریف کند.");
    console.error(error);
    return FAIL("ذخیره‌سازی با خطا مواجه شد.");
  }
}

function refresh() {
  revalidatePath("/admin/duties");
  revalidatePath("/admin/today");
}

export async function saveDuty(formData: FormData): Promise<FormResult> {
  return guardManager(async (me) => {
    const id = text(formData.get("id"));
    const parsed = dutySchema.safeParse({
      title: text(formData.get("title")),
      note: text(formData.get("note")),
      assigneeId: text(formData.get("assigneeId")),
      repeat: text(formData.get("repeat")),
      weekdays: formData.getAll("weekdays").map(String),
      monthDay: text(formData.get("monthDay")),
      timeHint: text(formData.get("timeHint")),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const assignee = await prisma.user.findUnique({
      where: { id: v.assigneeId },
      select: { isActive: true },
    });
    if (!assignee) return FAIL("کاربری که انتخاب کردی پیدا نشد.", { assigneeId: "پیدا نشد" });
    if (!assignee.isActive) {
      return FAIL("این حساب غیرفعال است و کاری نمی‌گیرد.", { assigneeId: "حساب غیرفعال است" });
    }

    const data = {
      title: v.title,
      note: v.note || null,
      assigneeId: v.assigneeId,
      repeat: v.repeat,
      // روزهای هفته و روز ماه فقط برای حالت خودشان معنی دارند؛ اگر
      // مدیر حالت را عوض کند، مقدار قبلی باید پاک شود وگرنه یک
      // مسئولیتِ «هر روز» با روزهای هفته‌ی باقی‌مانده گیج‌کننده است
      weekdays: v.repeat === "WEEKLY" ? v.weekdays : [],
      monthDay: v.repeat === "MONTHLY" ? v.monthDay : null,
      timeHint: v.timeHint || null,
      isActive: !!v.isActive,
    };

    if (id) {
      await prisma.duty.update({ where: { id }, data });
    } else {
      await prisma.duty.create({ data: { ...data, createdById: me.id } });
    }

    await logAction({ action: id ? "duty.update" : "duty.create", entity: "Duty", entityId: id || null });
    refresh();
    return OK(id ? "مسئولیت به‌روزرسانی شد." : "مسئولیت تعریف شد.");
  }) as Promise<FormResult>;
}

export async function deleteDuty(id: string): Promise<FormResult> {
  return guardManager(async () => {
    // کارهای ساخته‌شده هم با آن می‌روند (onDelete: Cascade). این
    // عمدی است: مسئولیتی که پاک شده، سابقه‌ی تیک‌هایش هم بی‌معنی
    // می‌شود. اگر فقط می‌خواهی موقتاً متوقف شود، غیرفعالش کن.
    await prisma.duty.delete({ where: { id } });
    await logAction({ action: "duty.delete", entity: "Duty", entityId: id });
    refresh();
    return OK("مسئولیت حذف شد.");
  }) as Promise<FormResult>;
}

export async function toggleDutyActive(id: string): Promise<FormResult> {
  return guardManager(async () => {
    const duty = await prisma.duty.findUniqueOrThrow({
      where: { id },
      select: { isActive: true },
    });
    await prisma.duty.update({ where: { id }, data: { isActive: !duty.isActive } });
    refresh();
    return OK(duty.isActive ? "متوقف شد." : "دوباره فعال شد.");
  }) as Promise<FormResult>;
}

/** کار یک‌باره — چیزی که فقط همین یک‌بار باید انجام شود */
export async function saveTask(formData: FormData): Promise<FormResult> {
  return guardManager(async (me) => {
    const parsed = taskSchema.safeParse({
      title: text(formData.get("title")),
      note: text(formData.get("note")),
      assigneeId: text(formData.get("assigneeId")),
      dueOn: text(formData.get("dueOn")),
    });
    if (!parsed.success) return FAIL("ورودی‌ها را بررسی کنید.", fieldErrors(parsed.error));

    const v = parsed.data;
    const due = v.dueOn ? parseJalaliInput(v.dueOn) : new Date();
    if (!due) return FAIL("تاریخ معتبر نیست.", { dueOn: "تاریخ را مثل ۱۴۰۵/۰۷/۱۵ بنویس" });

    const assignee = await prisma.user.findUnique({
      where: { id: v.assigneeId },
      select: { isActive: true },
    });
    if (!assignee?.isActive) {
      return FAIL("این حساب غیرفعال است و کاری نمی‌گیرد.", { assigneeId: "حساب غیرفعال است" });
    }

    await prisma.task.create({
      data: {
        title: v.title,
        note: v.note || null,
        assigneeId: v.assigneeId,
        dueOn: dayKey(due),
        createdById: me.id,
      },
    });

    await logAction({ action: "task.create", entity: "Task" });
    refresh();
    return OK("کار سپرده شد.");
  }) as Promise<FormResult>;
}

/**
 * تیک‌زدن و برداشتنِ تیک — این یکی کارِ خودِ کارمند است، نه مدیر.
 *
 * هر کس فقط کارِ خودش را می‌تواند تیک بزند؛ مدیر هم کارِ همه را، تا
 * اگر کارمندی تلفنی گفت «انجام شد» بشود ثبتش کرد.
 */
export async function setTaskDone(id: string, done: boolean): Promise<FormResult> {
  const me = await getSession();
  if (!me) return FAIL("برای این کار باید وارد حساب شوید.");

  const task = await prisma.task.findUnique({
    where: { id },
    select: { assigneeId: true, title: true },
  });
  if (!task) return FAIL("این کار پیدا نشد.");

  const mine = task.assigneeId === me.id;
  if (!mine && !can(me.role, "duties")) {
    return FAIL("این کار به شما سپرده نشده است.");
  }

  await prisma.task.update({
    where: { id },
    data: done
      ? { status: "DONE", doneAt: new Date() }
      : // برگشت به حالت باز: doneAt هم پاک می‌شود، وگرنه گزارش‌ها
        // کاری را که باز است «انجام‌شده در فلان ساعت» نشان می‌دهند
        { status: "OPEN", doneAt: null },
  });

  await logAction({
    userId: me.id,
    action: done ? "task.done" : "task.reopen",
    entity: "Task",
    entityId: id,
    detail: task.title,
  });

  refresh();
  return OK(done ? "انجام شد ✅" : "به کارهای باز برگشت.");
}
