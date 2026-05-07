import { NextRequest, NextResponse } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/inventory",
  "/stock-in",
  "/sell",
  "/sales",
  "/purchases",
  "/settings",
];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isLoginPage = pathname.startsWith("/login");

  const accessToken = req.cookies.get("sb-access-token")?.value;
  const isAuthenticated = Boolean(accessToken);

  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"],
};
