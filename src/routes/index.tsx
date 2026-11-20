import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Camera, Check, MessageCircle, ScanFace, Share2, Sparkles, Store, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { FrameArt } from "@/components/FrameArt";
import { getPublicPlans } from "@/lib/public.functions";
import { formatPrice } from "@/lib/eyewear";
import heroImg from "@/assets/hero-glasses.jpg";

const plansQuery = queryOptions({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "عدسة | متجر نظارات إلكتروني بتجربة افتراضية ثلاثية الأبعاد" },
      { name: "description", content: "اعمل متجر نظارات أونلاين لمحلك: تجربة النظارات بالكاميرا، تحليل شكل الوجه، نسبة التطابق، واستفسار واتساب مباشر. اشتراك شهري." },
      { property: "og:title", content: "عدسة | خلّي عملاءك يجرّبوا النظارة من موبايلهم" },
      { property: "og:description", content: "تجربة افتراضية ثلاثية الأبعاد، تحليل شكل الوجه، وتوصيات بنسبة تطابق لمحلات النظارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQuery),
  component: Landing,
});

const FEATURES = [
  { icon: Camera, title: "تجربة ثلاثية الأبعاد بالكاميرا", body: "العميل يلبس النظارة على وشّه مباشرة، من الأمام والجنب، والنظارة بتتحرك مع حركة راسه." },
  { icon: ScanFace, title: "تحليل شكل الوجه ولون البشرة", body: "الذكاء الاصطناعي بيحدد شكل الوجه (بيضاوي، دائري، مربع، قلب، ماسي) ودرجة البشرة." },
  { icon: Sparkles, title: "نسبة تطابق مع أسباب واضحة", body: "كل نظارة بتاخد نسبة زي 95% مع سبب مفهوم: «الإطار المربع بيوازن استدارة وجهك»." },
  { icon: Share2, title: "شارك واسأل صحابك", body: "رابط خاص بصورة العميل من الأمام والجنب، وصحابه يصوّتوا: عجبني، حلوة، جرّب غيرها." },
  { icon: MessageCircle, title: "عدسات + واتساب في خطوة", body: "اختيار نوع وسُمك العدسة ورفع الروشتة، ورسالة واتساب جاهزة توصلك بكل التفاصيل." },
  { icon: BarChart3, title: "لوحة تحكم وإحصائيات", body: "أضف نظاراتك وأسعارك، غيّر ألوان متجرك، وشوف أكتر الموديلات تجربة وطلباً." },
];

