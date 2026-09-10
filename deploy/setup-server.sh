#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
#  راه‌اندازی سرور از صفر — Ubuntu 24.04
#
#  اجرا (با کاربر root):
#    bash deploy/setup-server.sh
#
#  چند بار هم اجرا شود مشکلی ندارد: هر کاری که قبلاً انجام شده رد می‌شود.
#  هیچ‌وقت دیتابیس موجود را پاک نمی‌کند.
# ───────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP_USER=sharzad
APP_DIR=/var/www/sharzad
DB_NAME=sharzad
DB_USER=sharzad
REPO=https://github.com/amirhosein13/sharzadclinic.git
BRANCH=claude/beauty-clinic-website-7ej1e7

ok()   { echo -e "\033[32m✅\033[0m $*"; }
info() { echo -e "\033[36m▸\033[0m  $*"; }
warn() { echo -e "\033[33m⚠️\033[0m  $*"; }
die()  { echo -e "\033[31m❌\033[0m $*" >&2; exit 1; }

trap 'die "خطا در خط $LINENO. چیزی نصفه‌کاره ماند — پیام بالا را بفرست."' ERR

[[ $EUID -eq 0 ]] || die "این اسکریپت را با کاربر root اجرا کن."
. /etc/os-release
[[ "${VERSION_ID:-}" == "24.04" ]] || warn "این اسکریپت روی Ubuntu 24.04 نوشته شده (تو: ${VERSION_ID:-نامعلوم})."

# ─── ۰) گرفتن اطلاعات ────────────────────────────────────────
read -rp "دامنه (بدون www و بدون https)، مثلاً shahrzadlaser.ir : " DOMAIN
[[ -n "$DOMAIN" ]] || die "دامنه لازم است."
read -rp "ایمیل برای گواهی SSL (هشدار انقضا به این می‌آید): " SSL_EMAIL
[[ -n "$SSL_EMAIL" ]] || die "ایمیل لازم است."
read -rp "ایمیل ورود مدیر به پنل [admin@$DOMAIN]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@$DOMAIN}

echo
info "دامنه: $DOMAIN | مدیر: $ADMIN_EMAIL"
read -rp "درست است؟ (y/n) " -n1 CONFIRM; echo
[[ "$CONFIRM" == "y" ]] || die "لغو شد."

# ─── ۱) بسته‌های پایه ────────────────────────────────────────
# سرور تازه‌نصب معمولاً وسط unattended-upgrades است و قفل apt را گرفته.
# به‌جای خطا دادن، صبر می‌کنیم.
# نکته: با نام پردازه (pgrep -f unattended-upgr) چک نکن — الگو داخل خطِ
# فرمانِ خودِ همین حلقه هم هست و pgrep خودش را می‌بیند، پس حلقه هیچ‌وقت
# تمام نمی‌شود. خودِ قفل را چک می‌کنیم که شرطِ واقعی هم همان است.
apt_locked() {
  if command -v fuser >/dev/null 2>&1; then
    fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
      || fuser /var/lib/apt/lists/lock >/dev/null 2>&1
  else
    # اگر psmisc نصب نباشد، از روی پردازه — با کروشه تا خودش را نگیرد
    pgrep -f "[u]nattended-upgr" >/dev/null 2>&1 \
      || pgrep -x "[a]pt-get" >/dev/null 2>&1
  fi
}

wait_for_apt() {
  local waited=0
  while apt_locked; do
    if [[ $waited -eq 0 ]]; then
      info "به‌روزرسانی خودکار اوبونتو در حال اجراست — صبر می‌کنیم (چند دقیقه)..."
    fi
    sleep 5
    waited=$((waited + 5))
    if [[ $waited -ge 900 ]]; then
      die "۱۵ دقیقه صبر کردیم و قفل apt آزاد نشد. سرور را ری‌استارت کن و دوباره بزن."
    fi
  done
  [[ $waited -gt 0 ]] && ok "قفل apt آزاد شد (${waited} ثانیه صبر)"
  return 0
}

info "به‌روزرسانی سیستم..."
export DEBIAN_FRONTEND=noninteractive
wait_for_apt
apt-get update -qq
wait_for_apt
apt-get upgrade -y -qq
wait_for_apt
apt-get install -y -qq curl git ufw nginx postgresql postgresql-contrib \
  unzip ca-certificates gnupg openssl fail2ban certbot python3-certbot-nginx
