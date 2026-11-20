import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { storefrontQuery, brandVars } from "@/lib/storefront";
import { TryOnViewer } from "@/components/tryon/TryOnViewer";

export const Route = createFileRoute("/s/$slug/try-on")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ frame: typeof search.frame === "string" ? search.frame : undefined }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `تجربة النظارات بالكاميرا | ${loaderData.name}` : "تجربة النظارات بالكاميرا" },
      { name: "description", content: "البس النظارة على وشّك بالكاميرا، وحلّل شكل وجهك واعرف أنسب موديل." },
      { property: "og:title", content: "تجربة النظارات الافتراضية 3D" },
      { property: "og:description", content: "جرّب النظارات بالكاميرا واعرف نسبة التطابق مع شكل وجهك." },
    ],
  }),
  component: TryOnPage,
});

function TryOnPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  if (!data) return null;
  const { store, frames } = data;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4">
      <Link to="/s/$slug" params={{ slug }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-4 w-4" /> كل النظارات
      </Link>
      <h1 className="mt-3 text-2xl sm:text-3xl">جرّب النظارات بالكاميرا</h1>
      <p className="mt-1 text-sm text-muted-foreground">البس النظارة افتراضياً، وحلّل شكل وجهك للحصول على توصيات.</p>
      <div className="mt-6 rounded-3xl border bg-background p-4 sm:p-6" style={brandVars(store.brand_color)}>
        <TryOnViewer storeId={store.id} frames={frames} initialFrameId={search.frame} />
      </div>
    </main>
  );
}