function Landing() {
  const { data: plans } = useSuspenseQuery(plansQuery);
  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <BrandMark tone="light" />
          <nav className="hidden items-center gap-8 text-sm text-ink-muted md:flex">
            <a href="#features" className="hover:text-ink-foreground">المميزات</a>
            <a href="#how" className="hover:text-ink-foreground">إزاي بتشتغل</a>
            <a href="#pricing" className="hover:text-ink-foreground">الأسعار</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="glass" size="sm" className="rounded-full px-4">
              <Link to="/auth">دخول</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={heroImg} alt="نظارة طبية فاخرة على قاعدة من الحجر" className="absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/10 via-ink/70 to-ink md:bg-gradient-to-l md:from-transparent md:via-ink/50 md:to-ink" />
        <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-end px-5 pb-16 pt-32 md:justify-center md:pb-24">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-ink/40 px-3 py-1 text-xs text-gold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> منصة متاجر النظارات الذكية
            </span>
            <h1 className="mt-5 text-4xl leading-[1.25] sm:text-5xl md:text-6xl">
              خلّي عملاءك <span className="text-gold-gradient">يلبسوا النظارة</span> قبل ما يدخلوا المحل
            </h1>
            <p className="mt-5 max-w-md text-base leading-8 text-ink-muted">
              متجر إلكتروني لمحل النظارات بتاعك، فيه تجربة افتراضية ثلاثية الأبعاد بالكاميرا، تحليل لشكل الوجه، وتوصيات بنسبة تطابق — وكل طلب يوصلك على واتساب.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="gold" size="xl">
                <Link to="/s/$slug/try-on" params={{ slug: "demo" }}>
                  <Camera /> جرّب النظارات على وشّك
                </Link>
              </Button>
              <Button asChild variant="glass" size="xl">
                <Link to="/auth" search={{ mode: "signup" }}>
                  <Store /> أنشئ متجرك مجاناً
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-ink-muted">تجربة مجانية 14 يوم · بدون بطاقة ائتمان</p>
          </div>
        </div>
      </section>

      {/* MATCH PREVIEW STRIP */}
      <section className="relative z-10 -mt-10 px-5">
        <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-3">
          {[
            { name: "ليوناردو", shape: "square" as const, color: "#2a1a12", score: 96, reason: "يوازن استدارة الوجه" },
            { name: "أتلس", shape: "round" as const, color: "#c9a45c", score: 91, reason: "يلطّف زوايا الفك" },
            { name: "فالكون", shape: "aviator" as const, color: "#b08d57", score: 88, reason: "متناغم مع بشرتك الدافئة", tint: "#3d4a3a" },
          ].map((m) => (
            <div key={m.name} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-muted">
                <FrameArt shape={m.shape} color={m.color} tint={m.tint ?? null} className="w-20" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl text-foreground">{m.score}%</span>
                  <span className="text-xs text-muted-foreground">تطابق</span>
                </div>
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-gold">كل اللي محلك محتاجه أونلاين</p>
          <h2 className="mt-3 text-3xl leading-snug md:text-4xl">تجربة شراء نظارة زي ما تكون في المحل، وأحسن</h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="bg-ink-gradient text-ink-foreground">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="text-3xl md:text-4xl">3 خطوات ومحلك يبقى أونلاين</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              ["01", "سجّل محلك", "اختار اسم ولينك متجرك (adasa.app/s/اسم-محلك) ورقم الواتساب."],
              ["02", "ارفع نظاراتك", "أضف الموديلات والأسعار وحدد كل إطار يناسب أنهي شكل وجه."],
              ["03", "شارك اللينك", "حطه في الإنستجرام والفيسبوك، والطلبات توصلك على واتساب جاهزة."],
            ].map(([n, t, b]) => (
              <div key={n}>
                <span className="font-display text-5xl text-gold-gradient">{n}</span>
                <div className="mt-4 hairline" />
                <h3 className="mt-5 text-xl">{t}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24">
        <div className="text-center">
          <p className="text-sm font-medium text-gold">اشتراك شهري بسيط</p>
          <h2 className="mt-3 text-3xl md:text-4xl">اختار الباقة المناسبة لمحلك</h2>
          <p className="mt-3 text-sm text-muted-foreground">الدفع بفودافون كاش أو إنستاباي أو تحويل بنكي</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className={
                p.is_featured
                  ? "relative rounded-3xl bg-ink p-7 text-ink-foreground shadow-lift"
                  : "relative rounded-3xl border bg-card p-7 shadow-soft"
              }
            >
              {p.is_featured && (
                <span className="absolute -top-3 start-7 rounded-full bg-gold-gradient px-3 py-1 text-xs font-medium text-gold-foreground">الأكثر طلباً</span>
              )}
              <h3 className="text-xl">{p.name}</h3>
              <p className={p.is_featured ? "mt-1 text-sm text-ink-muted" : "mt-1 text-sm text-muted-foreground"}>{p.description}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-4xl">{formatPrice(p.price_monthly)}</span>
                <span className={p.is_featured ? "text-sm text-ink-muted" : "text-sm text-muted-foreground"}>/ شهرياً</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant={p.is_featured ? "gold" : "ink"} size="lg" className="mt-8 w-full">
                <Link to="/auth" search={{ mode: "signup" }}>ابدأ التجربة المجانية</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[2rem] bg-gold-gradient px-6 py-14 text-center text-gold-foreground">
          <h2 className="text-3xl md:text-4xl">شوف بنفسك قبل ما تشترك</h2>
          <p className="max-w-md text-sm leading-7">افتح المتجر التجريبي وجرّب النظارات على وشّك بالكاميرا — نفس التجربة اللي عملائك هيشوفوها.</p>
          <Button asChild variant="ink" size="xl">
            <Link to="/s/$slug" params={{ slug: "demo" }}>افتح المتجر التجريبي</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <BrandMark />
          <p>© {new Date().getFullYear()} عدسة — منصة متاجر النظارات</p>
        </div>
      </footer>
    </div>
  );
}
