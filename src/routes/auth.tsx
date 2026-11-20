import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import heroImg from "@/assets/hero-glasses.jpg";

const searchSchema = z.object({ redirect: z.string().optional(), mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | عدسة" },
      { name: "description", content: "سجّل دخولك أو أنشئ حساب لمحل النظارات الخاص بك على منصة عدسة." },
      { property: "og:title", content: "تسجيل الدخول | عدسة" },
      { property: "og:description", content: "ادخل لوحة تحكم متجر النظارات الخاص بك." },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(r?: string) {
  if (!r) return "/dashboard";
  try {
    const u = new URL(r, window.location.origin);
    if (u.origin !== window.location.origin) return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

const GoogleG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (search.redirect) sessionStorage.setItem("adasa:after-auth", search.redirect);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safeRedirect(search.redirect ?? sessionStorage.getItem("adasa:after-auth") ?? undefined) });
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const target = safeRedirect(sessionStorage.getItem("adasa:after-auth") ?? search.redirect);
        sessionStorage.removeItem("adasa:after-auth");
        navigate({ to: target });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, search.redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return void toast.error("اكتب البريد الإلكتروني");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("بعتنالك رابط لإعادة تعيين كلمة المرور على بريدك.");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("كلمة المرور لازم تكون 8 حروف على الأقل");
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
        if (error) throw error;
        setSent("تم إنشاء الحساب! افتح بريدك واضغط رابط التأكيد، وبعدها سجّل دخولك.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حصل خطأ";
      toast.error(msg.includes("Invalid login") ? "البريد أو كلمة المرور غير صحيحة" : msg);
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error("تعذر تسجيل الدخول، حاول مرة أخرى");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <BrandMark />
          <h1 className="mt-10 text-3xl text-foreground">
            {mode === "signup" ? "أنشئ متجرك على عدسة" : mode === "forgot" ? "استعادة كلمة المرور" : "أهلاً بعودتك"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup" ? "تجربة مجانية 14 يوم، بدون أي بيانات دفع." : "ادخل لوحة تحكم محل النظارات بتاعك."}
          </p>

          {sent ? (
            <div className="mt-8 rounded-2xl border border-gold/40 bg-gold-soft/40 p-5 text-sm leading-7 text-foreground">{sent}</div>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="mt-8 grid gap-3">
                  <Button type="button" variant="outline" size="lg" className="w-full rounded-full" onClick={() => social("google")}>
                    <GoogleG />
                    المتابعة باستخدام Google
                  </Button>
                  <Button type="button" variant="outline" size="lg" className="w-full rounded-full" onClick={() => social("lovable")}>
                    <LovableMark />
                    المتابعة باستخدام Lovable
                  </Button>
                  <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    أو بالبريد الإلكتروني
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                </div>
                {mode !== "forgot" && (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">كلمة المرور</Label>
                      {mode === "signin" && (
                        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                          نسيت كلمة المرور؟
                        </button>
                      )}
                    </div>
                    <Input id="password" type="password" dir="ltr" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                  </div>
                )}
                <Button type="submit" variant="ink" size="lg" disabled={busy} className="mt-2 w-full">
                  {busy ? "جاري..." : mode === "signup" ? "إنشاء الحساب" : mode === "forgot" ? "إرسال الرابط" : "تسجيل الدخول"}
                </Button>
              </form>
            </>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "عندك حساب؟ " : "لسه معندكش حساب؟ "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setSent(null);
                setMode(mode === "signup" ? "signin" : "signup");
              }}
            >
              {mode === "signup" ? "سجّل دخول" : "ابدأ تجربتك المجانية"}
            </button>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <img src={heroImg} alt="نظارة فاخرة على قاعدة حجرية" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/60 to-transparent p-12">
          <p className="font-display text-3xl leading-snug text-ink-foreground">"عملائنا بقوا يجربوا النظارة من البيت، ويجوا المحل وهما عارفين عايزين إيه."</p>
          <p className="mt-3 text-sm text-ink-muted">— صاحب محل بصريات، الإسكندرية</p>
        </div>
      </div>
    </div>
  );
}
