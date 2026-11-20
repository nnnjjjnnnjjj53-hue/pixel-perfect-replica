import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { storefrontQuery, brandVars } from "@/lib/storefront";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name, tagline: data.store.tagline };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} | جرّب نظارتك أونلاين` : "متجر نظارات | عدسة" },
      { name: "description", content: loaderData?.tagline || "جرّب النظارات على وشّك بالكاميرا واعرف أنسب إطار لشكل وجهك." },
      { property: "og:title", content: loaderData ? `${loaderData.name} — تجربة النظارات الافتراضية` : "متجر نظارات" },
      { property: "og:description", content: "جرّب النظارات على وشّك بالكاميرا واعرف أنسب إطار لشكل وجهك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreLayout,
});

function StoreLayout() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  if (!data) return null;
  const { store } = data;
  return (
    <div className="min-h-screen bg-background" style={brandVars(store.brand_color)}>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/s/$slug" params={{ slug }} className="flex min-w-0 items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-display text-lg text-brand-foreground">
                {store.name.slice(0, 1)}
              </span>
            )}
            <span className="truncate font-display text-lg">{store.name}</span>
          </Link>
          <Button asChild variant="brand" size="sm" className="rounded-full px-4">
            <Link to="/s/$slug/try-on" params={{ slug }}>
              <Camera /> جرّب بالكاميرا
            </Link>
          </Button>
        </div>
      </header>
      <Outlet />
      <footer className="mt-16 border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-xs text-muted-foreground">
          <span>{store.name}</span>
          <a href="/" className="hover:text-foreground">مدعوم بمنصة عدسة</a>
        </div>
      </footer>
    </div>
  );
}
