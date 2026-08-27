import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * The storefront footer, in one place so every public page ends the same
 * way. Reads the Storefront toggles itself, so a link that's been switched
 * off in Settings can't survive in the footer of a page that forgot to ask.
 */
export async function SubmarineFooter() {
  const config = await prisma.storefrontConfig
    .findUnique({
      where: { id: "default" },
      select: { showCoursesNav: true, showSignIn: true, showCreateAccount: true },
    })
    .catch(() => null);

  const showCourses = config?.showCoursesNav ?? true;
  const showSignIn = config?.showSignIn ?? true;
  const showCreateAccount = config?.showCreateAccount ?? true;

  return (
    <footer className="border-t-2 border-[#F2E4CD] px-5 py-8 sm:px-10">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 text-[15px] font-bold text-[#6B7794]">
        <p>© {new Date().getFullYear()} The Sensory Submarine</p>
        <div className="flex flex-wrap items-center gap-5">
          {showCourses && (
            <Link href="/courses" className="hover:text-[#12235B]">
              Courses
            </Link>
          )}
          <Link href="/book" className="hover:text-[#12235B]">
            Book a session
          </Link>
          <Link href="/resources" className="hover:text-[#12235B]">
            Free resources
          </Link>
          {showSignIn && (
            <Link href="/login" className="hover:text-[#12235B]">
              Sign in
            </Link>
          )}
          {showCreateAccount && (
            <Link href="/register" className="hover:text-[#12235B]">
              Create account
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
