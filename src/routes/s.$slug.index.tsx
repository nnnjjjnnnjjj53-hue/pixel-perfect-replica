import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ScanFace, SlidersHorizontal, Sparkles } from "lucide-react";
import { storefrontQuery, loadFace, type SavedFace } from "@/lib/storefront";
import {
  CATEGORY_LABELS,
  FACE_SHAPE_LABELS,
  FRAME_SHAPE_LABELS,
  KIND_LABELS,
  MATERIAL_LABELS,
  formatPrice,
  type FrameCategory,
  type FrameKind,
  type FrameMaterial,
  type FrameShape,
} from "@/lib/eyewear";
import { scoreFrame } from "@/lib/recommend";
import { FrameThumb } from "@/components/store/FrameThumb";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/s/$slug/")({
  head: () => ({
    meta: [
      { title: "كتالوج النظارات | جرّب أونلاين" },
      { name: "description", content: "تصفح النظارات الطبية والشمسية، فلتر حسب الشكل والخامة والسعر، وجرّبها على وشّك." },
      { property: "og:title", content: "كتالوج النظارات" },
      { property: "og:description", content: "تصفح النظارات وجرّبها على وشّك بالكاميرا." },
    ],
  }),
  component: Catalog,
});

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Catalog() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const frames = data?.frames ?? [];
  const maxPrice = useMemo(() => Math.max(1000, ...frames.map((f) => f.price)), [frames]);
  const [category, setCategory] = useState<FrameCategory | "all">("all");
  const [kind, setKind] = useState<FrameKind | "all">("all");
  const [shape, setShape] = useState<FrameShape | "all">("all");
  const [material, setMaterial] = useState<FrameMaterial | "all">("all");
  const [price, setPrice] = useState<number>(maxPrice);
  const [sort, setSort] = useState<"match" | "low" | "high">("match");
  const [face, setFace] = useState<SavedFace | null>(null);

  useEffect(() => setFace(loadFace()), []);

  const list = useMemo(() => {
    const filtered = frames.filter(
      (f) =>
        (category === "all" || f.category === category || (f.category === "unisex" && category !== "kids")) &&
        (kind === "all" || f.kind === kind) &&
        (shape === "all" || f.shape === shape) &&
        (material === "all" || f.material === material) &&
        f.price <= price,
    );
    const withScore = filtered.map((f) => ({ frame: f, match: face ? scoreFrame(f, face.shape, face.tone) : null }));
    if (sort === "low") withScore.sort((a, b) => a.frame.price - b.frame.price);
    else if (sort === "high") withScore.sort((a, b) => b.frame.price - a.frame.price);
    else if (face) withScore.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
    return withScore;
  }, [frames, category, kind, shape, material, price, sort, face]);

  const shapes = [...new Set(frames.map((f) => f.shape))];
  const materials = [...new Set(frames.map((f) => f.material))];

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="pt-8">
        <h1 className="text-3xl leading-snug sm:text-4xl">{data?.store.name}</h1>
        {data?.store.tagline && <p className="mt-2 text-sm text-muted-foreground">{data.store.tagline}</p>}

        {face ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-brand/40 bg-card p-4 shadow-soft">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm leading-6">
              شكل وجهك <b>{FACE_SHAPE_LABELS[face.shape]}</b> — رتبنالك النظارات حسب نسبة التطابق.
            </p>
          </div>
        ) : (
          <Link
            to="/s/$slug/try-on"
            params={{ slug }}
            className="mt-6 flex items-center gap-4 rounded-2xl bg-ink-gradient p-5 text-ink-foreground shadow-lift"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <ScanFace className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg">اعرف شكل وجهك في ثواني</span>
              <span className="block text-xs text-ink-muted">افتح الكاميرا وجرّب النظارات 3D، وهنقولك أنسب موديلات ليك بنسبة تطابق.</span>
            </span>
          </Link>
        )}
      </section>

      <section className="sticky top-[57px] z-20 -mx-4 mt-6 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>الكل</Chip>
          {(["men", "women", "kids"] as const).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABELS[c]}</Chip>
          ))}
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          {(["optical", "sunglasses"] as const).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? "all" : k)}>{KIND_LABELS[k]}</Chip>
          ))}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 rounded-full">
                <SlidersHorizontal /> فلترة
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl" dir="rtl">
              <SheetHeader>
                <SheetTitle className="text-start">فلترة النظارات</SheetTitle>
              </SheetHeader>
              <div className="grid gap-6 px-4 pb-8">
                <div>
                  <p className="mb-3 text-sm font-medium">شكل الإطار</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={shape === "all"} onClick={() => setShape("all")}>الكل</Chip>
                    {shapes.map((s) => (
                      <Chip key={s} active={shape === s} onClick={() => setShape(s)}>{FRAME_SHAPE_LABELS[s]}</Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-sm font-medium">الخامة</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={material === "all"} onClick={() => setMaterial("all")}>الكل</Chip>
                    {materials.map((m) => (
                      <Chip key={m} active={material === m} onClick={() => setMaterial(m)}>{MATERIAL_LABELS[m]}</Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="font-medium">أقصى سعر</span>
                    <span className="text-muted-foreground">{formatPrice(price)}</span>
                  </div>
                  <Slider dir="rtl" min={0} max={maxPrice} step={50} value={[price]} onValueChange={(v) => setPrice(v[0] ?? maxPrice)} />
                </div>
                <div>
                  <p className="mb-3 text-sm font-medium">الترتيب</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={sort === "match"} onClick={() => setSort("match")}>{face ? "الأنسب لوجهك" : "المميز"}</Chip>
                    <Chip active={sort === "low"} onClick={() => setSort("low")}>الأقل سعراً</Chip>
                    <Chip active={sort === "high"} onClick={() => setSort("high")}>الأعلى سعراً</Chip>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {list.map(({ frame, match }) => (
          <Link
            key={frame.id}
            to="/s/$slug/f/$frameId"
            params={{ slug, frameId: frame.id }}
            className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift"
          >
            <div className="relative aspect-[4/3] bg-paper">
              <FrameThumb frame={frame} className="transition-transform duration-500 group-hover:scale-105" />
              {match && (
                <span className="absolute start-2 top-2 rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
                  {match.score}% تطابق
                </span>
              )}
              {frame.kind === "sunglasses" && (
                <span className="absolute end-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">شمسية</span>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium">{frame.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {FRAME_SHAPE_LABELS[frame.shape]} · {MATERIAL_LABELS[frame.material]}
              </p>
              <p className="mt-2 font-display text-lg">{formatPrice(frame.price)}</p>
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="col-span-full py-16 text-center text-muted-foreground">مفيش نظارات بالفلاتر دي.</p>}
      </section>
    </main>
  );
}
