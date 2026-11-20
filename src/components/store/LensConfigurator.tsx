import { useMemo, useRef, useState } from "react";
import { Check, FileImage, MessageCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Frame, LensOption, PublicStore } from "@/lib/eyewear";
import { formatPrice } from "@/lib/eyewear";
import { buildConsultMessage, lensTotal, whatsappLink, type LensSelection } from "@/lib/whatsapp";
import { fileExt } from "@/lib/storage";
import { logEvent } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "usage", title: "استخدام العدسة" },
  { key: "index", title: "سُمك العدسة" },
  { key: "coating", title: "الطبقات الإضافية" },
] as const;

export function LensConfigurator({
  store,
  frame,
  options,
  shareId,
}: {
  store: PublicStore;
  frame: Frame;
  options: LensOption[];
  shareId: string | null;
}) {
  const byStep = useMemo(() => {
    const g: Record<string, LensOption[]> = { usage: [], index: [], coating: [] };
    for (const o of options) g[o.step]?.push(o);
    return g;
  }, [options]);
  const [sel, setSel] = useState<LensSelection>(() => ({
    usage: byStep["usage"]?.find((o) => o.code === "distance") ?? byStep["usage"]?.[0] ?? null,
    index: byStep["index"]?.[0] ?? null,
    coating: byStep["coating"]?.[0] ?? null,
  }));
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const frameOnly = sel.usage?.code === "frame_only";
  const total = lensTotal(frame.price, sel);

  async function consult() {
    if (!store.whatsapp_number) return void toast.error("المحل لسه ماضافش رقم واتساب");
    setBusy(true);
    try {
      const reqId = crypto.randomUUID();
      let prescriptionPath: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("حجم الروشتة أكبر من 10 ميجا");
        prescriptionPath = `${store.id}/${reqId}.${fileExt(file)}`;
        const { error } = await supabase.storage.from("prescriptions").upload(prescriptionPath, file, { contentType: file.type });
        if (error) throw new Error("تعذر رفع الروشتة");
      }
      const pick = (o?: LensOption | null) => (o ? { code: o.code, name: o.name, price: o.price } : null);
      const { error } = await supabase.from("consultation_requests").insert({
        id: reqId,
        store_id: store.id,
        frame_id: frame.id,
        share_id: shareId,
        lens_config: { usage: pick(sel.usage), index: frameOnly ? null : pick(sel.index), coating: frameOnly ? null : pick(sel.coating) },
        total_price: total,
        prescription_path: prescriptionPath,
        customer_note: note.slice(0, 500) || null,
      });
      if (error) console.warn(error.message);
      logEvent(store.id, "whatsapp", frame.id);
      const msg = buildConsultMessage({
        storeName: store.name,
        frame,
        selection: sel,
        shareUrl: shareId ? `${window.location.origin}/t/${shareId}` : null,
        prescriptionAttached: !!prescriptionPath,
        requestRef: reqId.slice(0, 8).toUpperCase(),
        note: note || null,
      });
      window.location.href = whatsappLink(store.whatsapp_number, msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حصل خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {STEPS.map((step, i) => {
        const disabled = step.key !== "usage" && frameOnly;
        const list = byStep[step.key] ?? [];
        if (list.length === 0) return null;
        return (
          <fieldset key={step.key} disabled={disabled} className={cn("transition-opacity", disabled && "opacity-40")}>
            <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
              {step.title}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((o) => {
                const active = sel[step.key]?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSel((s) => ({ ...s, [step.key]: o }))}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border bg-card p-3 text-start transition-colors",
                      active ? "border-brand ring-1 ring-brand" : "hover:bg-muted",
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", active && "border-brand bg-brand text-brand-foreground")}>
                      {active && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{o.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{o.price > 0 ? `+${formatPrice(o.price)}` : "مجاناً"}</span>
                      </span>
                      {o.description && <span className="mt-0.5 block text-xs text-muted-foreground">{o.description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {!frameOnly && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">4</span>
            الروشتة (اختياري)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <FileImage className="h-5 w-5 text-brand" />
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="إزالة الروشتة" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground hover:bg-muted"
            >
              <Upload className="h-4 w-4" /> ارفع صورة الروشتة
            </button>
          )}
        </div>
      )}

      <Textarea placeholder="ملاحظة للمحل (مثلاً: محتاج المقاس يوم الخميس)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />

      <div className="rounded-2xl bg-ink p-5 text-ink-foreground">
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>الإطار</span>
          <span>{formatPrice(frame.price)}</span>
        </div>
        {sel.usage && sel.usage.price > 0 && (
          <div className="mt-1 flex items-center justify-between text-sm text-ink-muted">
            <span>{sel.usage.name}</span>
            <span>+{formatPrice(sel.usage.price)}</span>
          </div>
        )}
        {!frameOnly && sel.index && sel.index.price > 0 && (
          <div className="mt-1 flex items-center justify-between text-sm text-ink-muted">
            <span>{sel.index.name}</span>
            <span>+{formatPrice(sel.index.price)}</span>
          </div>
        )}
        {!frameOnly && sel.coating && sel.coating.price > 0 && (
          <div className="mt-1 flex items-center justify-between text-sm text-ink-muted">
            <span>{sel.coating.name}</span>
            <span>+{formatPrice(sel.coating.price)}</span>
          </div>
        )}
        <div className="my-3 hairline" />
        <div className="flex items-baseline justify-between">
          <span>الإجمالي التقديري</span>
          <span className="font-display text-2xl">{formatPrice(total)}</span>
        </div>
        <Button variant="whatsapp" size="xl" className="mt-4 w-full whitespace-normal py-3 leading-snug" disabled={busy} onClick={consult}>
          <MessageCircle />
          {busy ? "جاري التجهيز..." : "استفسر من خبير البصريات عبر واتساب"}
        </Button>
        <p className="mt-2 text-center text-[11px] text-ink-muted">هنبعت للمحل اسم الإطار والعدسات{shareId ? " ولينك صورتك بالنظارة" : ""}.</p>
      </div>
    </div>
  );
}
