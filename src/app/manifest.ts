import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * تا مشتری و منشی بتوانند سایت را روی صفحه‌ی گوشی‌شان نصب کنند و مثل
 * اپلیکیشن بازش کنند. نام از تنظیمات خوانده می‌شود تا با نام واقعی
 * کلینیک یکی باشد.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();

  return {
    name: settings.clinicName,
    short_name: settings.clinicName.split(" ").slice(-1)[0] || settings.clinicName,
    description: settings.description,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "fa-IR",
    background_color: "#fdfaf8",
    theme_color: "#b76e79",
    icons: [
      { src: "/images/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "رزرو نوبت", url: "/booking" },
      { name: "حساب من", url: "/account" },
      { name: "پیگیری نوبت", url: "/track" },
    ],
  };
}
