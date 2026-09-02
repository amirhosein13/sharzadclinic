/**
 * ساخت فایل CSV که اکسل فارسی درست بازش می‌کند:
 * BOM برای یونیکد و خط `sep=,` تا اکسل جداکننده را اشتباه نگیرد.
 */
export function toCsv(sections: { title?: string; head: string[]; rows: (string | number)[][] }[]): string {
  const esc = (value: string | number) => {
    const text = typeof value === "number" ? String(value) : value;
    return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const lines: string[] = ["sep=,"];
  for (const section of sections) {
    if (section.title) lines.push(esc(section.title));
    lines.push(section.head.map(esc).join(","));
    for (const row of section.rows) lines.push(row.map(esc).join(","));
    lines.push("");
  }

  return "﻿" + lines.join("\r\n");
}