ok "بسته‌های پایه نصب شد"

# ─── ۲) Node.js 22 ───────────────────────────────────────────
# مخزن خود اوبونتو ۲۴.۰۴ نسخه‌ی ۱۸ دارد که برای این پروژه قدیمی است
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  info "نصب Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  wait_for_apt
  apt-get install -y -qq nodejs
fi
ok "Node $(node -v)"

# اگر رجیستری npm از داخل ایران باز نشد، آینه‌ی جایگزین
if ! timeout 20 npm ping >/dev/null 2>&1; then
  warn "registry.npmjs.org جواب نداد — آینه‌ی جایگزین تنظیم شد."
  npm config set registry https://registry.npmmirror.com --location=global
fi

# ─── ۳) فایروال ──────────────────────────────────────────────
# ⚠️ خطرناک‌ترین قسمت اسکریپت: اگر پورت SSH را باز نکنیم و فایروال را
#    روشن کنیم، همان لحظه از سرور بیرون می‌افتیم و راه برگشتی نیست.
#    بعضی ارائه‌دهنده‌ها (مثل ایران‌سرور) SSH را روی پورت غیر از ۲۲
#    می‌گذارند، پس نباید ۲۲ را فرض کرد — باید پیدایش کرد.
detect_ssh_ports() {
  local ports=""

  # معتبرترین منبع: خودِ sshd می‌گوید روی چه پورتی گوش می‌دهد
  if command -v sshd >/dev/null 2>&1; then
    ports=$(sshd -T 2>/dev/null | awk '/^port /{print $2}')
  fi

  # اگر نشد، از سوکت‌های در حال گوش‌دادن
  if [[ -z "$ports" ]] && command -v ss >/dev/null 2>&1; then
    ports=$(ss -tlnpH 2>/dev/null | awk '/sshd/{split($4,a,":"); print a[length(a)]}' | sort -u)
  fi

  # پورتی که همین الان از آن وصل شده‌ایم، همیشه باید باز بماند
  # SSH_CONNECTION = "آی‌پی‌مبدأ پورت‌مبدأ آی‌پی‌مقصد پورت‌مقصد"
  if [[ -n "${SSH_CONNECTION:-}" ]]; then
    ports="$ports $(awk '{print $4}' <<<"$SSH_CONNECTION")"
  fi

  [[ -z "${ports// /}" ]] && ports=22
  tr ' ' '\n' <<<"$ports" | grep -E '^[0-9]+$' | sort -un | tr '\n' ' '
}

SSH_PORTS=$(detect_ssh_ports)
info "پورت(های) SSH پیداشده: $SSH_PORTS"

for port in $SSH_PORTS; do
  ufw allow "$port/tcp" >/dev/null
done
ufw allow 'Nginx Full' >/dev/null

# آخرین بررسی: اگر به هر دلیلی پورتِ اتصال فعلی در فهرست نیست، فایروال
# را اصلاً روشن نکن. قفل‌شدن بیرون از سرور بدتر از نداشتن فایروال است.
if [[ -n "${SSH_CONNECTION:-}" ]]; then
  CURRENT_PORT=$(awk '{print $4}' <<<"$SSH_CONNECTION")
  if ! grep -qw "$CURRENT_PORT" <<<"$SSH_PORTS"; then
    die "پورت اتصال فعلی ($CURRENT_PORT) در فهرست نیست. فایروال روشن نشد تا قفل نشوی."
  fi
fi

ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null 2>&1 || true
ok "فایروال روشن شد — باز: ${SSH_PORTS}۸۰ و ۴۴۳"

# ─── ۴) کاربر برنامه ─────────────────────────────────────────
# برنامه با کاربر بی‌دسترسی اجرا می‌شود، نه root
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$APP_DIR" --shell /bin/bash "$APP_USER"
fi
mkdir -p "$APP_DIR"
ok "کاربر $APP_USER آماده است"

