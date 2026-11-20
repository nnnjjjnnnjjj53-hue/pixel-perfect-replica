import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** The Adasa wordmark: two linked lenses + Arabic name. */
export function BrandMark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 48 24" className="h-6 w-12" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--gold)" strokeWidth="2.6" />
        <circle cx="36" cy="12" r="9" fill="none" stroke="var(--gold)" strokeWidth="2.6" />
        <path d="M21 10 Q24 7 27 10" fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className={cn("font-display text-2xl leading-none", tone === "light" ? "text-ink-foreground" : "text-foreground")}>
        عدسة
      </span>
    </Link>
  );
}
