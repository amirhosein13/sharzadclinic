#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
#  بررسی سلامت استقرار — یک دستور، همه‌ی چیزهایی که معمولاً خراب‌اند
# ───────────────────────────────────────────────────────────────
#
#  اجرا:  bash /var/www/sharzad/deploy/doctor.sh
#
#  چیزی را عوض نمی‌کند؛ فقط نگاه می‌کند و در پایان می‌گوید چه کار کنی.
#
#  چرا وجود دارد: هر بار عیب‌یابی از راه دور یعنی یک بلوک ۱۵ خطی که
#  باید کپی شود و خروجی‌اش برگردد. این را یک بار می‌نویسیم تا دفعه‌ی
#  بعد فقط یک خط باشد.

set -uo pipefail

APP_DIR=${APP_DIR:-/var/www/sharzad}
APP_PORT=${APP_PORT:-3000}
problems=()

say()  { printf '%s\n' "$*"; }
head2() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  ✅ %s\n' "$*"; }
bad()  { printf '  ❌ %s\n' "$*"; problems+=("$*"); }
warn() { printf '  ⚠️  %s\n' "$*"; }

cd "$APP_DIR" 2>/dev/null || { say "❌ پوشه‌ی $APP_DIR پیدا نشد"; exit 1; }

# ─── سرویس‌ها ───────────────────────────────────────────────
head2 "سرویس‌ها"
for unit in sharzad nginx postgresql; do
  state=$(systemctl is-active "$unit" 2>/dev/null)
  [[ $state == active ]] && ok "$unit فعال است" || bad "$unit فعال نیست (وضعیت: ${state:-نامشخص})"
done

# ─── تازگی بیلد ─────────────────────────────────────────────
head2 "بیلد"
commit_time=$(git log -1 --format=%ct 2>/dev/null || echo 0)
commit_hash=$(git log -1 --format=%h 2>/dev/null || echo "?")
if [[ -f .next/BUILD_ID ]]; then
  build_time=$(stat -c %Y .next/BUILD_ID)
  say "  کامیت: $commit_hash ($(date -d "@$commit_time" '+%Y-%m-%d %H:%M'))"
  say "  بیلد : $(date -d "@$build_time" '+%Y-%m-%d %H:%M')"
  # چند ثانیه اختلاف طبیعی است (بیلد بلافاصله بعد از pull اجرا می‌شود)؛
  # فقط اختلاف معنادار یعنی بیلد جا مانده
  if (( commit_time - build_time > 120 )); then
    bad "بیلد از کد قدیمی‌تر است — npm run build را نزده‌ای"
  else
    ok "بیلد با کد هماهنگ است"
  fi
else
  bad "پوشه‌ی .next وجود ندارد — اصلاً بیلد نشده"
fi

# ─── آیا مسیرها واقعاً بیلد شده‌اند؟ ────────────────────────
head2 "مسیرهای بیلدشده"
if [[ -f .next/routes-manifest.json ]]; then
  for route in /admin /admin/services /admin/login /; do
    if node -e "
      const m=require('./.next/routes-manifest.json');
      const r=[...(m.dynamicRoutes||[]),...(m.staticRoutes||[])].map(x=>x.page);
      process.exit(r.includes('$route') ? 0 : 1);
    " 2>/dev/null; then
      ok "$route در بیلد هست"
    else
      bad "$route در بیلد نیست — بیلد ناقص است"
    fi
  done
else
  bad "routes-manifest.json نیست — بیلد ناقص یا خراب است"
fi

# ─── پاسخ خودِ برنامه، بدون nginx ───────────────────────────
head2 "پاسخ برنامه (بدون nginx، بدون کوکی)"
for path in / /admin /admin/services /admin/login; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:${APP_PORT}${path}" 2>/dev/null)
  case "$path:$code" in
    /:200|/admin:307|/admin/services:307|/admin/login:200) ok "$path → $code" ;;
    *:404) bad "$path → ۴۰۴ (این مسیر در بیلد نیست)" ;;
    *:000) bad "$path → برنامه جواب نداد" ;;
    *) warn "$path → $code (انتظار داشتیم چیز دیگری باشد)" ;;
  esac
done

# ─── nginx ──────────────────────────────────────────────────
head2 "nginx"
nginx -t >/dev/null 2>&1 && ok "تنظیمات سالم است" || bad "nginx -t خطا می‌دهد"
ss -lntp 2>/dev/null | grep -q ':443 ' && ok "روی ۴۴۳ گوش می‌دهد (SSL)" || bad "روی ۴۴۳ گوش نمی‌دهد — بلوک SSL پریده، certbot را دوباره بزن"
grep -q 'limit_req zone=sharzad_all' /etc/nginx/sites-available/sharzad 2>/dev/null && {
  grep -A1 'location /_next/static/' /etc/nginx/sites-available/sharzad | grep -q limit_req \
    && bad "محدودیت نرخ روی فایل‌های ثابت هم هست — کانفیگ قدیمی است" \
    || ok "محدودیت نرخ فقط روی مسیرهای داینامیک است"
}

# ─── حافظه ──────────────────────────────────────────────────
head2 "حافظه"
free -h | sed -n '2p;3p' | sed 's/^/  /'
swap_total=$(free -m | awk '/Swap:/{print $2}')
(( swap_total > 0 )) && ok "swap دارد (${swap_total} مگابایت)" || warn "swap ندارد — next build ممکن است وسط کار کشته شود"
oom=$(journalctl -k --no-pager 2>/dev/null | grep -ciE "out of memory|killed process" || true)
(( oom > 0 )) && bad "کرنل $oom بار فرایندی را به‌خاطر کمبود حافظه کشته — احتمالاً بیلد نیمه‌کاره مانده" || ok "هیچ فرایندی به‌خاطر حافظه کشته نشده"

# ─── دیسک ───────────────────────────────────────────────────
head2 "دیسک"
df -h / | sed -n '2p' | sed 's/^/  /'

# ─── جمع‌بندی ───────────────────────────────────────────────
head2 "نتیجه"
if (( ${#problems[@]} == 0 )); then
  say "  🎉 همه چیز سالم است."
else
  printf '  %s مشکل پیدا شد:\n' "${#problems[@]}"
  for p in "${problems[@]}"; do printf '    • %s\n' "$p"; done

  if printf '%s\n' "${problems[@]}" | grep -q "در بیلد نیست\|بیلد ناقص\|قدیمی‌تر\|.next وجود ندارد"; then
    cat <<'FIX'

  ── برای بیلد ناقص ──
  اگر swap نداری، اول بساز (یک‌بار برای همیشه):
    fallocate -l 4G /swapfile && chmod 600 /swapfile
    mkswap /swapfile && swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

  بعد بیلد را از صفر بزن — پوشه‌ی نیمه‌کاره باید کامل پاک شود:
    cd /var/www/sharzad
    sudo -u sharzad rm -rf .next
    sudo -u sharzad npm run build
    systemctl restart sharzad
FIX
  fi
fi
say ""