# ─── ۵) دیتابیس ──────────────────────────────────────────────
systemctl enable --now postgresql
DB_PASS_FILE=/root/.sharzad-db-pass
if [[ -f "$DB_PASS_FILE" ]]; then
  DB_PASS=$(cat "$DB_PASS_FILE")
  info "رمز دیتابیس از قبل ساخته شده بود"
else
  DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
  echo "$DB_PASS" > "$DB_PASS_FILE"; chmod 600 "$DB_PASS_FILE"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -qc "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
else
  # رمز را با چیزی که در .env می‌رود یکی نگه می‌داریم
  sudo -u postgres psql -qc "ALTER ROLE $DB_USER PASSWORD '$DB_PASS';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  ok "دیتابیس $DB_NAME ساخته شد"
else
  ok "دیتابیس $DB_NAME از قبل بود — دست نخورد"
fi

# ─── ۶) گرفتن کد ─────────────────────────────────────────────
# مخزن خصوصی است. اسکریپت از داخل یک نسخه‌ی گرفته‌شده اجرا می‌شود، پس
# همان را کپی می‌کنیم و دوباره سراغ گیت‌هاب نمی‌رویم — وگرنه کاربر باید
# دو بار توکن وارد کند.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SRC_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

# adduser پوشه‌ی خانه را به نام sharzad می‌سازد، ولی این مرحله با root
# اجرا می‌شود. گیت از نسخه‌ی ۲.۳۵ به بعد کار کردن روی مخزنی که مالکش
# کاربر دیگری است را رد می‌کند («dubious ownership») — حتی برای root.
# پس تا وقتی کارِ گیت تمام نشده، پوشه مال root است.
chown root:root "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
git config --global --add safe.directory "$SRC_DIR" 2>/dev/null || true

