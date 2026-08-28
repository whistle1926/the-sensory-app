import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Runs on pages AND /api so the template-based area gating can block
  // restricted staff from sensitive data APIs too. Static assets and image
  // optimisation are excluded. /api routes still enforce their own auth —
  // middleware only adds the extra area gating on top.
  //
  // `brand` is excluded because it holds public logo assets: the storefront
  // header loads /brand/logo-mark.jpg and customer emails embed
  // /brand/logo.jpg, both fetched unauthenticated. Without this they redirect
  // to /login and the image comes back as the login page instead of a logo.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
