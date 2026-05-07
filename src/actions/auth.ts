"use server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type LoginState = { error?: string } | undefined;

export async function login(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { error: error?.message ?? "Login failed. Check your credentials." };
  }

  const session = data.session;
  const expiresAt = new Date(session.expires_at! * 1000);
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isProduction = process.env.NODE_ENV === "production";

  const cookieStore = await cookies();

  cookieStore.set("sb-access-token", session.access_token, {
    httpOnly: true,
    secure: isProduction,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("sb-refresh-token", session.refresh_token!, {
    httpOnly: true,
    secure: isProduction,
    expires: thirtyDays,
    sameSite: "lax",
    path: "/",
  });

  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");
  redirect("/login");
}
