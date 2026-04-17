import Link from "next/link";
import { Clock, Users, ArrowRight } from "lucide-react";

export interface StorefrontCourse {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  shortDescription: string | null;
  description?: string;
  audience: string;
  duration: string;
  level: string | null;
  price: number;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  accreditationBadges?: string[];
  _count?: { modules?: number; enrollments?: number };
}

export function formatPrice(pence: number): string {
  if (!pence || pence === 0) return "Free";
  return `£${pence}`;
}

interface Props {
  course: StorefrontCourse;
  variant?: "standard" | "featured";
}

export function CourseCard({ course, variant = "standard" }: Props) {
  const image = course.thumbnailUrl ?? course.heroImageUrl;
  const blurb =
    course.shortDescription ?? course.tagline ?? course.description ?? "";
  const moduleCount = course._count?.modules ?? 0;
  const enrolledCount = course._count?.enrollments ?? 0;
  const featured = variant === "featured";

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
            <span className="text-3xl font-black text-primary/40">
              {course.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {course.isFeatured && (
            <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
              Featured
            </span>
          )}
          {course.isBestseller && (
            <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              Bestseller
            </span>
          )}
        </div>

        <div className="absolute right-3 top-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm ${
              course.price === 0
                ? "bg-green-500 text-white"
                : "bg-white/95 text-foreground"
            }`}
          >
            {formatPrice(course.price)}
          </span>
        </div>
      </div>

      <div className={`flex flex-1 flex-col p-5 ${featured ? "gap-3" : "gap-2"}`}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <span>{course.audience}</span>
          {course.level && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{course.level}</span>
            </>
          )}
        </div>

        <h3
          className={`font-bold tracking-tight ${
            featured ? "text-xl" : "text-lg"
          }`}
        >
          {course.title}
        </h3>

        {blurb && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{blurb}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {course.duration}
            </span>
            {moduleCount > 0 && (
              <span className="inline-flex items-center gap-1">
                {moduleCount} module{moduleCount === 1 ? "" : "s"}
              </span>
            )}
            {enrolledCount > 10 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {enrolledCount}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Learn more
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
