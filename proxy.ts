import { NextRequest, NextResponse } from "next/server";

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the login page through unconditionally
  if (pathname === "/login") {
    const accessToken = req.cookies.get("sb-access-token")?.value;
    if (accessToken) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  // Every other route requires an authenticated session
  const accessToken = req.cookies.get("sb-access-token")?.value;
  if (!accessToken) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|ico|jpg|jpeg|gif|webp)$).*)",
  ],
};
