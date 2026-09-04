import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "sharzad_session";

/**
 * محافظت از مسیرهای /admin.
 * فقط اعتبار توکن بررسی می‌شود؛ بررسی نقش در خود صفحات انجام می‌گیرد.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // صفحه‌های ورود و بازیابی رمز باید بدون نشست باز شوند
  if (pathname === "/admin/login" || pathname === "/admin/forgot") {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET;

  if (token && secret && secret.length >= 32) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      // توکن منقضی یا دستکاری‌شده
    }
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
