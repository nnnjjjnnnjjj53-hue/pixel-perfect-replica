// Browser helpers for private storage buckets (signed URLs).
import { supabase } from "@/integrations/supabase/client";

export async function signedUrl(bucket: string, path: string | null | undefined, ttl = 60 * 60 * 24) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

export async function signedUrls(bucket: string, paths: (string | null | undefined)[], ttl = 60 * 60 * 24) {
  const list = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("http")))];
  const out: Record<string, string> = {};
  if (!list.length) return out;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, ttl);
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
}

export function randomId(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function fileExt(file: File) {
  const m = file.name.match(/\.([a-zA-Z0-9]{1,6})$/);
  return (m?.[1] ?? "bin").toLowerCase();
}
