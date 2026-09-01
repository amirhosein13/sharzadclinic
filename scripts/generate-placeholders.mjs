/**
 * تصاویر جای‌گزینِ ظریف (SVG) برای زمانی که هنوز عکس واقعی کلینیک آپلود نشده.
 * اجرا:  node scripts/generate-placeholders.mjs
 * بعداً کافی است فایل‌های داخل public/images را با عکس‌های واقعی جایگزین کنی.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "images");
mkdirSync(join(OUT, "services"), { recursive: true });
mkdirSync(join(OUT, "staff"), { recursive: true });
mkdirSync(join(OUT, "gallery"), { recursive: true });
mkdirSync(join(OUT, "blog"), { recursive: true });

const PALETTES = [
  ["#f6e2e6", "#e2b5bf", "#b76e79"],
  ["#f7ece2", "#e6cdb4", "#c9a961"],
  ["#efe3ee", "#cbaac5", "#6d4262"],
  ["#fdf3ef", "#f0d3c6", "#d98a99"],
  ["#e9e6f0", "#c3bcd4", "#7b6f97"],
  ["#f2eee6", "#dcd2bd", "#a88b48"],
];

/** الگوی خطیِ گیاهی/هندسی ملایم روی پس‌زمینه */
function ornament(seed, stroke) {
  const rnd = mulberry(seed);
  let d = "";
  for (let i = 0; i < 7; i++) {
    const cx = 80 + rnd() * 640;
    const cy = 60 + rnd() * 380;
    const r = 40 + rnd() * 150;
    d += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="1" opacity="${(0.10 + rnd() * 0.18).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 3; i++) {
    const y = 80 + rnd() * 340;
    d += `<path d="M -20 ${y.toFixed(1)} Q 200 ${(y - 90 + rnd() * 60).toFixed(1)} 400 ${y.toFixed(1)} T 820 ${(y + 40).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="0.16"/>`;
  }
  return d;
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function svg({ w = 800, h = 500, seed = 1, label = "", sub = "", palette }) {
  const [c1, c2, c3] = palette ?? PALETTES[seed % PALETTES.length];
  const id = `g${seed}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 800 500" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="${id}h" cx="72%" cy="22%" r="62%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="500" fill="url(#${id})"/>
  <g>${ornament(seed, "#ffffff")}</g>
  <rect width="800" height="500" fill="url(#${id}h)"/>
  ${label ? `<text x="400" y="${sub ? 258 : 268}" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="34" font-weight="700" fill="#ffffff" opacity="0.92">${escapeXml(label)}</text>` : ""}
  ${sub ? `<text x="400" y="300" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="18" fill="#ffffff" opacity="0.72">${escapeXml(sub)}</text>` : ""}
</svg>`;
}

function avatarSvg(seed, initial) {
  const [c1, , c3] = PALETTES[seed % PALETTES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs><linearGradient id="a${seed}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c3}"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#a${seed})"/>
  <circle cx="200" cy="158" r="66" fill="#ffffff" opacity="0.85"/>
  <path d="M 76 400 C 76 296 132 246 200 246 C 268 246 324 296 324 400 Z" fill="#ffffff" opacity="0.85"/>
  <text x="200" y="176" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="56" font-weight="700" fill="${c3}">${escapeXml(initial)}</text>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

const write = (p, content) => { writeFileSync(join(OUT, p), content, "utf8"); };

// هیرو و صفحات عمومی
write("hero.svg", svg({ seed: 3, label: "" }));
write("about.svg", svg({ seed: 1, label: "" }));
write("clinic-1.svg", svg({ seed: 5, label: "" }));
write("clinic-2.svg", svg({ seed: 2, label: "" }));
write("og.svg", svg({ seed: 3, label: "کلینیک زیبایی شهرزاد", sub: "پوست • مو • زیبایی" }));

const services = [
  ["laser", "لیزر موهای زائد"], ["botox", "بوتاکس"], ["filler", "فیلر و ژل"],
  ["hydrafacial", "هیدرافیشیال"], ["skin-rejuvenation", "جوانسازی پوست"],
  ["mesotherapy", "مزوتراپی"], ["hair-transplant", "کاشت مو"], ["hair-loss", "درمان ریزش مو"], ["prp", "پی‌آر‌پی"],
  ["carboxytherapy", "کربوکسی‌تراپی"], ["microneedling", "میکرونیدلینگ"],
  ["chemical-peel", "پیلینگ شیمیایی"], ["lip-filler", "تزریق لب"],
  ["hifu", "لیفت هایفو"], ["rf-lift", "لیفت آر‌اف"], ["acne-treatment", "درمان آکنه"],
  ["melasma", "درمان ملاسما"], ["body-contouring", "فرم‌دهی بدن"], ["nail", "خدمات ناخن"],
  ["makeup", "میکاپ حرفه‌ای"], ["consultation", "مشاوره تخصصی"],
];
services.forEach(([slug, title], i) => write(`services/${slug}.svg`, svg({ seed: i + 7, label: title })));

const staff = [
  ["dr-sharzad", "ش"], ["dr-parisa", "پ"], ["dr-nika", "ن"], ["mahsa", "م"], ["sara", "س"],
];
staff.forEach(([slug, initial], i) => write(`staff/${slug}.svg`, avatarSvg(i + 2, initial)));

for (let i = 1; i <= 8; i++) {
  write(`gallery/before-${i}.svg`, svg({ seed: i + 20, label: "قبل", palette: ["#efe9e4", "#d8cbc2", "#a08e83"] }));
  write(`gallery/after-${i}.svg`, svg({ seed: i + 40, label: "بعد" }));
}

const posts = ["skincare-routine", "laser-guide", "botox-facts", "summer-skin", "hair-loss", "post-care"];
posts.forEach((slug, i) => write(`blog/${slug}.svg`, svg({ seed: i + 60 })));

console.log(`✅ ${services.length + staff.length + 16 + posts.length + 5} تصویر جای‌گزین در public/images ساخته شد.`);
