"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  Loader2,
  PlayCircle,
  Quote,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";

interface Testimonial {
  quote?: string;
  author?: string;
  role?: string;
}

interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  shortDescription: string | null;
  description: string;
  audience: string;
  duration: string;
  level: string | null;
  price: number;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  features: string[];
  accreditationBadges: string[];
  instructorName: string | null;
  instructorRole: string | null;
  instructorBio: string | null;
  instructorImageUrl: string | null;
  testimonials: Testimonial[];
  isBestseller: boolean;
  _count: { enrollments: number };
  modules: { id: string; title: string; order: number; hasVideo: boolean }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  // Shown in the footer CTA — different copy for free vs paid vs enrolled.
  primaryAction: {
    label: string;
    onClick?: () => void;
    href?: string;
    loading?: boolean;
  };
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/**
 * Rich course-info modal used from the portal training catalogue.
 *
 * Fetches the public course detail (already built for the storefront) and
 * renders a warm, scannable preview — hero art, tagline, what you'll
 * learn, modules, instructor, testimonials, accreditation — so a signed-in
 * buyer can decide before committing, without leaving the portal.
 *
 * The primaryAction prop keeps the caller in charge of what "buy" means
 * (start free, kick off checkout, continue enrolled, etc.) — this dialog
 * is presentational only.
 */
export function CourseInfoDialog({ open, onOpenChange, slug, primaryAction }: Props) {
  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    // Only fetch when the dialog is actually open. Clear stale state on close.
    setLoading(true);
    setError("");
    setData(null);
    fetch(`/api/courses/public/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load course details");
        return r.json();
      })
      .then((payload: CourseDetail) => setData(payload))
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? e.message
            : "Could not load course details right now.",
        );
      })
      .finally(() => setLoading(false));
  }, [open, slug]);

  const hero =
    data?.heroImageUrl ?? data?.thumbnailUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:!max-w-[760px] !p-0 overflow-hidden"
        // The dialog has its own scroll region; prevent the outer to avoid
        // body-jank on iOS.
      >
        <div className="max-h-[85vh] overflow-y-auto">
          {loading && (
            <div className="flex h-[60vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !loading && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{data.title}</DialogTitle>
              </DialogHeader>

              {/* Hero image */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-primary/15 to-primary/40">
                {hero ? (
                  <Image
                    src={hero}
                    alt={data.title}
                    fill
                    sizes="760px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-6xl font-black text-primary/40">
                    {data.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                  {data.isBestseller && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                      <Star className="h-3 w-3 fill-white" />
                      Bestseller
                    </span>
                  )}
                  {data.level && (
                    <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-foreground shadow-sm backdrop-blur">
                      {data.level}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="space-y-8 p-7">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
                    {data.audience}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight leading-tight">
                    {data.title}
                  </h2>
                  {data.tagline && (
                    <p className="mt-2 text-base font-medium text-primary">
                      {data.tagline}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {data.duration}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" />
                      {data.modules.length} module
                      {data.modules.length === 1 ? "" : "s"}
                    </span>
                    {data._count.enrollments >= 5 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {data._count.enrollments} enrolled
                      </span>
                    )}
                  </div>
                </div>

                {data.description && (
                  <section>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      About this course
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
                      {data.description}
                    </p>
                  </section>
                )}

                {data.features.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      What you&apos;ll learn
                    </h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {data.features.map((f, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-sm"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <Check className="h-3 w-3" />
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {data.modules.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground inline-flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      Curriculum
                    </h3>
                    <ol className="mt-3 space-y-2">
                      {data.modules.map((m, i) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="flex-1 font-medium">{m.title}</span>
                          {m.hasVideo && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <PlayCircle className="h-3.5 w-3.5" />
                              Video
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {data.instructorName && (
                  <section>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Your instructor
                    </h3>
                    <div className="mt-3 flex gap-4 rounded-2xl border border-border bg-card p-4">
                      {data.instructorImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={data.instructorImageUrl}
                          alt={data.instructorName}
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                          {data.instructorName.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold">
                          {data.instructorName}
                        </p>
                        {data.instructorRole && (
                          <p className="mt-0.5 text-xs font-medium text-primary">
                            {data.instructorRole}
                          </p>
                        )}
                        {data.instructorBio && (
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">
                            {data.instructorBio}
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {data.testimonials.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      What learners say
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {data.testimonials.slice(0, 4).map((t, i) => (
                        <blockquote
                          key={i}
                          className="rounded-2xl border border-border bg-card p-4"
                        >
                          <Quote className="h-4 w-4 text-primary/40" />
                          <p className="mt-1.5 text-xs leading-relaxed">
                            {t.quote ?? ""}
                          </p>
                          {(t.author || t.role) && (
                            <footer className="mt-2 text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {t.author ?? "Anonymous"}
                              </span>
                              {t.role && <span> — {t.role}</span>}
                            </footer>
                          )}
                        </blockquote>
                      ))}
                    </div>
                  </section>
                )}

                {data.accreditationBadges.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground inline-flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                      Accreditation
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      {data.accreditationBadges.map((url, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="h-12 w-auto opacity-80"
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          )}

          {/* Sticky footer with primary CTA */}
          {data && !loading && (
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-4 backdrop-blur">
              <div className="text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {data.price === 0 ? "Free course" : "One-time purchase"}
                </p>
                <p className="text-xl font-black">
                  {data.price === 0 ? "Free" : gbp.format(data.price)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                {primaryAction.href ? (
                  <a href={primaryAction.href} className={buttonVariants()}>
                    <GraduationCap className="mr-1.5 h-4 w-4" />
                    {primaryAction.label}
                  </a>
                ) : (
                  <Button
                    onClick={() => primaryAction.onClick?.()}
                    disabled={primaryAction.loading}
                  >
                    {primaryAction.loading ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Award className="mr-1.5 h-4 w-4" />
                    )}
                    {primaryAction.label}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
