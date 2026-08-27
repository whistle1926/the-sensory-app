import Link from "next/link";

/**
 * A course card in the Submarine style, for the public home page.
 *
 * Deliberately separate from the CourseCard used on /courses: only the
 * home page wears this treatment for now, and the catalogue shouldn't
 * change underneath people as a side effect.
 */
export interface SubCourse {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  shortDescription: string | null;
  duration: string;
  price: number;
  thumbnailUrl: string | null;
  heroImageUrl: string | null;
  isBestseller?: boolean;
  _count?: { modules: number };
}

export function SubmarineCourseCard({ course }: { course: SubCourse }) {
  const image = course.thumbnailUrl ?? course.heroImageUrl;
  const blurb = course.tagline ?? course.shortDescription ?? "";
  const modules = course._count?.modules ?? 0;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="sub-edge sub-press flex flex-col overflow-hidden rounded-[26px] bg-white"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b-[3px] border-[#12235B] bg-[#FFE9A8]">
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="sub-display flex h-full items-center justify-center text-2xl text-[#12235B]/50">
            {course.title.slice(0, 2)}
          </span>
        )}
        {course.isBestseller && (
          <span
            className="sub-edge absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider"
            style={{ background: "var(--sub-yellow)" }}
          >
            Most popular
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="sub-display text-[21px] leading-tight">{course.title}</p>
        {blurb && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-[#3D4A6B]">
            {blurb}
          </p>
        )}
        {/* Only the parts that exist — a course with no duration set was
            printing a stranded "·". */}
        <p className="mt-2 text-sm font-bold text-[#6B7794]">
          {[
            modules > 0 ? `${modules} module${modules === 1 ? "" : "s"}` : "",
            course.duration,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-4 flex items-baseline justify-between gap-3 border-t-2 border-[#F2E9DA] pt-4">
          <span className="sub-display text-2xl">
            {course.price === 0 ? "Free" : `£${course.price}`}
          </span>
          <span className="text-[15px] font-extrabold text-[#E71D57]">
            See the course →
          </span>
        </div>
      </div>
    </Link>
  );
}
