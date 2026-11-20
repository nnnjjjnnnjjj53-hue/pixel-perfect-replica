import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Camera, Heart, MessageCircle, ThumbsUp, RotateCcw } from "lucide-react";
import { z } from "zod";
import { getShare, type ShareView } from "@/lib/public.functions";
import { FRAME_SHAPE_LABELS, KIND_LABELS, formatPrice } from "@/lib/eyewear";
import { FACE_SHAPE_LABELS } from "@/lib/eyewear";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { FrameThumb } from "@/components/store/FrameThumb";
import type { Frame } from "@/lib/eyewear";

const shareQuery = (id: string) =>
  queryOptions({
    queryKey: ["share", id],
    queryFn: () => getShare({ data: { id } }),
    staleTime: 30_000,
  });

const searchSchema = z.object({ voted: z.string().optional() });

export const Route = createFileRoute("/t/$shareId")({
  ssr: false,
  validateSearch: searchSchema,
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(shareQuery(params.shareId));
    if (!data) throw notFound();
    return null;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "شوف شكلي بالنظارة | عدسة" },
      { name: "description", content: "صورة تجربة النظارة الافتراضية — صوّت وشارك رأيك." },
      { property: "og:title", content: "تجربة نظارة افتراضية" },
      { property: "og:description", content: "شوف شكلي بالنظارة وقولي رأيك." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SharePage,
});

type VoteType = "love" | "good" | "another";
const VOTE_LABELS: Record<VoteType, string> = { love: "عجبتني جداً", good: "حلوة", another: "جرّب غيرها" };
const VOTE_ICONS: Record<VoteType, typeof Heart> = { love: Heart, good: ThumbsUp, another: RotateCcw };

function SharePage() {
  const { shareId } = Route.useParams();
  const search = Route.useSearch();
  const { data: share } = useSuspenseQuery(shareQuery(shareId));
  if (!share) return null;

  const totalVotes = Object.values(share.votes).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <BrandMark />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">الرئيسية</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="overflow-hidden rounded-3xl border bg-card shadow-soft">
          {/* Photos */}
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {share.front_url && (
              <div className="aspect-[3/4] bg-muted">
                <img src={share.front_url} alt="صورة بالنظارة من الأمام" className="h-full w-full object-cover" />
              </div>
            )}
            {share.side_url && (
              <div className="aspect-[3/4] bg-muted">
                <img src={share.side_url} alt="صورة بالنظارة من الجنب" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div className="p-5">
            {share.face_shape && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-primary">
                <Camera className="h-3 w-3" /> شكل الوجه: {FACE_SHAPE_LABELS[share.face_shape as keyof typeof FACE_SHAPE_LABELS] ?? share.face_shape}
              </span>
            )}

            {share.frame && (
              <div className="mt-4 flex items-center gap-4">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <FrameThumb frame={{ ...share.frame, store_id: "", sku: share.frame.sku, description: "", category: "unisex", material: "acetate", frame_color: share.frame.frame_color, lens_tint: share.frame.lens_tint, image_path: null, model_path: null, suits_face_shapes: [], is_active: true, price: share.frame.price } as Frame} className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{share.frame.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABELS[share.frame.kind as keyof typeof KIND_LABELS] ?? share.frame.kind} · {FRAME_SHAPE_LABELS[share.frame.shape as keyof typeof FRAME_SHAPE_LABELS] ?? share.frame.shape}
                  </p>
                  <p className="mt-1 font-display text-lg">{formatPrice(share.frame.price)}</p>
                </div>
              </div>
            )}

            {/* Votes */}
            <div className="mt-6">
              <p className="mb-3 text-sm font-medium">قول رأيك</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(VOTE_LABELS) as VoteType[]).map((vt) => {
                  const Icon = VOTE_ICONS[vt];
                  const count = share.votes[vt] ?? 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const voted = search.voted === vt;
                  return (
                    <Button
                      key={vt}
                      variant={voted ? "ink" : "outline"}
                      size="sm"
                      className="rounded-full"
                      asChild
                    >
                      <Link to="/t/$shareId" params={{ shareId }} search={{ voted: vt }}>
                        <Icon className="h-4 w-4" /> {VOTE_LABELS[vt]} {count > 0 && `(${count})`}
                      </Link>
                    </Button>
                  );
                })}
              </div>
              {totalVotes > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{totalVotes} صوت</p>
              )}
            </div>

            {/* Comments */}
            {share.comments.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-medium">التعليقات</p>
                <ul className="space-y-3">
                  {share.comments.map((c, i) => (
                    <li key={i} className="rounded-xl border bg-background p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{c.name ?? "زائر"}</span>
                        {c.vote && <span className="text-xs text-muted-foreground">{VOTE_LABELS[c.vote as VoteType] ?? c.vote}</span>}
                      </div>
                      {c.comment && <p className="mt-1 text-muted-foreground">{c.comment}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {share.store.whatsapp_number && (
              <a
                href={`https://wa.me/${share.store.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[var(--whatsapp)] px-6 py-3 text-sm font-medium text-[var(--whatsapp-foreground)]"
              >
                <MessageCircle className="h-4 w-4" /> راسل {share.store.name}
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
