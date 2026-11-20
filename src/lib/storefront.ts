import { queryOptions } from "@tanstack/react-query";
import { getStorefront } from "./public.functions";
import { supabase } from "@/integrations/supabase/client";
import type { FaceShape } from "./eyewear";
import type { SkinTone } from "./face-analysis";

export const storefrontQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug],
    queryFn: () => getStorefront({ data: { slug } }),
    staleTime: 60_000,
  });

export type StoreEvent = "view" | "try_on" | "share" | "whatsapp" | "face_scan";

export function logEvent(storeId: string, event: StoreEvent, frameId?: string | null, faceShape?: string | null) {
  void supabase
    .from("tryon_events")
    .insert({ store_id: storeId, event, frame_id: frameId ?? null, face_shape: faceShape ?? null })
    .then(({ error }) => {
      if (error) console.warn("event log failed", error.message);
    });
}

export interface SavedFace {
  shape: FaceShape;
  tone: SkinTone | null;
  confidence: number;
}
const FACE_KEY = "adasa:face";
export function saveFace(face: SavedFace) {
  try {
    sessionStorage.setItem(FACE_KEY, JSON.stringify(face));
  } catch {
    /* ignore */
  }
}
export function loadFace(): SavedFace | null {
  try {
    const raw = sessionStorage.getItem(FACE_KEY);
    return raw ? (JSON.parse(raw) as SavedFace) : null;
  } catch {
    return null;
  }
}

/** Pick readable text on top of a hex brand color. */
export function brandVars(hex: string): Record<string, string> {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0"), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { "--brand": hex, "--brand-foreground": lum > 0.6 ? "var(--ink)" : "var(--ink-foreground)" };
}
