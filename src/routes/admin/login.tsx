import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { AdminField, adminInput } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Turnstile, turnstileReady } from "@/components/site/Turnstile";
import { getViewer } from "@/lib/auth.functions";
import { supabaseBrowser } from "@/lib/supabase.browser";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Detty Sky" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { denied?: boolean } =>
    s["denied"] ? { denied: true } : {},
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const router = useRouter();
  const { denied } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(denied ? "That account isn't an admin." : "");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const sb = supabaseBrowser();
          const { error: err } = await sb.auth.signInWithPassword({
            email: email.trim(),
            password,
            ...(captcha ? { options: { captchaToken: captcha } } : {}),
          });
          setCaptchaReset((n) => n + 1);
          if (err) {
            setBusy(false);
            setError(/invalid login/i.test(err.message) ? "Wrong email or password." : err.message);
            return;
          }
          // Same check the /admin guard does, so a customer account gets a clear message.
          const viewer = await getViewer();
          setBusy(false);
          if (viewer?.role !== "admin") {
            await sb.auth.signOut();
            setError("That account isn't an admin.");
            return;
          }
          await router.invalidate();
          nav({ to: "/admin" });
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-display font-bold">
            Detty<span className="text-gold-gradient">Sky</span> Admin
          </span>
        </div>
        <h1 className="mt-6 text-xl">Sign in</h1>
        <div className="mt-5 space-y-4">
          <AdminField label="Email" htmlFor="ad-email">
            <input
              id="ad-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Password" htmlFor="ad-pw">
            <input
              id="ad-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className={adminInput}
            />
          </AdminField>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} action="admin-login" />
          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={busy || !turnstileReady(captcha)}
          >
            <Lock /> Sign in
          </Button>
        </div>
      </form>
    </div>
  );
}
