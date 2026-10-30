#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
#  به‌روزرسانی سایت — یک دستور، از اول تا آخر
# ───────────────────────────────────────────────────────────────
#
#  اجرا:  sudo bash /var/www/sharzad/deploy/update.sh
#
#  چرا وجود دارد: تا امروز به‌روزرسانی شش دستور دستی بود و اگر وسطش
#  چیزی می‌شکست، معلوم نمی‌شد کجا — یا بدتر، سایت با بیلد نیمه‌کاره
#  ری‌استارت می‌شد. اینجا هر قدم چک می‌شود و اگر بشکند، *قبل از*
#  ری‌استارت می‌ایستد؛ یعنی نسخه‌ی قبلی سرِ جایش می‌ماند.
#
#  ترتیب عمدی است:
#    پشتیبان → گرفتن کد → پکیج‌ها → مهاجرت → بیلد → ری‌استارت → چکاپ
#  پشتیبان اولِ همه است چون تنها قدمِ برگشت‌ناپذیر، مهاجرتِ دیتابیس است.

set -uo pipefail

# ─── از روی یک کپیِ بی‌حرکت اجرا شو ──────────────────────────
#
# این اسکریپت وسط کار خودش را به‌روزرسانی می‌کند (git pull نسخه‌ی تازه‌ی
# همین فایل را می‌آورد). ولی bash اسکریپت را یک‌جا نمی‌خواند؛ تکه‌تکه و
# بر اساس جای فعلی‌اش در فایل می‌خواند. پس وقتی فایل زیر پایش عوض
# می‌شود، ادامه‌ی اجرا از جای غلط خوانده می‌شود.
#
# یک بار واقعاً اتفاق افتاد: قدمِ ساختِ پوشه‌ی تصاویر کامل رد شد، چون
# در نسخه‌ی قبلیِ فایل وجود نداشت و merge بعد از عبور از آن نقطه رسید.
# آن دفعه فقط یک قدم جا افتاد؛ دفعه‌ی بعد می‌توانست نصفِ یک دستور را
# اجرا کند.
#
# راه‌حل: اول از خودمان یک کپی بگیر و همان را اجرا کن. کپی زیر پای
# هیچ‌کس عوض نمی‌شود.
if [[ ${SHARZAD_UPDATE_FROM_COPY:-} != 1 ]]; then
  _copy=$(mktemp /tmp/sharzad-update.XXXXXX) || exit 1
  cat "$0" > "$_copy" || exit 1
  SHARZAD_UPDATE_FROM_COPY=1 bash "$_copy" "$@"
  _status=$?
  rm -f "$_copy"
  exit $_status
fi

APP_DIR=${APP_DIR:-/var/www/sharzad}
APP_USER=${APP_USER:-sharzad}
SERVICE=${SERVICE:-sharzad}
APP_PORT=${APP_PORT:-3000}
BRANCH=${BRANCH:-}

step()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()    { printf '  ✅ %s\n' "$*"; }
warn()  { printf '  ⚠️  %s\n' "$*"; }
info()  { printf '     %s\n' "$*"; }

# تا وقتی مهاجرت اجرا نشده، شکست یعنی «هیچ اتفاقی نیفتاد». بعد از آن
# دیگر این جمله دروغ است — دیتابیس عوض شده. پس وضعیت را دنبال می‌کنیم.
STAGE=safe

die() {
  printf '\n\033[1;31m✖ %s\033[0m\n' "$1"
  shift
  for line in "$@"; do printf '  %s\n' "$line"; done
  case $STAGE in
    safe)
      printf '\n  هنوز دست به دیتابیس نزده بودیم — سایت دست‌نخورده ماند.\n\n'
      ;;
    migrated)
      printf '\n  ⚠️  کد و دیتابیس به‌روز شده‌اند ولی سرویس با نسخه‌ی قبلی کار\n'
      printf '     می‌کند. معمولاً سایت بالاست، ولی تا ری‌استارتِ موفق\n'
      printf '     نصفه‌کاره‌ایم. پشتیبانِ قبل از شروع را داری.\n\n'
      ;;
  esac
  exit 1
}