# آدرس واقعی مخزن: از نسخه‌ای که کاربر گرفته برمی‌داریم، وگرنه پیش‌فرض.
# مسیر محلی (‎/tmp/...) به‌درد origin نمی‌خورد چون بعداً پاک می‌شود.
ORIGIN=$(git -C "$SRC_DIR" remote get-url origin 2>/dev/null || echo "$REPO")
[[ "$ORIGIN" == /* ]] && ORIGIN="$REPO"

if [[ -d "$APP_DIR/.git" ]]; then
  info "به‌روزرسانی کد..."
  # اول origin را درست کن، بعد fetch — وگرنه ممکن است از مسیر موقتی بکشد
  git -C "$APP_DIR" remote set-url origin "$ORIGIN"
  git -C "$APP_DIR" fetch origin "$BRANCH" --quiet
  git -C "$APP_DIR" reset --hard "origin/$BRANCH" --quiet
else
  if git -C "$SRC_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    # کلونِ محلی: هیچ رمز و توکنی نمی‌خواهد، حتی اگر مخزن خصوصی باشد
    info "کپی کد از نسخه‌ای که همین الان گرفتی..."
    rm -rf "${APP_DIR:?}"/{*,.[!.]*} 2>/dev/null || true
    git clone --branch "$BRANCH" "$SRC_DIR" "$APP_DIR" --quiet
  else
    info "گرفتن کد از گیت‌هاب..."
    rm -rf "${APP_DIR:?}"/{*,.[!.]*} 2>/dev/null || true
    git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR" --quiet
  fi
  # origin باید به گیت‌هاب اشاره کند تا git pull بعدی کار کند
  git -C "$APP_DIR" remote set-url origin "$ORIGIN"
fi
ok "کد آماده است (origin: $ORIGIN)"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "کد روی سرور است"

# ─── ۷) فایل .env ────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  ok ".env از قبل بود — دست نخورد (رمزهایت جای امنی‌اند)"
else
  info "ساخت .env..."
  AUTH_SECRET=$(openssl rand -base64 32)
  # رمز پیش‌فرض (Admin@12345) در مخزن عمومی نوشته شده، پس روی سرور
  # نباید از آن استفاده شود. یک رمز تصادفی می‌سازیم و آخر کار نشان می‌دهیم.
  ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)
  cat > "$ENV_FILE" <<ENVEOF
# ساخته‌شده توسط deploy/setup-server.sh — $(date -u +%F)
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
AUTH_SECRET="$AUTH_SECRET"
NEXT_PUBLIC_SITE_URL="https://$DOMAIN"
ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
NODE_ENV="production"
TZ="Asia/Tehran"

# ─── پیامک (ملی پیامک) — از پنل ملی‌پیامک پر کن ───
SMS_PROVIDER="melipayamak"
MELIPAYAMAK_USERNAME=""
MELIPAYAMAK_PASSWORD=""
MELIPAYAMAK_FROM=""

# ─── درگاه پرداخت (زرین‌پال) ───
ZARINPAL_MERCHANT_ID=""
ZARINPAL_SANDBOX="true"

# ─── ایمیل (اختیاری) ───
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="کلینیک شهرزاد <no-reply@$DOMAIN>"

# ─── پشتیبان‌گیری ───
BACKUP_KEEP="14"
ENVEOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env ساخته شد (رمزها تصادفی و امن)"
fi

# ─── ۸) نصب و ساخت ───────────────────────────────────────────
# npm ci وقتی خروجی‌اش ترمینال واقعی نیست هیچ چیزی چاپ نمی‌کند و کاربر
# چند دقیقه به یک صفحه‌ی ساکت نگاه می‌کند و فکر می‌کند هنگ کرده.
# با --loglevel=http هر بسته‌ای که می‌آید یک خط می‌نویسد.
info "نصب پکیج‌ها (روی ۱ هسته ۳ تا ۸ دقیقه — خط‌های زیر یعنی در حال کار است)..."
sudo -u "$APP_USER" bash -lc "cd $APP_DIR && npm ci --no-audit --no-fund --loglevel=http"

info "ساخت جدول‌های دیتابیس..."
sudo -u "$APP_USER" bash -lc "cd $APP_DIR && npx prisma migrate deploy"

info "ساخت نسخه‌ی پروداکشن (روی ۱ هسته حدود ۳ دقیقه)..."
sudo -u "$APP_USER" bash -lc "cd $APP_DIR && npm run build"
ok "برنامه ساخته شد"

# داده‌ی اولیه فقط اگر دیتابیس خالی باشد — هیچ‌وقت روی داده‌ی واقعی نمی‌ریزد
CUSTOMERS=$(sudo -u postgres psql -tAd "$DB_NAME" -c "SELECT COUNT(*) FROM customers" 2>/dev/null || echo 0)
USERS=$(sudo -u postgres psql -tAd "$DB_NAME" -c "SELECT COUNT(*) FROM users" 2>/dev/null || echo 0)
if [[ "${USERS:-0}" -eq 0 ]]; then
  info "دیتابیس خالی است — داده‌ی اولیه ریخته می‌شود..."
  sudo -u "$APP_USER" bash -lc "cd $APP_DIR && npm run db:seed"
else
  ok "دیتابیس $CUSTOMERS مشتری دارد — داده‌ی اولیه ریخته نشد"
fi

# پوشه‌هایی که برنامه در آن‌ها می‌نویسد (طبق src/lib/upload.ts و backup.ts).
# باید قبل از اولین اجرا باشند، چون ProtectSystem=strict اجازه‌ی ساختِ
# پوشه‌ی تازه بیرون از ReadWritePaths را نمی‌دهد.
mkdir -p "$APP_DIR/public/uploads" "$APP_DIR/storage/private" "$APP_DIR/storage/backups"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/public/uploads" "$APP_DIR/storage"
chmod 700 "$APP_DIR/storage/private"   # عکس پرونده‌ی پزشکی — فقط خودِ برنامه

# ─── ۹) سرویس ────────────────────────────────────────────────
cp "$APP_DIR/deploy/sharzad.service" /etc/systemd/system/sharzad.service
systemctl daemon-reload
systemctl enable sharzad >/dev/null
systemctl restart sharzad
sleep 5
systemctl is-active --quiet sharzad || die "سرویس بالا نیامد. ببین چه می‌گوید: journalctl -u sharzad -n 50"
ok "سرویس روی پورت ۳۰۰۰ بالا آمد"

# ─── ۱۰) Nginx ───────────────────────────────────────────────
info "تنظیم Nginx..."
sed "s/DOMAIN/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/sharzad

# IPv6 فقط اگر سرور واقعاً داشته باشد؛ وگرنه nginx اصلاً بالا نمی‌آید
if [[ -f /proc/net/if_inet6 ]] && [[ -s /proc/net/if_inet6 ]]; then
  sed -i 's|^    # LISTEN_IPV6.*|    listen [::]:80;|' /etc/nginx/sites-available/sharzad
  ok "IPv6 دارد — روی هر دو گوش می‌دهد"
else
  info "سرور IPv6 ندارد — فقط IPv4"
fi

ln -sf /etc/nginx/sites-available/sharzad /etc/nginx/sites-enabled/sharzad
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 || die "تنظیمات nginx مشکل دارد: nginx -t"
systemctl reload nginx
ok "Nginx روی پورت ۸۰"

# ─── ۱۱) گواهی SSL ───────────────────────────────────────────
info "بررسی اینکه دامنه به این سرور اشاره می‌کند..."
SERVER_IP=$(curl -s --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)

if [[ "$DOMAIN_IP" != "$SERVER_IP" ]]; then
  warn "دامنه هنوز به این سرور اشاره نمی‌کند."
  warn "  IP سرور:  $SERVER_IP"
  warn "  IP دامنه: ${DOMAIN_IP:-هیچ}"
  warn "در پنل DNS رکورد A را روی $SERVER_IP بگذار، نیم ساعت صبر کن، بعد بزن:"
  warn "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --agree-tos -m $SSL_EMAIL --redirect"
else
  info "دامنه درست اشاره می‌کند — گرفتن گواهی SSL..."
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect || \
    warn "گرفتن گواهی نشد. بعداً دستی بزن: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  ok "SSL نصب شد و خودکار تمدید می‌شود"
fi

# ─── ۱۲) کارهای خودکار (cron) ────────────────────────────────
info "تنظیم کارهای خودکار..."
cat > /etc/cron.d/sharzad <<CRONEOF
# کارهای خودکار سایت کلینیک — ساعت‌ها به وقت تهران
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CRON_TZ=Asia/Tehran

# یادآوری نوبت فردا — هر روز ساعت ۱۰ صبح
0  10 * * *  $APP_USER  cd $APP_DIR && npm run reminders  >> /var/log/sharzad-cron.log 2>&1
# گزارش شبانه برای مدیر — هر شب ساعت ۲۲
0  22 * * *  $APP_USER  cd $APP_DIR && npm run digest     >> /var/log/sharzad-cron.log 2>&1
# ارسال دسته‌ای پیامک گروهی — هر ۱۵ دقیقه
*/15 *  * * *  $APP_USER  cd $APP_DIR && npm run campaign >> /var/log/sharzad-cron.log 2>&1
# پشتیبان سبک (بدون عکس) — هر شب ۲:۳۰
30 2  * * *  $APP_USER  cd $APP_DIR && npm run backup -- --light >> /var/log/sharzad-cron.log 2>&1
# پشتیبان کامل (با عکس‌ها) — جمعه‌ها ۳ صبح
0  3  * * 5  $APP_USER  cd $APP_DIR && npm run backup     >> /var/log/sharzad-cron.log 2>&1
CRONEOF
chmod 644 /etc/cron.d/sharzad
touch /var/log/sharzad-cron.log; chown "$APP_USER:$APP_USER" /var/log/sharzad-cron.log
ok "کارهای خودکار تنظیم شد"

# ─── تمام ────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════"
ok "راه‌اندازی تمام شد"
echo "═══════════════════════════════════════════════"
echo
echo "  سایت:      https://$DOMAIN"
echo "  پنل:       https://$DOMAIN/admin"
echo "  ایمیل:     $ADMIN_EMAIL"
if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  echo "  رمز:       $ADMIN_PASSWORD"
  echo "             ↑ همین حالا جایی امن ذخیره‌اش کن — دوباره نشان داده نمی‌شود"
else
  echo "  رمز:       همانی که در .env گذاشته بودی"
fi
echo
echo "  وضعیت سرویس:  systemctl status sharzad"
echo "  لاگ زنده:      journalctl -u sharzad -f"
echo "  رمز دیتابیس:   $DB_PASS_FILE"
echo
warn "قدم بعدی: در پنل → تنظیمات، اطلاعات کلینیک و ملی‌پیامک را پر کن."
