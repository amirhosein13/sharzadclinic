import "server-only";
import { prisma } from "./prisma";
import { normalizePhone, toEn } from "./utils";
import { formatJalaliDateTime } from "./date";

export type SearchHit = {
  kind: "customer" | "appointment" | "ticket";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * جستجوی سراسری پنل — مشتری با نام یا شماره، نوبت با کد پیگیری،
 * و گفت‌وگو با موضوع. برای میز پذیرش که روزی ده‌ها بار دنبال یک نفر
 * می‌گردد.
 */
export async function searchEverything(rawQuery: string, limit = 6): Promise<SearchHit[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  // شماره ممکن است با ارقام فارسی یا با فاصله و خط تیره وارد شود
  const asLatin = toEn(query);
  const digitsOnly = asLatin.replace(/\D/g, "");
  const hasPhone = digitsOnly.length >= 3;
  const asPhone = hasPhone ? normalizePhone(query) : "";

  const [customers, appointments, tickets] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          ...(hasPhone
            ? [
                { phone: { contains: digitsOnly } },
                { phone: { contains: asPhone } },
                { nationalCode: { contains: digitsOnly } },
              ]
            : []),
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { code: { contains: asLatin.toUpperCase() } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { title: true } },
      },
      take: limit,
      orderBy: { startsAt: "desc" },
    }),
    prisma.supportTicket.findMany({
      where: { subject: { contains: query, mode: "insensitive" } },
      include: { customer: { select: { firstName: true, lastName: true } } },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return [
    ...customers.map((c) => ({
      kind: "customer" as const,
      id: c.id,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: c.phone,
      href: `/admin/customers/${c.id}`,
    })),
    ...appointments.map((a) => ({
      kind: "appointment" as const,
      id: a.id,
      title: `${a.customer.firstName} ${a.customer.lastName} — ${a.service.title}`,
      subtitle: `${a.code} • ${formatJalaliDateTime(a.startsAt)}`,
      href: `/admin/appointments?q=${a.code}`,
    })),
    ...tickets.map((t) => ({
      kind: "ticket" as const,
      id: t.id,
      title: t.subject,
      subtitle: `${t.customer.firstName} ${t.customer.lastName}`,
      href: "/admin/tickets?filter=all",
    })),
  ];
}