cd "$APP_DIR" 2>/dev/null || die "پوشه‌ی $APP_DIR پیدا نشد." \
  "اگر سایت جای دیگری نصب است:  APP_DIR=/مسیر/درست bash .../update.sh"

[[ -d .git ]] || die "$APP_DIR یک مخزن گیت نیست." \
  "این اسکریپت برای سروری است که با git نصب شده."

# کارها باید با کاربر خودِ برنامه اجرا شوند، وگرنه فایل‌های ساخته‌شده
# مالِ root می‌شوند و دفعه‌ی بعد سرویس نمی‌تواند بخواندشان
if [[ $(id -u) -eq 0 ]] && id -u "$APP_USER" >/dev/null 2>&1; then
  as_app() { sudo -u "$APP_USER" "$@"; }
else
  as_app() { "$@"; }
  [[ $(id -u) -eq 0 ]] || warn "با کاربر $(whoami) اجرا می‌شود، نه $APP_USER."
fi

printf '\n\033[1m به‌روزرسانی کلینیک شهرزاد \033[0m\n'
info "پوشه: $APP_DIR"

# ─── ۰. وضعیت فعلی ─────────────────────────────────────────────
step "وضعیت فعلی"

# فقط فایل‌های *ردیابی‌شده‌ی دست‌خورده* جلوی merge را می‌گیرند. فایل
# تازه‌ی ردیابی‌نشده (لاگ، پشتیبان، .env.bak) بی‌خطر است و اگر هم
# روی فایلی از مخزن بیفتد، خودِ merge جلویش را می‌گیرد — پس نباید
# کل به‌روزرسانی را متوقف کند. روی سروری که یک ماه کار کرده، همیشه
# چند تایی از این‌ها هست.
modified=$(git status --porcelain 2>/dev/null | grep -v '^??')
if [[ -n $modified ]]; then
  printf '%s\n' "$modified" | sed 's/^/     /'
  die "فایل‌های بالا روی سرور دست‌خورده‌اند و به‌روزرسانی خرابشان می‌کند." \
      "اگر عمدی‌اند، جایی نگهشان دار. اگر نه، برشان گردان:" \
      "  cd $APP_DIR && sudo -u $APP_USER git checkout ."
fi
ok "فایل ردیابی‌شده‌ی دست‌خورده‌ای نیست"

untracked=$(git status --porcelain 2>/dev/null | grep -c '^??')
(( untracked > 0 )) && info "$untracked فایل ردیابی‌نشده هست (کاری‌شان نداریم)"

current=$(git rev-parse --short HEAD)
BRANCH=${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}
info "شاخه: $BRANCH • نسخه‌ی فعلی: $current"

# ─── ۰.۵ پوشه‌های آپلود ───────────────────────────────────────
# اگر نباشند یا مالکشان کاربر برنامه نباشد، آپلود عکس بی‌صدا شکست
# می‌خورد. ارزان است، پس هر بار چک می‌شود.
step "پوشه‌های تصاویر"
if [[ $(id -u) -eq 0 ]] && id -u "$APP_USER" >/dev/null 2>&1; then
  mkdir -p "$APP_DIR/storage/public" "$APP_DIR/storage/private" "$APP_DIR/public/uploads"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR/storage" "$APP_DIR/public/uploads"
  chmod 755 "$APP_DIR/storage/public" "$APP_DIR/public/uploads"
  # عکس پرونده‌ی پزشکی: فقط خودِ برنامه
  chmod 700 "$APP_DIR/storage/private"
  ok "ساخته و مالکیتشان درست شد"
else
  warn "بدون root اجرا می‌شود — مالکیت پوشه‌ها چک نشد"
fi

# ─── ۱. پشتیبان ────────────────────────────────────────────────
# قبل از هر چیز، چون مهاجرت دیتابیس برگشت‌پذیر نیست.
step "پشتیبان‌گیری (قبل از دست‌زدن به دیتابیس)"
if as_app npm run backup --silent -- --light 2>&1 | sed 's/^/     /'; then
  ok "پشتیبان گرفته شد"
