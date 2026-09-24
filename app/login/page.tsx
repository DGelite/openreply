"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Purge any stale or invalid JWE cookies to avoid redirect loops
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});

      const result = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("نام کاربری یا رمز عبور وارد شده اشتباه است.");
        setLoading(false);
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      } else {
        setError("خطایی در ورود به سیستم رخ داد. لطفاً مجدداً تلاش کنید.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Login submit error:", err);
      setError("خطای ارتباط با سرور. لطفاً مجدداً تلاش کنید.");
      setLoading(false);
    }
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-5 px-4 py-3 rounded-lg border text-sm text-center"
          style={{
            background: "rgba(248,113,113,0.08)",
            borderColor: "rgba(248,113,113,0.25)",
            color: "var(--color-error)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-sm font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            نام کاربری یا ایمیل
          </label>
          <input
            id="username"
            type="text"
            required
            dir="ltr"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            style={{
              background: "var(--color-background)",
              borderColor: "var(--color-border)",
              color: "var(--color-foreground)",
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border text-sm placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium"
            style={{ color: "var(--color-foreground)" }}
          >
            رمز عبور
          </label>
          <input
            id="password"
            type="password"
            required
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              background: "var(--color-background)",
              borderColor: "var(--color-border)",
              color: "var(--color-foreground)",
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border text-sm placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          id="login-submit"
          disabled={loading}
          className="w-full mt-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{
            background: "var(--color-accent)",
            color: "#fff",
          }}
          onMouseEnter={(e) =>
            !loading &&
            ((e.currentTarget.style.background) = "var(--color-accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget.style.background) = "var(--color-accent)")
          }
        >
          {loading ? "در حال ورود..." : "ورود به سیستم"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-background)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              style={{ color: "var(--color-accent)" }}
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--color-foreground)" }}
          >
            OpenReply
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            ورود به پنل مدیریت
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Suspense
            fallback={
              <div
                className="text-center text-sm"
                style={{ color: "var(--color-muted)" }}
              >
                در حال بارگذاری...
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
