"use server";

import { prisma } from "@/lib/prisma";
import { contactSchema, fieldErrors } from "@/lib/validators";

export type ContactState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    subject: formData.get("subject") ?? "",
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  try {
    await prisma.contactMessage.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        subject: parsed.data.subject || null,
        body: parsed.data.body,
      },
    });
    return { ok: true, message: "پیام شما ثبت شد. همکاران ما به‌زودی تماس می‌گیرند." };
  } catch {
    return { ok: false, message: "ثبت پیام با خطا مواجه شد. لطفاً دوباره تلاش کنید." };
  }
}