else
  warn "پشتیبان‌گیری جواب نداد."
  read -r -p "     بدون پشتیبان ادامه بدهم؟ (yes/no) " answer
  [[ $answer == yes ]] || die "متوقف شد. اول بفهم چرا پشتیبان‌گیری کار نمی‌کند."
fi

# ─── ۲. گرفتن کد ───────────────────────────────────────────────
step "گرفتن آخرین نسخه"
as_app git fetch origin "$BRANCH" 2>&1 | sed 's/^/     /' \
  || die "git fetch نشد — اینترنت سرور یا دسترسی گیت‌هاب را چک کن."

target=$(git rev-parse --short FETCH_HEAD)
if [[ $current == "$target" ]]; then
  ok "کد از قبل به‌روز است ($current)"
  pulled=0
else
  count=$(git rev-list --count "HEAD..FETCH_HEAD")
  info "$count کامیت تازه:"
  git log --oneline --no-decorate "HEAD..FETCH_HEAD" | head -25 | sed 's/^/       • /'
  (( count > 25 )) && info "... و $((count - 25)) کامیت دیگر"
  # خروجی خودِ merge عمداً بلعیده می‌شود: با یک ماه کامیت، diffstat
  # صدها خط است و کامیت‌ها را که همین بالا نشان دادیم.
  if ! merge_out=$(as_app git merge --ff-only FETCH_HEAD 2>&1); then
    printf '%s\n' "$merge_out" | tail -10 | sed 's/^/     /'
    die "merge نشد." "احتمالاً روی سرور کامیت محلی هست. بررسی کن:" "  git log --oneline -5"
  fi
  changed=$(git diff --name-only "$current" HEAD | wc -l)
  info "$changed فایل عوض شد"
  ok "رسید به $target"
  pulled=1
fi

# ─── ۳. پکیج‌ها ────────────────────────────────────────────────
# npm ci چند دقیقه طول می‌کشد؛ فقط وقتی لازم است که قفل عوض شده باشد.
step "پکیج‌ها"
if [[ ! -d node_modules ]]; then
  info "node_modules نیست — نصب کامل (چند دقیقه طول می‌کشد)"
  need_install=1
elif [[ $pulled -eq 1 ]] && ! git diff --quiet "$current" HEAD -- package-lock.json package.json; then
  info "لیست پکیج‌ها عوض شده — نصب دوباره"
  need_install=1
else
  ok "پکیج‌ها تغییری نکرده‌اند — رد می‌شویم"
  need_install=0
fi

if [[ $need_install -eq 1 ]]; then
  as_app npm ci 2>&1 | tail -5 | sed 's/^/     /' \
    || die "npm ci شکست خورد." "اگر خطا شبکه است، دوباره بزن. اگر جای دیسک کم است:  df -h /"
  ok "پکیج‌ها نصب شدند"
fi

# ─── ۴. مهاجرت دیتابیس ─────────────────────────────────────────
step "ساختار دیتابیس"
migrate_out=$(as_app npx prisma migrate deploy 2>&1)
printf '%s\n' "$migrate_out" | grep -E "migration|Applying|No pending|successfully" | tail -6 | sed 's/^/     /'
if printf '%s\n' "$migrate_out" | grep -qiE "error|failed"; then
  printf '%s\n' "$migrate_out" | tail -20 | sed 's/^/     /'
  die "مهاجرت دیتابیس شکست خورد." \
      "دیتابیس ممکن است نیمه‌کاره مانده باشد. پشتیبانِ همین الان را داری." \
      "قبل از هر کار دیگر، متن خطای بالا را بفرست."
fi
as_app npx prisma generate >/dev/null 2>&1
STAGE=migrated
ok "ساختار دیتابیس به‌روز است"

