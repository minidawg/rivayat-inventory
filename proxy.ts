import { NextRequest, NextResponse } from "next/server";

function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Reject if expired (with a 10-second clock-skew buffer)
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000) - 10;
  } catch {
    return false;
  }
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get("sb-access-token")?.value;

  // Allow the login page through unconditionally
  if (pathname === "/login") {
    if (accessToken && isTokenValid(accessToken)) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  // Every other route requires a valid, unexpired session
  if (!accessToken || !isTokenValid(accessToken)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|ico|jpg|jpeg|gif|webp)$).*)",
  ],
};
