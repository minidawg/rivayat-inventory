// NOTE: Requires SUPABASE_JWT_SECRET in .env.local
// Find it at: Supabase Dashboard → Settings → API → JWT Secret
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

async function isTokenValid(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get("sb-access-token")?.value;

  if (pathname === "/login") {
    if (accessToken && (await isTokenValid(accessToken))) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!accessToken || !(await isTokenValid(accessToken))) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|ico|jpg|jpeg|gif|webp)$).*)",
  ],
};