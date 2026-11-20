import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Frame, LensOption, PublicStore } from "./eyewear";

const STORE_COLUMNS = "id, slug, name, tagline, logo_path, brand_color, whatsapp_number, status";
const SIGNED_TTL = 60 * 60 * 24 * 7;

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Signed URLs are minted against the server URL; rewrite them to the browser-facing URL. */
function toPublicUrl(signed: string): string {
  const serverUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  const publicUrl = (import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  if (serverUrl && publicUrl && signed.startsWith(serverUrl)) return publicUrl + signed.slice(serverUrl.length);
  return signed;
}

async function signPaths(
  sb: ReturnType<typeof publicClient>,
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("http")))];
  const out: Record<string, string> = {};
  for (const p of paths) if (p && p.startsWith("http")) out[p] = p;
  if (list.length === 0) return out;
  const { data } = await sb.storage.from(bucket).createSignedUrls(list, SIGNED_TTL);
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = toPublicUrl(row.signedUrl);
  return out;
}

export interface Storefront {
  store: PublicStore;
  frames: Frame[];
  lensOptions: LensOption[];
}

export const getStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).toLowerCase().slice(0, 40) }))
  .handler(async ({ data }): Promise<Storefront | null> => {
    const sb = publicClient();
    const { data: store, error } = await sb.from("stores").select(STORE_COLUMNS).eq("slug", data.slug).maybeSingle();
    if (error) console.error("getStorefront", error);
    if (!store) return null;
    const [{ data: frames }, { data: lenses }] = await Promise.all([
      sb.from("frames").select("*").eq("store_id", store.id).order("created_at", { ascending: true }),
      sb.from("lens_options").select("id, step, code, name, description, price, sort_order").eq("store_id", store.id).order("sort_order"),
    ]);
    const signed = await signPaths(sb, "store-assets", [store.logo_path, ...(frames ?? []).flatMap((f) => [f.image_path, f.model_path])]);
    return {
      store: { ...store, logo_url: store.logo_path ? signed[store.logo_path] ?? null : null },
      frames: (frames ?? []).map((f) => ({
        ...(f as unknown as Frame),
        price: Number(f.price),
        image_url: f.image_path ? signed[f.image_path] ?? null : null,
        model_url: f.model_path ? signed[f.model_path] ?? null : null,
      })),
      lensOptions: (lenses ?? []).map((l) => ({ ...(l as unknown as LensOption), price: Number(l.price) })),
    };
  });

export interface ShareView {
  id: string;
  front_url: string | null;
  side_url: string | null;
  face_shape: string | null;
  customer_name: string | null;
  created_at: string;
  store: { slug: string; name: string; brand_color: string; whatsapp_number: string };
  frame: { id: string; name: string; sku: string; price: number; shape: string; frame_color: string; lens_tint: string | null; kind: string; image_url: string | null } | null;
  votes: Partial<Record<"love" | "good" | "another", number>>;
  comments: { name: string | null; comment: string; vote: string; created_at: string }[];
}

export const getShare = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => ({ id: String(input.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 24) }))
  .handler(async ({ data }): Promise<ShareView | null> => {
    const sb = publicClient();
    const { data: row, error } = await sb.rpc("get_tryon_share", { _id: data.id });
    if (error) console.error("getShare", error);
    if (!row) return null;
    const r = row as unknown as {
      id: string; front_path: string; side_path: string | null; face_shape: string | null; customer_name: string | null; created_at: string;
      store: ShareView["store"]; frame: (Omit<NonNullable<ShareView["frame"]>, "image_url"> & { image_path: string | null }) | null;
      votes: ShareView["votes"] | null; comments: ShareView["comments"] | null;
    };
    // Try-on photos are private; sign only this share's own photos with the privileged client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shots: Record<string, string> = {};
    const shotPaths = [r.front_path, r.side_path].filter((p): p is string => !!p);
    const { data: signedShots } = await supabaseAdmin.storage.from("tryon").createSignedUrls(shotPaths, SIGNED_TTL);
    for (const row of signedShots ?? []) if (row.path && row.signedUrl) shots[row.path] = toPublicUrl(row.signedUrl);
    const frameImg = r.frame?.image_path ? await signPaths(sb, "store-assets", [r.frame.image_path]) : {};
    return {
      id: r.id,
      front_url: shots[r.front_path] ?? null,
      side_url: r.side_path ? shots[r.side_path] ?? null : null,
      face_shape: r.face_shape,
      customer_name: r.customer_name,
      created_at: r.created_at,
      store: r.store,
      frame: r.frame
        ? { ...r.frame, price: Number(r.frame.price), image_url: r.frame.image_path ? frameImg[r.frame.image_path] ?? null : null }
        : null,
      votes: r.votes ?? {},
      comments: r.comments ?? [],
    };
  });

export interface PublicPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  currency: string;
  frame_limit: number;
  features: string[];
  is_featured: boolean;
}

export const getPublicPlans = createServerFn({ method: "GET" }).handler(async (): Promise<PublicPlan[]> => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("plans")
    .select("id, name, description, price_monthly, currency, frame_limit, features, is_featured")
    .eq("is_active", true)
    .order("sort_order");
  if (error) console.error("getPublicPlans", error);
  return (data ?? []).map((p) => ({ ...p, price_monthly: Number(p.price_monthly) }));
});
