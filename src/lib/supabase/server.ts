import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
    }
  );

  if (accessToken && refreshToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const {
      data: { session },
    } = await client.auth.getSession();

    if (session && session.access_token !== accessToken) {
      const isProduction = process.env.NODE_ENV === "production";
      const expiresAt = new Date(session.expires_at! * 1000);
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      cookieStore.set("sb-access-token", session.access_token, {
        httpOnly: true,
        secure: isProduction,
        expires: expiresAt,
        sameSite: "lax",
        path: "/",
      });

      if (session.refresh_token) {
        cookieStore.set("sb-refresh-token", session.refresh_token, {
          httpOnly: true,
          secure: isProduction,
          expires: thirtyDays,
          sameSite: "lax",
          path: "/",
        });
      }
    }
  }

  return client;
}
