// Auth middleware temporarily disabled for preview
// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";

export function middleware() {
  // Allow all requests through - auth disabled for preview
  return;
}

export const config = {
  matcher: [],
};