# ─── ۵. بیلد ───────────────────────────────────────────────────
step "ساختن نسخه‌ی تازه"
swap=$(free -m | awk '/Swap:/{print $2}')
if (( swap == 0 )) && [[ ${ALLOW_NO_SWAP:-0} != 1 ]]; then
  die "سرور swap ندارد و next build وسط کار کشته می‌شود." \
      "یک‌بار برای همیشه بساز:" \
      "  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile" \
      "  sudo mkswap /swapfile && sudo swapon /swapfile" \
      "  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab" \
      "" \
      "اگر مطمئنی حافظه کافی است:  ALLOW_NO_SWAP=1 sudo -E bash $APP_DIR/deploy/update.sh"
fi
info "swap: ${swap} مگابایت • این قدم ۲ تا ۵ دقیقه طول می‌کشد"

if as_app npm run build 2>&1 | tail -6 | sed 's/^/     /'; then
  ok "بیلد تمام شد"
else
  die "بیلد شکست خورد — سرویس ری‌استارت نشد و نسخه‌ی قبلی هنوز بالاست." \
      "اگر بدون پیام خطا قطع شد، یعنی حافظه کم آمده. لاگ را ببین:" \
      "  journalctl -k --no-pager | grep -i 'out of memory' | tail -3"
fi

[[ -f .next/BUILD_ID ]] || die "بیلد تمام شد ولی .next/BUILD_ID نیست — بیلد ناقص است." \
  "پوشه را کامل پاک کن و دوباره بزن:" \
  "  sudo -u $APP_USER rm -rf $APP_DIR/.next && sudo bash $APP_DIR/deploy/update.sh"

# ─── ۶. ری‌استارت ──────────────────────────────────────────────
step "ری‌استارت سرویس"
# صرفِ وجودِ فرمان systemctl کافی نیست — در کانتینر هم هست ولی کار
# نمی‌کند. این پوشه فقط وقتی هست که systemd واقعاً PID 1 باشد.
if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
  systemctl restart "$SERVICE" || die "systemctl restart $SERVICE خطا داد." \
    "  journalctl -u $SERVICE -n 30 --no-pager"

  # صبر می‌کنیم تا واقعاً جواب بدهد؛ «restart موفق» یعنی فرمان رفت،
  # نه اینکه برنامه بالا آمد
  for _ in $(seq 1 30); do
    sleep 1
    code=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/" 2>/dev/null)
    [[ $code == 200 ]] && break
  done
  if [[ ${code:-000} == 200 ]]; then
    ok "برنامه بالا آمد"
  else
    die "سرویس ری‌استارت شد ولی جواب نمی‌دهد (کد ${code:-000})." \
        "  journalctl -u $SERVICE -n 40 --no-pager"
  fi
else
  warn "systemd روی این ماشین اجرا نمی‌شود — ری‌استارت رد شد"
fi

# ─── ۷. چکاپ ───────────────────────────────────────────────────
step "چکاپ نهایی"
healthy=unknown
if [[ -f deploy/doctor.sh ]]; then
  doctor_log=$(mktemp)
  bash deploy/doctor.sh 2>&1 | tee "$doctor_log"
  # «تمام شد» سبز، در حالی که بالایش ۱۳ مشکل نوشته، بدترین نوع گزارش
  # است: کاربر خط آخر را می‌خواند و خیالش راحت می‌شود.
  if grep -q "همه چیز سالم است" "$doctor_log"; then
    healthy=yes
  else
    healthy=no
    problems=$(grep -oP '^\s+\K\d+(?= مشکل پیدا شد)' "$doctor_log" | head -1)
  fi
  rm -f "$doctor_log"
else
  warn "doctor.sh پیدا نشد"
fi

version=$(git rev-parse --short HEAD)
case $healthy in
  yes)
    printf '\n\033[1;32m✔ به‌روزرسانی تمام شد و همه‌چیز سالم است — %s\033[0m\n\n' "$version"
    ;;
  no)
    printf '\n\033[1;33m▲ به‌روزرسانی انجام شد (%s) ولی چکاپ %s مشکل دید.\033[0m\n' \
      "$version" "${problems:-چند}"
    printf '  فهرست مشکل‌ها همین بالاست — همان را بفرست.\n\n'
    ;;
  *)
    printf '\n\033[1;32m✔ به‌روزرسانی تمام شد — %s\033[0m\n\n' "$version"
    ;;
esac
