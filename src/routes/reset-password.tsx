import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | عدسة" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك على عدسة." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة | عدسة" },
      { property: "og:description", content: "اختر كلمة مرور جديدة لحسابك." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return void toast.error("كلمة المرور لازم تكون 8 حروف على الأقل");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("تم تغيير كلمة المرور");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-soft">
        <BrandMark />
        <h1 className="mt-8 text-2xl">كلمة مرور جديدة</h1>
        <div className="mt-6 grid gap-2">
          <Label htmlFor="pw">كلمة المرور الجديدة</Label>
          <Input id="pw" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" variant="ink" size="lg" disabled={busy} className="mt-6 w-full">حفظ</Button>
      </form>
    </div>
  );
}
