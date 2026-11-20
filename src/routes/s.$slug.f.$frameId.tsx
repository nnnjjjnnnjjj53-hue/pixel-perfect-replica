import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Camera, ChevronRight, Sparkles } from "lucide-react";
import { storefrontQuery, loadFace, logEvent, type SavedFace } from "@/lib/storefront";
import { CATEGORY_LABELS, FACE_SHAPE_LABELS, FRAME_SHAPE_LABELS, KIND_LABELS, MATERIAL_LABELS, formatPrice } from "@/lib/eyewear";
import { scoreFrame } from "@/lib/recommend";
import { FrameThumb } from "@/components/store/FrameThumb";
import { LensConfigurator } from "@/components/store/LensConfigurator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$slug/f/$frameId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    const frame = data?.frames.find((f) => f.id === params.frameId);
    if (!data || !frame) throw notFound();
    return { name: frame.name, store: data.store.name, description: frame.description, image: frame.image_url ?? null };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} | ${loaderData.store}` : "نظارة";
    const desc = loaderData?.description || "جرّب الإطار ده على وشّك واختار العدسات المناسبة.";
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    return { meta };
  },
  component: FramePage,
});

function FramePage() {
  const { slug, frameId } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const frame = data?.frames.find((f) => f.id === frameId);
  const [face, setFace] = useState<SavedFace | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  useEffect(() => {
    setFace(loadFace());
    try {
      setShareId(sessionStorage.getItem(`adasa:share:${frameId}`));
    } catch {
      /* ignore */
    }
    if (data) logEvent(data.store.id, "view", frameId);
  }, [frameId, data]);

  if (!data || !frame) return null;
  const match = face ? scoreFrame(frame, face.shape, face.tone) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4">
      <Link to="/s/$slug" params={{ slug }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-4 w-4" /> كل النظارات
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-paper shadow-soft">
            <FrameThumb frame={frame} artClassName="w-3/4" />
          </div>
          <Button asChild variant="ink" size="xl" className="mt-4 w-full">
            <Link to="/s/$slug/try-on" params={{ slug }} search={{ frame: frame.id }}>
              <Camera /> جرّبها على وشّك 3D
            </Link>
          </Button>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            {KIND_LABELS[frame.kind]} · {CATEGORY_LABELS[frame.category]}{frame.sku ? ` · ${frame.sku}` : ""}
          </p>
          <h1 className="mt-1 text-4xl">{frame.name}</h1>
          <p className="mt-3 font-display text-2xl">{formatPrice(frame.price)}</p>
          {frame.description && <p className="mt-4 text-sm leading-7 text-muted-foreground">{frame.description}</p>}
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-muted p-3"><dt className="text-muted-foreground">الشكل</dt><dd className="mt-1 font-medium">{FRAME_SHAPE_LABELS[frame.shape]}</dd></div>
            <div className="rounded-xl bg-muted p-3"><dt className="text-muted-foreground">الخامة</dt><dd className="mt-1 font-medium">{MATERIAL_LABELS[frame.material]}</dd></div>
            <div className="rounded-xl bg-muted p-3">
              <dt className="text-muted-foreground">اللون</dt>
              <dd className="mt-1 flex justify-center"><span className="h-4 w-4 rounded-full border" style={{ backgroundColor: frame.frame_color }} /></dd>
            </div>
          </dl>
          {frame.suits_face_shapes.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              مناسبة للوجه: {frame.suits_face_shapes.map((s) => FACE_SHAPE_LABELS[s as keyof typeof FACE_SHAPE_LABELS] ?? s).join("، ")}
            </p>
          )}

          {match && (
            <div className="mt-6 rounded-2xl border border-brand/40 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl">{match.score}%</span>
                <span className="text-sm text-muted-foreground">تطابق مع وجهك ال{FACE_SHAPE_LABELS[face!.shape]}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {match.reasons.map((r) => (
                  <li key={r} className="flex gap-2"><Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-4 text-xl">اختار العدسات</h2>
            <LensConfigurator store={data.store} frame={frame} options={data.lensOptions} shareId={shareId} />
          </div>
        </div>
      </div>
    </main>
  );
}
