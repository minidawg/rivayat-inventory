"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";
import { Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-primary/3 blur-3xl" />
        <div className="absolute top-0 left-0 h-48 w-48 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 mb-5">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground">
            Rivayat
          </h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/60 mt-1">
            Fashion Lounge
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Access your inventory dashboard</p>
          </div>

          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email"
                className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Email address
              </label>
              <input
                id="email" name="email" type="email"
                autoComplete="email" required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password"
                className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Password
              </label>
              <input
                id="password" name="password" type="password"
                autoComplete="current-password" required
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>

            {state?.error && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3">
                <p className="text-sm text-destructive">{state.error}</p>
              </div>
            )}

            <button
              type="submit" disabled={pending}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground/30">
          Inventory Management System · v1.4
        </p>
      </div>
    </div>
  );
}
