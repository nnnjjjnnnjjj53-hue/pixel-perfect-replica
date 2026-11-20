// Pure helpers for the lens configurator and WhatsApp consult message.
import type { Frame, LensOption } from "./eyewear";
import { formatPrice } from "./eyewear";

export interface LensSelection {
  usage?: LensOption | null;
  index?: LensOption | null;
  coating?: LensOption | null;
}

export function lensTotal(framePrice: number, sel: LensSelection): number {
  const frameOnly = sel.usage?.code === "frame_only";
  const parts = frameOnly
    ? [sel.usage?.price ?? 0]
    : [sel.usage?.price ?? 0, sel.index?.price ?? 0, sel.coating?.price ?? 0];
  return framePrice + parts.reduce((a, b) => a + Number(b), 0);
}

/** Digits only, Egyptian local numbers (01xxxxxxxxx) become 201xxxxxxxxx. */
export function normalizeWhatsapp(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("01")) d = "2" + d;
  return d;
}

export function buildConsultMessage(opts: {
  storeName: string;
  frame: Pick<Frame, "name" | "sku" | "price">;
  selection: LensSelection;
  shareUrl?: string | null;
  prescriptionAttached?: boolean;
  requestRef?: string | null;
  note?: string | null;
}): string {
  const { frame, selection: s } = opts;
  const frameOnly = s.usage?.code === "frame_only";
  const lines = [
    `مرحباً ${opts.storeName} 👋`,
    `حابب أستفسر عن النظارة دي:`,
    ``,
    `🕶️ الإطار: ${frame.name}${frame.sku ? ` (${frame.sku})` : ""}`,
    `💰 سعر الإطار: ${formatPrice(frame.price)}`,
  ];
  if (s.usage) lines.push(`👓 الاستخدام: ${s.usage.name}`);
  if (!frameOnly && s.index) lines.push(`🔬 سُمك العدسة: ${s.index.name}`);
  if (!frameOnly && s.coating) lines.push(`✨ الطبقة: ${s.coating.name}`);
  lines.push(`🧾 الإجمالي التقديري: ${formatPrice(lensTotal(frame.price, s))}`);
  if (opts.prescriptionAttached) lines.push(`📄 رفعت صورة الروشتة${opts.requestRef ? ` (طلب رقم ${opts.requestRef})` : ""}`);
  else if (opts.requestRef) lines.push(`🔖 رقم الطلب: ${opts.requestRef}`);
  if (opts.note) lines.push(``, `📝 ملاحظة: ${opts.note}`);
  if (opts.shareUrl) lines.push(``, `👀 شوف شكلي بالنظارة: ${opts.shareUrl}`);
  return lines.join("\n");
}

export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${normalizeWhatsapp(number)}?text=${encodeURIComponent(message)}`;
}
