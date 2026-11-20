import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Camera, ExternalLink, LogOut, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "لوحة التحكم | عدسة" },
      { name: "description", content: "لوحة تحكم متجر النظارات الخاص بك على عدسة." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const [, setUser] = useState<User | null>(user);

  useEffect(() => {
    setUser(user);
  }, [user]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl">أهلاً بك في لوحة التحكم</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          من هنا تقدر تدير متجرك، تضيف نظاراتك، وتشوف الإحصائيات.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="group rounded-3xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-lift"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft text-primary">
              <Store className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg">إعداد متجرك</h2>
            <p className="mt-1 text-sm text-muted-foreground">أضف اسم المتجر، اللينك، رقم الواتساب، والألوان.</p>
          </Link>

          <Link
            to="/s/$slug"
            params={{ slug: "demo" }}
            className="group rounded-3xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-lift"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft text-primary">
              <Camera className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg">المتجر التجريبي</h2>
            <p className="mt-1 text-sm text-muted-foreground">شوف شكل متجرك وجرّب التجربة الافتراضية.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> افتح
            </span>
          </Link>

          <div className="rounded-3xl border bg-card p-6 shadow-soft">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft text-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg">الإحصائيات</h2>
            <p className="mt-1 text-sm text-muted-foreground">قريباً: عدد التجارب، الطلبات، وأكثر الموديلات طلباً.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
